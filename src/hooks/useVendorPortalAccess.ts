import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeVendorPortalRole, type VendorPortalRole } from "@/lib/vendorPortalRoles";
import { useActiveVendorPortalVendor } from "@/hooks/useActiveVendorPortalVendor";

type VendorJobAccessRow = {
  can_view_job_details?: boolean | null;
  can_submit_bills?: boolean | null;
  can_view_plans?: boolean | null;
  can_view_rfis?: boolean | null;
  can_submit_rfis?: boolean | null;
  can_view_submittals?: boolean | null;
  can_submit_submittals?: boolean | null;
  can_view_photos?: boolean | null;
  can_view_rfps?: boolean | null;
  can_view_all_job_bids?: boolean | null;
  can_submit_bids?: boolean | null;
  can_view_subcontracts?: boolean | null;
  can_access_messages?: boolean | null;
  can_access_filing_cabinet?: boolean | null;
  can_upload_compliance_docs?: boolean | null;
};

type VendorRoleCaps = {
  canAccessDashboard: boolean;
  canAccessJobs: boolean;
  canAccessBills: boolean;
  canAccessCompliance: boolean;
  canAccessSettings: boolean;
  canManageUsers: boolean;
  canViewJobDetails: boolean;
  canSubmitBills: boolean;
  canViewPlans: boolean;
  canViewRfis: boolean;
  canSubmitRfis: boolean;
  canViewSubmittals: boolean;
  canSubmitSubmittals: boolean;
  canViewPhotos: boolean;
  canViewRfps: boolean;
  canViewAllJobBids: boolean;
  canSubmitBids: boolean;
  canViewSubcontracts: boolean;
  canAccessMessages: boolean;
  canAccessFilingCabinet: boolean;
  canUploadComplianceDocs: boolean;
  canNegotiateContracts: boolean;
  canSubmitSovProposals: boolean;
  canUploadSignedContracts: boolean;
};

const COMPANY_WIDE_VENDOR_CAPS: VendorRoleCaps = {
  canAccessDashboard: true,
  canAccessJobs: true,
  canAccessBills: true,
  canAccessCompliance: true,
  canAccessSettings: false,
  canManageUsers: false,
  canViewJobDetails: true,
  canSubmitBills: true,
  canViewPlans: true,
  canViewRfis: true,
  canSubmitRfis: true,
  canViewSubmittals: true,
  canSubmitSubmittals: true,
  canViewPhotos: true,
  canViewRfps: true,
  canViewAllJobBids: true,
  canSubmitBids: true,
  canViewSubcontracts: true,
  canAccessMessages: true,
  canAccessFilingCabinet: true,
  canUploadComplianceDocs: true,
  canNegotiateContracts: true,
  canSubmitSovProposals: true,
  canUploadSignedContracts: true,
};

export function useVendorPortalAccess(jobId?: string) {
  const { user, profile } = useAuth();
  const {
    vendorId: effectiveVendorId,
    vendorIds: effectiveVendorIds,
    vendorPortalRole: activeVendorPortalRole,
    loading: vendorContextLoading,
  } = useActiveVendorPortalVendor();
  const [loading, setLoading] = useState(Boolean(jobId));
  const [jobAccess, setJobAccess] = useState<VendorJobAccessRow | null>(null);

  const internalRole = useMemo<VendorPortalRole>(() => {
    const profileRole = String(activeVendorPortalRole || profile?.vendor_portal_role || "").trim();
    if (profileRole) return normalizeVendorPortalRole(profileRole);
    return profile?.approved_by === profile?.user_id ? "owner" : "basic_user";
  }, [activeVendorPortalRole, profile?.approved_by, profile?.user_id, profile?.vendor_portal_role]);

  const roleCaps = useMemo<VendorRoleCaps>(() => ({
    ...COMPANY_WIDE_VENDOR_CAPS,
    canAccessSettings: internalRole === "owner",
    canManageUsers: internalRole === "owner",
  }), [internalRole]);

  useEffect(() => {
    let ignore = false;

    async function loadJobAccess() {
      if (vendorContextLoading) {
        setLoading(true);
        return;
      }

      if (!jobId || effectiveVendorIds.length === 0) {
        setJobAccess(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("vendor_job_access" as any)
        .select(`
          can_view_job_details,
          can_submit_bills,
          can_view_plans,
          can_view_rfis,
          can_submit_rfis,
          can_view_submittals,
          can_submit_submittals,
          can_view_photos,
          can_view_rfps,
          can_view_all_job_bids,
          can_submit_bids,
          can_view_subcontracts,
          can_access_messages,
          can_access_filing_cabinet,
          can_upload_compliance_docs
        `)
        .in("vendor_id", effectiveVendorIds)
        .eq("job_id", jobId)
        .limit(20);

      if (!ignore) {
        if (error) {
          console.error("Failed to load vendor job access:", error);
          setJobAccess(null);
        } else {
          const rows = ((data || []) as VendorJobAccessRow[]);
          if (rows.length === 0) {
            setJobAccess(null);
          } else {
            const merged = rows.reduce<VendorJobAccessRow>((acc, row) => ({
              can_view_job_details: !!acc.can_view_job_details || !!row.can_view_job_details,
              can_submit_bills: !!acc.can_submit_bills || !!row.can_submit_bills,
              can_view_plans: !!acc.can_view_plans || !!row.can_view_plans,
              can_view_rfis: !!acc.can_view_rfis || !!row.can_view_rfis,
              can_submit_rfis: !!acc.can_submit_rfis || !!row.can_submit_rfis,
              can_view_submittals: !!acc.can_view_submittals || !!row.can_view_submittals,
              can_submit_submittals: !!acc.can_submit_submittals || !!row.can_submit_submittals,
              can_view_photos: !!acc.can_view_photos || !!row.can_view_photos,
              can_view_rfps: !!acc.can_view_rfps || !!row.can_view_rfps,
              can_view_all_job_bids: !!acc.can_view_all_job_bids || !!row.can_view_all_job_bids,
              can_submit_bids: !!acc.can_submit_bids || !!row.can_submit_bids,
              can_view_subcontracts: !!acc.can_view_subcontracts || !!row.can_view_subcontracts,
              can_access_messages: !!acc.can_access_messages || !!row.can_access_messages,
              can_access_filing_cabinet: !!acc.can_access_filing_cabinet || !!row.can_access_filing_cabinet,
              can_upload_compliance_docs: !!acc.can_upload_compliance_docs || !!row.can_upload_compliance_docs,
            }), {});
            setJobAccess(merged);
          }
        }
        setLoading(false);
      }
    }

    void loadJobAccess();
    return () => {
      ignore = true;
    };
  }, [effectiveVendorIds, jobId, vendorContextLoading]);

  const effectiveJobAccess = useMemo(() => {
    const assignment = jobAccess || {};
    return {
      canViewJobDetails: roleCaps.canViewJobDetails && assignment.can_view_job_details !== false,
      canSubmitBills: roleCaps.canSubmitBills && !!assignment.can_submit_bills,
      canViewPlans: roleCaps.canViewPlans && !!assignment.can_view_plans,
      canViewRfis: roleCaps.canViewRfis && !!assignment.can_view_rfis,
      canSubmitRfis: roleCaps.canSubmitRfis && !!assignment.can_submit_rfis,
      canViewSubmittals: roleCaps.canViewSubmittals && !!assignment.can_view_submittals,
      canSubmitSubmittals: roleCaps.canSubmitSubmittals && !!assignment.can_submit_submittals,
      canViewPhotos: roleCaps.canViewPhotos && !!assignment.can_view_photos,
      canViewRfps: roleCaps.canViewRfps && !!assignment.can_view_rfps,
      canViewAllJobBids: roleCaps.canViewAllJobBids && !!assignment.can_view_all_job_bids,
      canSubmitBids: roleCaps.canSubmitBids && !!assignment.can_submit_bids,
      canViewSubcontracts: roleCaps.canViewSubcontracts && !!assignment.can_view_subcontracts,
      canAccessMessages: roleCaps.canAccessMessages && !!assignment.can_access_messages,
      canAccessFilingCabinet: roleCaps.canAccessFilingCabinet && !!assignment.can_access_filing_cabinet,
      canUploadComplianceDocs: roleCaps.canUploadComplianceDocs && !!assignment.can_upload_compliance_docs,
      canNegotiateContracts: false,
      canSubmitSovProposals: false,
      canUploadSignedContracts: false,
    };
  }, [jobAccess, roleCaps]);

  return {
    loading,
    internalRole,
    roleCaps,
    effectiveJobAccess,
  };
}
