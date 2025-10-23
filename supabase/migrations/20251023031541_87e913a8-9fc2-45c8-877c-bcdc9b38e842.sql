-- Fix RLS policy for credit_card_coding_requests to prevent cross-company data leaks
-- Drop the problematic policy that allows viewing based on requested_coder_id alone
DROP POLICY IF EXISTS "Users can view coding requests for their companies" ON credit_card_coding_requests;

-- Create a corrected policy that ONLY shows requests for companies the user has access to
CREATE POLICY "Users can view coding requests for their companies"
ON credit_card_coding_requests
FOR SELECT
USING (
  company_id IN (
    SELECT company_id 
    FROM get_user_companies(auth.uid())
  )
);

-- Ensure users can only update requests for their own companies
DROP POLICY IF EXISTS "Users can update their assigned coding requests" ON credit_card_coding_requests;

CREATE POLICY "Users can update their assigned coding requests"
ON credit_card_coding_requests
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id 
    FROM get_user_companies(auth.uid())
  )
  AND (requested_coder_id = auth.uid() OR requested_by = auth.uid())
);