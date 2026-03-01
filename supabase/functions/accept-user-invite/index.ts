import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AcceptInviteRequest = {
  inviteToken?: string;
};

type InviteErrorCode =
  | "MISSING_AUTH_HEADER"
  | "UNAUTHORIZED"
  | "MISSING_AUTH_EMAIL"
  | "INVITATION_NOT_FOUND"
  | "INVITATION_EXPIRED"
  | "INVITATION_EMAIL_MISMATCH"
  | "INTERNAL_ERROR";

const ALLOWED_BASE_ROLES = new Set([
  "admin",
  "company_admin",
  "controller",
  "project_manager",
  "employee",
  "view_only",
  "vendor",
]);

serve(async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  const sendJson = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  const sendError = (
    status: number,
    code: InviteErrorCode,
    message: string,
    debug: Record<string, unknown> = {},
  ) =>
    sendJson(status, {
      success: false,
      code,
      error: message,
      requestId,
      debug,
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) return sendError(401, "MISSING_AUTH_HEADER", "Missing Authorization header");
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return sendError(401, "MISSING_AUTH_HEADER", "Missing bearer token");

    const supabaseAuthed = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Try both auth resolution paths for better compatibility across environments.
    let userData: any = null;
    let userError: any = null;

    const serviceGetUser = await supabaseAuthed.auth.getUser().catch((err) => ({ data: null, error: err }));
    if (serviceGetUser?.data?.user) {
      userData = serviceGetUser.data;
    } else {
      userError = serviceGetUser?.error || null;
      const anonGetUser = await supabaseAnon.auth.getUser(token).catch((err) => ({ data: null, error: err }));
      if (anonGetUser?.data?.user) {
        userData = anonGetUser.data;
        userError = null;
      } else {
        userError = anonGetUser?.error || userError;
      }
    }

    if (!userData?.user) {
      return sendError(401, "UNAUTHORIZED", "Unauthorized", {
        authError: userError?.message || String(userError || ""),
      });
    }

    const { inviteToken }: AcceptInviteRequest = await req.json().catch(() => ({} as AcceptInviteRequest));

    const normalizedEmail = (userData.user.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return sendError(400, "MISSING_AUTH_EMAIL", "Authenticated user has no email", {
        userId: userData.user.id,
        hasInviteToken: !!inviteToken,
      });
    }

    let pendingInvite: any = null;
    let inviteWasAlreadyAccepted = false;
    let inviteSource: "token" | "email_fallback" = inviteToken ? "token" : "email_fallback";
    let inviteCounts = {
      active: 0,
      activeUnaccepted: 0,
      activeAccepted: 0,
    };

    if (inviteToken) {
      const { data, error: pendingError } = await supabaseAdmin
        .from("pending_user_invites")
        .select("id, email, company_id, role, custom_role_id, invited_by, expires_at, accepted_at")
        .eq("invite_token", inviteToken)
        .maybeSingle();

      if (pendingError) throw pendingError;
      pendingInvite = data;
    } else {
      // Fallback for users who completed auth but lost the invite token in the browser redirect.
      // Accept only when there is exactly one active pending invite for this email to avoid ambiguity.
      const { data, error: pendingError } = await supabaseAdmin
        .from("pending_user_invites")
        .select("id, email, company_id, role, custom_role_id, invited_by, expires_at, accepted_at, created_at")
        .ilike("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(20);

      if (pendingError) throw pendingError;

      const activeInvites = (data || []).filter((inv: any) => {
        const expiresAtMs = new Date(inv.expires_at).getTime();
        return Number.isFinite(expiresAtMs) && expiresAtMs >= Date.now();
      });

      const unacceptedActiveInvites = activeInvites.filter((inv: any) => !inv.accepted_at);
      const acceptedActiveInvites = activeInvites.filter((inv: any) => !!inv.accepted_at);
      inviteCounts = {
        active: activeInvites.length,
        activeUnaccepted: unacceptedActiveInvites.length,
        activeAccepted: acceptedActiveInvites.length,
      };

      if (unacceptedActiveInvites.length === 1) {
        pendingInvite = unacceptedActiveInvites[0];
      } else if (unacceptedActiveInvites.length > 1) {
        // Prefer the most recent active unaccepted invite when multiple resends/deletes exist.
        pendingInvite = unacceptedActiveInvites[0];
      } else if (acceptedActiveInvites.length === 1) {
        // Repair path: invite may already be marked accepted while profile/company access was not fully applied.
        pendingInvite = acceptedActiveInvites[0];
        inviteWasAlreadyAccepted = true;
      } else if (acceptedActiveInvites.length > 1) {
        // Repair path with multiple invite history rows: choose latest accepted active invite.
        pendingInvite = acceptedActiveInvites[0];
        inviteWasAlreadyAccepted = true;
      } else {
        pendingInvite = null;
      }
    }

    if (!pendingInvite) {
      return sendError(404, "INVITATION_NOT_FOUND", "Invitation not found", {
        userId: userData.user.id,
        email: normalizedEmail,
        inviteSource,
        inviteCounts,
        hasInviteToken: !!inviteToken,
      });
    }

    if (pendingInvite.accepted_at) {
      inviteWasAlreadyAccepted = true;
    }

    if (new Date(pendingInvite.expires_at).getTime() < Date.now()) {
      return sendError(410, "INVITATION_EXPIRED", "Invitation has expired", {
        userId: userData.user.id,
        email: normalizedEmail,
        inviteId: pendingInvite.id,
        companyId: pendingInvite.company_id,
        inviteSource,
      });
    }

    const inviteEmail = String(pendingInvite.email || "").trim().toLowerCase();
    if (inviteEmail !== normalizedEmail) {
      return sendError(403, "INVITATION_EMAIL_MISMATCH", "This invite is for a different email address", {
        userId: userData.user.id,
        authEmail: normalizedEmail,
        inviteEmail,
        inviteId: pendingInvite.id,
        companyId: pendingInvite.company_id,
        inviteSource,
      });
    }

    const baseRole = ALLOWED_BASE_ROLES.has(String(pendingInvite.role || "").toLowerCase())
      ? String(pendingInvite.role).toLowerCase()
      : "employee";

    const nowIso = new Date().toISOString();

    // Grant/activate company access
    const { data: existingAccess, error: existingAccessError } = await supabaseAdmin
      .from("user_company_access")
      .select("id")
      .eq("company_id", pendingInvite.company_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (existingAccessError) throw existingAccessError;

    if (existingAccess?.id) {
      const { error: updateAccessError } = await supabaseAdmin
        .from("user_company_access")
        .update({
          is_active: true,
          role: baseRole as any,
          granted_by: pendingInvite.invited_by,
        })
        .eq("id", existingAccess.id);
      if (updateAccessError) throw updateAccessError;
    } else {
      const { error: insertAccessError } = await supabaseAdmin
        .from("user_company_access")
        .insert({
          company_id: pendingInvite.company_id,
          user_id: userData.user.id,
          role: baseRole as any,
          is_active: true,
          granted_by: pendingInvite.invited_by,
        });
      if (insertAccessError) throw insertAccessError;
    }

    // Ensure tenant membership exists for the invited company's tenant.
    // Without this, users can be redirected to /tenant-request even after invite acceptance.
    const { data: companyRow, error: companyLookupError } = await supabaseAdmin
      .from("companies")
      .select("tenant_id")
      .eq("id", pendingInvite.company_id)
      .maybeSingle();
    if (companyLookupError) throw companyLookupError;

    if (companyRow?.tenant_id) {
      const { data: tenantMemberRow, error: tenantMemberLookupError } = await supabaseAdmin
        .from("tenant_members")
        .select("tenant_id, user_id, role")
        .eq("tenant_id", companyRow.tenant_id)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (tenantMemberLookupError) throw tenantMemberLookupError;

      const shouldBeTenantAdmin = ["admin", "company_admin", "controller", "owner", "super_admin"]
        .includes(baseRole);
      const tenantRole = shouldBeTenantAdmin ? "admin" : "member";

      if (!tenantMemberRow) {
        const { error: tenantMemberInsertError } = await supabaseAdmin
          .from("tenant_members")
          .insert({
            tenant_id: companyRow.tenant_id,
            user_id: userData.user.id,
            role: tenantRole,
            invited_by: pendingInvite.invited_by,
          });
        if (tenantMemberInsertError) throw tenantMemberInsertError;
      } else if (tenantMemberRow.role !== tenantRole) {
        const { error: tenantMemberUpdateError } = await supabaseAdmin
          .from("tenant_members")
          .update({ role: tenantRole })
          .eq("tenant_id", companyRow.tenant_id)
          .eq("user_id", userData.user.id);
        if (tenantMemberUpdateError) throw tenantMemberUpdateError;
      }
    }

    // Apply custom role to profile (if present on invite).
    // Be robust to missing profile rows (can happen with invite/account race conditions).
    const profilePatch: Record<string, unknown> = {
      custom_role_id: pendingInvite.custom_role_id ?? null,
      status: "approved",
      approved_at: nowIso,
      approved_by: pendingInvite.invited_by,
      current_company_id: pendingInvite.company_id,
    };
    if (pendingInvite.custom_role_id) {
      // Keep base profile role neutral and rely on company access + custom role permissions
      profilePatch.role = "employee";
    }

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;

    if (existingProfile?.user_id) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from("profiles")
        .update(profilePatch)
        .eq("user_id", userData.user.id);
      if (profileUpdateError) throw profileUpdateError;
    } else {
      const profileInsertPayload: Record<string, unknown> = {
        user_id: userData.user.id,
        email: userData.user.email ?? null,
        role: pendingInvite.custom_role_id ? "employee" : baseRole,
        ...profilePatch,
      };
      const { error: profileInsertError } = await supabaseAdmin
        .from("profiles")
        .insert(profileInsertPayload);
      if (profileInsertError) throw profileInsertError;
    }

    // Mark invitation accepted in both tracking tables
    await supabaseAdmin
      .from("pending_user_invites")
      .update({ accepted_at: nowIso, updated_at: nowIso })
      .eq("id", pendingInvite.id);

    await supabaseAdmin
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: nowIso,
        accepted_by: userData.user.id,
        updated_at: nowIso,
      })
      .eq("company_id", pendingInvite.company_id)
      .eq("email", pendingInvite.email)
      .eq("status", "pending");

    return sendJson(200, {
      success: true,
      requestId,
      alreadyAccepted: inviteWasAlreadyAccepted,
      companyId: pendingInvite.company_id,
      role: baseRole,
      customRoleId: pendingInvite.custom_role_id ?? null,
      debug: {
        elapsedMs: Date.now() - startedAt,
        inviteId: pendingInvite.id,
        inviteSource,
        inviteCounts,
      },
    });
  } catch (error: any) {
    console.error("Error in accept-user-invite:", {
      requestId,
      error: error?.message ?? "Unknown error",
      stack: error?.stack,
    });
    return sendError(500, "INTERNAL_ERROR", error?.message ?? "Unknown error", {
      elapsedMs: Date.now() - startedAt,
    });
  }
});
