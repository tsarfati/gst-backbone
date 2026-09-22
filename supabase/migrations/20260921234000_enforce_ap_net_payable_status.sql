-- Prevent stale clients from changing a paid-net-of-retainage invoice back to
-- pending_payment by comparing payments with the gross invoice amount.

CREATE OR REPLACE FUNCTION public.enforce_ap_invoice_net_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid numeric;
  v_payable numeric;
BEGIN
  IF COALESCE(NEW.retainage_amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('approved', 'pending_payment', 'paid') THEN
    RETURN NEW;
  END IF;

  v_paid := public.ap_effective_paid_for_invoice(NEW.id);
  IF v_paid <= 0 THEN
    RETURN NEW;
  END IF;

  v_payable := GREATEST(
    0::numeric,
    COALESCE(NEW.amount, 0)
      - GREATEST(
          0::numeric,
          COALESCE(NEW.retainage_amount, 0) - COALESCE(NEW.retainage_released_amount, 0)
        )
  );

  NEW.status := CASE
    WHEN v_paid >= v_payable - 0.01 THEN 'paid'
    ELSE 'pending_payment'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ap_invoice_net_payment_status_trigger ON public.invoices;
CREATE TRIGGER enforce_ap_invoice_net_payment_status_trigger
  BEFORE UPDATE OF status, amount, retainage_amount, retainage_released_amount
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ap_invoice_net_payment_status();

-- Reapply the repair after installing the guard.
DO $$
DECLARE
  invoice_row record;
BEGIN
  FOR invoice_row IN
    SELECT DISTINCT i.id
    FROM public.invoices i
    JOIN public.payment_invoice_lines pil ON pil.invoice_id = i.id
    WHERE i.status IN ('approved', 'pending_payment', 'paid')
      AND COALESCE(i.retainage_amount, 0) > 0
  LOOP
    PERFORM public.sync_ap_invoice_payment_status(invoice_row.id);
  END LOOP;
END;
$$;
