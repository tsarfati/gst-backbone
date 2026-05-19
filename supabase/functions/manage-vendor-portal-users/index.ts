import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedRoles = new Set([
  "owner",
  "basic_user",
]);

const normalizeRole = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  return allowedRoles.has(normalized) ? normalized : "basic_user";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("Missing Supabase environment configuration");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const requesterUserId = authData.user.id;
    const { action, vendorId, targetUserId, inviteId, vendorPortalRole } = await req.json();

    const normalizedAction = String(action || "").trim().toLowerCase();
    const normalizedVendorId = String(vendorId || "").trim();
    const normalizedTargetUserId = String(targetUserId || "").trim();
    const normalizedInviteId = String(inviteId || "").trim();

    if (!normalizedAction || !normalizedVendorId) {
      return new Response(JSON.stringify({ error: "Missing action or vendor id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: vendorRecord, error: vendorError } = await supabase
      .from("vendors")
      .select("id, company_id")
      .eq("id", normalizedVendorId)
      .maybeSingle();
    if (vendorError) throw vendorError;
    if (!vendorRecord?.id) {
      return new Response(JSON.stringify({ error: "Vendor not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: requesterProfile, error: requesterProfileError } = await supabase
      .from("profiles")
      .select("user_id, role, vendor_id, vendor_portal_role")
      .eq("user_id", requesterUserId)
      .maybeSingle();
    if (requesterProfileError) throw requesterProfileError;

    const requesterRole = String(requesterProfile?.role || "").trim().toLowerCase();
    const requesterVendorId = String(requesterProfile?.vendor_id || "").trim();
    const isVendorManager =
      requesterRole === "vendor" &&
      requesterVendorId === normalizedVendorId;

    const { data: builderAccessRows, error: builderAccessError } = await supabase
      .from("user_company_access")
      .select("company_id, role, is_active")
      .eq("user_id", requesterUserId)
      .eq("company_id", vendorRecord.company_id)
      .eq("is_active", true);
    if (builderAccessError) throw builderAccessError;

    const isInternalBuilderUser = ((builderAccessRows || []) as any[]).some((row) => {
      const rowRole = String(row.role || "").trim().toLowerCase();
      return rowRole !== "vendor" && rowRole !== "design_professional" && rowRole !== "employee";
    });

    if (!isVendorManager && !isInternalBuilderUser) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const loadTeamPayload = async () => {
      const [{ data: linkedUsers, error: linkedUsersError }, { data: pendingInvites, error: pendingInvitesError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, first_name, last_name, email, phone, avatar_url, vendor_portal_role")
          .eq("vendor_id", normalizedVendorId)
          .eq("role", "vendor")
          .order("created_at", { ascending: true }),
        supabase
          .from("vendor_invitations")
          .select("id, email, invited_at, expires_at, status, vendor_portal_role, created_user_id")
          .eq("vendor_id", normalizedVendorId)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .order("invited_at", { ascending: false }),
      ]);

      if (linkedUsersError) throw linkedUsersError;
      if (pendingInvitesError) throw pendingInvitesError;

      const linkedUserIds = ((linkedUsers || []) as any[])
        .map((entry) => String(entry.user_id || "").trim())
        .filter(Boolean);

      const lastLoginByUserId = new Map<string, { login_time: string | null; login_method: string | null; app_source: string | null }>();
      if (linkedUserIds.length > 0) {
        const { data: loginAuditRows, error: loginAuditError } = await supabase
          .from("user_login_audit")
          .select("user_id, login_time, login_method, app_source")
          .in("user_id", linkedUserIds)
          .order("login_time", { ascending: false });
        if (loginAuditError) throw loginAuditError;

        ((loginAuditRows || []) as any[]).forEach((row) => {
          const userId = String(row.user_id || "").trim();
          if (!userId || lastLoginByUserId.has(userId)) return;
          lastLoginByUserId.set(userId, {
            login_time: row.login_time || null,
            login_method: row.login_method || null,
            app_source: row.app_source || null,
          });
        });
      }

      return {
        linkedUsers: ((linkedUsers || []) as any[]).map((entry) => ({
          last_login_at: lastLoginByUserId.get(String(entry.user_id))?.login_time || null,
          last_login_method: lastLoginByUserId.get(String(entry.user_id))?.login_method || null,
          last_login_app_source: lastLoginByUserId.get(String(entry.user_id))?.app_source || null,
          user_id: String(entry.user_id),
          name:
            String(entry.display_name || "").trim()
            || [entry.first_name, entry.last_name].filter(Boolean).join(" ")
            || entry.email
            || "Vendor User",
          email: entry.email || null,
          phone: entry.phone || null,
          avatar_url: entry.avatar_url || null,
          vendor_portal_role: normalizeRole(entry.vendor_portal_role),
        })),
        pendingInvites: ((pendingInvites || []) as any[]).map((invite) => ({
          id: String(invite.id),
          email: String(invite.email || ""),
          invited_at: invite.invited_at,
          expires_at: invite.expires_at,
          status: invite.status,
          created_user_id: invite.created_user_id || null,
          vendor_portal_role: normalizeRole(invite.vendor_portal_role),
        })),
      };
    };

    if (normalizedAction === "list") {
      return new Response(JSON.stringify({ success: true, ...(await loadTeamPayload()) }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (normalizedAction === "update_role") {
      if (!normalizedTargetUserId) {
        return new Response(JSON.stringify({ error: "Missing target user id" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const nextRole = normalizeRole(vendorPortalRole);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ vendor_portal_role: nextRole })
        .eq("user_id", normalizedTargetUserId)
        .eq("vendor_id", normalizedVendorId)
        .eq("role", "vendor");
      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, ...(await loadTeamPayload()) }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (normalizedAction === "revoke_invite") {
      if (!normalizedInviteId) {
        return new Response(JSON.stringify({ error: "Missing invite id" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { error: revokeError } = await supabase
        .from("vendor_invitations")
        .update({ status: "revoked" })
        .eq("id", normalizedInviteId)
        .eq("vendor_id", normalizedVendorId)
        .eq("status", "pending");
      if (revokeError) throw revokeError;

      return new Response(JSON.stringify({ success: true, ...(await loadTeamPayload()) }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in manage-vendor-portal-users:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
