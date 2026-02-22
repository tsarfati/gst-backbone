
-- Feature modules master list
CREATE TABLE public.feature_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage feature modules"
  ON public.feature_modules FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view active feature modules"
  ON public.feature_modules FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Subscription tiers
CREATE TABLE public.subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  monthly_price numeric NOT NULL DEFAULT 0,
  annual_price numeric,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage subscription tiers"
  ON public.subscription_tiers FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view active tiers"
  ON public.subscription_tiers FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Tier <-> Feature mapping
CREATE TABLE public.tier_feature_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES public.subscription_tiers(id) ON DELETE CASCADE,
  feature_module_id uuid NOT NULL REFERENCES public.feature_modules(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'full',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tier_id, feature_module_id)
);

ALTER TABLE public.tier_feature_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage tier features"
  ON public.tier_feature_access FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view tier features"
  ON public.tier_feature_access FOR SELECT
  TO authenticated
  USING (true);

-- Company subscriptions
CREATE TABLE public.company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.subscription_tiers(id),
  status text NOT NULL DEFAULT 'active',
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  billing_cycle text DEFAULT 'monthly',
  notes text,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage company subscriptions"
  ON public.company_subscriptions FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Company members can view their subscription"
  ON public.company_subscriptions FOR SELECT
  TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

-- Helper function to check if a company has access to a feature
CREATE OR REPLACE FUNCTION public.company_has_feature(p_company_id uuid, p_feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM company_subscriptions cs
    JOIN tier_feature_access tfa ON tfa.tier_id = cs.tier_id
    JOIN feature_modules fm ON fm.id = tfa.feature_module_id
    WHERE cs.company_id = p_company_id
      AND cs.status = 'active'
      AND fm.key = p_feature_key
      AND fm.is_active = true
  )
$$;

-- Seed default feature modules
INSERT INTO public.feature_modules (key, name, description, category, sort_order) VALUES
  ('punch_clock', 'Punch Clock', 'Time tracking and punch clock functionality', 'time_tracking', 10),
  ('timesheets', 'Timesheets', 'Timesheet management and reports', 'time_tracking', 20),
  ('employees', 'Employees', 'Employee management and profiles', 'hr', 30),
  ('employee_reports', 'Employee Reports', 'Employee performance and payroll reports', 'hr', 40),
  ('jobs_basic', 'Jobs (Basic)', 'Create and manage jobs with basic info', 'construction', 50),
  ('job_budgets', 'Job Budgets', 'Job cost budgets and cost code management', 'construction', 60),
  ('job_cost_codes', 'Cost Codes', 'Cost code setup and management', 'construction', 70),
  ('job_plans', 'Plans', 'Construction plan management', 'construction', 80),
  ('job_rfis', 'RFIs', 'Request for information management', 'construction', 90),
  ('job_permits', 'Permits', 'Permit tracking and management', 'construction', 100),
  ('job_photos', 'Job Photos', 'Photo albums and documentation', 'construction', 110),
  ('job_filing', 'Filing Cabinet', 'Document management per job', 'construction', 120),
  ('delivery_tickets', 'Delivery Tickets', 'Delivery ticket tracking', 'construction', 130),
  ('visitor_logs', 'Visitor Logs', 'Job site visitor management', 'construction', 140),
  ('project_tasks', 'Project Tasks', 'Task management and deadlines', 'construction', 150),
  ('subcontracts', 'Subcontracts', 'Subcontract management', 'construction', 160),
  ('purchase_orders', 'Purchase Orders', 'Purchase order management', 'construction', 170),
  ('rfps', 'RFPs & Bidding', 'Request for proposals and bid comparison', 'construction', 180),
  ('vendors', 'Vendors', 'Vendor management', 'accounting', 190),
  ('bills', 'Bills & Payables', 'Bill management and payment tracking', 'accounting', 200),
  ('receipts', 'Receipts', 'Receipt scanning and coding', 'accounting', 210),
  ('chart_of_accounts', 'Chart of Accounts', 'Accounting chart of accounts', 'accounting', 220),
  ('journal_entries', 'Journal Entries', 'General ledger journal entries', 'accounting', 230),
  ('bank_accounts', 'Bank Accounts', 'Bank account management and reconciliation', 'accounting', 240),
  ('credit_cards', 'Credit Cards', 'Credit card transaction management', 'accounting', 250),
  ('ar_invoices', 'AR Invoices', 'Accounts receivable invoicing', 'accounting', 260),
  ('payments', 'Payments', 'Payment processing and history', 'accounting', 270),
  ('customers', 'Customers', 'Customer management', 'accounting', 280),
  ('construction_reports', 'Construction Reports', 'Construction-specific reports', 'reports', 290),
  ('accounting_reports', 'Accounting Reports', 'Financial and accounting reports', 'reports', 300),
  ('messaging', 'Messaging', 'Internal team messaging', 'communication', 310),
  ('announcements', 'Announcements', 'Company announcements', 'communication', 320),
  ('pm_lynk', 'PM LYNK Access', 'PM mobile app access', 'mobile', 330),
  ('punch_clock_app', 'Punch Clock App', 'Punch Clock mobile app access', 'mobile', 340);

-- Triggers for updated_at
CREATE TRIGGER set_subscription_tiers_updated_at
  BEFORE UPDATE ON public.subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_company_subscriptions_updated_at
  BEFORE UPDATE ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
