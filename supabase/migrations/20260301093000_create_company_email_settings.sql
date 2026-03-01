create table if not exists public.company_email_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  from_email text,
  from_name text,
  smtp_host text,
  smtp_port integer default 587,
  smtp_username text,
  smtp_password_encrypted text,
  incoming_protocol text default 'imap' check (incoming_protocol in ('imap', 'pop3')),
  incoming_host text,
  incoming_port integer default 993,
  incoming_username text,
  incoming_password_encrypted text,
  imap_host text,
  imap_port integer default 993,
  imap_username text,
  imap_password_encrypted text,
  use_ssl boolean default true,
  is_configured boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_email_settings enable row level security;

create policy if not exists "company_email_settings_select"
on public.company_email_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.user_company_access uca
    where uca.company_id = company_email_settings.company_id
      and uca.user_id = auth.uid()
      and coalesce(uca.is_active, true) = true
  )
);

create policy if not exists "company_email_settings_insert"
on public.company_email_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_company_access uca
    where uca.company_id = company_email_settings.company_id
      and uca.user_id = auth.uid()
      and coalesce(uca.is_active, true) = true
      and lower(coalesce(uca.role, '')) in ('admin', 'company_admin', 'controller', 'owner')
  )
);

create policy if not exists "company_email_settings_update"
on public.company_email_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.user_company_access uca
    where uca.company_id = company_email_settings.company_id
      and uca.user_id = auth.uid()
      and coalesce(uca.is_active, true) = true
      and lower(coalesce(uca.role, '')) in ('admin', 'company_admin', 'controller', 'owner')
  )
)
with check (
  exists (
    select 1
    from public.user_company_access uca
    where uca.company_id = company_email_settings.company_id
      and uca.user_id = auth.uid()
      and coalesce(uca.is_active, true) = true
      and lower(coalesce(uca.role, '')) in ('admin', 'company_admin', 'controller', 'owner')
  )
);

drop trigger if exists company_email_settings_set_updated_at on public.company_email_settings;
create trigger company_email_settings_set_updated_at
before update on public.company_email_settings
for each row execute procedure public.update_updated_at_column();
