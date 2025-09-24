-- Create trigger to grant company access when a request is approved
DROP TRIGGER IF EXISTS trg_grant_company_access_on_approval ON public.company_access_requests;
CREATE TRIGGER trg_grant_company_access_on_approval
AFTER UPDATE ON public.company_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.grant_company_access_on_approval();

-- Backfill existing approved requests into user_company_access
INSERT INTO public.user_company_access (user_id, company_id, role, granted_by, is_active, granted_at)
SELECT car.user_id,
       car.company_id,
       'employee'::public.user_role,
       COALESCE(car.reviewed_by, car.user_id) AS granted_by,
       true AS is_active,
       COALESCE(car.reviewed_at, now()) AS granted_at
FROM public.company_access_requests car
LEFT JOIN public.user_company_access uca
  ON uca.user_id = car.user_id AND uca.company_id = car.company_id
WHERE car.status = 'approved'
  AND uca.id IS NULL;