alter table public.notification_settings
  add column if not exists rfp_update_notifications boolean not null default true,
  add column if not exists rfp_plan_update_notifications boolean not null default true,
  add column if not exists rfp_comment_update_notifications boolean not null default true;

comment on column public.notification_settings.rfp_update_notifications is
  'Controls notifications to invited vendors/design professionals when an RFP record is updated.';

comment on column public.notification_settings.rfp_plan_update_notifications is
  'Controls notifications to invited vendors/design professionals when RFP plans or attachments are updated.';

comment on column public.notification_settings.rfp_comment_update_notifications is
  'Controls notifications to invited vendors/design professionals when RFP plan page notes/callouts are updated.';
