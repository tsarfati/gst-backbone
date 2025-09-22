-- Allow users to activate company access once approved
CREATE OR REPLACE FUNCTION public.activate_company_access(_company_id uuid)
RETURNS void AS $$
BEGIN
  -- Ensure there is an approved access request for this user and company
  IF EXISTS (
    SELECT 1 FROM public.company_access_requests
    WHERE user_id = auth.uid() AND company_id = _company_id AND status = 'approved'
  ) THEN
    -- If access exists, ensure it's active; otherwise insert it
    IF EXISTS (
      SELECT 1 FROM public.user_company_access
      WHERE user_id = auth.uid() AND company_id = _company_id
    ) THEN
      UPDATE public.user_company_access
      SET is_active = true
      WHERE user_id = auth.uid() AND company_id = _company_id;
    ELSE
      INSERT INTO public.user_company_access (user_id, company_id, role, granted_by, is_active)
      VALUES (auth.uid(), _company_id, 'employee'::user_role, auth.uid(), true);
    END IF;
  ELSE
    RAISE EXCEPTION 'No approved request found for this company';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;