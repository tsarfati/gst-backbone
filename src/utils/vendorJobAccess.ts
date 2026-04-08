import { supabase } from "@/integrations/supabase/client";

const SUBCONTRACT_VENDOR_ACCESS_DEFAULTS = {
  can_view_job_details: true,
  can_submit_bills: true,
  can_view_plans: true,
  can_view_rfis: true,
  can_submit_rfis: true,
  can_view_submittals: true,
  can_submit_submittals: true,
  can_view_team_directory: true,
  can_upload_compliance_docs: true,
  can_view_photos: true,
  can_view_rfps: false,
  can_submit_bids: false,
  can_view_subcontracts: true,
  can_access_messages: true,
  can_access_filing_cabinet: true,
  filing_cabinet_access_level: "view_only",
  can_download_filing_cabinet_files: true,
};

type EnsureSubcontractVendorJobAccessOptions = {
  createdBy?: string | null;
  jobId?: string | null;
};

export async function ensureSubcontractVendorJobAccess(
  vendorId: string,
  options: EnsureSubcontractVendorJobAccessOptions = {}
) {
  let query = supabase
    .from("subcontracts")
    .select("job_id")
    .eq("vendor_id", vendorId)
    .not("job_id", "is", null);

  if (options.jobId) {
    query = query.eq("job_id", options.jobId);
  }

  const { data: subcontractRows, error: subcontractError } = await query;
  if (subcontractError) throw subcontractError;

  const jobIds = Array.from(
    new Set((subcontractRows || []).map((row: any) => row.job_id).filter(Boolean))
  );

  if (jobIds.length === 0) return;

  const accessRows = jobIds.map((jobId) => ({
    vendor_id: vendorId,
    job_id: jobId,
    ...SUBCONTRACT_VENDOR_ACCESS_DEFAULTS,
    created_by: options.createdBy || null,
  }));

  const { error: accessError } = await supabase
    .from("vendor_job_access" as any)
    .upsert(accessRows, {
      onConflict: "vendor_id,job_id",
      ignoreDuplicates: true,
    });

  if (accessError) throw accessError;
}
