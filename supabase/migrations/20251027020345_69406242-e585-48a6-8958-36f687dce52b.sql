-- Create bill_communications table for intercompany messages about bills
CREATE TABLE IF NOT EXISTS public.bill_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bill_communications ENABLE ROW LEVEL SECURITY;

-- Create policies for bill communications
CREATE POLICY "Users can view bill communications for their companies"
  ON public.bill_communications
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Users can create bill communications for their companies"
  ON public.bill_communications
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Users can update their own bill communications"
  ON public.bill_communications
  FOR UPDATE
  USING (
    user_id = auth.uid() AND
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Users can delete their own bill communications"
  ON public.bill_communications
  FOR DELETE
  USING (
    user_id = auth.uid() AND
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_bill_communications_bill_id ON public.bill_communications(bill_id);
CREATE INDEX idx_bill_communications_company_id ON public.bill_communications(company_id);
CREATE INDEX idx_bill_communications_created_at ON public.bill_communications(created_at DESC);