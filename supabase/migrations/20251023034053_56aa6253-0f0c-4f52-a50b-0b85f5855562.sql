-- Remove duplicate INSERT policy for credit_card_coding_requests
DROP POLICY IF EXISTS "Users can create coding requests for their companies" ON credit_card_coding_requests;

-- Keep only the original INSERT policy which has proper authorization check
-- The existing "Users can create coding requests" policy already handles this correctly