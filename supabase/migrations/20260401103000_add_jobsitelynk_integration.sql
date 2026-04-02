-- Company-level JobSiteLynk integration config, stored separately from broad company settings
-- so the shared secret is only readable by elevated roles and server-side functions.

create table if not exists public.company_jobsitelynk_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  jobsitelynk_base_url text not null,
  external_company_id text not null,
  shared_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

alter table public.company_jobsitelynk_integrations enable row level security;

drop policy if exists "Elevated users can view JobSiteLynk integrations" on public.company_jobsitelynk_integrations;
drop policy if exists "Elevated users can insert JobSiteLynk integrations" on public.company_jobsitelynk_integrations;
drop policy if exists "Elevated users can update JobSiteLynk integrations" on public.company_jobsitelynk_integrations;

create policy "Elevated users can view JobSiteLynk integrations"
on public.company_jobsitelynk_integrations
for select
to authenticated
using (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = company_jobsitelynk_integrations.company_id
      and lower(coalesce(uc.role::text, '')) in ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'super_admin'
  )
);

create policy "Elevated users can insert JobSiteLynk integrations"
on public.company_jobsitelynk_integrations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = company_jobsitelynk_integrations.company_id
      and lower(coalesce(uc.role::text, '')) in ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'super_admin'
  )
);

create policy "Elevated users can update JobSiteLynk integrations"
on public.company_jobsitelynk_integrations
for update
to authenticated
using (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = company_jobsitelynk_integrations.company_id
      and lower(coalesce(uc.role::text, '')) in ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'super_admin'
  )
)
with check (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = company_jobsitelynk_integrations.company_id
      and lower(coalesce(uc.role::text, '')) in ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'super_admin'
  )
);

drop trigger if exists update_company_jobsitelynk_integrations_updated_at on public.company_jobsitelynk_integrations;
create trigger update_company_jobsitelynk_integrations_updated_at
before update on public.company_jobsitelynk_integrations
for each row
execute function public.update_updated_at_column();

alter table public.jobs
  add column if not exists jobsitelynk_project_id text;
