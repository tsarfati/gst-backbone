create table if not exists public.rfp_plan_pages (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfps(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id uuid not null references public.job_plans(id) on delete cascade,
  plan_page_id uuid not null references public.plan_pages(id) on delete cascade,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  note text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  unique (rfp_id, plan_page_id)
);

create index if not exists idx_rfp_plan_pages_rfp_id on public.rfp_plan_pages(rfp_id);
create index if not exists idx_rfp_plan_pages_company_id on public.rfp_plan_pages(company_id);
create index if not exists idx_rfp_plan_pages_plan_id on public.rfp_plan_pages(plan_id);
create index if not exists idx_rfp_plan_pages_plan_page_id on public.rfp_plan_pages(plan_page_id);

alter table public.rfp_plan_pages enable row level security;

drop policy if exists "Users can view rfp plan pages in their company" on public.rfp_plan_pages;
create policy "Users can view rfp plan pages in their company"
on public.rfp_plan_pages for select
using (
  (
    exists (
      select 1
      from public.user_company_access uca
      where uca.user_id = auth.uid()
        and uca.company_id = rfp_plan_pages.company_id
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
      where riv.rfp_id = rfp_plan_pages.rfp_id
        and riv.company_id = rfp_plan_pages.company_id
        and riv.vendor_id = public.get_user_vendor_id(auth.uid())
    )
  )
);

drop policy if exists "Users can manage rfp plan pages in their company" on public.rfp_plan_pages;
create policy "Users can manage rfp plan pages in their company"
on public.rfp_plan_pages for all
using (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = rfp_plan_pages.company_id
      and coalesce(uca.is_active, true) = true
      and uca.role::text not in ('vendor', 'design_professional')
  )
)
with check (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = rfp_plan_pages.company_id
      and coalesce(uca.is_active, true) = true
      and uca.role::text not in ('vendor', 'design_professional')
  )
);
