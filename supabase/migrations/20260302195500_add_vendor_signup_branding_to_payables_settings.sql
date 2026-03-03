alter table public.payables_settings
  add column if not exists vendor_portal_signup_background_image_url text,
  add column if not exists vendor_portal_signup_company_logo_url text,
  add column if not exists vendor_portal_signup_header_logo_url text,
  add column if not exists vendor_portal_signup_header_title text,
  add column if not exists vendor_portal_signup_header_subtitle text;

comment on column public.payables_settings.vendor_portal_signup_background_image_url is
  'Background image URL for the public vendor signup page.';
comment on column public.payables_settings.vendor_portal_signup_company_logo_url is
  'Company logo override URL for the public vendor signup page.';
comment on column public.payables_settings.vendor_portal_signup_header_logo_url is
  'Header logo URL shown near top of public vendor signup page.';
comment on column public.payables_settings.vendor_portal_signup_header_title is
  'Custom header title text for public vendor signup page.';
comment on column public.payables_settings.vendor_portal_signup_header_subtitle is
  'Custom header subtitle text for public vendor signup page.';
