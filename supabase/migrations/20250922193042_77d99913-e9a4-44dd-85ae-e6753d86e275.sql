-- Fix grant access trigger to assign a valid role and ensure trigger exists
CREATE OR REPLACE FUNCTION public.grant_company_access_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when status transitions to approved
  IF (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM NEW.status)) THEN
    -- Insert access if it doesn't already exist
    INSERT INTO public.user_company_access (user_id, company_id, role, granted_by, is_active)
    SELECT NEW.user_id, NEW.company_id, 'employee'::user_role, COALESCE(NEW.reviewed_by, NEW.user_id), true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_company_access uca
      WHERE uca.user_id = NEW.user_id AND uca.company_id = NEW.company_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_grant_access_on_request_approval ON public.company_access_requests;
CREATE TRIGGER trg_grant_access_on_request_approval
AFTER UPDATE ON public.company_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.grant_company_access_on_approval();

-- Backfill any missing access for already approved requests
INSERT INTO public.user_company_access (user_id, company_id, role, granted_by, is_active)
SELECT car.user_id, car.company_id, 'employee'::user_role, COALESCE(car.reviewed_by, car.user_id), true
FROM public.company_access_requests car
LEFT JOIN public.user_company_access uca
  ON uca.user_id = car.user_id AND uca.company_id = car.company_id
JOIN public.companies c ON c.id = car.company_id AND c.is_active = true
WHERE car.status = 'approved' AND uca.id IS NULL;