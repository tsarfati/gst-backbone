-- Backfill linked_user_id for existing project-team directory rows so
-- website/PM job visibility can be driven from actual job team membership.

-- Pass 1: exact email match within the same company where there is a single
-- active company-access user for that email.
with unique_email_matches as (
  select
    jpd.id as directory_id,
    (array_agg(distinct uca.user_id order by uca.user_id))[1] as matched_user_id
  from public.job_project_directory jpd
  join public.profiles p
    on p.email is not null
   and jpd.email is not null
   and lower(trim(p.email)) = lower(trim(jpd.email))
  join public.user_company_access uca
    on uca.user_id = p.user_id
   and uca.company_id = jpd.company_id
   and uca.is_active = true
  where jpd.linked_user_id is null
    and coalesce(jpd.is_active, true) = true
    and jpd.linked_vendor_id is null
  group by jpd.id
  having count(distinct uca.user_id) = 1
)
update public.job_project_directory jpd
set linked_user_id = uem.matched_user_id
from unique_email_matches uem
where jpd.id = uem.directory_id
  and jpd.linked_user_id is null;

-- Pass 2: exact normalized name match within the same company only when there
-- is a single active company-access user with that name.
with unique_name_matches as (
  select
    jpd.id as directory_id,
    (array_agg(distinct uca.user_id order by uca.user_id))[1] as matched_user_id
  from public.job_project_directory jpd
  join public.profiles p
    on (
      lower(trim(coalesce(jpd.name, ''))) = lower(trim(coalesce(p.display_name, '')))
      or lower(trim(coalesce(jpd.name, ''))) = lower(trim(concat_ws(' ', p.first_name, p.last_name)))
    )
  join public.user_company_access uca
    on uca.user_id = p.user_id
   and uca.company_id = jpd.company_id
   and uca.is_active = true
  where jpd.linked_user_id is null
    and coalesce(jpd.is_active, true) = true
    and jpd.linked_vendor_id is null
    and nullif(trim(coalesce(jpd.name, '')), '') is not null
  group by jpd.id
  having count(distinct uca.user_id) = 1
)
update public.job_project_directory jpd
set linked_user_id = unm.matched_user_id
from unique_name_matches unm
where jpd.id = unm.directory_id
  and jpd.linked_user_id is null;
