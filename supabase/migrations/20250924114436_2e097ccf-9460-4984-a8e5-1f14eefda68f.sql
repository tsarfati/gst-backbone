-- Add DELETE policy for admins and managers on current_punch_status
CREATE POLICY "Admins and managers can delete any punch status"
ON public.current_punch_status
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::public.user_role)
  OR public.has_role(auth.uid(), 'controller'::public.user_role)
  OR public.has_role(auth.uid(), 'project_manager'::public.user_role)
);