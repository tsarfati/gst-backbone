-- Fix profile role audit trigger for service-role updates where auth.uid() is null.

CREATE OR REPLACE FUNCTION public.create_user_role_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed_by uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      v_changed_by := COALESCE(auth.uid(), NEW.user_id, OLD.user_id);

      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by, reason
      ) VALUES (
        COALESCE(NEW.current_company_id, OLD.current_company_id),
        'profiles',
        NEW.user_id,
        'update',
        'role',
        OLD.role::text,
        NEW.role::text,
        v_changed_by,
        'User role changed'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

