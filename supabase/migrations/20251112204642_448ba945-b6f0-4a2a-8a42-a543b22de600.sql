-- Fix all audit triggers comprehensively

-- Fix user_company_access audit trigger
CREATE OR REPLACE FUNCTION public.create_company_access_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  IF (TG_OP = 'UPDATE' AND OLD.is_active != NEW.is_active) THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by, reason
    ) VALUES (
      NEW.company_id, 'user_company_access', NEW.user_id, 
      CASE WHEN NEW.is_active THEN 'activate' ELSE 'deactivate' END,
      'is_active', OLD.is_active::text, NEW.is_active::text, current_user_id,
      CASE WHEN NEW.is_active THEN 'User access activated' ELSE 'User access deactivated' END
    );
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'user_company_access', OLD.user_id, 'revoke_access', 
      current_user_id, 'User access revoked'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix jobs audit trigger
CREATE OR REPLACE FUNCTION public.create_job_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'jobs', OLD.id, 'delete', current_user_id, 'Job deleted: ' || OLD.name
    );
  END IF;
  
  RETURN OLD;
END;
$$;

-- Fix cost_codes audit trigger
CREATE OR REPLACE FUNCTION public.create_cost_code_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'cost_codes', OLD.id, 'delete', current_user_id, 
      'Cost code deleted: ' || OLD.code
    );
  END IF;
  
  RETURN OLD;
END;
$$;

-- Fix chart_of_accounts audit trigger
CREATE OR REPLACE FUNCTION public.create_chart_account_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'chart_of_accounts', OLD.id, 'delete', current_user_id, 
      'Chart account deleted: ' || OLD.account_name
    );
  END IF;
  
  RETURN OLD;
END;
$$;