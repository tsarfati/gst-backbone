-- Add chart_account_id and vendor_id to credit_card_transactions table
ALTER TABLE public.credit_card_transactions
ADD COLUMN IF NOT EXISTS chart_account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;