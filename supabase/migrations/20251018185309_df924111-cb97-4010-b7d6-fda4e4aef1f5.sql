-- Create file upload settings table
CREATE TABLE IF NOT EXISTS public.file_upload_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- File naming patterns
  receipt_naming_pattern TEXT DEFAULT '{vendor}_{date}_{amount}',
  bill_naming_pattern TEXT DEFAULT '{vendor}_{invoice_number}_{date}',
  subcontract_naming_pattern TEXT DEFAULT '{vendor}_{contract_number}_{date}',
  
  -- Available variables info stored as JSONB
  naming_variables JSONB DEFAULT '{
    "receipt": ["vendor", "date", "amount", "job", "cost_code", "original_filename"],
    "bill": ["vendor", "invoice_number", "date", "amount", "job", "original_filename"],
    "subcontract": ["vendor", "contract_number", "date", "amount", "job", "original_filename"]
  }'::jsonb,
  
  -- 3rd party storage settings
  enable_google_drive BOOLEAN DEFAULT false,
  google_drive_folder_id TEXT,
  
  enable_onedrive BOOLEAN DEFAULT false,
  onedrive_folder_id TEXT,
  
  enable_ftp BOOLEAN DEFAULT false,
  ftp_host TEXT,
  ftp_port INTEGER DEFAULT 21,
  ftp_username TEXT,
  ftp_password TEXT, -- Should be encrypted in production
  ftp_folder_path TEXT DEFAULT '/',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.file_upload_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and controllers can manage file upload settings"
  ON public.file_upload_settings
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
      WHERE role IN ('admin', 'controller')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
      WHERE role IN ('admin', 'controller')
    )
  );

CREATE POLICY "Users can view file upload settings for their companies"
  ON public.file_upload_settings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  );

-- Update trigger
CREATE TRIGGER update_file_upload_settings_updated_at
  BEFORE UPDATE ON public.file_upload_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();