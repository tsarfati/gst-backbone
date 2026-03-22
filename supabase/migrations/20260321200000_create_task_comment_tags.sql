create table if not exists public.task_comment_tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  task_comment_id uuid not null references public.task_comments(id) on delete cascade,
  tag text not null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  constraint task_comment_tags_unique unique (task_comment_id, tag)
);

alter table public.task_comment_tags enable row level security;

drop policy if exists "Users can view task comment tags" on public.task_comment_tags;
create policy "Users can view task comment tags" on public.task_comment_tags
for select using (
  task_id in (
    select id from public.tasks
    where company_id in (
      select company_id from public.user_company_access where user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can manage task comment tags" on public.task_comment_tags;
create policy "Users can manage task comment tags" on public.task_comment_tags
for all using (
  task_id in (
    select id from public.tasks
    where company_id in (
      select company_id from public.user_company_access where user_id = auth.uid()
    )
  )
)
with check (
  task_id in (
    select id from public.tasks
    where company_id in (
      select company_id from public.user_company_access where user_id = auth.uid()
    )
  )
);

create index if not exists idx_task_comment_tags_task_id on public.task_comment_tags(task_id);
create index if not exists idx_task_comment_tags_company_id on public.task_comment_tags(company_id);
create index if not exists idx_task_comment_tags_tag on public.task_comment_tags(tag);
