-- Allow admins and controllers to create punch records for any user
CREATE POLICY "Admins and controllers can create punch records for any user" 
ON public.punch_records 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));