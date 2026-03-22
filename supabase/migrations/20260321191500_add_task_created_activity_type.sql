alter table public.task_activity
drop constraint if exists task_activity_activity_type_check;

alter table public.task_activity
add constraint task_activity_activity_type_check
check (
  activity_type in (
    'comment_added',
    'attachment_added',
    'attachment_deleted',
    'assignee_added',
    'assignee_removed',
    'checklist_item_added',
    'checklist_item_completed',
    'checklist_item_reopened',
    'checklist_item_deleted',
    'lead_assigned',
    'lead_cleared',
    'task_created',
    'task_updated'
  )
);
