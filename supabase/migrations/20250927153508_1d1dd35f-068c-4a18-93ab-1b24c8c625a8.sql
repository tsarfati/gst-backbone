-- Create bank accounts table with automatic cash account creation
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name TEXT NOT NULL,
    account_number TEXT,
    routing_number TEXT,
    bank_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'money-market', 'credit-line')),
    initial_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    balance_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    chart_account_id UUID REFERENCES public.chart_of_accounts(id),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on bank accounts
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bank accounts
CREATE POLICY "Admins and controllers can manage bank accounts"
ON public.bank_accounts
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

CREATE POLICY "Authenticated users can view bank accounts"
ON public.bank_accounts
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Function to get next available cash account number
CREATE OR REPLACE FUNCTION public.get_next_cash_account_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    max_num INTEGER;
    next_num TEXT;
BEGIN
    -- Find the highest existing cash account number starting with 1
    SELECT COALESCE(MAX(CAST(SUBSTRING(account_number FROM '^1(\d+)$') AS INTEGER)), 999) INTO max_num
    FROM public.chart_of_accounts 
    WHERE account_type = 'cash' 
    AND account_number ~ '^1\d+$';
    
    -- Generate next number
    next_num := '1' || LPAD((max_num + 1)::TEXT, 3, '0');
    
    RETURN next_num;
END;
$$;

-- Function to create cash account for bank account
CREATE OR REPLACE FUNCTION public.create_cash_account_for_bank()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_account_number TEXT;
    chart_account_id UUID;
BEGIN
    -- Generate next available cash account number
    new_account_number := get_next_cash_account_number();
    
    -- Create the cash account in chart of accounts
    INSERT INTO public.chart_of_accounts (
        account_number,
        account_name,
        account_type,
        account_category,
        normal_balance,
        current_balance,
        is_system_account,
        is_active,
        created_by
    ) VALUES (
        new_account_number,
        NEW.account_name || ' - ' || NEW.bank_name,
        'cash',
        'cash_accounts',
        'debit',
        NEW.initial_balance,
        false,
        true,
        NEW.created_by
    )
    RETURNING id INTO chart_account_id;
    
    -- Update the bank account with the chart account reference
    NEW.chart_account_id := chart_account_id;
    NEW.current_balance := NEW.initial_balance;
    
    RETURN NEW;
END;
$$;

-- Create trigger to auto-create cash account
CREATE TRIGGER create_cash_account_trigger
    BEFORE INSERT ON public.bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.create_cash_account_for_bank();

-- Create trigger for updated_at
CREATE TRIGGER update_bank_accounts_updated_at
    BEFORE UPDATE ON public.bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();