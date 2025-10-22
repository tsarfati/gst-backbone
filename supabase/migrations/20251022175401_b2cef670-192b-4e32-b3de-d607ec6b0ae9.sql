-- Step 1: Update audit functions to handle null auth.uid() during migrations
CREATE OR REPLACE FUNCTION public.create_invoice_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_changed_by uuid;
BEGIN
  v_changed_by := COALESCE(auth.uid(), NEW.created_by, OLD.created_by);
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoice_audit_trail (invoice_id, changed_by, change_type, reason)
    VALUES (NEW.id, NEW.created_by, 'create', 'Invoice created');
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.invoice_audit_trail (invoice_id, changed_by, change_type, field_name, old_value, new_value)
      VALUES (NEW.id, v_changed_by, CASE NEW.status WHEN 'pending_payment' THEN 'approve' WHEN 'paid' THEN 'payment' WHEN 'rejected' THEN 'reject' ELSE 'update' END, 'status', OLD.status, NEW.status);
    END IF;
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      INSERT INTO public.invoice_audit_trail (invoice_id, changed_by, change_type, field_name, old_value, new_value)
      VALUES (NEW.id, v_changed_by, 'update', 'amount', OLD.amount::text, NEW.amount::text);
    END IF;
    IF OLD.cost_code_id IS DISTINCT FROM NEW.cost_code_id THEN
      INSERT INTO public.invoice_audit_trail (invoice_id, changed_by, change_type, field_name, old_value, new_value, reason)
      VALUES (NEW.id, v_changed_by, 'update', 'cost_code_id', OLD.cost_code_id::text, NEW.cost_code_id::text, 'Cost code changed');
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_invoice_to_company_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  vendor_company_id uuid;
  v_changed_by uuid;
BEGIN
  SELECT company_id INTO vendor_company_id FROM public.vendors WHERE id = COALESCE(NEW.vendor_id, OLD.vendor_id);
  v_changed_by := COALESCE(auth.uid(), NEW.created_by, OLD.created_by);
  IF vendor_company_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.company_audit_log (company_id, table_name, record_id, action, changed_by, reason)
    VALUES (vendor_company_id, 'invoices', NEW.id, 'create', v_changed_by, 'Invoice created');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.company_audit_log (company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by)
    VALUES (vendor_company_id, 'invoices', NEW.id, 'update', 'status', OLD.status, NEW.status, v_changed_by);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;