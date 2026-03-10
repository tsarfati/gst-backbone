CREATE TABLE IF NOT EXISTS public.rfp_bid_comparison_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfp_bid_comparison_messages_rfp_created_at
  ON public.rfp_bid_comparison_messages(rfp_id, created_at);

CREATE INDEX IF NOT EXISTS idx_rfp_bid_comparison_messages_company_id
  ON public.rfp_bid_comparison_messages(company_id);

ALTER TABLE public.rfp_bid_comparison_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view bid comparison messages for their companies"
  ON public.rfp_bid_comparison_messages;
CREATE POLICY "Users can view bid comparison messages for their companies"
  ON public.rfp_bid_comparison_messages
  FOR SELECT
  USING (
    company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert bid comparison messages for their companies"
  ON public.rfp_bid_comparison_messages;
CREATE POLICY "Users can insert bid comparison messages for their companies"
  ON public.rfp_bid_comparison_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  );
