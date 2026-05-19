import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeVendorPortalRole, type VendorPortalRole } from "@/lib/vendorPortalRoles";

export interface VendorPortalTeamUser {
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  vendor_portal_role: VendorPortalRole;
  membership_status?: string | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  last_login_at?: string | null;
  last_login_method?: string | null;
  last_login_app_source?: string | null;
  recent_logins?: Array<{
    login_time: string | null;
    login_method: string | null;
    app_source?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    success?: boolean | null;
  }>;
}

export interface VendorPortalTeamInvite {
  id: string;
  email: string;
  invited_at: string | null;
  expires_at: string | null;
  status: string | null;
  created_user_id: string | null;
  vendor_portal_role: VendorPortalRole;
}

type LoadPayload = {
  linkedUsers?: VendorPortalTeamUser[];
  pendingInvites?: VendorPortalTeamInvite[];
};

export function useVendorPortalTeam(vendorId?: string | null) {
  const [loading, setLoading] = useState(false);
  const [linkedUsers, setLinkedUsers] = useState<VendorPortalTeamUser[]>([]);
  const [pendingInvites, setPendingInvites] = useState<VendorPortalTeamInvite[]>([]);

  const applyPayload = useCallback((payload?: LoadPayload) => {
    setLinkedUsers(((payload?.linkedUsers || []) as VendorPortalTeamUser[]).map((user) => ({
      ...user,
      vendor_portal_role: normalizeVendorPortalRole(user.vendor_portal_role),
    })));
    setPendingInvites(((payload?.pendingInvites || []) as VendorPortalTeamInvite[]).map((invite) => ({
      ...invite,
      vendor_portal_role: normalizeVendorPortalRole(invite.vendor_portal_role),
    })));
  }, []);

  const loadTeam = useCallback(async () => {
    if (!vendorId) {
      setLinkedUsers([]);
      setPendingInvites([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-vendor-portal-users", {
        body: {
          action: "list",
          vendorId,
        },
      });
      if (error) throw error;
      applyPayload(data || {});
    } finally {
      setLoading(false);
    }
  }, [applyPayload, vendorId]);

  const updateRole = useCallback(async (targetUserId: string, nextRole: VendorPortalRole) => {
    if (!vendorId) return;
    const { data, error } = await supabase.functions.invoke("manage-vendor-portal-users", {
      body: {
        action: "update_role",
        vendorId,
        targetUserId,
        vendorPortalRole: nextRole,
      },
    });
    if (error) throw error;
    applyPayload(data || {});
  }, [applyPayload, vendorId]);

  const revokeInvite = useCallback(async (inviteId: string) => {
    if (!vendorId) return;
    const { data, error } = await supabase.functions.invoke("manage-vendor-portal-users", {
      body: {
        action: "revoke_invite",
        vendorId,
        inviteId,
      },
    });
    if (error) throw error;
    applyPayload(data || {});
  }, [applyPayload, vendorId]);

  const resetPassword = useCallback(async (targetUserId: string) => {
    if (!vendorId) return;
    const { data, error } = await supabase.functions.invoke("manage-vendor-portal-users", {
      body: {
        action: "reset_password",
        vendorId,
        targetUserId,
      },
    });
    if (error) throw error;
    applyPayload(data || {});
  }, [applyPayload, vendorId]);

  const setMembershipStatus = useCallback(async (targetUserId: string, membershipStatus: "accepted" | "suspended") => {
    if (!vendorId) return;
    const { data, error } = await supabase.functions.invoke("manage-vendor-portal-users", {
      body: {
        action: "set_membership_status",
        vendorId,
        targetUserId,
        membershipStatus,
      },
    });
    if (error) throw error;
    applyPayload(data || {});
  }, [applyPayload, vendorId]);

  const removeUser = useCallback(async (targetUserId: string) => {
    if (!vendorId) return;
    const { data, error } = await supabase.functions.invoke("manage-vendor-portal-users", {
      body: {
        action: "remove_user",
        vendorId,
        targetUserId,
      },
    });
    if (error) throw error;
    applyPayload(data || {});
  }, [applyPayload, vendorId]);

  return {
    loading,
    linkedUsers,
    pendingInvites,
    loadTeam,
    updateRole,
    revokeInvite,
    resetPassword,
    setMembershipStatus,
    removeUser,
    setLinkedUsers,
    setPendingInvites,
  };
}
