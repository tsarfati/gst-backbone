create table if not exists public.rfp_plan_page_notes (
  id uuid primary key default gen_random_uuid(),
  rfp_plan_page_id uuid not null references public.rfp_plan_pages(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  shape_type text not null default 'rect' check (shape_type in ('rect', 'ellipse')),
  x double precision not null,
  y double precision not null,
  width double precision not null,
  height double precision not null,
  note_text text null,
  sort_order integer not null default 0,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rfp_plan_page_notes_rfp_plan_page_id
  on public.rfp_plan_page_notes(rfp_plan_page_id);

create index if not exists idx_rfp_plan_page_notes_company_id
  on public.rfp_plan_page_notes(company_id);

alter table public.rfp_plan_page_notes enable row level security;

drop policy if exists "Users can view rfp plan page notes in their company" on public.rfp_plan_page_notes;
create policy "Users can view rfp plan page notes in their company"
on public.rfp_plan_page_notes for select
using (
  (
    exists (
      select 1
      from public.user_company_access uca
      where uca.user_id = auth.uid()
        and uca.company_id = rfp_plan_page_notes.company_id
        and coalesce(uca.is_active, true) = true
        and uca.role::text not in ('vendor', 'design_professional')
    )
  )
  or
  (
    public.is_vendor_user(auth.uid())
    and exists (
      select 1
      from public.rfp_plan_pages rpp
      join public.rfp_invited_vendors riv
        on riv.rfp_id = rpp.rfp_id
       and riv.company_id = rpp.company_id
      where rpp.id = rfp_plan_page_notes.rfp_plan_page_id
        and riv.vendor_id = public.get_user_vendor_id(auth.uid())
    )
  )
);

drop policy if exists "Users can manage rfp plan page notes in their company" on public.rfp_plan_page_notes;
create policy "Users can manage rfp plan page notes in their company"
on public.rfp_plan_page_notes for all
using (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = rfp_plan_page_notes.company_id
      and coalesce(uca.is_active, true) = true
      and uca.role::text not in ('vendor', 'design_professional')
  )
)
with check (
  exists (
    select 1
    from public.user_company_access uca
    where uca.user_id = auth.uid()
      and uca.company_id = rfp_plan_page_notes.company_id
      and coalesce(uca.is_active, true) = true
      and uca.role::text not in ('vendor', 'design_professional')
  )
);
