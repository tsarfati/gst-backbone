alter table public.company_jobsitelynk_integrations
  add column if not exists connection_status text not null default 'not_connected',
  add column if not exists connected_account_email text,
  add column if not exists connected_account_name text,
  add column if not exists connected_at timestamptz,
  add column if not exists last_connection_error text;
