-- Drop the restrictive policy that requires being super admin to read
DROP POLICY IF EXISTS "Super admins can view super admins" ON public.super_admins;

-- Create a policy that allows users to check if THEY are a super admin
CREATE POLICY "Users can check own super admin status" 
ON public.super_admins 
FOR SELECT 
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));