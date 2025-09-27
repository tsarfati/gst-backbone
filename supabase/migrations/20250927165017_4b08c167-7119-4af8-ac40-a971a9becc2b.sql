-- Update RLS policies for complete company separation

-- Drop existing policies for cost_codes and create company-filtered ones
DROP POLICY IF EXISTS "Cost codes are viewable by authenticated users" ON public.cost_codes;
DROP POLICY IF EXISTS "Admins and controllers can manage cost codes" ON public.cost_codes;

CREATE POLICY "Users can view cost codes for their companies" ON public.cost_codes
FOR SELECT USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  )
);

CREATE POLICY "Admins and controllers can manage cost codes for their companies" ON public.cost_codes
FOR ALL USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller')
  )
) WITH CHECK (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller')
  )
);

-- Update chart_of_accounts policies
DROP POLICY IF EXISTS "Authenticated users can view chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Admins and controllers can manage chart of accounts" ON public.chart_of_accounts;

CREATE POLICY "Users can view chart of accounts for their companies" ON public.chart_of_accounts
FOR SELECT USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  )
);

CREATE POLICY "Admins and controllers can manage chart of accounts for their companies" ON public.chart_of_accounts
FOR ALL USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller')
  )
) WITH CHECK (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller')
  )
);

-- Update time_cards policies
DROP POLICY IF EXISTS "Users can view their own time cards" ON public.time_cards;
DROP POLICY IF EXISTS "Users can insert their own time cards" ON public.time_cards;
DROP POLICY IF EXISTS "Users can update their own time cards" ON public.time_cards;
DROP POLICY IF EXISTS "Project managers and admins can view all time cards" ON public.time_cards;
DROP POLICY IF EXISTS "Project managers and admins can update all time cards" ON public.time_cards;

CREATE POLICY "Users can view time cards for their companies" ON public.time_cards
FOR SELECT USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  ) AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'controller'::user_role) OR
    has_role(auth.uid(), 'project_manager'::user_role)
  )
);

CREATE POLICY "Users can create time cards for their companies" ON public.time_cards
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  ) AND auth.uid() = user_id
);

CREATE POLICY "Users can update their own time cards" ON public.time_cards
FOR UPDATE USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  ) AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'controller'::user_role) OR
    has_role(auth.uid(), 'project_manager'::user_role)
  )
);

-- Update punch_records policies
DROP POLICY IF EXISTS "Users can manage their own punch records" ON public.punch_records;
DROP POLICY IF EXISTS "Admins and controllers can view all punch records" ON public.punch_records;
DROP POLICY IF EXISTS "Admins and managers can manage punch records" ON public.punch_records;

CREATE POLICY "Users can view punch records for their companies" ON public.punch_records
FOR SELECT USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  ) AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'controller'::user_role) OR
    has_role(auth.uid(), 'project_manager'::user_role)
  )
);

CREATE POLICY "Users can create punch records for their companies" ON public.punch_records
FOR INSERT WITH CHECK (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  ) AND auth.uid() = user_id
);

CREATE POLICY "Managers can update punch records for their companies" ON public.punch_records
FOR UPDATE USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  ) AND (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'controller'::user_role) OR
    has_role(auth.uid(), 'project_manager'::user_role)
  )
);