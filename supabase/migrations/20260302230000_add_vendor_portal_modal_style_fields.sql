alter table if exists public.payables_settings
  add column if not exists vendor_portal_signup_background_color text not null default '#030B20',
  add column if not exists vendor_portal_signup_modal_color text not null default '#071231',
  add column if not exists vendor_portal_signup_modal_opacity numeric(4,3) not null default 0.960;

alter table if exists public.payables_settings
  drop constraint if exists payables_settings_vendor_portal_signup_modal_opacity_check;

alter table if exists public.payables_settings
  add constraint payables_settings_vendor_portal_signup_modal_opacity_check
  check (vendor_portal_signup_modal_opacity >= 0 and vendor_portal_signup_modal_opacity <= 1);
