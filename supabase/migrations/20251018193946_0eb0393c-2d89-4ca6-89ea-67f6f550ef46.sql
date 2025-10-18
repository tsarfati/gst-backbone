-- Add comprehensive audit triggers for all major company actions

-- Function to audit company access changes
CREATE OR REPLACE FUNCTION public.create_company_access_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      NEW.company_id, 'user_company_access', NEW.user_id, 'grant_access', 
      COALESCE(NEW.granted_by, NEW.user_id), 
      'User granted access with role: ' || NEW.role::text
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by
      ) VALUES (
        NEW.company_id, 'user_company_access', NEW.user_id, 'update', 'role', 
        OLD.role::text, NEW.role::text, auth.uid()
      );
    END IF;
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by, reason
      ) VALUES (
        NEW.company_id, 'user_company_access', NEW.user_id, 
        CASE WHEN NEW.is_active THEN 'activate' ELSE 'deactivate' END,
        'is_active', OLD.is_active::text, NEW.is_active::text, auth.uid(),
        CASE WHEN NEW.is_active THEN 'User access activated' ELSE 'User access deactivated' END
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'user_company_access', OLD.user_id, 'revoke_access', 
      auth.uid(), 'User access revoked'
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to audit subcontract actions
CREATE OR REPLACE FUNCTION public.create_subcontract_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      'Subcontract created: ' || COALESCE(NEW.contract_number, 'No contract number')
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
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by
      ) VALUES (
        job_company_id, 'subcontracts', NEW.id, 'update', 'amount', 
        OLD.amount::text, NEW.amount::text, auth.uid()
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

-- Enhanced invoice audit function to log to company_audit_log
CREATE OR REPLACE FUNCTION public.log_invoice_to_company_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vendor_company_id UUID;
BEGIN
  -- Get company_id from vendor
  SELECT company_id INTO vendor_company_id FROM public.vendors WHERE id = COALESCE(NEW.vendor_id, OLD.vendor_id);
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      vendor_company_id, 'invoices', NEW.id, 'create', NEW.created_by, 
      'Bill/Invoice created: ' || COALESCE(NEW.invoice_number, 'No invoice number')
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by
      ) VALUES (
        vendor_company_id, 'invoices', NEW.id, 
        CASE NEW.status 
          WHEN 'pending_payment' THEN 'approve'
          WHEN 'paid' THEN 'payment'
          WHEN 'rejected' THEN 'reject'
          ELSE 'update'
        END,
        'status', OLD.status, NEW.status, auth.uid()
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      vendor_company_id, 'invoices', OLD.id, 'delete', auth.uid(), 
      'Bill/Invoice deleted'
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to audit cost code changes
CREATE OR REPLACE FUNCTION public.create_cost_code_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      NEW.company_id, 'cost_codes', NEW.id, 'create', auth.uid(), 
      'Cost code created: ' || NEW.code || ' - ' || NEW.description
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active = false THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, changed_by, reason
      ) VALUES (
        NEW.company_id, 'cost_codes', NEW.id, 'deactivate', auth.uid(), 
        'Cost code deactivated: ' || NEW.code
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'cost_codes', OLD.id, 'delete', auth.uid(), 
      'Cost code deleted: ' || OLD.code
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to audit company settings changes
CREATE OR REPLACE FUNCTION public.create_company_settings_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      NEW.company_id, 'company_settings', NEW.id, 'update', auth.uid(), 
      'Company settings updated'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create all triggers
CREATE TRIGGER company_access_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_company_access
  FOR EACH ROW
  EXECUTE FUNCTION public.create_company_access_audit_entry();

CREATE TRIGGER subcontract_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.subcontracts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_subcontract_audit_entry();

CREATE TRIGGER invoice_company_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_invoice_to_company_audit();

CREATE TRIGGER cost_code_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.cost_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_cost_code_audit_entry();

CREATE TRIGGER company_settings_audit_trigger
  AFTER UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_company_settings_audit_entry();