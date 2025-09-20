-- Create enum for template editor types
DO $$ BEGIN
  CREATE TYPE public.template_editor AS ENUM ('richtext', 'html');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Email templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  editor_type public.template_editor NOT NULL DEFAULT 'richtext',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Email templates are viewable by authenticated users"
ON public.email_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins or controllers can create templates"
ON public.email_templates FOR INSERT
WITH CHECK (
  created_by = auth.uid() AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
);

CREATE POLICY "Creators or admins/controllers can update templates"
ON public.email_templates FOR UPDATE
USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role)
);

-- Updated at trigger
DO $$ BEGIN
  CREATE TRIGGER set_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notification settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  overdue_invoices BOOLEAN NOT NULL DEFAULT true,
  invoices_paid BOOLEAN NOT NULL DEFAULT true,
  vendor_invitations BOOLEAN NOT NULL DEFAULT true,
  job_assignments BOOLEAN NOT NULL DEFAULT true,
  receipt_uploaded BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification settings"
ON public.notification_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own notification settings"
ON public.notification_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
ON public.notification_settings FOR UPDATE
USING (auth.uid() = user_id);

DO $$ BEGIN
  CREATE TRIGGER set_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;