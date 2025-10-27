-- Create enum for RFI ball-in-court status
CREATE TYPE public.rfi_ball_status AS ENUM ('manager', 'design_professional');

-- Create enum for RFI status
CREATE TYPE public.rfi_status AS ENUM ('draft', 'submitted', 'in_review', 'responded', 'closed');

-- Create RFIs table
CREATE TABLE public.rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_number TEXT NOT NULL,
  job_id UUID NOT NULL,
  company_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  assigned_to UUID,
  status public.rfi_status NOT NULL DEFAULT 'draft',
  ball_in_court public.rfi_ball_status NOT NULL DEFAULT 'manager',
  due_date DATE,
  response TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, rfi_number)
);

-- Create RFI attachments table
CREATE TABLE public.rfi_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create RFI messages table
CREATE TABLE public.rfi_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plans table
CREATE TABLE public.job_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  company_id UUID NOT NULL,
  plan_name TEXT NOT NULL,
  plan_number TEXT,
  revision TEXT,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfi_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfi_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rfis
CREATE POLICY "Users can view RFIs for their companies"
ON public.rfis FOR SELECT
TO authenticated
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
));

CREATE POLICY "Users can create RFIs for their companies"
ON public.rfis FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
  )
);

CREATE POLICY "Users can update RFIs for their companies"
ON public.rfis FOR UPDATE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
));

CREATE POLICY "Admins can delete RFIs"
ON public.rfis FOR DELETE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
  WHERE role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
));

-- RLS Policies for rfi_attachments
CREATE POLICY "Users can view RFI attachments for their companies"
ON public.rfi_attachments FOR SELECT
TO authenticated
USING (rfi_id IN (
  SELECT id FROM public.rfis WHERE company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
  )
));

CREATE POLICY "Users can create RFI attachments"
ON public.rfi_attachments FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND
  rfi_id IN (
    SELECT id FROM public.rfis WHERE company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  )
);

CREATE POLICY "Users can delete their own RFI attachments"
ON public.rfi_attachments FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid() OR
  rfi_id IN (
    SELECT id FROM public.rfis WHERE company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
      WHERE role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
    )
  )
);

-- RLS Policies for rfi_messages
CREATE POLICY "Users can view RFI messages for their companies"
ON public.rfi_messages FOR SELECT
TO authenticated
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
));

CREATE POLICY "Users can create RFI messages"
ON public.rfi_messages FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
  )
);

-- RLS Policies for job_plans
CREATE POLICY "Users can view plans for their companies"
ON public.job_plans FOR SELECT
TO authenticated
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
));

CREATE POLICY "Users can create plans for their companies"
ON public.job_plans FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND
  company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
  )
);

CREATE POLICY "Users can update plans for their companies"
ON public.job_plans FOR UPDATE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
));

CREATE POLICY "Users can delete plans for their companies"
ON public.job_plans FOR DELETE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
));

-- Create indexes
CREATE INDEX idx_rfis_job_id ON public.rfis(job_id);
CREATE INDEX idx_rfis_company_id ON public.rfis(company_id);
CREATE INDEX idx_rfis_status ON public.rfis(status);
CREATE INDEX idx_rfis_ball_in_court ON public.rfis(ball_in_court);
CREATE INDEX idx_rfi_attachments_rfi_id ON public.rfi_attachments(rfi_id);
CREATE INDEX idx_rfi_messages_rfi_id ON public.rfi_messages(rfi_id);
CREATE INDEX idx_job_plans_job_id ON public.job_plans(job_id);

-- Create trigger for updated_at
CREATE TRIGGER update_rfis_updated_at
BEFORE UPDATE ON public.rfis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_plans_updated_at
BEFORE UPDATE ON public.job_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();