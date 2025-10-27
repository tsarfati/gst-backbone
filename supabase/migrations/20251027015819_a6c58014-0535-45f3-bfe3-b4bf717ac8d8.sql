-- Create job_permits table
CREATE TABLE IF NOT EXISTS public.job_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  permit_name TEXT NOT NULL,
  permit_number TEXT,
  description TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_permits ENABLE ROW LEVEL SECURITY;

-- Create policies for job permits
CREATE POLICY "Users can view permits for their company jobs"
  ON public.job_permits
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Users can create permits for their company jobs"
  ON public.job_permits
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Users can update permits for their company jobs"
  ON public.job_permits
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Users can delete permits for their company jobs"
  ON public.job_permits
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  );

-- Create storage bucket for job permits
INSERT INTO storage.buckets (id, name, public) 
VALUES ('job-permits', 'job-permits', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for job permits
CREATE POLICY "Users can view job permit files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'job-permits');

CREATE POLICY "Users can upload job permit files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'job-permits' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their job permit files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'job-permits' AND
    auth.uid() IS NOT NULL
  );

-- Create indexes for better performance
CREATE INDEX idx_job_permits_job_id ON public.job_permits(job_id);
CREATE INDEX idx_job_permits_company_id ON public.job_permits(company_id);
CREATE INDEX idx_job_permits_uploaded_at ON public.job_permits(uploaded_at DESC);