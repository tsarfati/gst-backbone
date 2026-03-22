alter table public.tasks
add column if not exists is_due_asap boolean not null default false;
