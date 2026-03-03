-- Add design professional as a first-class system role
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'design_professional';

-- Seed role permissions by copying vendor permissions as a baseline
INSERT INTO public.role_permissions (role, menu_item, can_access)
SELECT
  'design_professional'::public.user_role,
  rp.menu_item,
  rp.can_access
FROM public.role_permissions rp
WHERE rp.role = 'vendor'::public.user_role
ON CONFLICT (role, menu_item) DO NOTHING;

-- Ensure design professional has a default landing page
INSERT INTO public.role_default_pages (role, default_page, created_by)
VALUES (
  'design_professional'::public.user_role,
  '/design-professional/dashboard',
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (role) DO UPDATE
SET default_page = EXCLUDED.default_page;

