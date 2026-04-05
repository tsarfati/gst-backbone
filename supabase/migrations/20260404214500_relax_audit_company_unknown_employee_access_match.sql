create or replace function public.audit_company_unknown_employee_access(p_company_name text)
returns table (
  company_id uuid,
  company_name text,
  user_id uuid,
  access_role text,
  profile_exists boolean,
  display_name text,
  first_name text,
  last_name text,
  current_company_id uuid,
  job_access_count bigint,
  active_company_access_count bigint
)
language sql
security definer
set search_path = public
as $$
  with target_companies as (
    select c.id, coalesce(nullif(trim(c.display_name), ''), c.name) as company_name
    from public.companies c
    where c.is_active = true
      and (
        lower(c.name) like '%' || lower(trim(p_company_name)) || '%'
        or lower(coalesce(c.display_name, '')) like '%' || lower(trim(p_company_name)) || '%'
      )
  ),
  candidate_access as (
    select
      tc.id as company_id,
      tc.company_name,
      uca.user_id,
      uca.role::text as access_role,
      p.user_id as profile_user_id,
      nullif(trim(p.display_name), '') as display_name,
      nullif(trim(p.first_name), '') as first_name,
      nullif(trim(p.last_name), '') as last_name,
      p.current_company_id
    from target_companies tc
    join public.user_company_access uca
      on uca.company_id = tc.id
     and uca.is_active = true
     and lower(uca.role::text) = 'employee'
    left join public.profiles p
      on p.user_id = uca.user_id
    where (
      p.user_id is null
      or (
        nullif(trim(p.display_name), '') is null
        and nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') is null
      )
      or lower(coalesce(trim(p.display_name), '')) = 'unknown user'
    )
  )
  select
    ca.company_id,
    ca.company_name,
    ca.user_id,
    ca.access_role,
    (ca.profile_user_id is not null) as profile_exists,
    ca.display_name,
    ca.first_name,
    ca.last_name,
    ca.current_company_id,
    (
      select count(*)
      from public.user_job_access uja
      join public.jobs j on j.id = uja.job_id
      where uja.user_id = ca.user_id
        and j.company_id = ca.company_id
    ) as job_access_count,
    (
      select count(*)
      from public.user_company_access uca2
      where uca2.user_id = ca.user_id
        and uca2.is_active = true
    ) as active_company_access_count
  from candidate_access ca
  order by ca.company_name, ca.user_id;
$$;

revoke all on function public.audit_company_unknown_employee_access(text) from public;
grant execute on function public.audit_company_unknown_employee_access(text) to anon, authenticated;
