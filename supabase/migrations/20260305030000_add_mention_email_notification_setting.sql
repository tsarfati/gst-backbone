alter table public.notification_settings
  add column if not exists mention_email_notifications boolean not null default true;

comment on column public.notification_settings.mention_email_notifications is
  'Controls whether user receives email notifications when mentioned.';
