alter table public.payables_settings
  add column if not exists design_professional_signup_background_color text not null default '#030B20',
  add column if not exists design_professional_signup_modal_color text not null default '#071231',
  add column if not exists design_professional_signup_modal_opacity numeric(4,3) not null default 0.960;

alter table public.payables_settings
  drop constraint if exists payables_settings_design_professional_signup_modal_opacity_check;

alter table public.payables_settings
  add constraint payables_settings_design_professional_signup_modal_opacity_check
  check (
    design_professional_signup_modal_opacity >= 0
    and design_professional_signup_modal_opacity <= 1
  );
