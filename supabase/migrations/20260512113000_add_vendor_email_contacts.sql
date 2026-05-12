alter table public.vendors
add column if not exists email_contacts jsonb not null default '[]'::jsonb;
