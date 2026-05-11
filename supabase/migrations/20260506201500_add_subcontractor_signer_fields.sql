alter table public.subcontracts
add column if not exists subcontractor_signer_name text,
add column if not exists subcontractor_signer_title text;
