create or replace function public.task_user_is_assignable(
  p_company_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_company_access uca
    left join public.profiles p on p.user_id = uca.user_id
    where uca.company_id = p_company_id
      and uca.user_id = p_user_id
      and coalesce(uca.is_active, true) = true
      and (
        uca.role <> 'employee'
        or p.custom_role_id is not null
      )
  );
$$;

create or replace function public.enforce_task_assignee_is_assignable()
returns trigger
language plpgsql
as $$
declare
  v_company_id uuid;
begin
  select t.company_id
  into v_company_id
  from public.tasks t
  where t.id = new.task_id;

  if v_company_id is null then
    raise exception 'Task company could not be resolved for task assignee.';
  end if;

  if not public.task_user_is_assignable(v_company_id, new.user_id) then
    raise exception 'Employees cannot be assigned to tasks.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_task_leader_is_assignable()
returns trigger
language plpgsql
as $$
begin
  if new.leader_user_id is not null
     and not public.task_user_is_assignable(new.company_id, new.leader_user_id) then
    raise exception 'Employees cannot be task leads.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_task_assignee_is_assignable on public.task_assignees;
create trigger trg_enforce_task_assignee_is_assignable
before insert or update on public.task_assignees
for each row
execute function public.enforce_task_assignee_is_assignable();

drop trigger if exists trg_enforce_task_leader_is_assignable on public.tasks;
create trigger trg_enforce_task_leader_is_assignable
before insert or update of leader_user_id on public.tasks
for each row
execute function public.enforce_task_leader_is_assignable();
