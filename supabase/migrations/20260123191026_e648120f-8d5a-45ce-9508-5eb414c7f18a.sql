-- Add the demo user as a super admin
INSERT INTO public.super_admins (user_id)
VALUES ('843e8c84-c08e-4b50-ba5d-0a6d1a4608d7')
ON CONFLICT DO NOTHING;

-- Create the sandbox tenant
INSERT INTO public.tenants (id, name, slug, subscription_tier, is_active)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'BuilderLynk Sandbox',
  'builderlynk-sandbox',
  'professional',
  true
)
ON CONFLICT DO NOTHING;

-- Add the demo user as tenant owner
INSERT INTO public.tenant_members (tenant_id, user_id, role)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7',
  'owner'
)
ON CONFLICT DO NOTHING;

-- Create the sandbox company under this tenant
INSERT INTO public.companies (id, name, display_name, tenant_id, created_by, is_active)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'Apex Construction Co',
  'Apex Construction Co.',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7',
  true
)
ON CONFLICT DO NOTHING;

-- Grant the demo user admin access to the company
INSERT INTO public.user_company_access (user_id, company_id, role, granted_by, is_active)
VALUES (
  '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7',
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'admin',
  '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7',
  true
)
ON CONFLICT DO NOTHING;

-- Update the existing profile for the demo user
UPDATE public.profiles 
SET 
  first_name = 'Demo',
  last_name = 'User',
  current_company_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  status = 'approved'
WHERE user_id = '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7';