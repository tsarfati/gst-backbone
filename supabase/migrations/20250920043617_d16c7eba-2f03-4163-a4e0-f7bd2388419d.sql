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
CREATE POLICY IF NOT EXISTS "Email templates are viewable by authenticated users"
ON public.email_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "Admins or controllers can create templates"
ON public.email_templates FOR INSERT
WITH CHECK (
  created_by = auth.uid() AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
);

CREATE POLICY IF NOT EXISTS "Creators or admins/controllers can update templates"
ON public.email_templates FOR UPDATE
USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role)
);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$ BEGIN
  CREATE TRIGGER set_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
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

CREATE POLICY IF NOT EXISTS "Users can view their own notification settings"
ON public.notification_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can upsert their own notification settings"
ON public.notification_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own notification settings"
ON public.notification_settings FOR UPDATE
USING (auth.uid() = user_id);

DO $$ BEGIN
  CREATE TRIGGER set_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default email templates if none exist
INSERT INTO public.email_templates (key, name, description, subject, html_content, editor_type, created_by)
SELECT t.key, t.name, t.description, t.subject, t.html_content, t.editor_type::public.template_editor, t.created_by
FROM (
  VALUES
    ('overdue_invoice', 'Overdue Invoice Reminder', 'Notifies customers about overdue invoices', 'Invoice {{invoice_number}} is overdue',
     '<h2>Invoice {{invoice_number}} is overdue</h2><p>Dear {{customer_name}},</p><p>This is a reminder that your invoice <strong>{{invoice_number}}</strong> for <strong>{{amount}}</strong> was due on <strong>{{due_date}}</strong>.</p><p>Please make the payment at your earliest convenience.</p><p>Thank you,<br/>{{company_name}}</p>', 'html', gen_random_uuid()),
    ('invoice_paid', 'Invoice Paid Confirmation', 'Confirms payment received', 'Payment received for invoice {{invoice_number}}',
     '<h2>Payment received</h2><p>Hi {{customer_name}},</p><p>We''ve received your payment of <strong>{{amount}}</strong> for invoice <strong>{{invoice_number}}</strong>.</p><p>Receipt attached.</p><p>Regards,<br/>{{company_name}}</p>', 'html', gen_random_uuid()),
    ('vendor_invitation', 'Vendor Invitation', 'Invite a vendor to your portal', 'You are invited to join {{company_name}} vendor portal',
     '<h2>Invitation to join {{company_name}}</h2><p>Hello {{vendor_name}},</p><p>You''ve been invited to join our vendor portal. Click the link below to get started:</p><p><a href="{{invitation_link}}">Accept Invitation</a></p>', 'html', gen_random_uuid()),
    ('job_assignment', 'Job Assignment', 'Notify employees of new job assignment', 'You have been assigned to {{job_name}}',
     '<h2>New Assignment: {{job_name}}</h2><p>Hi {{assignee_name}},</p><p>You have been assigned to {{job_name}} starting {{start_date}}.</p>', 'html', gen_random_uuid()),
    ('receipt_uploaded', 'Receipt Uploaded', 'Notify controller a new receipt was uploaded', 'New receipt uploaded by {{uploader_name}}',
     '<h2>New Receipt Uploaded</h2><p>{{uploader_name}} uploaded a new receipt: {{filename}} for {{amount}}.</p>', 'html', gen_random_uuid())
) AS t(key, name, description, subject, html_content, editor_type, created_by)
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates);
