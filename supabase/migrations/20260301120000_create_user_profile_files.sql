create table if not exists public.user_profile_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_path text,
  file_type text,
  file_size bigint,
  label text,
  description text,
  uploaded_by uuid references public.profiles(user_id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profile_files_company_user
  on public.user_profile_files(company_id, user_id, created_at desc);

alter table public.user_profile_files enable row level security;

drop policy if exists "user_profile_files_select_company_members" on public.user_profile_files;
create policy "user_profile_files_select_company_members"
on public.user_profile_files
for select
to authenticated
using (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = user_profile_files.company_id
      and coalesce(uca.is_active, true) = true
  )
);

drop policy if exists "user_profile_files_insert_company_admins" on public.user_profile_files;
create policy "user_profile_files_insert_company_admins"
on public.user_profile_files
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = user_profile_files.company_id
      and coalesce(uca.is_active, true) = true
      and lower(uca.role::text) in ('admin', 'company_admin', 'controller')
  )
);

drop policy if exists "user_profile_files_update_company_admins" on public.user_profile_files;
create policy "user_profile_files_update_company_admins"
on public.user_profile_files
for update
to authenticated
using (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = user_profile_files.company_id
      and coalesce(uca.is_active, true) = true
      and lower(uca.role::text) in ('admin', 'company_admin', 'controller')
  )
)
with check (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = user_profile_files.company_id
      and coalesce(uca.is_active, true) = true
      and lower(uca.role::text) in ('admin', 'company_admin', 'controller')
  )
);

drop policy if exists "user_profile_files_delete_company_admins" on public.user_profile_files;
create policy "user_profile_files_delete_company_admins"
on public.user_profile_files
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = user_profile_files.company_id
      and coalesce(uca.is_active, true) = true
      and lower(uca.role::text) in ('admin', 'company_admin', 'controller')
  )
);
