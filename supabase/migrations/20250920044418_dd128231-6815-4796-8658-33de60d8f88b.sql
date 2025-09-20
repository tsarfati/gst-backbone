-- Create enum for punch status
DO $$ BEGIN
  CREATE TYPE public.punch_status AS ENUM ('punched_in', 'punched_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create cost codes table first
CREATE TABLE IF NOT EXISTS public.cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, code)
);

ALTER TABLE public.cost_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cost codes are viewable by authenticated users"
ON public.cost_codes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and controllers can manage cost codes"
ON public.cost_codes FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- Time tracking punch records table
CREATE TABLE IF NOT EXISTS public.punch_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_id UUID REFERENCES public.jobs(id),
  cost_code_id UUID REFERENCES public.cost_codes(id),
  punch_type public.punch_status NOT NULL,
  punch_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.punch_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own punch records"
ON public.punch_records FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own punch records"
ON public.punch_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and controllers can view all punch records"
ON public.punch_records FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- Current punch status tracking
CREATE TABLE IF NOT EXISTS public.current_punch_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  job_id UUID REFERENCES public.jobs(id),
  cost_code_id UUID REFERENCES public.cost_codes(id),
  punch_in_time TIMESTAMPTZ NOT NULL,
  punch_in_location_lat DECIMAL(10, 8),
  punch_in_location_lng DECIMAL(11, 8),
  punch_in_photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.current_punch_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own punch status"
ON public.current_punch_status FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own punch status"
ON public.current_punch_status FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and controllers can view all punch status"
ON public.current_punch_status FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- Add triggers for updated_at
DO $$ BEGIN
  CREATE TRIGGER set_cost_codes_updated_at
  BEFORE UPDATE ON public.cost_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_current_punch_status_updated_at
  BEFORE UPDATE ON public.current_punch_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create storage bucket for punch photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'punch-photos', 
  'punch-photos', 
  false, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for punch photos
DO $$ BEGIN
  CREATE POLICY "Users can view their own punch photos" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'punch-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can upload their own punch photos" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'punch-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all punch photos" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'punch-photos' AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed some default cost codes for existing jobs
INSERT INTO public.cost_codes (job_id, code, description)
SELECT id, unnest(ARRAY['LAB', 'MAT', 'EQP', 'SUB', 'TRV']), 
       unnest(ARRAY['Labor', 'Materials', 'Equipment', 'Subcontractors', 'Travel'])
FROM public.jobs
WHERE id IN (SELECT id FROM public.jobs LIMIT 5)
ON CONFLICT (job_id, code) DO NOTHING;