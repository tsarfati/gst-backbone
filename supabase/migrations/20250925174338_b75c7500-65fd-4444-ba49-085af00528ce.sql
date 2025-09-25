-- Create payables settings table
CREATE TABLE public.payables_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- Bills Approval Settings
  bills_require_approval BOOLEAN NOT NULL DEFAULT true,
  bills_approval_roles TEXT[] NOT NULL DEFAULT ARRAY['admin', 'controller'],
  bills_auto_approve_roles TEXT[] NOT NULL DEFAULT ARRAY['admin'],
  bills_max_auto_approve_amount NUMERIC DEFAULT 1000.00,
  
  -- Payment Approval Settings
  payments_require_approval BOOLEAN NOT NULL DEFAULT true,
  payment_approval_threshold NUMERIC NOT NULL DEFAULT 5000.00,
  payment_approval_roles TEXT[] NOT NULL DEFAULT ARRAY['admin', 'controller'],
  payment_auto_approve_roles TEXT[] NOT NULL DEFAULT ARRAY['admin'],
  payment_dual_approval_threshold NUMERIC DEFAULT 25000.00,
  payment_dual_approval_roles TEXT[] NOT NULL DEFAULT ARRAY['admin', 'controller'],
  
  -- Notification Settings
  notify_on_bill_submission BOOLEAN NOT NULL DEFAULT true,
  notify_on_payment_approval BOOLEAN NOT NULL DEFAULT true,
  send_payment_confirmations BOOLEAN NOT NULL DEFAULT true,
  
  -- Default Settings
  default_payment_terms TEXT DEFAULT '30',
  default_payment_method TEXT DEFAULT 'check',
  require_receipt_attachment BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  UNIQUE(company_id)
);

-- Create job settings table
CREATE TABLE public.job_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  
  -- Budget Approval Settings
  budget_require_approval BOOLEAN NOT NULL DEFAULT true,
  budget_approval_threshold NUMERIC NOT NULL DEFAULT 10000.00,
  budget_approval_roles TEXT[] NOT NULL DEFAULT ARRAY['admin', 'controller'],
  budget_change_approval_percentage NUMERIC DEFAULT 10.00, -- 10% change requires approval
  
  -- Job Creation Settings
  require_project_manager BOOLEAN NOT NULL DEFAULT true,
  auto_assign_pm_role TEXT DEFAULT 'project_manager',
  require_job_description BOOLEAN NOT NULL DEFAULT false,
  require_start_date BOOLEAN NOT NULL DEFAULT true,
  require_budget BOOLEAN NOT NULL DEFAULT true,
  
  -- Cost Code Settings
  require_cost_codes BOOLEAN NOT NULL DEFAULT true,
  auto_create_default_cost_codes BOOLEAN NOT NULL DEFAULT true,
  default_cost_codes TEXT[] DEFAULT ARRAY['General', 'Labor', 'Materials', 'Equipment'],
  
  -- Status Workflow Settings
  default_job_status TEXT DEFAULT 'planning',
  allow_status_change_roles TEXT[] NOT NULL DEFAULT ARRAY['admin', 'controller', 'project_manager'],
  require_completion_approval BOOLEAN NOT NULL DEFAULT true,
  
  -- Time Tracking Settings
  require_timecard_approval BOOLEAN NOT NULL DEFAULT true,
  timecard_approval_roles TEXT[] NOT NULL DEFAULT ARRAY['project_manager', 'admin', 'controller'],
  overtime_approval_required BOOLEAN NOT NULL DEFAULT true,
  overtime_approval_threshold NUMERIC DEFAULT 8.0, -- hours per day
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.payables_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payables_settings
CREATE POLICY "Company users can view payables settings" 
ON public.payables_settings 
FOR SELECT 
USING (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
  )
);

CREATE POLICY "Admins and controllers can manage payables settings" 
ON public.payables_settings 
FOR ALL
USING (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
    WHERE get_user_companies.role IN ('admin', 'controller')
  )
)
WITH CHECK (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
    WHERE get_user_companies.role IN ('admin', 'controller')
  )
);

-- RLS Policies for job_settings
CREATE POLICY "Company users can view job settings" 
ON public.job_settings 
FOR SELECT 
USING (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
  )
);

CREATE POLICY "Admins and controllers can manage job settings" 
ON public.job_settings 
FOR ALL
USING (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
    WHERE get_user_companies.role IN ('admin', 'controller')
  )
)
WITH CHECK (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
    WHERE get_user_companies.role IN ('admin', 'controller')
  )
);

-- Add update trigger
CREATE TRIGGER update_payables_settings_updated_at
  BEFORE UPDATE ON public.payables_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_settings_updated_at
  BEFORE UPDATE ON public.job_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();