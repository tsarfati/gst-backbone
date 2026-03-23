alter table public.notification_settings
  add column if not exists task_team_assignment_notifications boolean not null default true,
  add column if not exists task_timeline_mention_notifications boolean not null default true,
  add column if not exists task_timeline_activity_notifications boolean not null default true;

comment on column public.notification_settings.task_team_assignment_notifications is
  'Controls notifications when a user is added to a task team.';

comment on column public.notification_settings.task_timeline_mention_notifications is
  'Controls notifications when a user is @mentioned in a task timeline comment.';

comment on column public.notification_settings.task_timeline_activity_notifications is
  'Controls notifications for task timeline activity updates involving the user.';
