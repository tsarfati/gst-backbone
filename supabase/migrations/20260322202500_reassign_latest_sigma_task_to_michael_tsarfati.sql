-- Data fix: reassign the latest affected Sigma task to Michael Tsarfati
-- Sigma company id: f64fff8d-16f4-4a07-81b3-e470d7e2d560
-- Michael Sigma user id: 2b272abe-69d1-4730-9502-52a968092f35
-- Michael Tsarfati user id: dcdfec98-5141-4559-adb2-fe1d70bfce98

with target_task as (
  select t.id
  from public.tasks t
  where t.company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560'
    and (
      t.leader_user_id = '2b272abe-69d1-4730-9502-52a968092f35'
      or not exists (
        select 1
        from public.task_assignees ta
        where ta.task_id = t.id
      )
    )
  order by t.created_at desc
  limit 1
),
updated_task as (
  update public.tasks t
  set leader_user_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98'
  from target_task
  where t.id = target_task.id
  returning t.id
)
insert into public.task_assignees (task_id, user_id, assigned_by)
select
  updated_task.id,
  'dcdfec98-5141-4559-adb2-fe1d70bfce98',
  'dcdfec98-5141-4559-adb2-fe1d70bfce98'
from updated_task
on conflict (task_id, user_id) do nothing;

delete from public.task_assignees
where task_id in (
  select t.id
  from public.tasks t
  where t.company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560'
    and t.leader_user_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98'
  order by t.created_at desc
  limit 1
)
  and user_id = '2b272abe-69d1-4730-9502-52a968092f35';
