-- Prevent profile role audit logging from failing for external/vendor users that do
-- not have current_company_id populated at the moment the role changes.

CREATE OR REPLACE FUNCTION public.create_user_role_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed_by uuid;
  v_company_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    v_changed_by := COALESCE(auth.uid(), NEW.approved_by, OLD.approved_by, NEW.user_id, OLD.user_id);

    v_company_id := COALESCE(
      NEW.current_company_id,
      OLD.current_company_id,
      (
        SELECT uca.company_id
        FROM public.user_company_access uca
        WHERE uca.user_id = NEW.user_id
          AND uca.is_active = true
        ORDER BY uca.granted_at DESC NULLS LAST, uca.created_at DESC NULLS LAST
        LIMIT 1
      ),
      (
        SELECT car.company_id
        FROM public.company_access_requests car
        WHERE car.user_id = NEW.user_id
        ORDER BY car.requested_at DESC NULLS LAST, car.created_at DESC NULLS LAST
        LIMIT 1
      ),
      (
        SELECT v.company_id
        FROM public.vendors v
        WHERE v.id = COALESCE(NEW.vendor_id, OLD.vendor_id)
        LIMIT 1
      )
    );

    IF v_company_id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by, reason
    ) VALUES (
      v_company_id,
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

  RETURN NEW;
END;
$$;
