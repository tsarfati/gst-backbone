-- Ensure approved company access requests grant the requested role from notes JSON.
-- Notes payload expected shape: { requestedRole: "employee" | "vendor" | "design_professional", ... }

CREATE OR REPLACE FUNCTION public.grant_company_access_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role_text text;
  v_requested_role public.user_role := 'employee'::public.user_role;
  v_granted_by uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    v_granted_by := COALESCE(NEW.reviewed_by, NEW.user_id);

    BEGIN
      v_requested_role_text := lower(COALESCE((NEW.notes::jsonb ->> 'requestedRole'), 'employee'));
    EXCEPTION WHEN others THEN
      v_requested_role_text := 'employee';
    END;

    IF v_requested_role_text IN ('employee', 'vendor', 'design_professional', 'view_only', 'project_manager', 'controller', 'company_admin', 'admin') THEN
      v_requested_role := v_requested_role_text::public.user_role;
    ELSE
      v_requested_role := 'employee'::public.user_role;
    END IF;

    -- Keep profile state aligned to approved result.
    UPDATE public.profiles
    SET
      role = v_requested_role,
      status = 'approved',
      approved_by = v_granted_by,
      approved_at = COALESCE(NEW.reviewed_at, now())
    WHERE user_id = NEW.user_id;

    -- Prefer updating existing access rows for this company/user.
    UPDATE public.user_company_access
    SET
      role = v_requested_role,
      granted_by = v_granted_by,
      is_active = true,
      granted_at = COALESCE(NEW.reviewed_at, now())
    WHERE user_id = NEW.user_id
      AND company_id = NEW.company_id;

    IF NOT FOUND THEN
      INSERT INTO public.user_company_access (user_id, company_id, role, granted_by, is_active, granted_at)
      VALUES (NEW.user_id, NEW.company_id, v_requested_role, v_granted_by, true, COALESCE(NEW.reviewed_at, now()));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_access_on_request_approval ON public.company_access_requests;
DROP TRIGGER IF EXISTS trg_grant_company_access_on_approval ON public.company_access_requests;

CREATE TRIGGER trg_grant_company_access_on_approval
AFTER UPDATE ON public.company_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.grant_company_access_on_approval();

-- Backfill any already-approved requests to requested role (when present in notes).
WITH role_backfill AS (
  SELECT
    car.user_id,
    car.company_id,
    COALESCE(
      CASE
        WHEN lower(COALESCE(car.notes::jsonb ->> 'requestedRole', '')) IN
          ('employee','vendor','design_professional','view_only','project_manager','controller','company_admin','admin')
        THEN (car.notes::jsonb ->> 'requestedRole')::public.user_role
        ELSE NULL
      END,
      'employee'::public.user_role
    ) AS requested_role,
    COALESCE(car.reviewed_by, car.user_id) AS granted_by,
    COALESCE(car.reviewed_at, now()) AS granted_at
  FROM public.company_access_requests car
  WHERE car.status = 'approved'
)
UPDATE public.user_company_access uca
SET
  role = rb.requested_role,
  granted_by = rb.granted_by,
  is_active = true,
  granted_at = rb.granted_at
FROM role_backfill rb
WHERE uca.user_id = rb.user_id
  AND uca.company_id = rb.company_id;
