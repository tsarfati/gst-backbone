alter table public.subcontracts
add column if not exists company_signer_name text,
add column if not exists company_signer_title text;
