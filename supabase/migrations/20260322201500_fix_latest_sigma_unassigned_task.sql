-- Data fix: assign the latest unassigned Sigma task to Michael Sigma / task creator
-- Sigma company id: f64fff8d-16f4-4a07-81b3-e470d7e2d560
-- Michael Sigma user id: 2b272abe-69d1-4730-9502-52a968092f35

with target_task as (
  select
    t.id,
    coalesce(t.created_by, '2b272abe-69d1-4730-9502-52a968092f35'::uuid) as target_user_id
  from public.tasks t
  where t.company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560'
    and not exists (
      select 1
      from public.task_assignees ta
      where ta.task_id = t.id
    )
  order by t.created_at desc
  limit 1
),
updated_task as (
  update public.tasks t
  set leader_user_id = target_task.target_user_id
  from target_task
  where t.id = target_task.id
  returning t.id, target_task.target_user_id
)
insert into public.task_assignees (task_id, user_id, assigned_by)
select
  updated_task.id,
  updated_task.target_user_id,
  updated_task.target_user_id
from updated_task
on conflict (task_id, user_id) do nothing;
