-- Keep job-linked draw invoices aligned to the job's customer.
-- Applies to AIA draw invoices (application_number > 0).

CREATE OR REPLACE FUNCTION public.enforce_ar_invoice_job_customer_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  job_customer_id UUID;
BEGIN
  IF NEW.job_id IS NULL OR COALESCE(NEW.application_number, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT j.customer_id
  INTO job_customer_id
  FROM public.jobs j
  WHERE j.id = NEW.job_id
    AND j.company_id = NEW.company_id
  LIMIT 1;

  IF job_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create/update draw invoice: job must have a customer assigned in Job Information';
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.application_number, 0) > 0 THEN
    IF NEW.job_id IS DISTINCT FROM OLD.job_id THEN
      RAISE EXCEPTION 'Draw invoice job cannot be changed after creation';
    END IF;

    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Draw invoice company cannot be changed after creation';
    END IF;
  END IF;

  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := job_customer_id;
  ELSIF NEW.customer_id IS DISTINCT FROM job_customer_id THEN
    RAISE EXCEPTION 'Draw invoice customer must match the job customer';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ar_invoice_job_customer_context_trigger ON public.ar_invoices;
CREATE TRIGGER enforce_ar_invoice_job_customer_context_trigger
BEFORE INSERT OR UPDATE ON public.ar_invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ar_invoice_job_customer_context();
