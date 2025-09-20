-- Create job_status enum
CREATE TYPE job_status AS ENUM ('planning', 'active', 'on-hold', 'completed');

-- Create job_type enum  
CREATE TYPE job_type AS ENUM ('residential', 'commercial', 'industrial', 'renovation', 'maintenance');

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client TEXT,
  address TEXT,
  job_type job_type DEFAULT 'residential',
  status job_status DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2),
  description TEXT,
  project_manager_user_id UUID REFERENCES public.profiles(user_id),
  created_by UUID NOT NULL REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for jobs table
CREATE POLICY "Users can view all jobs" 
ON public.jobs 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create jobs" 
ON public.jobs 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project managers and admins can update jobs" 
ON public.jobs 
FOR UPDATE 
USING (
  auth.uid() = created_by OR 
  auth.uid() = project_manager_user_id OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'controller')
);

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- Create policies for receipts storage
CREATE POLICY "Users can view their own receipts" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload receipts" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own receipts" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own receipts" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updating updated_at timestamp
CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();