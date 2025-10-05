-- Allow company managers/admins to see pending time card change requests
-- This fixes a discrepancy where Employee Dashboard shows own pending requests
-- but TimeSheets (manager view) shows none due to RLS visibility.

-- Create SELECT policy for managers/controllers/admins to view change requests
-- tied to time cards within companies they manage.
CREATE POLICY "Managers can view time card change requests for their companies"
ON public.time_card_change_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.time_cards tc
    JOIN public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
      ON uc.company_id = tc.company_id
    WHERE tc.id = time_card_change_requests.time_card_id
      AND uc.role IN ('admin', 'controller', 'project_manager')
  )
);

-- Optional: Allow creators to view their own requests (in case missing)
CREATE POLICY "Users can view their own time card change requests"
ON public.time_card_change_requests
FOR SELECT
USING (auth.uid() = user_id);