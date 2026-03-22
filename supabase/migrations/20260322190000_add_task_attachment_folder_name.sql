alter table public.task_attachments
add column if not exists folder_name text;

create index if not exists idx_task_attachments_task_id_folder_name
on public.task_attachments (task_id, folder_name);
