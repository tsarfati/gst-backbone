-- Fix vendor audit trigger to use auth.uid() instead of non-existent created_by field
CREATE OR REPLACE FUNCTION public.create_vendor_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      NEW.company_id, 'vendors', NEW.id, 'create', auth.uid(), 'Vendor created: ' || NEW.name
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by
      ) VALUES (
        NEW.company_id, 'vendors', NEW.id, 'update', 'name', OLD.name, NEW.name, auth.uid()
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'vendors', OLD.id, 'delete', auth.uid(), 'Vendor deleted: ' || OLD.name
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;