import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const safeString = (value: unknown) => String(value || "").trim();

const isMissingColumnError = (error: any, columnName: string) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes("column");
};

const isDesignProfessionalVendorType = (value: unknown) => {
  const normalized = safeString(value).toLowerCase();
  return normalized === "design_professional" || normalized === "design professional";
};

const isInternalRole = (value: unknown) => {
  const normalized = safeString(value).toLowerCase();
  return !!normalized && normalized !== "vendor" && normalized !== "design_professional";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment configuration");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { token, userId, firstName, lastName, companyId } = await req.json();

    const inviteToken = safeString(token);
    const authUserId = safeString(userId);
    const normalizedFirstName = safeString(firstName);
    const normalizedLastName = safeString(lastName);
    const requestedCompanyId = safeString(companyId);

    if ((!inviteToken && !requestedCompanyId) || !authUserId) {
      return new Response(
        JSON.stringify({ error: "Missing invitation token/company or user id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(authUserId);
    if (authUserError) throw authUserError;

    const actualEmail = safeString(authUserData.user?.email).toLowerCase();
    if (!actualEmail) {
      return new Response(
        JSON.stringify({ error: "Signed-in user does not have a valid email address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const invitationSelectWithRole = `
      id,
      vendor_id,
      company_id,
      invited_by,
      email,
      status,
      expires_at,
      accepted_at,
      created_user_id,
      vendor_portal_role,
      vendor:vendors(id, name, vendor_type)
    `;
    const invitationSelectWithoutRole = `
      id,
      vendor_id,
      company_id,
      invited_by,
      email,
      status,
      expires_at,
      accepted_at,
      created_user_id,
      vendor:vendors(id, name, vendor_type)
    `;

    const loadInvitations = async (selectSql: string) => {
      if (inviteToken) {
        const result = await supabase
          .from("vendor_invitations")
          .select(selectSql)
          .eq("token", inviteToken)
          .limit(1);
        return result;
      }

      const result = await supabase
        .from("vendor_invitations")
        .select(selectSql)
        .eq("company_id", requestedCompanyId)
        .eq("email", actualEmail)
        .in("status", ["pending", "accepted"])
        .order("invited_at", { ascending: false })
        .limit(10);
      return result;
    };

    let invitationRows: any[] | null = null;
    let invitationError: any = null;

    const invitationWithRole = await loadInvitations(invitationSelectWithRole);
    if (invitationWithRole.error && isMissingColumnError(invitationWithRole.error, "vendor_portal_role")) {
      const invitationWithoutRole = await loadInvitations(invitationSelectWithoutRole);
      invitationRows = invitationWithoutRole.data || null;
      invitationError = invitationWithoutRole.error;
    } else {
      invitationRows = invitationWithRole.data || null;
      invitationError = invitationWithRole.error;
    }

    if (invitationError) throw invitationError;

    const invitationCandidates = Array.isArray(invitationRows) ? invitationRows : [];
    const invitation = invitationCandidates.find((row: any) => {
      const status = safeString(row?.status).toLowerCase();
      const createdUserId = safeString(row?.created_user_id);
      return status === "pending" || (status === "accepted" && createdUserId === authUserId);
    }) || null;

    if (!invitation) {
      return new Response(
        JSON.stringify({ error: inviteToken ? "Invalid or expired invitation link" : "No active vendor invitation found for this company" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const inviteStatus = safeString((invitation as any).status).toLowerCase();
    const existingCreatedUserId = safeString((invitation as any).created_user_id);
    const isAcceptedByThisUser = inviteStatus === "accepted" && existingCreatedUserId === authUserId;
    if (inviteStatus !== "pending" && !isAcceptedByThisUser) {
      return new Response(
        JSON.stringify({ error: "This invitation is no longer active" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (new Date((invitation as any).expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const invitedEmail = safeString((invitation as any).email).toLowerCase();
    if (!actualEmail || actualEmail !== invitedEmail) {
      return new Response(
        JSON.stringify({ error: "Signed-in user does not match this invitation email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const vendorRecord = (invitation as any).vendor || null;
    const externalRole = isDesignProfessionalVendorType(vendorRecord?.vendor_type) ? "design_professional" : "vendor";
    const approvedAt = new Date().toISOString();
    const displayName = [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ").trim() || invitedEmail;
    const linkedVendorId = safeString((invitation as any).vendor_id) || null;
    const linkedCompanyId = safeString((invitation as any).company_id) || null;
    const rawVendorPortalRole = safeString((invitation as any).vendor_portal_role).toLowerCase();
    const vendorPortalRole = rawVendorPortalRole === "owner" ? "owner" : "basic_user";

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("role, current_company_id, default_company_id, vendor_id, vendor_portal_role")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;

    const { data: existingAccessRows, error: existingAccessError } = await supabase
      .from("user_company_access")
      .select("company_id, role, is_active")
      .eq("user_id", authUserId)
      .eq("is_active", true);
    if (existingAccessError) throw existingAccessError;

    const internalAccessRows = ((existingAccessRows || []) as any[]).filter((row: any) =>
      isInternalRole(row?.role),
    );
    const hasInternalWorkspace = internalAccessRows.length > 0 || isInternalRole(existingProfile?.role);
    const preferredInternalCompanyId =
      internalAccessRows.find((row: any) => String(row?.company_id || "") === safeString(existingProfile?.current_company_id))?.company_id
      || internalAccessRows.find((row: any) => String(row?.company_id || "") === safeString(existingProfile?.default_company_id))?.company_id
      || internalAccessRows[0]?.company_id
      || null;
    const preservedRole = isInternalRole(existingProfile?.role) ? safeString(existingProfile?.role) : null;

    const notesPayload = {
      requestType: "external_access_signup",
      requestedRole: externalRole,
      businessName: safeString(vendorRecord?.name) || null,
      homeCompanyId: linkedCompanyId,
      homeCompanyName: null,
      externalCompanyId: linkedCompanyId,
      vendorId: linkedVendorId,
      requestedAt: approvedAt,
      email: invitedEmail,
      source: "vendor_portal_invitation",
    };

    const existingUserMetadata = authUserData.user?.user_metadata || {};
    const existingAppMetadata = authUserData.user?.app_metadata || {};
    const metadataRole = hasInternalWorkspace
      ? preservedRole || safeString(existingUserMetadata.role) || safeString(existingAppMetadata.role)
      : externalRole;
    const metadataCurrentCompanyId = hasInternalWorkspace
      ? safeString(preferredInternalCompanyId || existingProfile?.current_company_id || existingProfile?.default_company_id || existingUserMetadata.current_company_id || existingAppMetadata.current_company_id) || null
      : linkedCompanyId;
    const metadataDefaultCompanyId = hasInternalWorkspace
      ? safeString(preferredInternalCompanyId || existingProfile?.default_company_id || existingProfile?.current_company_id || existingUserMetadata.default_company_id || existingAppMetadata.default_company_id) || null
      : linkedCompanyId;
    const { error: authMetadataError } = await supabase.auth.admin.updateUserById(authUserId, {
      user_metadata: {
        ...existingUserMetadata,
        first_name: normalizedFirstName || existingUserMetadata.first_name || null,
        last_name: normalizedLastName || existingUserMetadata.last_name || null,
        is_vendor: externalRole === "vendor",
        vendor_id: hasInternalWorkspace ? (existingUserMetadata.vendor_id ?? null) : linkedVendorId,
        current_company_id: metadataCurrentCompanyId,
        default_company_id: metadataDefaultCompanyId,
        role: metadataRole || null,
        vendor_portal_role: hasInternalWorkspace ? (existingUserMetadata.vendor_portal_role ?? null) : vendorPortalRole,
      },
      app_metadata: {
        ...existingAppMetadata,
        is_vendor: externalRole === "vendor",
        vendor_id: hasInternalWorkspace ? (existingAppMetadata.vendor_id ?? null) : linkedVendorId,
        current_company_id: metadataCurrentCompanyId,
        default_company_id: metadataDefaultCompanyId,
        role: metadataRole || null,
        vendor_portal_role: hasInternalWorkspace ? (existingAppMetadata.vendor_portal_role ?? null) : vendorPortalRole,
      },
    });
    if (authMetadataError) throw authMetadataError;

    const profilePayload = {
      user_id: authUserId,
      email: invitedEmail,
      first_name: normalizedFirstName || null,
      last_name: normalizedLastName || null,
      display_name: displayName,
      role: hasInternalWorkspace ? (preservedRole || existingProfile?.role || externalRole) : externalRole,
      current_company_id: hasInternalWorkspace ? (metadataCurrentCompanyId || null) : linkedCompanyId,
      default_company_id: hasInternalWorkspace ? (metadataDefaultCompanyId || null) : linkedCompanyId,
      status: "approved",
      approved_at: approvedAt,
      approved_by: (invitation as any).invited_by || authUserId,
      vendor_id: hasInternalWorkspace ? (existingProfile?.vendor_id || null) : linkedVendorId,
      vendor_portal_role: hasInternalWorkspace ? (existingProfile?.vendor_portal_role || null) : vendorPortalRole,
    };

    let { error: profileError } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "user_id" });

    if (profileError && isMissingColumnError(profileError, "vendor_portal_role")) {
      const { vendor_portal_role, ...profilePayloadWithoutRole } = profilePayload;
      const retryResult = await supabase
        .from("profiles")
        .upsert(profilePayloadWithoutRole, { onConflict: "user_id" });
      profileError = retryResult.error;
    }

    if (profileError) throw profileError;

    const { error: accessError } = await supabase
      .from("user_company_access")
      .upsert({
        user_id: authUserId,
        company_id: linkedCompanyId,
        role: externalRole,
        is_active: true,
        granted_by: (invitation as any).invited_by || authUserId,
      }, { onConflict: "user_id,company_id" });
    if (accessError) throw accessError;

    const { data: existingAccessRequest, error: existingAccessRequestError } = await supabase
      .from("company_access_requests")
      .select("id")
      .eq("user_id", authUserId)
      .eq("company_id", linkedCompanyId)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingAccessRequestError) throw existingAccessRequestError;

    if (existingAccessRequest?.id) {
      const { error: updateAccessRequestError } = await supabase
        .from("company_access_requests")
        .update({
          status: "approved",
          requested_at: approvedAt,
          reviewed_at: approvedAt,
          reviewed_by: (invitation as any).invited_by || authUserId,
          notes: JSON.stringify(notesPayload),
        })
        .eq("id", existingAccessRequest.id);
      if (updateAccessRequestError) throw updateAccessRequestError;
    } else {
      const { error: insertAccessRequestError } = await supabase
        .from("company_access_requests")
        .insert({
          user_id: authUserId,
          company_id: linkedCompanyId,
          status: "approved",
          requested_at: approvedAt,
          reviewed_at: approvedAt,
          reviewed_by: (invitation as any).invited_by || authUserId,
          notes: JSON.stringify(notesPayload),
      });
      if (insertAccessRequestError) throw insertAccessRequestError;
    }

    const { error: invitationUpdateError } = await supabase
      .from("vendor_invitations")
      .update({
        status: "accepted",
        accepted_at: safeString((invitation as any).accepted_at) || approvedAt,
        created_user_id: authUserId,
      })
      .eq("id", (invitation as any).id);
    if (invitationUpdateError) throw invitationUpdateError;

    return new Response(
      JSON.stringify({
        success: true,
        role: externalRole,
        companyId: linkedCompanyId,
        vendorId: linkedVendorId,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error finalizing vendor invite registration:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to finalize vendor invitation" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
