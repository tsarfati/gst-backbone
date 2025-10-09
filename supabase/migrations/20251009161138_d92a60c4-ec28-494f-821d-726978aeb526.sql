-- Create job_photos table for job photo album
CREATE TABLE public.job_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  photo_url TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view job photos for jobs they have access to"
ON public.job_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = j.company_id
    WHERE j.id = job_photos.job_id
  )
);

CREATE POLICY "Users can create job photos"
ON public.job_photos
FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by AND
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = j.company_id
    WHERE j.id = job_photos.job_id
  )
);

CREATE POLICY "Users can delete their own job photos"
ON public.job_photos
FOR DELETE
USING (auth.uid() = uploaded_by);

-- Create trigger for updated_at
CREATE TRIGGER update_job_photos_updated_at
BEFORE UPDATE ON public.job_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();