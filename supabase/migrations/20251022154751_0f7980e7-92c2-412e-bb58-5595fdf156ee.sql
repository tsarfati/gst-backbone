-- Create photo_albums table
CREATE TABLE public.photo_albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  is_auto_employee_album BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.photo_albums ENABLE ROW LEVEL SECURITY;

-- Create policies for photo_albums
CREATE POLICY "Users can view photo albums for jobs they have access to"
ON public.photo_albums
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = j.company_id
    WHERE j.id = photo_albums.job_id
  ) OR auth.uid() IS NULL
);

CREATE POLICY "Users can create photo albums"
ON public.photo_albums
FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = j.company_id
    WHERE j.id = photo_albums.job_id
  )
);

CREATE POLICY "Users can update photo albums they created"
ON public.photo_albums
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete photo albums they created"
ON public.photo_albums
FOR DELETE
USING (auth.uid() = created_by);

-- Create photo_comments table
CREATE TABLE public.photo_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES public.job_photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for photo_comments
CREATE POLICY "Users can view photo comments for photos they have access to"
ON public.photo_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_photos jp
    JOIN public.jobs j ON j.id = jp.job_id
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = j.company_id
    WHERE jp.id = photo_comments.photo_id
  ) OR auth.uid() IS NULL
);

CREATE POLICY "Users can create photo comments"
ON public.photo_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.job_photos jp
    JOIN public.jobs j ON j.id = jp.job_id
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = j.company_id
    WHERE jp.id = photo_comments.photo_id
  )
);

CREATE POLICY "Users can update their own comments"
ON public.photo_comments
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.photo_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Add album_id and location fields to job_photos
ALTER TABLE public.job_photos ADD COLUMN album_id UUID REFERENCES public.photo_albums(id) ON DELETE SET NULL;
ALTER TABLE public.job_photos ADD COLUMN location_lat NUMERIC;
ALTER TABLE public.job_photos ADD COLUMN location_lng NUMERIC;
ALTER TABLE public.job_photos ADD COLUMN location_address TEXT;

-- Create triggers for updated_at
CREATE TRIGGER update_photo_albums_updated_at
BEFORE UPDATE ON public.photo_albums
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_photo_comments_updated_at
BEFORE UPDATE ON public.photo_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get or create employee uploads album
CREATE OR REPLACE FUNCTION public.get_or_create_employee_album(p_job_id UUID, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_album_id UUID;
BEGIN
  -- Try to find existing employee album
  SELECT id INTO v_album_id
  FROM public.photo_albums
  WHERE job_id = p_job_id AND is_auto_employee_album = true
  LIMIT 1;

  -- Create if doesn't exist
  IF v_album_id IS NULL THEN
    INSERT INTO public.photo_albums (job_id, name, description, created_by, is_auto_employee_album)
    VALUES (p_job_id, 'Employee Uploads', 'Automatic album for employee-uploaded photos', p_user_id, true)
    RETURNING id INTO v_album_id;
  END IF;

  RETURN v_album_id;
END;
$$;