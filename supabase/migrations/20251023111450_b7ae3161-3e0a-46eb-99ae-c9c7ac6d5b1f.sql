-- Create public bucket for credit card attachments and policies
insert into storage.buckets (id, name, public)
values ('credit-card-attachments', 'credit-card-attachments', true)
on conflict (id) do nothing;

-- Public read policy
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read credit-card-attachments'
  ) then
    create policy "Public read credit-card-attachments"
      on storage.objects
      for select
      using (bucket_id = 'credit-card-attachments');
  end if;
end $$;

-- Authenticated insert
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated insert credit-card-attachments'
  ) then
    create policy "Authenticated insert credit-card-attachments"
      on storage.objects
      for insert
      with check (
        bucket_id = 'credit-card-attachments'
      );
  end if;
end $$;

-- Authenticated update
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated update credit-card-attachments'
  ) then
    create policy "Authenticated update credit-card-attachments"
      on storage.objects
      for update
      using (bucket_id = 'credit-card-attachments')
      with check (bucket_id = 'credit-card-attachments');
  end if;
end $$;

-- Authenticated delete
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated delete credit-card-attachments'
  ) then
    create policy "Authenticated delete credit-card-attachments"
      on storage.objects
      for delete
      using (bucket_id = 'credit-card-attachments');
  end if;
end $$;