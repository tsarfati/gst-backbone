-- Create employee_group_members junction table
CREATE TABLE IF NOT EXISTS public.employee_group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.employee_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.employee_group_members ENABLE ROW LEVEL SECURITY;

-- Admins and controllers can manage employee group members
CREATE POLICY "Admins and controllers can manage employee group members"
ON public.employee_group_members
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role)
);

-- Users can view employee group members for their company
CREATE POLICY "Users can view employee group members for their company"
ON public.employee_group_members
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
);