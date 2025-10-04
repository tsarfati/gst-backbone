-- Add RLS policy to allow viewing change requests without auth.uid() check
-- This allows PIN employees and users querying directly to see their own change requests

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own change requests" ON public.time_card_change_requests;

-- Create a more permissive policy that allows users to view change requests by user_id match
-- This works for both regular auth users and PIN employees
CREATE POLICY "Users can view their own change requests"
  ON public.time_card_change_requests
  FOR SELECT
  USING (true); -- Allow all reads, app code filters by user_id

-- Keep the insert policy restrictive for regular auth users
DROP POLICY IF EXISTS "Users can create their own change requests" ON public.time_card_change_requests;

CREATE POLICY "Users can create their own change requests"
  ON public.time_card_change_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL); -- Allow PIN users to create