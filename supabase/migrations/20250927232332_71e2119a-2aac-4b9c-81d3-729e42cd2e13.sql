-- Create credit cards table with GL account association
CREATE TABLE public.credit_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  card_name TEXT NOT NULL,
  card_number_last_four TEXT NOT NULL, -- Only store last 4 digits for security
  cardholder_name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  card_type TEXT,
  credit_limit NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  interest_rate NUMERIC,
  due_date DATE,
  liability_account_id UUID REFERENCES public.chart_of_accounts(id),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view credit cards for their companies" 
ON public.credit_cards 
FOR SELECT 
USING (company_id IN (
  SELECT uc.company_id 
  FROM get_user_companies(auth.uid()) uc
));

CREATE POLICY "Admins and controllers can manage credit cards for their companies" 
ON public.credit_cards 
FOR ALL 
USING (company_id IN (
  SELECT uc.company_id 
  FROM get_user_companies(auth.uid()) uc
  WHERE uc.role IN ('admin', 'controller')
))
WITH CHECK (company_id IN (
  SELECT uc.company_id 
  FROM get_user_companies(auth.uid()) uc
  WHERE uc.role IN ('admin', 'controller')
));

-- Add trigger for updated_at
CREATE TRIGGER update_credit_cards_updated_at
BEFORE UPDATE ON public.credit_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();