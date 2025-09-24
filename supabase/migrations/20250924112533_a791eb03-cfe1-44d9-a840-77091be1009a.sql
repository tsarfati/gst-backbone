-- Drop existing policy if it exists and recreate it
DROP POLICY IF EXISTS "Admins and managers can update any punch status" ON public.current_punch_status;

-- Allow admins, controllers, and project managers to update current punch status for any user
CREATE POLICY "Admins and managers can update any punch status"
ON public.current_punch_status
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::public.user_role)
  OR public.has_role(auth.uid(), 'controller'::public.user_role)
  OR public.has_role(auth.uid(), 'project_manager'::public.user_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.user_role)
  OR public.has_role(auth.uid(), 'controller'::public.user_role)
  OR public.has_role(auth.uid(), 'project_manager'::public.user_role)
);

-- Drop existing policy if it exists and recreate it
DROP POLICY IF EXISTS "Project managers can create punch records" ON public.punch_records;

-- Ensure project managers can create punch records for any user (to match UI permissions)
CREATE POLICY "Project managers can create punch records"
ON public.punch_records
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'project_manager'::public.user_role)
);