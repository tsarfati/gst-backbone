import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const safeString = (value: unknown) => String(value || "").trim();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const isDesignProfessionalVendorType = (value: unknown) => {
  const normalized = safeString(value).toLowerCase();
  return normalized === "design_professional" || normalized === "design professional";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Missing Supabase environment configuration" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { token, firstName, lastName, password } = await req.json();

    const inviteToken = safeString(token);
    const normalizedFirstName = safeString(firstName);
    const normalizedLastName = safeString(lastName);
    const normalizedPassword = safeString(password);

    if (!inviteToken || !normalizedFirstName || !normalizedLastName || normalizedPassword.length < 6) {
      return json(400, { error: "Missing required fields" });
    }

    const { data: invitation, error: invitationError } = await supabase
      .from("vendor_invitations")
      .select(`
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
      `)
      .eq("token", inviteToken)
      .maybeSingle();

    if (invitationError) throw invitationError;
    if (!invitation) {
      return json(404, { error: "Invalid or expired invitation link" });
    }

    const inviteStatus = safeString((invitation as any).status).toLowerCase();
    if (inviteStatus !== "pending") {
      return json(409, {
        error: inviteStatus === "accepted"
          ? "This invitation has already been used"
          : "This invitation is no longer active",
        code: inviteStatus === "accepted" ? "invitation_already_accepted" : "invitation_inactive",
      });
    }

    if (new Date((invitation as any).expires_at).getTime() < Date.now()) {
      return json(400, { error: "This invitation has expired", code: "invitation_expired" });
    }

    const invitedEmail = safeString((invitation as any).email).toLowerCase();
    if (!invitedEmail) {
      return json(400, { error: "Invitation is missing an email address" });
    }

    let existingUserId: string | null = null;
    let page = 1;
    while (!existingUserId) {
      const { data: userList, error: listUsersError } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (listUsersError) throw listUsersError;

      const matchedUser = (userList?.users || []).find(
        (candidate) => safeString(candidate.email).toLowerCase() === invitedEmail,
      );
      if (matchedUser) {
        existingUserId = matchedUser.id;
        break;
      }

      if (!userList?.users?.length || userList.users.length < 1000) break;
      page += 1;
    }

    if (existingUserId) {
      return json(409, {
        error: "This email already has a BuilderLYNK account. Sign in to this company vendor portal instead.",
        code: "email_already_registered",
      });
    }

    const vendorRecord = (invitation as any).vendor || null;
    const externalRole = isDesignProfessionalVendorType(vendorRecord?.vendor_type) ? "design_professional" : "vendor";
    const vendorPortalRole = safeString((invitation as any).vendor_portal_role).toLowerCase() === "owner"
      ? "owner"
      : "basic_user";

    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: invitedEmail,
      password: normalizedPassword,
      email_confirm: true,
      user_metadata: {
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        is_vendor: externalRole === "vendor",
        vendor_id: safeString((invitation as any).vendor_id) || null,
        current_company_id: safeString((invitation as any).company_id) || null,
        default_company_id: safeString((invitation as any).company_id) || null,
        role: externalRole,
        vendor_portal_role: vendorPortalRole,
      },
      app_metadata: {
        is_vendor: externalRole === "vendor",
        vendor_id: safeString((invitation as any).vendor_id) || null,
        current_company_id: safeString((invitation as any).company_id) || null,
        default_company_id: safeString((invitation as any).company_id) || null,
        role: externalRole,
        vendor_portal_role: vendorPortalRole,
      },
    });

    if (createUserError || !createdUser?.user?.id) {
      throw createUserError || new Error("Failed to create vendor user");
    }

    const authUserId = createdUser.user.id;
    const approvedAt = new Date().toISOString();
    const linkedVendorId = safeString((invitation as any).vendor_id) || null;
    const linkedCompanyId = safeString((invitation as any).company_id) || null;
    const displayName = [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ").trim() || invitedEmail;

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

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        user_id: authUserId,
        email: invitedEmail,
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        display_name: displayName,
        role: externalRole,
        current_company_id: linkedCompanyId,
        default_company_id: linkedCompanyId,
        status: "approved",
        approved_at: approvedAt,
        approved_by: (invitation as any).invited_by || authUserId,
        vendor_id: linkedVendorId,
        vendor_portal_role: vendorPortalRole,
      }, { onConflict: "user_id" });
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

    const { data: existingAccessRequest, error: accessRequestLookupError } = await supabase
      .from("company_access_requests")
      .select("id")
      .eq("user_id", authUserId)
      .eq("company_id", linkedCompanyId)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (accessRequestLookupError) throw accessRequestLookupError;

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
        accepted_at: approvedAt,
        created_user_id: authUserId,
      })
      .eq("id", (invitation as any).id);
    if (invitationUpdateError) throw invitationUpdateError;

    return json(200, {
      success: true,
      userId: authUserId,
      email: invitedEmail,
      role: externalRole,
      companyId: linkedCompanyId,
      vendorId: linkedVendorId,
      requiresEmailConfirmation: false,
    });
  } catch (error: any) {
    console.error("Error creating invited vendor account:", error);
    return json(500, {
      error: error?.message || "Failed to create vendor account",
      code: error?.code || null,
    });
  }
});
