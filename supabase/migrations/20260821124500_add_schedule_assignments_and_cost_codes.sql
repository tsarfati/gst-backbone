alter table public.job_schedule_items
  add column if not exists cost_code_id uuid references public.cost_codes(id) on delete set null;

create table if not exists public.job_schedule_item_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  schedule_item_id uuid not null references public.job_schedule_items(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_item_id, user_id)
);

create index if not exists idx_job_schedule_item_assignments_item_id
  on public.job_schedule_item_assignments(schedule_item_id);

create index if not exists idx_job_schedule_item_assignments_job_id
  on public.job_schedule_item_assignments(job_id);

alter table public.job_schedule_item_assignments enable row level security;

drop policy if exists "Users can view job schedule item assignments" on public.job_schedule_item_assignments;
create policy "Users can view job schedule item assignments"
on public.job_schedule_item_assignments
for select
to authenticated
using (
  public.user_can_access_job(auth.uid(), job_id)
);

drop policy if exists "Users can manage job schedule item assignments" on public.job_schedule_item_assignments;
create policy "Users can manage job schedule item assignments"
on public.job_schedule_item_assignments
for all
to authenticated
using (
  public.user_can_access_job(auth.uid(), job_id)
)
with check (
  public.user_can_access_job(auth.uid(), job_id)
);

drop trigger if exists update_job_schedule_item_assignments_updated_at on public.job_schedule_item_assignments;
create trigger update_job_schedule_item_assignments_updated_at
before update on public.job_schedule_item_assignments
for each row
execute function public.update_updated_at_column();
