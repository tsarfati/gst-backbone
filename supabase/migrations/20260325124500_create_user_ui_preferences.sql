create table if not exists public.user_ui_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index if not exists idx_user_ui_preferences_user_company
  on public.user_ui_preferences(user_id, company_id);

alter table public.user_ui_preferences enable row level security;

drop policy if exists "Users can view their own ui preferences" on public.user_ui_preferences;
create policy "Users can view their own ui preferences"
on public.user_ui_preferences
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own ui preferences" on public.user_ui_preferences;
create policy "Users can insert their own ui preferences"
on public.user_ui_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own ui preferences" on public.user_ui_preferences;
create policy "Users can update their own ui preferences"
on public.user_ui_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own ui preferences" on public.user_ui_preferences;
create policy "Users can delete their own ui preferences"
on public.user_ui_preferences
for delete
using (auth.uid() = user_id);

drop trigger if exists update_user_ui_preferences_updated_at on public.user_ui_preferences;
create trigger update_user_ui_preferences_updated_at
before update on public.user_ui_preferences
for each row
execute function public.update_updated_at_column();

insert into public.user_ui_preferences (user_id, company_id, settings)
select
  cus.user_id,
  cus.company_id,
  jsonb_strip_nulls(
    jsonb_build_object(
      'payables_dashboard_default_job', cus.settings::jsonb -> 'payables_dashboard_default_job',
      'bills_view', cus.settings::jsonb -> 'bills_view',
      'bills_view_default', cus.settings::jsonb -> 'bills_view_default',
      'subcontracts_view', cus.settings::jsonb -> 'subcontracts_view',
      'subcontracts_view_default', cus.settings::jsonb -> 'subcontracts_view_default',
      'purchase_orders_view', cus.settings::jsonb -> 'purchase_orders_view',
      'purchase_orders_view_default', cus.settings::jsonb -> 'purchase_orders_view_default',
      'design_pro_jobs_view', cus.settings::jsonb -> 'design_pro_jobs_view',
      'design_pro_jobs_view_default', cus.settings::jsonb -> 'design_pro_jobs_view_default',
      'dashboard_non_direct_read_tokens', cus.settings::jsonb -> 'dashboard_non_direct_read_tokens'
    )
  )
from public.company_ui_settings cus
where cus.user_id is not null
  and (
    cus.settings::jsonb ? 'payables_dashboard_default_job'
    or cus.settings::jsonb ? 'bills_view'
    or cus.settings::jsonb ? 'bills_view_default'
    or cus.settings::jsonb ? 'subcontracts_view'
    or cus.settings::jsonb ? 'subcontracts_view_default'
    or cus.settings::jsonb ? 'purchase_orders_view'
    or cus.settings::jsonb ? 'purchase_orders_view_default'
    or cus.settings::jsonb ? 'design_pro_jobs_view'
    or cus.settings::jsonb ? 'design_pro_jobs_view_default'
    or cus.settings::jsonb ? 'dashboard_non_direct_read_tokens'
  )
on conflict (user_id, company_id)
do update set
  settings = public.user_ui_preferences.settings || excluded.settings,
  updated_at = now();
