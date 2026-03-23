with legacy_task_setup as (
  select
    created.id as created_id,
    coalesce(
      jsonb_agg(
        case
          when extra.activity_type = 'assignee_added' then
            jsonb_build_object(
              'kind', 'action',
              'key', concat('team-add:', coalesce(created.actor_user_id::text, 'creator')),
              'label', 'Added the creator as a task member'
            )
          when extra.activity_type = 'lead_assigned' then
            jsonb_build_object(
              'kind', 'action',
              'key', concat('lead:', coalesce(created.actor_user_id::text, 'creator')),
              'label', 'Assigned the creator as task lead'
            )
          else null
        end
        order by extra.created_at, extra.id
      ) filter (where extra.id is not null),
      '[]'::jsonb
    ) as changes,
    array_remove(array_agg(extra.id), null) as extra_ids
  from public.task_activity created
  left join public.task_activity extra
    on extra.task_id = created.task_id
    and extra.actor_user_id is not distinct from created.actor_user_id
    and extra.activity_type in ('assignee_added', 'lead_assigned')
    and extra.content in ('Added the creator to the task team', 'Assigned the creator as task lead')
    and extra.created_at between created.created_at - interval '1 minute' and created.created_at + interval '5 minutes'
  where created.activity_type = 'task_created'
    and created.content = 'Created the task'
  group by created.id
),
updated_created_rows as (
  update public.task_activity created
  set metadata = coalesce(created.metadata, '{}'::jsonb) || jsonb_build_object(
    'batched', true,
    'changes', legacy_task_setup.changes
  )
  from legacy_task_setup
  where created.id = legacy_task_setup.created_id
    and jsonb_array_length(legacy_task_setup.changes) > 0
  returning legacy_task_setup.extra_ids
)
delete from public.task_activity
where id in (
  select unnest(extra_ids)
  from updated_created_rows
);
