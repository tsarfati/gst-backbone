CREATE TABLE IF NOT EXISTS public.rfp_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rfp_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view RFP communications" ON public.rfp_communications;
CREATE POLICY "Users can view RFP communications"
ON public.rfp_communications FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = rfp_communications.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can create RFP communications" ON public.rfp_communications;
CREATE POLICY "Users can create RFP communications"
ON public.rfp_communications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = rfp_communications.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can update their own RFP communications" ON public.rfp_communications;
CREATE POLICY "Users can update their own RFP communications"
ON public.rfp_communications FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own RFP communications" ON public.rfp_communications;
CREATE POLICY "Users can delete their own RFP communications"
ON public.rfp_communications FOR DELETE
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_rfp_communications_rfp_id ON public.rfp_communications(rfp_id);
CREATE INDEX IF NOT EXISTS idx_rfp_communications_company_id ON public.rfp_communications(company_id);
CREATE INDEX IF NOT EXISTS idx_rfp_communications_created_at ON public.rfp_communications(created_at DESC);

DROP TRIGGER IF EXISTS update_rfp_communications_updated_at ON public.rfp_communications;
CREATE TRIGGER update_rfp_communications_updated_at
BEFORE UPDATE ON public.rfp_communications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
