-- Keep held retainage out of the bill's current payable balance until it is
-- explicitly released. A release re-opens the original bill for only the
-- retained amount, preserving the original gross invoice and payment history.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS retainage_released_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainage_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS retainage_released_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS retainage_release_due_date date;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_retainage_released_amount_nonnegative;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_retainage_released_amount_nonnegative
  CHECK (retainage_released_amount >= 0);

COMMENT ON COLUMN public.invoices.retainage_released_amount IS
  'Portion of retainage_amount that has been released and is currently payable.';
COMMENT ON COLUMN public.invoices.retainage_release_due_date IS
  'Due date for a released retainage balance; the original invoice due date is preserved.';

-- An AP invoice should post its invoice journal entry only when it first enters
-- the payable workflow. Later paid/retainage transitions must not post the gross
-- invoice a second time.
DROP TRIGGER IF EXISTS create_invoice_journal_entry_trigger ON public.invoices;
CREATE TRIGGER create_invoice_journal_entry_trigger
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  WHEN (
    OLD.status NOT IN ('pending_payment', 'paid')
    AND NEW.status IN ('pending_payment', 'paid')
  )
  EXECUTE FUNCTION public.create_invoice_journal_entry();

CREATE OR REPLACE FUNCTION public.ap_effective_paid_for_invoice(p_invoice_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    COALESCE(target_line.amount_paid, 0) *
    CASE
      WHEN COALESCE(payment_totals.line_total, 0) > COALESCE(p.amount, 0) + 0.01
        AND COALESCE(p.amount, 0) > 0
      THEN p.amount / payment_totals.line_total
      ELSE 1
    END
  ), 0)::numeric
  FROM public.payment_invoice_lines target_line
  JOIN public.payments p ON p.id = target_line.payment_id
  JOIN LATERAL (
    SELECT COALESCE(SUM(all_lines.amount_paid), 0)::numeric AS line_total
    FROM public.payment_invoice_lines all_lines
    WHERE all_lines.payment_id = target_line.payment_id
  ) payment_totals ON true
  WHERE target_line.invoice_id = p_invoice_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_ap_invoice_payment_status(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_paid numeric;
  v_payable numeric;
  v_next_status text;
BEGIN
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND OR v_invoice.status NOT IN ('approved', 'pending_payment', 'paid') THEN
    RETURN;
  END IF;

  v_paid := public.ap_effective_paid_for_invoice(p_invoice_id);
  v_payable := GREATEST(
    0::numeric,
    COALESCE(v_invoice.amount, 0)
      - GREATEST(
          0::numeric,
          COALESCE(v_invoice.retainage_amount, 0) - COALESCE(v_invoice.retainage_released_amount, 0)
        )
  );
  v_next_status := CASE WHEN v_paid >= v_payable - 0.01 THEN 'paid' ELSE 'pending_payment' END;

  IF v_invoice.status IS DISTINCT FROM v_next_status THEN
    UPDATE public.invoices SET status = v_next_status, updated_at = now() WHERE id = p_invoice_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_ap_invoice_status_from_payment_line()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.invoice_id IS NOT NULL THEN
    PERFORM public.sync_ap_invoice_payment_status(OLD.invoice_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.invoice_id IS NOT NULL THEN
    PERFORM public.sync_ap_invoice_payment_status(NEW.invoice_id);
  END IF;

  FOR v_invoice_id IN
    SELECT DISTINCT pil.invoice_id
    FROM public.payment_invoice_lines pil
    WHERE pil.payment_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.payment_id ELSE NEW.payment_id END
  LOOP
    PERFORM public.sync_ap_invoice_payment_status(v_invoice_id);
  END LOOP;

  IF TG_OP = 'UPDATE' AND OLD.payment_id IS DISTINCT FROM NEW.payment_id THEN
    FOR v_invoice_id IN
      SELECT DISTINCT pil.invoice_id
      FROM public.payment_invoice_lines pil
      WHERE pil.payment_id = OLD.payment_id
    LOOP
      PERFORM public.sync_ap_invoice_payment_status(v_invoice_id);
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_ap_invoice_status_from_payment_line_trigger ON public.payment_invoice_lines;
CREATE TRIGGER sync_ap_invoice_status_from_payment_line_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.sync_ap_invoice_status_from_payment_line();

-- Repair existing paid-net-of-retainage invoices (including historical rows
-- such as TDK's Sigma 115 draws) when this migration is applied.
DO $$
DECLARE
  invoice_row record;
BEGIN
  FOR invoice_row IN
    SELECT DISTINCT i.id
    FROM public.invoices i
    JOIN public.payment_invoice_lines pil ON pil.invoice_id = i.id
    WHERE i.status IN ('approved', 'pending_payment', 'paid')
  LOOP
    PERFORM public.sync_ap_invoice_payment_status(invoice_row.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_subcontract_retainage(
  p_subcontract_id uuid,
  p_due_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(updated_invoice_count integer, released_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_role text;
BEGIN
  SELECT j.company_id
  INTO v_company_id
  FROM public.subcontracts s
  JOIN public.jobs j ON j.id = s.job_id
  WHERE s.id = p_subcontract_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Commitment not found';
  END IF;

  SELECT p.role::text
  INTO v_role
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.current_company_id = v_company_id;

  IF v_role IS NULL OR v_role NOT IN ('admin', 'controller', 'company_admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'You do not have permission to release retainage';
  END IF;

  RETURN QUERY
  WITH releasable AS (
    SELECT
      i.id,
      GREATEST(
        0::numeric,
        COALESCE(i.retainage_amount, 0) - COALESCE(i.retainage_released_amount, 0)
      ) AS amount_to_release
    FROM public.invoices i
    WHERE i.subcontract_id = p_subcontract_id
      AND i.status IN ('approved', 'pending_payment', 'paid')
      AND COALESCE(i.retainage_amount, 0) > COALESCE(i.retainage_released_amount, 0)
  ), updated AS (
    UPDATE public.invoices i
    SET
      retainage_released_amount = COALESCE(i.retainage_amount, 0),
      retainage_released_at = now(),
      retainage_released_by = auth.uid(),
      retainage_release_due_date = COALESCE(p_due_date, CURRENT_DATE),
      status = CASE
        WHEN public.ap_effective_paid_for_invoice(i.id) >= COALESCE(i.amount, 0) - 0.01 THEN 'paid'
        ELSE 'pending_payment'
      END,
      updated_at = now()
    FROM releasable r
    WHERE i.id = r.id
    RETURNING r.amount_to_release
  )
  SELECT COUNT(*)::integer, COALESCE(SUM(updated.amount_to_release), 0)::numeric
  FROM updated;
END;
$$;

REVOKE ALL ON FUNCTION public.release_subcontract_retainage(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_subcontract_retainage(uuid, date) TO authenticated;
