-- Add PIN field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN pin_code text;

-- Add punch clock login customization settings
CREATE TABLE public.punch_clock_login_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  header_image_url text,
  background_color text DEFAULT '#ffffff',
  primary_color text DEFAULT '#3b82f6',
  logo_url text,
  welcome_message text DEFAULT 'Welcome to Punch Clock',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS on punch clock login settings
ALTER TABLE public.punch_clock_login_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for punch clock login settings
CREATE POLICY "Admins and controllers can manage punch clock login settings"
ON public.punch_clock_login_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

CREATE POLICY "All users can view punch clock login settings"
ON public.punch_clock_login_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_punch_clock_login_settings_updated_at
BEFORE UPDATE ON public.punch_clock_login_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();