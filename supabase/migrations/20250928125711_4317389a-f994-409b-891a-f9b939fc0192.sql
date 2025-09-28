-- Add company_id to messages table to make messages company-specific
ALTER TABLE public.messages ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Update existing messages to set company_id based on the current user's company
-- We'll set this to NULL for now and let the application handle it
-- In practice, existing messages won't be visible until they get a company_id

-- Drop existing RLS policies for messages
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to any authenticated user" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own received messages" ON public.messages;

-- Create new company-specific RLS policies for messages
CREATE POLICY "Users can view messages in their company context" 
ON public.messages 
FOR SELECT 
USING (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  ) AND (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  )
);

CREATE POLICY "Users can send messages within their company" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = from_user_id AND
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

CREATE POLICY "Users can update their received messages in their company" 
ON public.messages 
FOR UPDATE 
USING (
  auth.uid() = to_user_id AND
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);