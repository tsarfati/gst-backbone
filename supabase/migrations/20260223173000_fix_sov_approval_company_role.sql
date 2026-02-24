-- Fix SOV approval authorization to use company-scoped roles (user_company_access)
-- instead of only profiles.role.

CREATE OR REPLACE FUNCTION public.enforce_schedule_of_values_workflow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_role TEXT;
  target_company_id UUID;
BEGIN
  target_company_id := COALESCE(NEW.company_id, OLD.company_id);

  -- Prefer company-scoped role membership for the row's company.
  SELECT uca.role::text
  INTO current_role
  FROM public.user_company_access uca
  WHERE uca.user_id = auth.uid()
    AND uca.company_id = target_company_id
    AND COALESCE(uca.is_active, true) = true
  ORDER BY
    CASE uca.role::text
      WHEN 'admin' THEN 1
      WHEN 'company_admin' THEN 2
      WHEN 'controller' THEN 3
      ELSE 100
    END
  LIMIT 1;

  -- Fallback for legacy setups still using profiles.role semantics.
  IF current_role IS NULL THEN
    SELECT p.role
    INTO current_role
    FROM public.profiles p
    WHERE p.user_id = auth.uid();
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.workflow_status := COALESCE(NEW.workflow_status, 'draft');

    IF NEW.workflow_status NOT IN ('draft', 'approved') THEN
      RAISE EXCEPTION 'Invalid SOV workflow_status: %', NEW.workflow_status;
    END IF;

    IF NEW.workflow_status = 'approved' THEN
      IF COALESCE(current_role, '') NOT IN ('admin', 'company_admin', 'controller') THEN
        RAISE EXCEPTION 'Only admin/company_admin/controller can approve Schedule of Values';
      END IF;
      NEW.approved_at := COALESCE(NEW.approved_at, now());
      NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
    ELSE
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.workflow_status = 'approved' THEN
    IF NEW.item_number IS DISTINCT FROM OLD.item_number
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.scheduled_value IS DISTINCT FROM OLD.scheduled_value
      OR NEW.cost_code_id IS DISTINCT FROM OLD.cost_code_id
      OR NEW.sort_order IS DISTINCT FROM OLD.sort_order
      OR NEW.job_id IS DISTINCT FROM OLD.job_id
      OR NEW.company_id IS DISTINCT FROM OLD.company_id
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
    THEN
      RAISE EXCEPTION 'Approved Schedule of Values rows are immutable';
    END IF;
  END IF;

  NEW.workflow_status := COALESCE(NEW.workflow_status, OLD.workflow_status, 'draft');
  IF NEW.workflow_status NOT IN ('draft', 'approved') THEN
    RAISE EXCEPTION 'Invalid SOV workflow_status: %', NEW.workflow_status;
  END IF;

  IF NEW.workflow_status IS DISTINCT FROM OLD.workflow_status THEN
    IF COALESCE(current_role, '') NOT IN ('admin', 'company_admin', 'controller') THEN
      RAISE EXCEPTION 'Only admin/company_admin/controller can change Schedule of Values approval status';
    END IF;

    IF OLD.workflow_status = 'approved' AND NEW.workflow_status = 'draft' THEN
      RAISE EXCEPTION 'Approved Schedule of Values rows cannot be reverted to draft';
    END IF;

    IF NEW.workflow_status = 'approved' THEN
      NEW.approved_at := now();
      NEW.approved_by := auth.uid();
    ELSE
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
    END IF;
  ELSE
    IF NEW.workflow_status = 'approved' THEN
      NEW.approved_at := OLD.approved_at;
      NEW.approved_by := OLD.approved_by;
    ELSE
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
