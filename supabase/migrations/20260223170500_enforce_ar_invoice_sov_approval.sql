-- Require an approved Schedule of Values before creating a job draw invoice (AIA application).
-- We key off job_id + application_number because AddARInvoice inserts draw invoices into ar_invoices.

CREATE OR REPLACE FUNCTION public.enforce_ar_invoice_sov_approval_for_draws()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  active_sov_count INTEGER := 0;
  approved_sov_count INTEGER := 0;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Only enforce for job-linked draw invoices (AIA applications).
  IF NEW.job_id IS NULL OR COALESCE(NEW.application_number, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE workflow_status = 'approved')::INTEGER
  INTO active_sov_count, approved_sov_count
  FROM public.schedule_of_values
  WHERE company_id = NEW.company_id
    AND job_id = NEW.job_id
    AND is_active = true;

  IF active_sov_count = 0 THEN
    RAISE EXCEPTION 'Cannot create draw invoice: no active Schedule of Values exists for this job'
      USING ERRCODE = '23514';
  END IF;

  IF approved_sov_count <> active_sov_count THEN
    RAISE EXCEPTION 'Cannot create draw invoice: Schedule of Values must be approved first'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ar_invoice_sov_approval_for_draws_trigger ON public.ar_invoices;
CREATE TRIGGER enforce_ar_invoice_sov_approval_for_draws_trigger
BEFORE INSERT ON public.ar_invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ar_invoice_sov_approval_for_draws();
