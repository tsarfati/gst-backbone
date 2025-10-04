-- Revert to more secure RLS policies for time_card_change_requests
-- PIN users will use edge function endpoint instead

DROP POLICY IF EXISTS "Users can view their own change requests" ON public.time_card_change_requests;
DROP POLICY IF EXISTS "Users can create their own change requests" ON public.time_card_change_requests;

-- Secure policy for regular authenticated users
CREATE POLICY "Users can view their own change requests"
  ON public.time_card_change_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Secure policy for creating change requests
CREATE POLICY "Users can create their own change requests"
  ON public.time_card_change_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);