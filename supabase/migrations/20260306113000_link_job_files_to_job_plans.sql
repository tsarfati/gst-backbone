alter table public.job_files
add column if not exists source_plan_id uuid references public.job_plans(id) on delete set null;

create unique index if not exists job_files_source_plan_id_unique
on public.job_files(source_plan_id)
where source_plan_id is not null;
