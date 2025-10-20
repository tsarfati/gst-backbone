-- Create private storage bucket for bank statements (idempotent)
insert into storage.buckets (id, name, public)
values ('bank-statements', 'bank-statements', false)
on conflict (id) do nothing;

-- Policy: view
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Bank statements viewable by company members'
  ) then
    create policy "Bank statements viewable by company members"
    on storage.objects
    for select
    using (
      bucket_id = 'bank-statements'
      and ((storage.foldername(name))[1])::uuid in (
        select uc.company_id from get_user_companies(auth.uid()) uc
      )
    );
  end if;
end$$;

-- Policy: insert
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Company members can upload bank statements'
  ) then
    create policy "Company members can upload bank statements"
    on storage.objects
    for insert
    with check (
      bucket_id = 'bank-statements'
      and ((storage.foldername(name))[1])::uuid in (
        select uc.company_id from get_user_companies(auth.uid()) uc
      )
    );
  end if;
end$$;

-- Policy: update
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins/controllers can update bank statements'
  ) then
    create policy "Admins/controllers can update bank statements"
    on storage.objects
    for update
    using (
      bucket_id = 'bank-statements'
      and ((storage.foldername(name))[1])::uuid in (
        select uc.company_id from get_user_companies(auth.uid()) uc where uc.role in ('admin','controller')
      )
    )
    with check (
      bucket_id = 'bank-statements'
      and ((storage.foldername(name))[1])::uuid in (
        select uc.company_id from get_user_companies(auth.uid()) uc where uc.role in ('admin','controller')
      )
    );
  end if;
end$$;

-- Policy: delete
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Admins/controllers can delete bank statements'
  ) then
    create policy "Admins/controllers can delete bank statements"
    on storage.objects
    for delete
    using (
      bucket_id = 'bank-statements'
      and ((storage.foldername(name))[1])::uuid in (
        select uc.company_id from get_user_companies(auth.uid()) uc where uc.role in ('admin','controller')
      )
    );
  end if;
end$$;

-- Link bank reconciliation to a bank statement (optional)
alter table public.bank_reconciliations
add column if not exists bank_statement_id uuid null;

-- Add a foreign key constraint if not present
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and table_name = 'bank_reconciliations' and constraint_name = 'bank_reconciliations_bank_statement_id_fkey'
  ) then
    alter table public.bank_reconciliations
      add constraint bank_reconciliations_bank_statement_id_fkey
      foreign key (bank_statement_id)
      references public.bank_statements(id)
      on delete set null;
  end if;
end$$;

create index if not exists idx_bank_reconciliations_bank_statement_id
on public.bank_reconciliations(bank_statement_id);
