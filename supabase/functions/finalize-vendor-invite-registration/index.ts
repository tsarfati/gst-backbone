import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const safeString = (value: unknown) => String(value || "").trim();

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
      throw new Error("Missing Supabase environment configuration");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { token, userId, firstName, lastName } = await req.json();

    const inviteToken = safeString(token);
    const authUserId = safeString(userId);
    const normalizedFirstName = safeString(firstName);
    const normalizedLastName = safeString(lastName);

    if (!inviteToken || !authUserId) {
      return new Response(
        JSON.stringify({ error: "Missing invitation token or user id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
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
        vendor:vendors(id, name, vendor_type)
      `)
      .eq("token", inviteToken)
      .maybeSingle();

    if (invitationError) throw invitationError;
    if (!invitation) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired invitation link" }),
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

    const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(authUserId);
    if (authUserError) throw authUserError;

    const invitedEmail = safeString((invitation as any).email).toLowerCase();
    const actualEmail = safeString(authUserData.user?.email).toLowerCase();
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

    const notesPayload = {
      requestType: "external_access_signup",
      requestedRole: externalRole,
      businessName: safeString(vendorRecord?.name) || null,
      homeCompanyId: safeString((invitation as any).company_id) || null,
      homeCompanyName: null,
      externalCompanyId: safeString((invitation as any).company_id) || null,
      requestedAt: approvedAt,
      email: invitedEmail,
      source: "rfp_vendor_invitation",
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        user_id: authUserId,
        email: invitedEmail,
        first_name: normalizedFirstName || null,
        last_name: normalizedLastName || null,
        display_name: displayName,
        role: externalRole,
        current_company_id: (invitation as any).company_id,
        default_company_id: (invitation as any).company_id,
        status: "approved",
        approved_at: approvedAt,
        approved_by: (invitation as any).invited_by || authUserId,
        vendor_id: (invitation as any).vendor_id,
      }, { onConflict: "user_id" });
    if (profileError) throw profileError;

    const { error: accessError } = await supabase
      .from("user_company_access")
      .upsert({
        user_id: authUserId,
        company_id: (invitation as any).company_id,
        role: externalRole,
        is_active: true,
        granted_by: (invitation as any).invited_by || authUserId,
      }, { onConflict: "user_id,company_id" });
    if (accessError) throw accessError;

    const { data: existingAccessRequest, error: existingAccessRequestError } = await supabase
      .from("company_access_requests")
      .select("id")
      .eq("user_id", authUserId)
      .eq("company_id", (invitation as any).company_id)
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
          company_id: (invitation as any).company_id,
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
        companyId: (invitation as any).company_id,
        vendorId: (invitation as any).vendor_id,
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
