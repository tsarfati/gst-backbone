alter table public.notification_settings
add column if not exists task_update_notifications boolean not null default true;
