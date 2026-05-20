import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

type VendorPortalVendorContext = {
  vendorId: string | null;
  vendorIds: string[];
  companyId: string | null;
  vendorPortalRole: string | null;
  loading: boolean;
};

export function useActiveVendorPortalVendor(): VendorPortalVendorContext {
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const authMetadata = (user?.user_metadata || {}) as Record<string, any>;
  const fallbackVendorId = useMemo(
    () =>
      String(
        profile?.vendor_id ||
        authMetadata.vendor_id ||
        "",
      ).trim() || null,
    [profile?.vendor_id, authMetadata.vendor_id],
  );
  const activeCompanyId = String(currentCompany?.id || profile?.current_company_id || "").trim() || null;
  const [vendorId, setVendorId] = useState<string | null>(fallbackVendorId);
  const [vendorIds, setVendorIds] = useState<string[]>(fallbackVendorId ? [fallbackVendorId] : []);
  const [vendorPortalRole, setVendorPortalRole] = useState<string | null>(
    String(profile?.vendor_portal_role || "").trim() || null,
  );
  const [loading, setLoading] = useState(Boolean(user?.id && activeCompanyId));

  useEffect(() => {
    let ignore = false;

    async function resolveVendorId() {
      if (!user?.id) {
        setVendorId(fallbackVendorId);
        setVendorIds(fallbackVendorId ? [fallbackVendorId] : []);
        setVendorPortalRole(String(profile?.vendor_portal_role || "").trim() || null);
        setLoading(false);
        return;
      }

      if (!activeCompanyId) {
        setVendorId(fallbackVendorId);
        setVendorIds(fallbackVendorId ? [fallbackVendorId] : []);
        setVendorPortalRole(String(profile?.vendor_portal_role || "").trim() || null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data: inviteRows, error: inviteError } = await supabase
          .from("vendor_invitations")
          .select("vendor_id, vendor_portal_role, status, created_user_id, invited_at, accepted_at, email")
          .eq("company_id", activeCompanyId)
          .or(`created_user_id.eq.${user.id},email.eq.${String(user.email || "").trim().toLowerCase()}`)
          .order("accepted_at", { ascending: false, nullsFirst: false })
          .order("invited_at", { ascending: false })
          .limit(10);

        if (inviteError) throw inviteError;

        const normalizedUserEmail = String(user.email || "").trim().toLowerCase();
        const bestInvite = ((inviteRows || []) as any[]).find((row: any) => {
          const createdUserId = String(row?.created_user_id || "").trim();
          const inviteEmail = String(row?.email || "").trim().toLowerCase();
          const status = String(row?.status || "").trim().toLowerCase();
          return (
            String(row?.vendor_id || "").trim() &&
            (createdUserId === user.id || (normalizedUserEmail && inviteEmail === normalizedUserEmail)) &&
            (status === "accepted" || status === "pending")
          );
        });

        const inviteVendorIds = Array.from(
          new Set(
            ((inviteRows || []) as any[])
              .map((row: any) => String(row?.vendor_id || "").trim())
              .filter(Boolean),
          ),
        );
        const combinedVendorIds = Array.from(
          new Set([...(fallbackVendorId ? [fallbackVendorId] : []), ...inviteVendorIds]),
        );

        if (!ignore) {
          setVendorId(String(bestInvite?.vendor_id || "").trim() || fallbackVendorId);
          setVendorIds(combinedVendorIds);
          setVendorPortalRole(String(bestInvite?.vendor_portal_role || "").trim() || String(profile?.vendor_portal_role || "").trim() || null);
        }
      } catch (error) {
        console.error("Failed to resolve active vendor portal vendor:", error);
        if (!ignore) {
          setVendorId(fallbackVendorId);
          setVendorIds(fallbackVendorId ? [fallbackVendorId] : []);
          setVendorPortalRole(String(profile?.vendor_portal_role || "").trim() || null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void resolveVendorId();

    return () => {
      ignore = true;
    };
  }, [user?.id, user?.email, activeCompanyId, fallbackVendorId, profile?.vendor_portal_role]);

  return {
    vendorId,
    vendorIds,
    companyId: activeCompanyId,
    vendorPortalRole,
    loading,
  };
}
