alter table public.payables_settings
  add column if not exists design_professional_portal_enabled boolean not null default true,
  add column if not exists design_professional_signup_background_image_url text,
  add column if not exists design_professional_signup_logo_url text,
  add column if not exists design_professional_signup_header_title text,
  add column if not exists design_professional_signup_header_subtitle text;

update public.payables_settings
set
  design_professional_signup_header_title = coalesce(design_professional_signup_header_title, 'Design Professional Signup'),
  design_professional_signup_header_subtitle = coalesce(design_professional_signup_header_subtitle, 'Create your design professional account and request company approval.')
where true;
