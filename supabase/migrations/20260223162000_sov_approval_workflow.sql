-- Add DB-backed approval workflow fields for Schedule of Values (SOV)
-- This supports Draft/Approved status and controller/admin-only approval.

ALTER TABLE public.schedule_of_values
  ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS approved_by UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schedule_of_values_workflow_status_check'
  ) THEN
    ALTER TABLE public.schedule_of_values
      ADD CONSTRAINT schedule_of_values_workflow_status_check
      CHECK (workflow_status IN ('draft', 'approved'));
  END IF;
END $$;

UPDATE public.schedule_of_values
SET workflow_status = COALESCE(workflow_status, 'draft')
WHERE workflow_status IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_schedule_of_values_workflow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_role TEXT;
BEGIN
  SELECT p.role
  INTO current_role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    NEW.workflow_status := COALESCE(NEW.workflow_status, 'draft');

    IF NEW.workflow_status NOT IN ('draft', 'approved') THEN
      RAISE EXCEPTION 'Invalid SOV workflow_status: %', NEW.workflow_status;
    END IF;

    IF NEW.workflow_status = 'approved' THEN
      IF COALESCE(current_role, '') NOT IN ('admin', 'controller') THEN
        RAISE EXCEPTION 'Only admin/controller can approve Schedule of Values';
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
    IF COALESCE(current_role, '') NOT IN ('admin', 'controller') THEN
      RAISE EXCEPTION 'Only admin/controller can change Schedule of Values approval status';
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

DROP TRIGGER IF EXISTS enforce_schedule_of_values_workflow_trigger ON public.schedule_of_values;
CREATE TRIGGER enforce_schedule_of_values_workflow_trigger
BEFORE INSERT OR UPDATE ON public.schedule_of_values
FOR EACH ROW
EXECUTE FUNCTION public.enforce_schedule_of_values_workflow();
