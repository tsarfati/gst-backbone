
-- Create storage bucket for job filing cabinet files
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-filing-cabinet', 'job-filing-cabinet', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job filing cabinet
CREATE POLICY "Authenticated users can upload job files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-filing-cabinet');

CREATE POLICY "Authenticated users can view job files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'job-filing-cabinet');

CREATE POLICY "Authenticated users can update job files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'job-filing-cabinet');

CREATE POLICY "Authenticated users can delete job files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'job-filing-cabinet');

-- Job folders table
CREATE TABLE public.job_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_folder_id UUID REFERENCES public.job_folders(id) ON DELETE CASCADE,
  is_system_folder BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view job folders in their company"
ON public.job_folders FOR SELECT
TO authenticated
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create job folders in their company"
ON public.job_folders FOR INSERT
TO authenticated
WITH CHECK (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update job folders in their company"
ON public.job_folders FOR UPDATE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete non-system job folders in their company"
ON public.job_folders FOR DELETE
TO authenticated
USING (
  is_system_folder = false AND
  company_id IN (
    SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
  )
);

-- Job files table
CREATE TABLE public.job_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.job_folders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view job files in their company"
ON public.job_files FOR SELECT
TO authenticated
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can upload job files in their company"
ON public.job_files FOR INSERT
TO authenticated
WITH CHECK (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update job files in their company"
ON public.job_files FOR UPDATE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete job files in their company"
ON public.job_files FOR DELETE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

-- User email/SMTP settings table
CREATE TABLE public.user_email_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_username TEXT,
  smtp_password_encrypted TEXT,
  imap_host TEXT,
  imap_port INTEGER DEFAULT 993,
  imap_username TEXT,
  imap_password_encrypted TEXT,
  from_email TEXT,
  from_name TEXT,
  use_ssl BOOLEAN DEFAULT true,
  is_configured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email settings"
ON public.user_email_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own email settings"
ON public.user_email_settings FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own email settings"
ON public.user_email_settings FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_job_folders_updated_at
BEFORE UPDATE ON public.job_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_files_updated_at
BEFORE UPDATE ON public.job_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_email_settings_updated_at
BEFORE UPDATE ON public.user_email_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
