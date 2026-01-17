-- Create RFPs table
CREATE TABLE public.rfps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  job_id UUID REFERENCES public.jobs(id),
  rfp_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scope_of_work TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  issue_date DATE,
  due_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create RFP attachments table
CREATE TABLE public.rfp_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create RFP invited vendors table
CREATE TABLE public.rfp_invited_vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  response_status VARCHAR(50) DEFAULT 'pending',
  UNIQUE(rfp_id, vendor_id)
);

-- Create bids table
CREATE TABLE public.bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  bid_amount DECIMAL(15, 2) NOT NULL,
  proposed_timeline VARCHAR(255),
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(rfp_id, vendor_id)
);

-- Create bid attachments table
CREATE TABLE public.bid_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bid scoring criteria table
CREATE TABLE public.bid_scoring_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  criterion_name VARCHAR(100) NOT NULL,
  description TEXT,
  weight DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
  max_score INTEGER NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bid scores table
CREATE TABLE public.bid_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES public.bid_scoring_criteria(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  score INTEGER NOT NULL,
  notes TEXT,
  scored_by UUID NOT NULL,
  scored_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bid_id, criterion_id)
);

-- Enable Row Level Security
ALTER TABLE public.rfps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfp_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfp_invited_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_scoring_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_scores ENABLE ROW LEVEL SECURITY;

-- RFPs policies
CREATE POLICY "Users can view rfps in their company"
ON public.rfps FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create rfps in their company"
ON public.rfps FOR INSERT
WITH CHECK (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update rfps in their company"
ON public.rfps FOR UPDATE
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete rfps in their company"
ON public.rfps FOR DELETE
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

-- RFP attachments policies
CREATE POLICY "Users can view rfp attachments in their company"
ON public.rfp_attachments FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can manage rfp attachments in their company"
ON public.rfp_attachments FOR ALL
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

-- RFP invited vendors policies
CREATE POLICY "Users can view invited vendors in their company"
ON public.rfp_invited_vendors FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can manage invited vendors in their company"
ON public.rfp_invited_vendors FOR ALL
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

-- Bids policies
CREATE POLICY "Users can view bids in their company"
ON public.bids FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create bids in their company"
ON public.bids FOR INSERT
WITH CHECK (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update bids in their company"
ON public.bids FOR UPDATE
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete bids in their company"
ON public.bids FOR DELETE
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

-- Bid attachments policies
CREATE POLICY "Users can view bid attachments in their company"
ON public.bid_attachments FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can manage bid attachments in their company"
ON public.bid_attachments FOR ALL
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

-- Bid scoring criteria policies
CREATE POLICY "Users can view scoring criteria in their company"
ON public.bid_scoring_criteria FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can manage scoring criteria in their company"
ON public.bid_scoring_criteria FOR ALL
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

-- Bid scores policies
CREATE POLICY "Users can view bid scores in their company"
ON public.bid_scores FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can manage bid scores in their company"
ON public.bid_scores FOR ALL
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX idx_rfps_company_id ON public.rfps(company_id);
CREATE INDEX idx_rfps_job_id ON public.rfps(job_id);
CREATE INDEX idx_rfps_status ON public.rfps(status);
CREATE INDEX idx_bids_rfp_id ON public.bids(rfp_id);
CREATE INDEX idx_bids_vendor_id ON public.bids(vendor_id);
CREATE INDEX idx_bid_scores_bid_id ON public.bid_scores(bid_id);
CREATE INDEX idx_bid_scoring_criteria_rfp_id ON public.bid_scoring_criteria(rfp_id);

-- Create trigger for updated_at
CREATE TRIGGER update_rfps_updated_at
BEFORE UPDATE ON public.rfps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bids_updated_at
BEFORE UPDATE ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();