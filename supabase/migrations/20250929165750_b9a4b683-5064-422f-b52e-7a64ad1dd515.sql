-- Create notification_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    email_enabled boolean DEFAULT true,
    in_app_enabled boolean DEFAULT true,
    overdue_invoices boolean DEFAULT true,
    invoices_paid boolean DEFAULT true,
    vendor_invitations boolean DEFAULT true,
    job_assignments boolean DEFAULT true,
    receipt_uploaded boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(user_id, company_id)
);

-- Enable RLS on notification_settings
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notification_settings
CREATE POLICY "Users can view their own notification settings for their companies"
ON public.notification_settings FOR SELECT
USING (
    user_id = auth.uid() AND 
    company_id IN (
        SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
    )
);

CREATE POLICY "Users can manage their own notification settings for their companies"
ON public.notification_settings FOR ALL
USING (
    user_id = auth.uid() AND 
    company_id IN (
        SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
    )
)
WITH CHECK (
    user_id = auth.uid() AND 
    company_id IN (
        SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
    )
);

-- Add updated_at trigger for notification_settings
CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON public.notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();