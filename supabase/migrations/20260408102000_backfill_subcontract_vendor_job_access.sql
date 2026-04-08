insert into public.vendor_job_access (
  vendor_id,
  job_id,
  can_view_job_details,
  can_submit_bills,
  can_view_plans,
  can_view_rfis,
  can_submit_rfis,
  can_view_submittals,
  can_submit_submittals,
  can_view_team_directory,
  can_upload_compliance_docs,
  can_view_photos,
  can_view_rfps,
  can_submit_bids,
  can_view_subcontracts,
  can_access_messages,
  can_access_filing_cabinet,
  filing_cabinet_access_level,
  can_download_filing_cabinet_files,
  created_by
)
select distinct
  s.vendor_id,
  s.job_id,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  false,
  false,
  true,
  true,
  true,
  'view_only',
  true,
  s.created_by
from public.subcontracts s
where s.vendor_id is not null
  and s.job_id is not null
on conflict (vendor_id, job_id) do nothing;
