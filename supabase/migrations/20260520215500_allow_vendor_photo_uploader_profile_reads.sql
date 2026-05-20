drop policy if exists "Vendor users can view profiles for assigned job photo uploaders" on public.profiles;
create policy "Vendor users can view profiles for assigned job photo uploaders"
on public.profiles
for select
using (
  exists (
    select 1
    from public.job_photos jp
    join public.vendor_job_access vja
      on vja.job_id = jp.job_id
    where jp.uploaded_by = profiles.user_id
      and vja.can_view_photos = true
      and public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);
