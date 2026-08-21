create table if not exists public.job_schedule_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  parent_item_id uuid null references public.job_schedule_items(id) on delete set null,
  linked_purchase_order_id uuid null references public.purchase_orders(id) on delete set null,
  title text not null,
  trade text null,
  status text not null default 'not_started',
  start_date date null,
  end_date date null,
  duration_days integer not null default 1,
  percent_complete numeric(5,2) not null default 0,
  sort_order integer not null default 0,
  requires_purchase_order boolean not null default false,
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_schedule_items_status_check check (
    lower(status) in ('not_started', 'ready', 'in_progress', 'blocked', 'completed', 'delayed')
  ),
  constraint job_schedule_items_duration_check check (duration_days >= 1),
  constraint job_schedule_items_progress_check check (percent_complete >= 0 and percent_complete <= 100)
);

create table if not exists public.job_schedule_dependencies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  predecessor_item_id uuid not null references public.job_schedule_items(id) on delete cascade,
  successor_item_id uuid not null references public.job_schedule_items(id) on delete cascade,
  dependency_type text not null default 'fs',
  lag_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_schedule_dependencies_type_check check (lower(dependency_type) in ('fs', 'ss', 'ff', 'sf')),
  constraint job_schedule_dependencies_self_ref_check check (predecessor_item_id <> successor_item_id),
  unique (predecessor_item_id, successor_item_id)
);

create index if not exists idx_job_schedule_items_job_id
  on public.job_schedule_items(job_id, sort_order, start_date);

create index if not exists idx_job_schedule_items_company_id
  on public.job_schedule_items(company_id);

create index if not exists idx_job_schedule_dependencies_job_id
  on public.job_schedule_dependencies(job_id);

create index if not exists idx_job_schedule_dependencies_successor
  on public.job_schedule_dependencies(successor_item_id);

create index if not exists idx_job_schedule_dependencies_predecessor
  on public.job_schedule_dependencies(predecessor_item_id);

alter table public.job_schedule_items enable row level security;
alter table public.job_schedule_dependencies enable row level security;

drop policy if exists "Users can view job schedule items" on public.job_schedule_items;
create policy "Users can view job schedule items"
on public.job_schedule_items
for select
to authenticated
using (
  public.user_can_access_job(auth.uid(), job_id)
);

drop policy if exists "Users can manage job schedule items" on public.job_schedule_items;
create policy "Users can manage job schedule items"
on public.job_schedule_items
for all
to authenticated
using (
  public.user_can_access_job(auth.uid(), job_id)
)
with check (
  public.user_can_access_job(auth.uid(), job_id)
);

drop policy if exists "Users can view job schedule dependencies" on public.job_schedule_dependencies;
create policy "Users can view job schedule dependencies"
on public.job_schedule_dependencies
for select
to authenticated
using (
  public.user_can_access_job(auth.uid(), job_id)
);

drop policy if exists "Users can manage job schedule dependencies" on public.job_schedule_dependencies;
create policy "Users can manage job schedule dependencies"
on public.job_schedule_dependencies
for all
to authenticated
using (
  public.user_can_access_job(auth.uid(), job_id)
)
with check (
  public.user_can_access_job(auth.uid(), job_id)
);

drop trigger if exists update_job_schedule_items_updated_at on public.job_schedule_items;
create trigger update_job_schedule_items_updated_at
before update on public.job_schedule_items
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_job_schedule_dependencies_updated_at on public.job_schedule_dependencies;
create trigger update_job_schedule_dependencies_updated_at
before update on public.job_schedule_dependencies
for each row
execute function public.update_updated_at_column();
