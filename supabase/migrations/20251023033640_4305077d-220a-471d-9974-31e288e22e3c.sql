-- Add missing INSERT and DELETE policies for credit_card_coding_requests

-- INSERT policy: Users can create coding requests for their companies
CREATE POLICY "Users can create coding requests for their companies"
ON credit_card_coding_requests
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id 
    FROM get_user_companies(auth.uid())
  )
);

-- DELETE policy: Users can delete coding requests for their companies
CREATE POLICY "Users can delete coding requests for their companies"
ON credit_card_coding_requests
FOR DELETE
USING (
  company_id IN (
    SELECT company_id 
    FROM get_user_companies(auth.uid())
  )
  AND (requested_by = auth.uid() OR requested_coder_id = auth.uid())
);