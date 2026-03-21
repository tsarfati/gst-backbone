create table if not exists public.super_admin_avatar_libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cover_image_url text,
  is_global boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.super_admin_avatar_library_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.super_admin_avatar_libraries(id) on delete cascade,
  name text not null,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.super_admin_avatar_library_companies (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.super_admin_avatar_libraries(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (library_id, company_id)
);

create index if not exists idx_super_admin_avatar_libraries_active
  on public.super_admin_avatar_libraries (is_active, is_global);

create index if not exists idx_super_admin_avatar_library_items_library
  on public.super_admin_avatar_library_items (library_id, sort_order);

create index if not exists idx_super_admin_avatar_library_companies_company
  on public.super_admin_avatar_library_companies (company_id, library_id);

create or replace function public.set_super_admin_avatar_libraries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_super_admin_avatar_libraries_updated_at on public.super_admin_avatar_libraries;
create trigger trg_super_admin_avatar_libraries_updated_at
before update on public.super_admin_avatar_libraries
for each row
execute function public.set_super_admin_avatar_libraries_updated_at();

alter table public.super_admin_avatar_libraries enable row level security;
alter table public.super_admin_avatar_library_items enable row level security;
alter table public.super_admin_avatar_library_companies enable row level security;

drop policy if exists "Authenticated users can view active avatar libraries" on public.super_admin_avatar_libraries;
create policy "Authenticated users can view active avatar libraries"
on public.super_admin_avatar_libraries
for select
to authenticated
using (is_active = true);

drop policy if exists "Super admins manage avatar libraries" on public.super_admin_avatar_libraries;
create policy "Super admins manage avatar libraries"
on public.super_admin_avatar_libraries
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

drop policy if exists "Authenticated users can view avatar library items" on public.super_admin_avatar_library_items;
create policy "Authenticated users can view avatar library items"
on public.super_admin_avatar_library_items
for select
to authenticated
using (
  exists (
    select 1
    from public.super_admin_avatar_libraries l
    where l.id = library_id
      and l.is_active = true
  )
);

drop policy if exists "Super admins manage avatar library items" on public.super_admin_avatar_library_items;
create policy "Super admins manage avatar library items"
on public.super_admin_avatar_library_items
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

drop policy if exists "Authenticated users can view avatar library company assignments" on public.super_admin_avatar_library_companies;
create policy "Authenticated users can view avatar library company assignments"
on public.super_admin_avatar_library_companies
for select
to authenticated
using (true);

drop policy if exists "Super admins manage avatar library company assignments" on public.super_admin_avatar_library_companies;
create policy "Super admins manage avatar library company assignments"
on public.super_admin_avatar_library_companies
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));
