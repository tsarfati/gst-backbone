alter table public.notification_settings
  add column if not exists bill_submission_notifications boolean not null default true,
  add column if not exists payment_approval_notifications boolean not null default true,
  add column if not exists payment_confirmation_notifications boolean not null default true;

