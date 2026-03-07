CREATE TABLE IF NOT EXISTS public.plan_ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.job_plans(id) ON DELETE CASCADE,
  page_number INTEGER,
  user_id UUID NOT NULL,
  question TEXT,
  answer TEXT NOT NULL,
  confidence TEXT,
  citations JSONB,
  trace_id TEXT,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_ai_feedback_plan_id ON public.plan_ai_feedback(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_ai_feedback_plan_page ON public.plan_ai_feedback(plan_id, page_number);
CREATE INDEX IF NOT EXISTS idx_plan_ai_feedback_user_id ON public.plan_ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_ai_feedback_created_at ON public.plan_ai_feedback(created_at DESC);

ALTER TABLE public.plan_ai_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view AI feedback for their company jobs" ON public.plan_ai_feedback;
CREATE POLICY "Users can view AI feedback for their company jobs"
ON public.plan_ai_feedback FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.job_plans jp
    WHERE jp.id = plan_ai_feedback.plan_id
      AND public.user_can_access_job(auth.uid(), jp.job_id)
  )
);

DROP POLICY IF EXISTS "Users can insert their own AI feedback" ON public.plan_ai_feedback;
CREATE POLICY "Users can insert their own AI feedback"
ON public.plan_ai_feedback FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.job_plans jp
    WHERE jp.id = plan_ai_feedback.plan_id
      AND public.user_can_access_job(auth.uid(), jp.job_id)
  )
);

DROP POLICY IF EXISTS "Users can update their own AI feedback" ON public.plan_ai_feedback;
CREATE POLICY "Users can update their own AI feedback"
ON public.plan_ai_feedback FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own AI feedback" ON public.plan_ai_feedback;
CREATE POLICY "Users can delete their own AI feedback"
ON public.plan_ai_feedback FOR DELETE
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_plan_ai_feedback_updated_at ON public.plan_ai_feedback;
CREATE TRIGGER trg_plan_ai_feedback_updated_at
BEFORE UPDATE ON public.plan_ai_feedback
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
