alter table public.payables_settings
  add column if not exists vendor_portal_require_profile_completion boolean not null default true,
  add column if not exists vendor_portal_require_payment_method boolean not null default true,
  add column if not exists vendor_portal_require_w9 boolean not null default false,
  add column if not exists vendor_portal_require_insurance boolean not null default false,
  add column if not exists vendor_portal_require_company_logo boolean not null default false,
  add column if not exists vendor_portal_require_user_avatar boolean not null default false;

comment on column public.payables_settings.vendor_portal_require_profile_completion is
  'Vendor must complete profile before first invoice submission.';
comment on column public.payables_settings.vendor_portal_require_payment_method is
  'Vendor must configure payment method before first invoice submission.';
comment on column public.payables_settings.vendor_portal_require_w9 is
  'Vendor must upload W-9 compliance document before first invoice submission.';
comment on column public.payables_settings.vendor_portal_require_insurance is
  'Vendor must upload insurance compliance document before first invoice submission.';
comment on column public.payables_settings.vendor_portal_require_company_logo is
  'Vendor must upload company logo before first invoice submission.';
comment on column public.payables_settings.vendor_portal_require_user_avatar is
  'Vendor user must upload avatar before first invoice submission.';
