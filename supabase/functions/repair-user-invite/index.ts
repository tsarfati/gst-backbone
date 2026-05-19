import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RepairInviteRequest = {
  invitationId?: string;
  companyId?: string;
};

const ADMIN_ROLES = new Set(["admin", "company_admin", "controller", "owner", "super_admin"]);

const findAuthUserByEmail = async (supabaseAdmin: ReturnType<typeof createClient>, email: string) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const matchedUser =
      (data?.users || []).find((user: any) => String(user?.email || "").trim().toLowerCase() === normalizedEmail) ||
      null;

    if (matchedUser) return matchedUser;
    if ((data?.users || []).length < 1000) break;
  }

  return null;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await supabaseAuthed.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { invitationId, companyId }: RepairInviteRequest = await req.json();
    if (!invitationId || !companyId) {
      return new Response(JSON.stringify({ error: "Missing invitationId or companyId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const requesterUserId = authData.user.id;

    const { data: accessRows, error: accessError } = await supabaseAdmin
      .from("user_company_access")
      .select("role, is_active")
      .eq("company_id", companyId)
      .eq("user_id", requesterUserId);
    if (accessError) throw accessError;

    let canManageUsers = (accessRows || []).some((row: any) => {
      const normalizedRole = String(row.role || "").toLowerCase();
      return row.is_active === true && ADMIN_ROLES.has(normalizedRole);
    });

    if (!canManageUsers) {
      const { data: requesterProfile, error: requesterProfileError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("user_id", requesterUserId)
        .maybeSingle();
      if (requesterProfileError) throw requesterProfileError;
      canManageUsers = ADMIN_ROLES.has(String(requesterProfile?.role || "").toLowerCase());
    }

    if (!canManageUsers) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("user_invitations")
      .select("*")
      .eq("id", invitationId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (invitationError) throw invitationError;
    if (!invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const normalizedEmail = String((invitation as any).email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return new Response(JSON.stringify({ error: "Invitation does not have an email address" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, role, status, custom_role_id")
      .ilike("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (profileError) throw profileError;

    let authUser: any = null;
    if (!profile?.user_id) {
      authUser = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);

      if (!authUser?.id) {
        return new Response(JSON.stringify({ error: "No existing account was found for this invitation email" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: profileByUserId, error: profileByUserIdError } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email, role, status, custom_role_id")
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (profileByUserIdError) throw profileByUserIdError;

      profile = profileByUserId;
    }

    const baseRole = String((invitation as any).role || "employee").toLowerCase();
    const customRoleId = (invitation as any).custom_role_id || null;
    const isExternalInviteRole = baseRole === "vendor" || baseRole === "design_professional";
    const nowIso = new Date().toISOString();

    if (!profile?.user_id && authUser?.id) {
      const firstName = String((authUser?.user_metadata?.first_name || (invitation as any).first_name || "")).trim() || null;
      const lastName = String((authUser?.user_metadata?.last_name || (invitation as any).last_name || "")).trim() || null;
      const displayName =
        String(authUser?.user_metadata?.display_name || "").trim() ||
        [firstName, lastName].filter(Boolean).join(" ").trim() ||
        normalizedEmail;

      const insertedProfile = {
        user_id: authUser.id,
        email: normalizedEmail,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        role: customRoleId ? "employee" : (baseRole as any),
        status: isExternalInviteRole ? "approved" : "pending",
        current_company_id: companyId,
        default_company_id: companyId,
        custom_role_id: customRoleId,
      };

      const { data: createdProfile, error: createProfileError } = await supabaseAdmin
        .from("profiles")
        .insert(insertedProfile)
        .select("user_id, email, role, status, custom_role_id")
        .single();
      if (createProfileError) throw createProfileError;

      profile = createdProfile;
    }

    const { data: existingAccess, error: existingAccessError } = await supabaseAdmin
      .from("user_company_access")
      .select("id, role")
      .eq("company_id", companyId)
      .eq("user_id", profile.user_id)
      .maybeSingle();
    if (existingAccessError) throw existingAccessError;

    if (existingAccess?.id) {
      const { error: updateAccessError } = await supabaseAdmin
        .from("user_company_access")
        .update({
          role: baseRole as any,
          is_active: true,
          granted_by: (invitation as any).invited_by || requesterUserId,
        })
        .eq("id", existingAccess.id);
      if (updateAccessError) throw updateAccessError;
    } else {
      const { error: insertAccessError } = await supabaseAdmin
        .from("user_company_access")
        .insert({
          company_id: companyId,
          user_id: profile.user_id,
          role: baseRole as any,
          is_active: true,
          granted_by: (invitation as any).invited_by || requesterUserId,
        });
      if (insertAccessError) throw insertAccessError;
    }

    const { data: companyRow, error: companyLookupError } = await supabaseAdmin
      .from("companies")
      .select("tenant_id")
      .eq("id", companyId)
      .maybeSingle();
    if (companyLookupError) throw companyLookupError;

    if (companyRow?.tenant_id) {
      const { data: tenantMemberRow, error: tenantMemberLookupError } = await supabaseAdmin
        .from("tenant_members")
        .select("tenant_id, user_id, role")
        .eq("tenant_id", companyRow.tenant_id)
        .eq("user_id", profile.user_id)
        .maybeSingle();
      if (tenantMemberLookupError) throw tenantMemberLookupError;

      const tenantRole = ["admin", "company_admin", "controller", "owner", "super_admin"].includes(baseRole)
        ? "admin"
        : "member";

      if (!tenantMemberRow) {
        const { error: tenantMemberInsertError } = await supabaseAdmin
          .from("tenant_members")
          .insert({
            tenant_id: companyRow.tenant_id,
            user_id: profile.user_id,
            role: tenantRole,
            invited_by: (invitation as any).invited_by || requesterUserId,
          });
        if (tenantMemberInsertError) throw tenantMemberInsertError;
      } else if (tenantMemberRow.role !== tenantRole) {
        const { error: tenantMemberUpdateError } = await supabaseAdmin
          .from("tenant_members")
          .update({ role: tenantRole })
          .eq("tenant_id", companyRow.tenant_id)
          .eq("user_id", profile.user_id);
        if (tenantMemberUpdateError) throw tenantMemberUpdateError;
      }
    }

    const profilePatch: Record<string, unknown> = {
      custom_role_id: customRoleId,
      current_company_id: companyId,
      default_company_id: companyId,
      status: isExternalInviteRole ? "approved" : (profile.status || "pending"),
      approved_at: isExternalInviteRole ? nowIso : null,
      approved_by: isExternalInviteRole ? ((invitation as any).invited_by || requesterUserId) : null,
    };
    if (customRoleId) {
      profilePatch.role = "employee";
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update(profilePatch)
      .eq("user_id", profile.user_id);
    if (profileUpdateError) throw profileUpdateError;

    const metadataRole = customRoleId ? "employee" : baseRole;
    const existingUserMetadata = authUser?.user_metadata || {};
    const existingAppMetadata = authUser?.app_metadata || {};
    const { error: authMetadataError } = await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
      user_metadata: {
        ...existingUserMetadata,
        role: metadataRole,
        current_company_id: companyId,
        default_company_id: companyId,
        custom_role_id: customRoleId,
      },
      app_metadata: {
        ...existingAppMetadata,
        role: metadataRole,
        current_company_id: companyId,
        default_company_id: companyId,
        custom_role_id: customRoleId,
      },
    });
    if (authMetadataError) throw authMetadataError;

    const { error: pendingInviteUpdateError } = await supabaseAdmin
      .from("pending_user_invites")
      .update({ accepted_at: nowIso, updated_at: nowIso })
      .eq("company_id", companyId)
      .eq("email", normalizedEmail)
      .is("accepted_at", null);
    if (pendingInviteUpdateError) throw pendingInviteUpdateError;

    const { error: invitationUpdateError } = await supabaseAdmin
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: nowIso,
        accepted_by: profile.user_id,
        updated_at: nowIso,
      })
      .eq("id", invitationId);
    if (invitationUpdateError) throw invitationUpdateError;

    const intakeNotes = JSON.stringify({
      source: "invite_repair",
      requestedRole: baseRole,
      customRoleId,
    });

    const { data: existingRequestRows, error: existingRequestError } = await supabaseAdmin
      .from("company_access_requests")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", profile.user_id)
      .order("requested_at", { ascending: false })
      .limit(1);
    if (existingRequestError) throw existingRequestError;

    const existingRequest = (existingRequestRows || [])[0] || null;
    if (existingRequest?.id) {
      const { error: updateRequestError } = await supabaseAdmin
        .from("company_access_requests")
        .update({
          notes: intakeNotes,
          requested_at: nowIso,
          status: isExternalInviteRole ? "approved" : "pending",
          reviewed_at: isExternalInviteRole ? nowIso : null,
          reviewed_by: isExternalInviteRole ? ((invitation as any).invited_by || requesterUserId) : null,
        })
        .eq("id", existingRequest.id);
      if (updateRequestError) throw updateRequestError;
    } else {
      const { error: insertRequestError } = await supabaseAdmin
        .from("company_access_requests")
        .insert({
          company_id: companyId,
          user_id: profile.user_id,
          notes: intakeNotes,
          requested_at: nowIso,
          status: isExternalInviteRole ? "approved" : "pending",
          reviewed_at: isExternalInviteRole ? nowIso : null,
          reviewed_by: isExternalInviteRole ? ((invitation as any).invited_by || requesterUserId) : null,
        });
      if (insertRequestError) throw insertRequestError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: profile.user_id,
        message: `Finalized invite for ${normalizedEmail}.`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("Error in repair-user-invite:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to repair invitation" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
