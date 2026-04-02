do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plan_pages_plan_id_page_number_key'
      and conrelid = 'public.plan_pages'::regclass
  ) then
    alter table public.plan_pages
      add constraint plan_pages_plan_id_page_number_key unique (plan_id, page_number);
  end if;
end $$;

drop policy if exists "Admins/controllers can manage plan pages" on public.plan_pages;
drop policy if exists "Users can insert plan pages for their company jobs" on public.plan_pages;
drop policy if exists "Users can update plan pages for their company jobs" on public.plan_pages;
drop policy if exists "Users can view plan pages for their company jobs" on public.plan_pages;
drop policy if exists "Users can view plan pages for their companies" on public.plan_pages;

create policy "Users can view plan pages for their company jobs"
on public.plan_pages
for select
to authenticated
using (
  exists (
    select 1
    from public.job_plans jp
    join public.jobs j on j.id = jp.job_id
    where jp.id = plan_pages.plan_id
      and j.company_id in (
        select uc.company_id
        from public.get_user_companies(auth.uid()) as uc(company_id, company_name, role)
      )
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'super_admin'
  )
);

create policy "Users can insert plan pages for their company jobs"
on public.plan_pages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.job_plans jp
    join public.jobs j on j.id = jp.job_id
    where jp.id = plan_pages.plan_id
      and j.company_id in (
        select uc.company_id
        from public.get_user_companies(auth.uid()) as uc(company_id, company_name, role)
      )
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'super_admin'
  )
);

create policy "Users can update plan pages for their company jobs"
on public.plan_pages
for update
to authenticated
using (
  exists (
    select 1
    from public.job_plans jp
    join public.jobs j on j.id = jp.job_id
    where jp.id = plan_pages.plan_id
      and j.company_id in (
        select uc.company_id
        from public.get_user_companies(auth.uid()) as uc(company_id, company_name, role)
      )
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
    from public.job_plans jp
    join public.jobs j on j.id = jp.job_id
    where jp.id = plan_pages.plan_id
      and j.company_id in (
        select uc.company_id
        from public.get_user_companies(auth.uid()) as uc(company_id, company_name, role)
      )
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'super_admin'
  )
);
