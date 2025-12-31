-- Add customer_id column to jobs table
ALTER TABLE public.jobs 
ADD COLUMN customer_id UUID REFERENCES public.customers(id);

-- Create index for better query performance
CREATE INDEX idx_jobs_customer_id ON public.jobs(customer_id);