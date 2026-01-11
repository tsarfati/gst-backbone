-- Drop the existing INSERT policies that are too restrictive
DROP POLICY IF EXISTS "Users can create their own time cards" ON public.time_cards;
DROP POLICY IF EXISTS "Users can create time cards for their companies" ON public.time_cards;

-- Create a new INSERT policy that allows:
-- 1. Users to create their own time cards
-- 2. Admins, controllers, and project managers to create time cards for any user in their companies
CREATE POLICY "Users and managers can create time cards" 
ON public.time_cards 
FOR INSERT 
WITH CHECK (
  -- The company must be one the current user has access to
  company_id IN (SELECT uc.company_id FROM get_user_companies(auth.uid()) uc)
  AND (
    -- Either creating for yourself
    auth.uid() = user_id
    -- Or you're an admin/controller/project_manager (can create for anyone)
    OR has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'controller'::user_role)
    OR has_role(auth.uid(), 'project_manager'::user_role)
  )
);