-- Fix audit logging when user_company_access is modified by service-role edge functions.
-- auth.uid() is null in that context; use granted_by/user_id fallback.

CREATE OR REPLACE FUNCTION public.create_company_access_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed_by uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changed_by := COALESCE(auth.uid(), NEW.granted_by, NEW.user_id);
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      NEW.company_id, 'user_company_access', NEW.user_id, 'grant_access',
      v_changed_by,
      'User granted access with role: ' || NEW.role::text
    );

  ELSIF TG_OP = 'UPDATE' THEN
    v_changed_by := COALESCE(auth.uid(), NEW.granted_by, OLD.granted_by, NEW.user_id, OLD.user_id);

    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by
      ) VALUES (
        NEW.company_id, 'user_company_access', NEW.user_id, 'update', 'role',
        OLD.role::text, NEW.role::text, v_changed_by
      );
    END IF;

    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by, reason
      ) VALUES (
        NEW.company_id, 'user_company_access', NEW.user_id,
        CASE WHEN NEW.is_active THEN 'activate' ELSE 'deactivate' END,
        'is_active', OLD.is_active::text, NEW.is_active::text, v_changed_by,
        CASE WHEN NEW.is_active THEN 'User access activated' ELSE 'User access deactivated' END
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_changed_by := COALESCE(auth.uid(), OLD.granted_by, OLD.user_id);
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'user_company_access', OLD.user_id, 'revoke_access',
      v_changed_by, 'User access revoked'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

