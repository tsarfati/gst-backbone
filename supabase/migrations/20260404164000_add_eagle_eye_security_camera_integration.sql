create table if not exists public.company_eagle_eye_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_status text not null default 'not_connected',
  account_label text,
  provider_account_email text,
  eagle_eye_account_id text,
  account_region text,
  provider_portal_url text,
  last_connection_error text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id)
);

create table if not exists public.job_security_camera_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider text not null default 'eagle_eye',
  camera_external_id text,
  camera_name text not null,
  location_label text,
  stream_url text,
  provider_camera_url text,
  access_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_eagle_eye_integrations
  add column if not exists provider_portal_url text;

alter table public.job_security_camera_mappings
  add column if not exists access_notes text;

create index if not exists idx_job_security_camera_mappings_job_id
  on public.job_security_camera_mappings(job_id);

create index if not exists idx_job_security_camera_mappings_company_id
  on public.job_security_camera_mappings(company_id);

alter table public.company_eagle_eye_integrations enable row level security;
alter table public.job_security_camera_mappings enable row level security;

drop policy if exists "Users can view Eagle Eye integrations" on public.company_eagle_eye_integrations;
drop policy if exists "Elevated users can manage Eagle Eye integrations" on public.company_eagle_eye_integrations;
drop policy if exists "Users can view job security camera mappings" on public.job_security_camera_mappings;
drop policy if exists "Elevated users can manage job security camera mappings" on public.job_security_camera_mappings;

create policy "Users can view Eagle Eye integrations"
on public.company_eagle_eye_integrations
for select
to authenticated
using (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = company_eagle_eye_integrations.company_id
  )
);

create policy "Elevated users can manage Eagle Eye integrations"
on public.company_eagle_eye_integrations
for all
to authenticated
using (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = company_eagle_eye_integrations.company_id
      and lower(coalesce(uc.role::text, '')) in ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
  )
)
with check (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = company_eagle_eye_integrations.company_id
      and lower(coalesce(uc.role::text, '')) in ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
  )
);

create policy "Users can view job security camera mappings"
on public.job_security_camera_mappings
for select
to authenticated
using (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = job_security_camera_mappings.company_id
  )
);

create policy "Elevated users can manage job security camera mappings"
on public.job_security_camera_mappings
for all
to authenticated
using (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = job_security_camera_mappings.company_id
      and lower(coalesce(uc.role::text, '')) in ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
  )
)
with check (
  exists (
    select 1
    from public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    where uc.company_id = job_security_camera_mappings.company_id
      and lower(coalesce(uc.role::text, '')) in ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
  )
);

drop trigger if exists update_company_eagle_eye_integrations_updated_at on public.company_eagle_eye_integrations;
create trigger update_company_eagle_eye_integrations_updated_at
before update on public.company_eagle_eye_integrations
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_job_security_camera_mappings_updated_at on public.job_security_camera_mappings;
create trigger update_job_security_camera_mappings_updated_at
before update on public.job_security_camera_mappings
for each row
execute function public.update_updated_at_column();
