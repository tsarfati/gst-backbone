-- Task email tracking: one tracking inbox per task + inbound/outbound email log.
CREATE TABLE IF NOT EXISTS public.task_email_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tracking_local_part TEXT NOT NULL UNIQUE,
  tracking_email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id)
);

CREATE TABLE IF NOT EXISTS public.task_email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
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

ALTER TABLE public.task_email_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view task email channels" ON public.task_email_channels;
CREATE POLICY "Users can view task email channels"
ON public.task_email_channels FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = task_email_channels.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can create task email channels" ON public.task_email_channels;
CREATE POLICY "Users can create task email channels"
ON public.task_email_channels FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = task_email_channels.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can update task email channels" ON public.task_email_channels;
CREATE POLICY "Users can update task email channels"
ON public.task_email_channels FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = task_email_channels.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can view task email messages" ON public.task_email_messages;
CREATE POLICY "Users can view task email messages"
ON public.task_email_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = task_email_messages.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can create task email messages" ON public.task_email_messages;
CREATE POLICY "Users can create task email messages"
ON public.task_email_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = task_email_messages.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

CREATE INDEX IF NOT EXISTS idx_task_email_channels_task_id ON public.task_email_channels (task_id);
CREATE INDEX IF NOT EXISTS idx_task_email_channels_company_id ON public.task_email_channels (company_id);
CREATE INDEX IF NOT EXISTS idx_task_email_messages_task_id_created_at ON public.task_email_messages (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_email_messages_provider_message_id ON public.task_email_messages (provider_message_id);

DROP TRIGGER IF EXISTS update_task_email_channels_updated_at ON public.task_email_channels;
CREATE TRIGGER update_task_email_channels_updated_at
BEFORE UPDATE ON public.task_email_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
