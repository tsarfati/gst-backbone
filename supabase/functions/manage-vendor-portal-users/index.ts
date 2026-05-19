import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const authFrom = resolveBuilderlynkFrom(
  Deno.env.get("AUTH_EMAIL_FROM") || Deno.env.get("INVITE_EMAIL_FROM"),
  EMAIL_FROM.AUTH,
  "manage-vendor-portal-users",
);

const allowedRoles = new Set([
  "owner",
  "basic_user",
]);

const normalizeRole = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  return allowedRoles.has(normalized) ? normalized : "basic_user";
};

const isInternalRole = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  return !!normalized && normalized !== "vendor" && normalized !== "design_professional" && normalized !== "employee";
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
    const body = await req.json();
    const { action, vendorId, targetUserId, inviteId, vendorPortalRole, membershipStatus } = body;

    const normalizedAction = String(action || "").trim().toLowerCase();
    const normalizedVendorId = String(vendorId || "").trim();
    const normalizedTargetUserId = String(targetUserId || "").trim();
    const normalizedInviteId = String(inviteId || "").trim();
    const normalizedMembershipStatus = String(membershipStatus || "").trim().toLowerCase();

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
      .select("user_id, role")
      .eq("user_id", requesterUserId)
      .maybeSingle();
    if (requesterProfileError) throw requesterProfileError;

    const requesterRole = String(requesterProfile?.role || "").trim().toLowerCase();
    const { data: requesterVendorMembership, error: requesterVendorMembershipError } = await supabase
      .from("vendor_invitations")
      .select("vendor_id, vendor_portal_role, created_user_id, status")
      .eq("vendor_id", normalizedVendorId)
      .eq("created_user_id", requesterUserId)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: false, nullsFirst: false })
      .order("invited_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (requesterVendorMembershipError) throw requesterVendorMembershipError;

    const isVendorManager =
      requesterRole === "vendor" &&
      String(requesterVendorMembership?.vendor_id || "").trim() === normalizedVendorId;
    const isVendorOwner = isVendorManager && normalizeRole(requesterVendorMembership?.vendor_portal_role) === "owner";

    const { data: builderAccessRows, error: builderAccessError } = await supabase
      .from("user_company_access")
      .select("company_id, role, is_active")
      .eq("user_id", requesterUserId)
      .eq("company_id", vendorRecord.company_id)
      .eq("is_active", true);
    if (builderAccessError) throw builderAccessError;

    const isInternalBuilderUser = ((builderAccessRows || []) as any[]).some((row) => {
      return isInternalRole(row.role);
    });

    if (!isVendorManager && !isInternalBuilderUser) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (isVendorManager && !isVendorOwner) {
      return new Response(JSON.stringify({ error: "Only the vendor company owner can manage the team." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const loadTeamPayload = async () => {
      const [{ data: linkedUsers, error: linkedUsersError }, { data: pendingInvites, error: pendingInvitesError }] = await Promise.all([
        supabase
          .from("vendor_invitations")
          .select("created_user_id, vendor_portal_role, invited_at, accepted_at, status")
          .eq("vendor_id", normalizedVendorId)
          .in("status", ["accepted", "suspended"])
          .not("created_user_id", "is", null)
          .order("accepted_at", { ascending: false, nullsFirst: false })
          .order("invited_at", { ascending: false }),
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

      const acceptedMembershipRows = ((linkedUsers || []) as any[]);
      const membershipByUserId = new Map<string, { role: string; status: string | null; invitedAt: string | null; acceptedAt: string | null }>();
      acceptedMembershipRows.forEach((entry: any) => {
        const userId = String(entry.created_user_id || "").trim();
        if (!userId || membershipByUserId.has(userId)) return;
        membershipByUserId.set(userId, {
          role: normalizeRole(entry.vendor_portal_role),
          status: entry.status || null,
          invitedAt: entry.invited_at || null,
          acceptedAt: entry.accepted_at || null,
        });
      });

      const linkedUserIds = Array.from(membershipByUserId.keys())
        .filter(Boolean);

      const { data: linkedProfiles, error: linkedProfilesError } = linkedUserIds.length > 0
        ? await supabase
            .from("profiles")
            .select("user_id, display_name, first_name, last_name, email, phone, avatar_url, status")
            .in("user_id", linkedUserIds)
        : { data: [], error: null as any };
      if (linkedProfilesError) throw linkedProfilesError;

      const lastLoginByUserId = new Map<string, { login_time: string | null; login_method: string | null; app_source: string | null }>();
      const recentLoginsByUserId = new Map<string, Array<{
        login_time: string | null;
        login_method: string | null;
        app_source: string | null;
        ip_address: string | null;
        user_agent: string | null;
        success: boolean | null;
      }>>();
      if (linkedUserIds.length > 0) {
        const { data: loginAuditRows, error: loginAuditError } = await supabase
          .from("user_login_audit")
          .select("user_id, login_time, login_method, app_source, ip_address, user_agent, success")
          .in("user_id", linkedUserIds)
          .order("login_time", { ascending: false });
        if (loginAuditError) throw loginAuditError;

        ((loginAuditRows || []) as any[]).forEach((row) => {
          const userId = String(row.user_id || "").trim();
          if (!userId) return;
          if (!lastLoginByUserId.has(userId)) {
            lastLoginByUserId.set(userId, {
              login_time: row.login_time || null,
              login_method: row.login_method || null,
              app_source: row.app_source || null,
            });
          }
          const existing = recentLoginsByUserId.get(userId) || [];
          if (existing.length < 5) {
            existing.push({
              login_time: row.login_time || null,
              login_method: row.login_method || null,
              app_source: row.app_source || null,
              ip_address: row.ip_address || null,
              user_agent: row.user_agent || null,
              success: typeof row.success === "boolean" ? row.success : null,
            });
            recentLoginsByUserId.set(userId, existing);
          }
        });
      }

      return {
        linkedUsers: ((linkedProfiles || []) as any[]).map((entry) => ({
          membership_status: membershipByUserId.get(String(entry.user_id))?.status || entry.status || null,
          invited_at: membershipByUserId.get(String(entry.user_id))?.invitedAt || null,
          accepted_at: membershipByUserId.get(String(entry.user_id))?.acceptedAt || null,
          last_login_at: lastLoginByUserId.get(String(entry.user_id))?.login_time || null,
          last_login_method: lastLoginByUserId.get(String(entry.user_id))?.login_method || null,
          last_login_app_source: lastLoginByUserId.get(String(entry.user_id))?.app_source || null,
          recent_logins: recentLoginsByUserId.get(String(entry.user_id)) || [],
          user_id: String(entry.user_id),
          name:
            String(entry.display_name || "").trim()
            || [entry.first_name, entry.last_name].filter(Boolean).join(" ")
            || entry.email
            || "Vendor User",
          email: entry.email || null,
          phone: entry.phone || null,
          avatar_url: entry.avatar_url || null,
          vendor_portal_role: normalizeRole(membershipByUserId.get(String(entry.user_id))?.role),
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
      const { data: targetMembership, error: targetMembershipError } = await supabase
        .from("vendor_invitations")
        .select("vendor_portal_role")
        .eq("vendor_id", normalizedVendorId)
        .eq("created_user_id", normalizedTargetUserId)
        .eq("status", "accepted")
        .order("accepted_at", { ascending: false, nullsFirst: false })
        .order("invited_at", { ascending: false })
        .maybeSingle();
      if (targetMembershipError) throw targetMembershipError;

      const currentTargetRole = normalizeRole(targetMembership?.vendor_portal_role);
      if (!isInternalBuilderUser && (currentTargetRole === "owner" || nextRole === "owner")) {
        return new Response(JSON.stringify({ error: "Only BuilderLYNK can reassign the company owner." }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { error: updateError } = await supabase
        .from("vendor_invitations")
        .update({ vendor_portal_role: nextRole })
        .eq("vendor_id", normalizedVendorId)
        .eq("created_user_id", normalizedTargetUserId)
        .eq("status", "accepted");
      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, ...(await loadTeamPayload()) }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (normalizedAction === "reset_password") {
      if (!normalizedTargetUserId) {
        return new Response(JSON.stringify({ error: "Missing target user id" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: targetAuthUser, error: targetAuthError } = await supabase.auth.admin.getUserById(normalizedTargetUserId);
      if (targetAuthError || !targetAuthUser?.user?.email) {
        return new Response(JSON.stringify({ error: "Target user not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const originHeader = req.headers.get("origin") || "https://builderlynk.com";
      const redirectTo = `${originHeader.replace(/\/$/, "")}/auth?type=recovery`;
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: String(targetAuthUser.user.email).toLowerCase(),
        options: { redirectTo },
      });
      if (linkError) {
        return new Response(JSON.stringify({ error: linkError.message }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const html = `
        <div style="font-family:Arial,sans-serif;background:#f8f9fb;padding:24px;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
            <h2 style="margin:0 0 12px;color:#111827;">Reset your BuilderLYNK password</h2>
            <p style="margin:0 0 16px;color:#374151;">A vendor portal administrator requested a password reset for your account.</p>
            <a href="${linkData.properties.action_link}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;">Reset Password</a>
            <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">If you did not request this, you can ignore this email.</p>
          </div>
        </div>
      `;

      const { error: emailError } = await resend.emails.send({
        from: authFrom,
        to: [String(targetAuthUser.user.email).toLowerCase()],
        subject: "Reset Your BuilderLYNK Password",
        html,
      });
      if (emailError) {
        return new Response(JSON.stringify({ error: emailError.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ success: true, ...(await loadTeamPayload()) }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (normalizedAction === "set_membership_status") {
      if (!normalizedTargetUserId || !["accepted", "suspended"].includes(normalizedMembershipStatus)) {
        return new Response(JSON.stringify({ error: "Missing target user id or membership status" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: targetMembership, error: targetMembershipError } = await supabase
        .from("vendor_invitations")
        .select("vendor_portal_role, status")
        .eq("vendor_id", normalizedVendorId)
        .eq("created_user_id", normalizedTargetUserId)
        .in("status", ["accepted", "suspended"])
        .order("accepted_at", { ascending: false, nullsFirst: false })
        .order("invited_at", { ascending: false })
        .maybeSingle();
      if (targetMembershipError) throw targetMembershipError;

      const currentTargetRole = normalizeRole(targetMembership?.vendor_portal_role);
      if (!isInternalBuilderUser && currentTargetRole === "owner") {
        return new Response(JSON.stringify({ error: "Only BuilderLYNK can block or unblock the company owner." }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { error: statusError } = await supabase
        .from("vendor_invitations")
        .update({ status: normalizedMembershipStatus })
        .eq("vendor_id", normalizedVendorId)
        .eq("created_user_id", normalizedTargetUserId)
        .in("status", ["accepted", "suspended"]);
      if (statusError) throw statusError;

      return new Response(JSON.stringify({ success: true, ...(await loadTeamPayload()) }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (normalizedAction === "remove_user") {
      if (!normalizedTargetUserId) {
        return new Response(JSON.stringify({ error: "Missing target user id" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: targetMembership, error: targetMembershipError } = await supabase
        .from("vendor_invitations")
        .select("vendor_portal_role")
        .eq("vendor_id", normalizedVendorId)
        .eq("created_user_id", normalizedTargetUserId)
        .in("status", ["accepted", "suspended"])
        .order("accepted_at", { ascending: false, nullsFirst: false })
        .order("invited_at", { ascending: false })
        .maybeSingle();
      if (targetMembershipError) throw targetMembershipError;

      const currentTargetRole = normalizeRole(targetMembership?.vendor_portal_role);
      if (!isInternalBuilderUser && currentTargetRole === "owner") {
        return new Response(JSON.stringify({ error: "Only BuilderLYNK can remove the company owner." }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { error: removeError } = await supabase
        .from("vendor_invitations")
        .update({ status: "revoked" })
        .eq("vendor_id", normalizedVendorId)
        .eq("created_user_id", normalizedTargetUserId)
        .in("status", ["accepted", "suspended"]);
      if (removeError) throw removeError;

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
