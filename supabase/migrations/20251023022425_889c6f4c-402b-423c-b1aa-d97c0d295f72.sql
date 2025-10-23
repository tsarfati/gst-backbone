-- Create table to store email history
CREATE TABLE public.email_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'overdue_bills', 'test', 'notification', etc.
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'pending'
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and controllers can view email history for their companies"
ON public.email_history
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
  WHERE role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
));

CREATE POLICY "System can insert email history"
ON public.email_history
FOR INSERT
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_email_history_company_id ON public.email_history(company_id);
CREATE INDEX idx_email_history_sent_at ON public.email_history(sent_at DESC);