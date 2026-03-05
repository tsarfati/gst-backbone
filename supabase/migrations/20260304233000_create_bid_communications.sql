-- Bid communications for team notes and vendor-facing conversations.
CREATE TABLE IF NOT EXISTS public.bid_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'intercompany' CHECK (message_type IN ('intercompany', 'vendor')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bid_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view bid communications" ON public.bid_communications;
CREATE POLICY "Users can view bid communications"
ON public.bid_communications FOR SELECT
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = bid_communications.company_id
        AND COALESCE(uca.is_active, true) = true
        AND uca.role::text NOT IN ('vendor', 'design_professional')
    )
  )
  OR
  (
    public.is_vendor_user(auth.uid())
    AND bid_communications.vendor_id = public.get_user_vendor_id(auth.uid())
    AND bid_communications.message_type = 'vendor'
    AND EXISTS (
      SELECT 1
      FROM public.bids b
      JOIN public.rfp_invited_vendors riv
        ON riv.rfp_id = b.rfp_id
       AND riv.company_id = b.company_id
       AND riv.vendor_id = bid_communications.vendor_id
      WHERE b.id = bid_communications.bid_id
        AND b.company_id = bid_communications.company_id
    )
  )
);

DROP POLICY IF EXISTS "Users can create bid communications" ON public.bid_communications;
CREATE POLICY "Users can create bid communications"
ON public.bid_communications FOR INSERT
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = bid_communications.company_id
        AND COALESCE(uca.is_active, true) = true
        AND uca.role::text NOT IN ('vendor', 'design_professional')
    )
  )
  OR
  (
    public.is_vendor_user(auth.uid())
    AND bid_communications.vendor_id = public.get_user_vendor_id(auth.uid())
    AND bid_communications.message_type = 'vendor'
    AND EXISTS (
      SELECT 1
      FROM public.bids b
      JOIN public.rfp_invited_vendors riv
        ON riv.rfp_id = b.rfp_id
       AND riv.company_id = b.company_id
       AND riv.vendor_id = bid_communications.vendor_id
      WHERE b.id = bid_communications.bid_id
        AND b.company_id = bid_communications.company_id
    )
  )
);

DROP POLICY IF EXISTS "Users can update their own bid communications" ON public.bid_communications;
CREATE POLICY "Users can update their own bid communications"
ON public.bid_communications FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own bid communications" ON public.bid_communications;
CREATE POLICY "Users can delete their own bid communications"
ON public.bid_communications FOR DELETE
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_bid_communications_bid_id ON public.bid_communications(bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_communications_company_id ON public.bid_communications(company_id);
CREATE INDEX IF NOT EXISTS idx_bid_communications_vendor_id ON public.bid_communications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bid_communications_created_at ON public.bid_communications(created_at DESC);

DROP TRIGGER IF EXISTS update_bid_communications_updated_at ON public.bid_communications;
CREATE TRIGGER update_bid_communications_updated_at
BEFORE UPDATE ON public.bid_communications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
