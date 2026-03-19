alter table public.vendor_compliance_documents
  add column if not exists target_company_id uuid references public.companies(id) on delete set null,
  add column if not exists target_job_id uuid references public.jobs(id) on delete set null;

create index if not exists idx_vendor_compliance_documents_target_company
  on public.vendor_compliance_documents(target_company_id);

create index if not exists idx_vendor_compliance_documents_target_job
  on public.vendor_compliance_documents(target_job_id);

comment on column public.vendor_compliance_documents.target_company_id is
  'Optional builder company this compliance document is intended for.';

comment on column public.vendor_compliance_documents.target_job_id is
  'Optional builder job this compliance document is intended for.';
