-- Fix the audit trigger function to use correct field name
CREATE OR REPLACE FUNCTION public.create_company_settings_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      NEW.id, 'company_settings', NEW.id, 'update', auth.uid(), 
      'Company settings updated'
    );
  END IF;
  RETURN NEW;
END;
$$;