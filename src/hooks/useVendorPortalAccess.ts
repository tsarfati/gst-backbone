import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type VendorPortalRole =
  | "owner"
  | "admin"
  | "accounting"
  | "project_contact"
  | "estimator"
  | "compliance_manager"
  | "basic_user";

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
  can_submit_bids?: boolean | null;
  can_view_subcontracts?: boolean | null;
  can_access_messages?: boolean | null;
  can_access_filing_cabinet?: boolean | null;
  can_upload_compliance_docs?: boolean | null;
  can_negotiate_contracts?: boolean | null;
  can_submit_sov_proposals?: boolean | null;
  can_upload_signed_contracts?: boolean | null;
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
  canSubmitBids: boolean;
  canViewSubcontracts: boolean;
  canAccessMessages: boolean;
  canAccessFilingCabinet: boolean;
  canUploadComplianceDocs: boolean;
  canNegotiateContracts: boolean;
  canSubmitSovProposals: boolean;
  canUploadSignedContracts: boolean;
};

const ROLE_CAPS: Record<VendorPortalRole, VendorRoleCaps> = {
  owner: {
    canAccessDashboard: true,
    canAccessJobs: true,
    canAccessBills: true,
    canAccessCompliance: true,
    canAccessSettings: true,
    canManageUsers: true,
    canViewJobDetails: true,
    canSubmitBills: true,
    canViewPlans: true,
    canViewRfis: true,
    canSubmitRfis: true,
    canViewSubmittals: true,
    canSubmitSubmittals: true,
    canViewPhotos: true,
    canViewRfps: true,
    canSubmitBids: true,
    canViewSubcontracts: true,
    canAccessMessages: true,
    canAccessFilingCabinet: true,
    canUploadComplianceDocs: true,
    canNegotiateContracts: true,
    canSubmitSovProposals: true,
    canUploadSignedContracts: true,
  },
  admin: {
    canAccessDashboard: true,
    canAccessJobs: true,
    canAccessBills: true,
    canAccessCompliance: true,
    canAccessSettings: true,
    canManageUsers: true,
    canViewJobDetails: true,
    canSubmitBills: true,
    canViewPlans: true,
    canViewRfis: true,
    canSubmitRfis: true,
    canViewSubmittals: true,
    canSubmitSubmittals: true,
    canViewPhotos: true,
    canViewRfps: true,
    canSubmitBids: true,
    canViewSubcontracts: true,
    canAccessMessages: true,
    canAccessFilingCabinet: true,
    canUploadComplianceDocs: true,
    canNegotiateContracts: true,
    canSubmitSovProposals: true,
    canUploadSignedContracts: true,
  },
  accounting: {
    canAccessDashboard: true,
    canAccessJobs: true,
    canAccessBills: true,
    canAccessCompliance: false,
    canAccessSettings: false,
    canManageUsers: false,
    canViewJobDetails: true,
    canSubmitBills: true,
    canViewPlans: false,
    canViewRfis: false,
    canSubmitRfis: false,
    canViewSubmittals: false,
    canSubmitSubmittals: false,
    canViewPhotos: false,
    canViewRfps: false,
    canSubmitBids: false,
    canViewSubcontracts: true,
    canAccessMessages: true,
    canAccessFilingCabinet: false,
    canUploadComplianceDocs: false,
    canNegotiateContracts: false,
    canSubmitSovProposals: false,
    canUploadSignedContracts: false,
  },
  project_contact: {
    canAccessDashboard: true,
    canAccessJobs: true,
    canAccessBills: false,
    canAccessCompliance: false,
    canAccessSettings: false,
    canManageUsers: false,
    canViewJobDetails: true,
    canSubmitBills: false,
    canViewPlans: true,
    canViewRfis: true,
    canSubmitRfis: true,
    canViewSubmittals: true,
    canSubmitSubmittals: true,
    canViewPhotos: true,
    canViewRfps: false,
    canSubmitBids: false,
    canViewSubcontracts: true,
    canAccessMessages: true,
    canAccessFilingCabinet: true,
    canUploadComplianceDocs: false,
    canNegotiateContracts: true,
    canSubmitSovProposals: true,
    canUploadSignedContracts: true,
  },
  estimator: {
    canAccessDashboard: true,
    canAccessJobs: true,
    canAccessBills: false,
    canAccessCompliance: false,
    canAccessSettings: false,
    canManageUsers: false,
    canViewJobDetails: true,
    canSubmitBills: false,
    canViewPlans: true,
    canViewRfis: false,
    canSubmitRfis: false,
    canViewSubmittals: false,
    canSubmitSubmittals: false,
    canViewPhotos: false,
    canViewRfps: true,
    canSubmitBids: true,
    canViewSubcontracts: false,
    canAccessMessages: true,
    canAccessFilingCabinet: true,
    canUploadComplianceDocs: false,
    canNegotiateContracts: false,
    canSubmitSovProposals: false,
    canUploadSignedContracts: false,
  },
  compliance_manager: {
    canAccessDashboard: true,
    canAccessJobs: true,
    canAccessBills: false,
    canAccessCompliance: true,
    canAccessSettings: false,
    canManageUsers: false,
    canViewJobDetails: true,
    canSubmitBills: false,
    canViewPlans: false,
    canViewRfis: false,
    canSubmitRfis: false,
    canViewSubmittals: false,
    canSubmitSubmittals: false,
    canViewPhotos: false,
    canViewRfps: false,
    canSubmitBids: false,
    canViewSubcontracts: false,
    canAccessMessages: true,
    canAccessFilingCabinet: false,
    canUploadComplianceDocs: true,
    canNegotiateContracts: false,
    canSubmitSovProposals: false,
    canUploadSignedContracts: false,
  },
  basic_user: {
    canAccessDashboard: true,
    canAccessJobs: true,
    canAccessBills: false,
    canAccessCompliance: false,
    canAccessSettings: false,
    canManageUsers: false,
    canViewJobDetails: true,
    canSubmitBills: false,
    canViewPlans: false,
    canViewRfis: false,
    canSubmitRfis: false,
    canViewSubmittals: false,
    canSubmitSubmittals: false,
    canViewPhotos: false,
    canViewRfps: false,
    canSubmitBids: false,
    canViewSubcontracts: false,
    canAccessMessages: true,
    canAccessFilingCabinet: false,
    canUploadComplianceDocs: false,
    canNegotiateContracts: false,
    canSubmitSovProposals: false,
    canUploadSignedContracts: false,
  },
};

const normalizeVendorRole = (value: unknown): VendorPortalRole => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized in ROLE_CAPS) return normalized as VendorPortalRole;
  return "basic_user";
};

export function useVendorPortalAccess(jobId?: string) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(Boolean(jobId && profile?.vendor_id));
  const [jobAccess, setJobAccess] = useState<VendorJobAccessRow | null>(null);

  const internalRole = useMemo<VendorPortalRole>(() => {
    const profileRole = String(profile?.vendor_portal_role || "").trim();
    if (profileRole) return normalizeVendorRole(profileRole);
    return profile?.approved_by === profile?.user_id ? "owner" : "basic_user";
  }, [profile?.approved_by, profile?.user_id, profile?.vendor_portal_role]);

  const roleCaps = ROLE_CAPS[internalRole];

  useEffect(() => {
    let ignore = false;

    async function loadJobAccess() {
      if (!jobId || !profile?.vendor_id) {
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
          can_submit_bids,
          can_view_subcontracts,
          can_access_messages,
          can_access_filing_cabinet,
          can_upload_compliance_docs,
          can_negotiate_contracts,
          can_submit_sov_proposals,
          can_upload_signed_contracts
        `)
        .eq("vendor_id", profile.vendor_id)
        .eq("job_id", jobId)
        .maybeSingle();

      if (!ignore) {
        if (error) {
          console.error("Failed to load vendor job access:", error);
          setJobAccess(null);
        } else {
          setJobAccess((data as VendorJobAccessRow | null) || null);
        }
        setLoading(false);
      }
    }

    void loadJobAccess();
    return () => {
      ignore = true;
    };
  }, [jobId, profile?.vendor_id]);

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
      canSubmitBids: roleCaps.canSubmitBids && !!assignment.can_submit_bids,
      canViewSubcontracts: roleCaps.canViewSubcontracts && !!assignment.can_view_subcontracts,
      canAccessMessages: roleCaps.canAccessMessages && !!assignment.can_access_messages,
      canAccessFilingCabinet: roleCaps.canAccessFilingCabinet && !!assignment.can_access_filing_cabinet,
      canUploadComplianceDocs: roleCaps.canUploadComplianceDocs && !!assignment.can_upload_compliance_docs,
      canNegotiateContracts: roleCaps.canNegotiateContracts && !!assignment.can_negotiate_contracts,
      canSubmitSovProposals: roleCaps.canSubmitSovProposals && !!assignment.can_submit_sov_proposals,
      canUploadSignedContracts: roleCaps.canUploadSignedContracts && !!assignment.can_upload_signed_contracts,
    };
  }, [jobAccess, roleCaps]);

  return {
    loading,
    internalRole,
    roleCaps,
    effectiveJobAccess,
  };
}
