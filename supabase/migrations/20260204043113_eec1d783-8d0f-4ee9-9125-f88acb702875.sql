-- Create job-specific visitor settings table for confirmation and checkout messages
CREATE TABLE public.job_visitor_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  confirmation_title TEXT DEFAULT 'Welcome to the Job Site!',
  confirmation_message TEXT DEFAULT 'Thank you for checking in. Please follow all safety protocols.',
  checkout_title TEXT DEFAULT 'Successfully Checked Out',
  checkout_message TEXT DEFAULT 'Thank you for visiting. Have a safe trip!',
  checkout_show_duration BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);

-- Enable Row Level Security
ALTER TABLE public.job_visitor_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for job_visitor_settings
CREATE POLICY "Users can view job visitor settings for their company"
ON public.job_visitor_settings
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM user_company_access WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert job visitor settings for their company"
ON public.job_visitor_settings
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_company_access WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update job visitor settings for their company"
ON public.job_visitor_settings
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM user_company_access WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete job visitor settings for their company"
ON public.job_visitor_settings
FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM user_company_access WHERE user_id = auth.uid()
  )
);

-- Allow public read access for visitors checking in/out (they need to see the messages)
CREATE POLICY "Public can read job visitor settings"
ON public.job_visitor_settings
FOR SELECT
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_job_visitor_settings_updated_at
BEFORE UPDATE ON public.job_visitor_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();