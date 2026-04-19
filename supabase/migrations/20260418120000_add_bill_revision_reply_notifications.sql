alter table public.notification_settings
add column if not exists bill_revision_reply_notifications boolean not null default true;
