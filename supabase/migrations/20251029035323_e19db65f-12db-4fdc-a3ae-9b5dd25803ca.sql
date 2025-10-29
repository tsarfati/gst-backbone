-- Create plan tables if missing
CREATE TABLE IF NOT EXISTS public.plan_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.job_plans(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  page_title TEXT,
  page_description TEXT,
  sheet_number TEXT,
  discipline TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(plan_id, page_number)
);

CREATE TABLE IF NOT EXISTS public.plan_markups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.job_plans(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  user_id UUID NOT NULL,
  markup_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.job_plans(id) ON DELETE CASCADE,
  page_number INTEGER,
  user_id UUID NOT NULL,
  comment_text TEXT NOT NULL,
  x_position DECIMAL,
  y_position DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plan_pages_plan_id ON public.plan_pages(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_markups_plan_page ON public.plan_markups(plan_id, page_number);
CREATE INDEX IF NOT EXISTS idx_plan_comments_plan_page ON public.plan_comments(plan_id, page_number);

-- Enable RLS
ALTER TABLE public.plan_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_markups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_comments ENABLE ROW LEVEL SECURITY;

-- Policies: scope by company via job_plans -> jobs and get_user_companies
DROP POLICY IF EXISTS "Users can view plan pages for their company jobs" ON public.plan_pages;
CREATE POLICY "Users can view plan pages for their company jobs"
ON public.plan_pages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_plans jp
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE jp.id = plan_pages.plan_id
      AND j.company_id IN (
        SELECT company_id FROM public.get_user_companies(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can insert plan pages for their company jobs" ON public.plan_pages;
CREATE POLICY "Users can insert plan pages for their company jobs"
ON public.plan_pages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_plans jp
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE jp.id = plan_pages.plan_id
      AND j.company_id IN (
        SELECT company_id FROM public.get_user_companies(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can update plan pages for their company jobs" ON public.plan_pages;
CREATE POLICY "Users can update plan pages for their company jobs"
ON public.plan_pages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.job_plans jp
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE jp.id = plan_pages.plan_id
      AND j.company_id IN (
        SELECT company_id FROM public.get_user_companies(auth.uid())
      )
  )
);

-- plan_markups policies
DROP POLICY IF EXISTS "Users can view markups for their company jobs" ON public.plan_markups;
CREATE POLICY "Users can view markups for their company jobs"
ON public.plan_markups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_plans jp
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE jp.id = plan_markups.plan_id
      AND j.company_id IN (
        SELECT company_id FROM public.get_user_companies(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can insert their own markups" ON public.plan_markups;
CREATE POLICY "Users can insert their own markups"
ON public.plan_markups FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.job_plans jp
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE jp.id = plan_markups.plan_id
      AND j.company_id IN (
        SELECT company_id FROM public.get_user_companies(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can update their own markups" ON public.plan_markups;
CREATE POLICY "Users can update their own markups"
ON public.plan_markups FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own markups" ON public.plan_markups;
CREATE POLICY "Users can delete their own markups"
ON public.plan_markups FOR DELETE
USING (auth.uid() = user_id);

-- plan_comments policies
DROP POLICY IF EXISTS "Users can view comments for their company jobs" ON public.plan_comments;
CREATE POLICY "Users can view comments for their company jobs"
ON public.plan_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_plans jp
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE jp.id = plan_comments.plan_id
      AND j.company_id IN (
        SELECT company_id FROM public.get_user_companies(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can insert their own comments" ON public.plan_comments;
CREATE POLICY "Users can insert their own comments"
ON public.plan_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.job_plans jp
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE jp.id = plan_comments.plan_id
      AND j.company_id IN (
        SELECT company_id FROM public.get_user_companies(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can update their own comments" ON public.plan_comments;
CREATE POLICY "Users can update their own comments"
ON public.plan_comments FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.plan_comments;
CREATE POLICY "Users can delete their own comments"
ON public.plan_comments FOR DELETE
USING (auth.uid() = user_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plan_pages_updated_at ON public.plan_pages;
CREATE TRIGGER trg_plan_pages_updated_at
BEFORE UPDATE ON public.plan_pages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_plan_markups_updated_at ON public.plan_markups;
CREATE TRIGGER trg_plan_markups_updated_at
BEFORE UPDATE ON public.plan_markups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_plan_comments_updated_at ON public.plan_comments;
CREATE TRIGGER trg_plan_comments_updated_at
BEFORE UPDATE ON public.plan_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();