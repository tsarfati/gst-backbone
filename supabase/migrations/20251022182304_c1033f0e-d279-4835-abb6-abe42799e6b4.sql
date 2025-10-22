-- Fix create_subcontract_audit_entry to reference correct column names
CREATE OR REPLACE FUNCTION public.create_subcontract_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  job_company_id UUID;
BEGIN
  -- Get company_id from job
  SELECT company_id INTO job_company_id FROM public.jobs WHERE id = COALESCE(NEW.job_id, OLD.job_id);
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      job_company_id, 'subcontracts', NEW.id, 'create', NEW.created_by, 
      'Subcontract created: ' || COALESCE(NEW.name, 'No name')
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by
      ) VALUES (
        job_company_id, 'subcontracts', NEW.id, 'update', 'status', 
        OLD.status, NEW.status, auth.uid()
      );
    END IF;
    IF OLD.contract_amount IS DISTINCT FROM NEW.contract_amount THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by
      ) VALUES (
        job_company_id, 'subcontracts', NEW.id, 'update', 'contract_amount', 
        OLD.contract_amount::text, NEW.contract_amount::text, auth.uid()
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      job_company_id, 'subcontracts', OLD.id, 'delete', auth.uid(), 
      'Subcontract deleted'
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;