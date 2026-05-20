alter table public.vendor_job_access
  add column if not exists can_view_all_job_bids boolean not null default false;

drop policy if exists "Vendors can view bid comparison rows for assigned vendor jobs" on public.bids;
create policy "Vendors can view bid comparison rows for assigned vendor jobs"
on public.bids
for select
using (
  exists (
    select 1
    from public.rfps r
    join public.vendor_job_access vja
      on vja.job_id = r.job_id
    where r.id = bids.rfp_id
      and vja.can_view_all_job_bids = true
      and public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);

drop policy if exists "Vendors can view bid attachments for assigned vendor jobs" on public.bid_attachments;
create policy "Vendors can view bid attachments for assigned vendor jobs"
on public.bid_attachments
for select
using (
  exists (
    select 1
    from public.bids b
    join public.rfps r
      on r.id = b.rfp_id
    join public.vendor_job_access vja
      on vja.job_id = r.job_id
    where b.id = bid_attachments.bid_id
      and vja.can_view_all_job_bids = true
      and public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);
