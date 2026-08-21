alter table public.job_schedule_items
  add column if not exists item_type text not null default 'activity';

alter table public.job_schedule_items
  drop constraint if exists job_schedule_items_duration_check;

alter table public.job_schedule_items
  drop constraint if exists job_schedule_items_item_type_check;

alter table public.job_schedule_items
  add constraint job_schedule_items_item_type_check
  check (lower(item_type) in ('activity', 'milestone'));

alter table public.job_schedule_items
  add constraint job_schedule_items_duration_check
  check (
    (lower(item_type) = 'milestone' and duration_days = 0)
    or
    (lower(item_type) = 'activity' and duration_days >= 1)
  );
