create table if not exists public.rfp_issue_packages (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfps(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rfp_id)
);

create table if not exists public.rfp_issue_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.rfp_issue_packages(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id uuid not null references public.job_plans(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (package_id, plan_id)
);

create index if not exists idx_rfp_issue_packages_rfp_id on public.rfp_issue_packages(rfp_id);
create index if not exists idx_rfp_issue_package_items_package_id on public.rfp_issue_package_items(package_id);

alter table public.rfp_issue_packages enable row level security;
alter table public.rfp_issue_package_items enable row level security;

drop policy if exists "Users can view rfp issue packages in their company" on public.rfp_issue_packages;
create policy "Users can view rfp issue packages in their company"
on public.rfp_issue_packages for select
using (
  (
    exists (
      select 1
      from public.user_company_access uca
      where uca.user_id = auth.uid()
        and uca.company_id = rfp_issue_packages.company_id
        and coalesce(uca.is_active, true) = true
        and uca.role::text not in ('vendor', 'design_professional')
    )
  )
  or
  (
    public.is_vendor_user(auth.uid())
    and exists (
      select 1
      from public.rfp_invited_vendors riv
      where riv.rfp_id = rfp_issue_packages.rfp_id
        and riv.company_id = rfp_issue_packages.company_id
        and riv.vendor_id = public.get_user_vendor_id(auth.uid())
    )
  )
);

drop policy if exists "Users can manage rfp issue packages in their company" on public.rfp_issue_packages;
create policy "Users can manage rfp issue packages in their company"
on public.rfp_issue_packages for all
using (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = rfp_issue_packages.company_id
      and coalesce(uca.is_active, true) = true
      and uca.role::text not in ('vendor', 'design_professional')
  )
)
with check (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = rfp_issue_packages.company_id
      and coalesce(uca.is_active, true) = true
      and uca.role::text not in ('vendor', 'design_professional')
  )
);

drop policy if exists "Users can view rfp issue package items in their company" on public.rfp_issue_package_items;
create policy "Users can view rfp issue package items in their company"
on public.rfp_issue_package_items for select
using (
  (
    exists (
      select 1
      from public.user_company_access uca
      where uca.user_id = auth.uid()
        and uca.company_id = rfp_issue_package_items.company_id
        and coalesce(uca.is_active, true) = true
        and uca.role::text not in ('vendor', 'design_professional')
    )
  )
  or
  (
    public.is_vendor_user(auth.uid())
    and exists (
      select 1
      from public.rfp_issue_packages rip
      join public.rfp_invited_vendors riv on riv.rfp_id = rip.rfp_id and riv.company_id = rip.company_id
      where rip.id = rfp_issue_package_items.package_id
        and riv.vendor_id = public.get_user_vendor_id(auth.uid())
    )
  )
);

drop policy if exists "Users can manage rfp issue package items in their company" on public.rfp_issue_package_items;
create policy "Users can manage rfp issue package items in their company"
on public.rfp_issue_package_items for all
using (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = rfp_issue_package_items.company_id
      and coalesce(uca.is_active, true) = true
      and uca.role::text not in ('vendor', 'design_professional')
  )
)
with check (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = rfp_issue_package_items.company_id
      and coalesce(uca.is_active, true) = true
      and uca.role::text not in ('vendor', 'design_professional')
  )
);

drop trigger if exists update_rfp_issue_packages_updated_at on public.rfp_issue_packages;
create trigger update_rfp_issue_packages_updated_at
before update on public.rfp_issue_packages
for each row
execute function public.update_updated_at_column();
