-- Bid email tracking: one tracking inbox per bid + inbound/outbound email log.
CREATE TABLE IF NOT EXISTS public.bid_email_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  tracking_local_part TEXT NOT NULL UNIQUE,
  tracking_email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bid_id)
);

CREATE TABLE IF NOT EXISTS public.bid_email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT,
  to_emails TEXT[] NOT NULL DEFAULT '{}',
  cc_emails TEXT[] NOT NULL DEFAULT '{}',
  bcc_emails TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  provider_message_id TEXT,
  provider_thread_id TEXT,
  message_source TEXT NOT NULL DEFAULT 'email',
  sent_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bid_email_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view bid email channels" ON public.bid_email_channels;
CREATE POLICY "Users can view bid email channels"
ON public.bid_email_channels FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_email_channels.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can create bid email channels" ON public.bid_email_channels;
CREATE POLICY "Users can create bid email channels"
ON public.bid_email_channels FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_email_channels.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can update bid email channels" ON public.bid_email_channels;
CREATE POLICY "Users can update bid email channels"
ON public.bid_email_channels FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_email_channels.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can view bid email messages" ON public.bid_email_messages;
CREATE POLICY "Users can view bid email messages"
ON public.bid_email_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_email_messages.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can create bid email messages" ON public.bid_email_messages;
CREATE POLICY "Users can create bid email messages"
ON public.bid_email_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_email_messages.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

CREATE INDEX IF NOT EXISTS idx_bid_email_channels_bid_id ON public.bid_email_channels (bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_email_channels_company_id ON public.bid_email_channels (company_id);
CREATE INDEX IF NOT EXISTS idx_bid_email_messages_bid_id_created_at ON public.bid_email_messages (bid_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bid_email_messages_provider_message_id ON public.bid_email_messages (provider_message_id);

DROP TRIGGER IF EXISTS update_bid_email_channels_updated_at ON public.bid_email_channels;
CREATE TRIGGER update_bid_email_channels_updated_at
BEFORE UPDATE ON public.bid_email_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
