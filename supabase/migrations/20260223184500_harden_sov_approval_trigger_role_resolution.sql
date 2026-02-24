-- Harden SOV approval trigger role resolution.
-- Uses company-scoped role membership first and falls back to legacy profile roles.
-- Some legacy profiles may still carry role='postgres'; treat that as privileged
-- to avoid blocking approvals while profile roles are normalized.

CREATE OR REPLACE FUNCTION public.enforce_schedule_of_values_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_company_id UUID;
  approver_user_id UUID;
  current_role TEXT;
BEGIN
  target_company_id := COALESCE(NEW.company_id, OLD.company_id);

  IF target_company_id IS NULL THEN
    SELECT j.company_id
    INTO target_company_id
    FROM public.jobs j
    WHERE j.id = COALESCE(NEW.job_id, OLD.job_id)
    LIMIT 1;
  END IF;

  NEW.workflow_status := COALESCE(NEW.workflow_status, OLD.workflow_status, 'draft');

  IF NEW.workflow_status NOT IN ('draft', 'approved') THEN
    RAISE EXCEPTION 'Invalid SOV workflow_status: %', NEW.workflow_status;
  END IF;

  -- Approved rows remain immutable for core fields.
  IF TG_OP = 'UPDATE' AND OLD.workflow_status = 'approved' THEN
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

  -- Validate role when transitioning into approved.
  IF TG_OP = 'UPDATE'
     AND NEW.workflow_status IS DISTINCT FROM OLD.workflow_status
     AND NEW.workflow_status = 'approved' THEN
    approver_user_id := COALESCE(
      NEW.approved_by,
      auth.uid(),
      NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    );

    SELECT lower(trim(uca.role::text))
    INTO current_role
    FROM public.user_company_access uca
    WHERE uca.user_id = approver_user_id
      AND uca.company_id = target_company_id
      AND COALESCE(uca.is_active, true) = true
    ORDER BY
      CASE lower(trim(uca.role::text))
        WHEN 'admin' THEN 1
        WHEN 'company_admin' THEN 2
        WHEN 'controller' THEN 3
        WHEN 'super_admin' THEN 4
        ELSE 100
      END
    LIMIT 1;

    IF current_role IS NULL THEN
      SELECT lower(trim(p.role::text))
      INTO current_role
      FROM public.profiles p
      WHERE p.user_id = approver_user_id;
    END IF;

    IF COALESCE(current_role, '') NOT IN ('admin', 'company_admin', 'controller', 'super_admin', 'postgres') THEN
      RAISE EXCEPTION 'Only admin/company_admin/controller/super_admin can change Schedule of Values approval status';
    END IF;

    NEW.approved_at := now();
    NEW.approved_by := approver_user_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.workflow_status IS DISTINCT FROM OLD.workflow_status
     AND OLD.workflow_status = 'approved'
     AND NEW.workflow_status = 'draft' THEN
    RAISE EXCEPTION 'Approved Schedule of Values rows cannot be reverted to draft';
  END IF;

  IF NEW.workflow_status = 'approved' THEN
    NEW.approved_at := COALESCE(NEW.approved_at, OLD.approved_at, now());
    NEW.approved_by := COALESCE(NEW.approved_by, OLD.approved_by, auth.uid());
  ELSE
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;
