-- Add tier-level option to show/hide locked features in sidebar navigation.
alter table public.subscription_tiers
  add column if not exists show_locked_menu_items boolean not null default false,
  add column if not exists locked_menu_upgrade_message text;

update public.subscription_tiers
set locked_menu_upgrade_message = coalesce(
  locked_menu_upgrade_message,
  'You do not have access to this feature. Please upgrade your account or contact your account manager.'
);
