create table if not exists public.company_jobsitelynk_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsitelynk_project_id text not null,
  project_name text not null,
  project_number text,
  project_status text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, jobsitelynk_project_id)
);

create index if not exists idx_company_jobsitelynk_projects_company_id
  on public.company_jobsitelynk_projects(company_id);

create index if not exists idx_company_jobsitelynk_projects_name
  on public.company_jobsitelynk_projects(company_id, project_name);

alter table public.company_jobsitelynk_projects enable row level security;

drop policy if exists "Company members can view cached JobSiteLynk projects" on public.company_jobsitelynk_projects;
create policy "Company members can view cached JobSiteLynk projects"
on public.company_jobsitelynk_projects
for select
to authenticated
using (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = company_jobsitelynk_projects.company_id
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'super_admin'
  )
);

drop trigger if exists update_company_jobsitelynk_projects_updated_at on public.company_jobsitelynk_projects;
create trigger update_company_jobsitelynk_projects_updated_at
before update on public.company_jobsitelynk_projects
for each row
execute function public.update_updated_at_column();
