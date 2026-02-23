
-- Add trade column to job_permits
ALTER TABLE public.job_permits ADD COLUMN IF NOT EXISTS trade text;
ALTER TABLE public.job_permits ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.job_permits ADD COLUMN IF NOT EXISTS expiration_date date;
ALTER TABLE public.job_permits ADD COLUMN IF NOT EXISTS issue_date date;
ALTER TABLE public.job_permits ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;

-- Company files table: links company-level docs to job filing cabinet
CREATE TABLE public.company_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category text NOT NULL, -- 'permit', 'contract', 'insurance', 'general'
  name text NOT NULL,
  description text,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint DEFAULT 0,
  file_type text,
  -- Optional job linkage
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  -- Reference to the actual file in job filing cabinet
  filing_document_id UUID REFERENCES public.job_filing_documents(id) ON DELETE SET NULL,
  -- Category-specific fields
  trade text, -- for permits
  permit_number text, -- for permits
  policy_number text, -- for insurance
  contract_value numeric, -- for contracts
  status text DEFAULT 'active', -- active, expiring, expired, pending
  issue_date date,
  expiration_date date,
  -- Metadata
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company files" ON public.company_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid() AND uca.company_id = company_files.company_id AND uca.is_active = true
    )
  );

CREATE POLICY "Users can insert company files" ON public.company_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid() AND uca.company_id = company_files.company_id AND uca.is_active = true
    )
  );

CREATE POLICY "Users can update company files" ON public.company_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid() AND uca.company_id = company_files.company_id AND uca.is_active = true
    )
  );

CREATE POLICY "Users can delete company files" ON public.company_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid() AND uca.company_id = company_files.company_id AND uca.is_active = true
    )
  );

-- Google Drive sync settings per job
CREATE TABLE public.google_drive_sync_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  -- What to sync for this job (NULL job_id = company-level settings)
  sync_photos boolean DEFAULT false,
  sync_filing_cabinet boolean DEFAULT false,
  sync_subcontracts boolean DEFAULT false,
  sync_permits boolean DEFAULT false,
  sync_delivery_tickets boolean DEFAULT false,
  sync_receipts boolean DEFAULT false,
  sync_bills boolean DEFAULT false,
  -- Company-level sync options (when job_id is NULL)
  sync_company_permits boolean DEFAULT false,
  sync_company_contracts boolean DEFAULT false,
  sync_company_insurance boolean DEFAULT false,
  sync_company_files boolean DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, job_id)
);

ALTER TABLE public.google_drive_sync_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync settings" ON public.google_drive_sync_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid() AND uca.company_id = google_drive_sync_settings.company_id AND uca.is_active = true
    )
  );

CREATE POLICY "Admins can manage sync settings" ON public.google_drive_sync_settings
  FOR ALL USING (
    public.is_company_admin_or_controller(auth.uid(), company_id)
  );

-- Trigger for updated_at
CREATE TRIGGER set_company_files_updated_at
  BEFORE UPDATE ON public.company_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_google_drive_sync_updated_at
  BEFORE UPDATE ON public.google_drive_sync_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
