import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_EMAIL = "estimating@carsonconcrete.net";

const safeString = (value: unknown) => String(value || "").trim();

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
    const approvedAt = new Date().toISOString();

    const { data: inviteRows, error: inviteError } = await supabase
      .from("vendor_invitations")
      .select(`
        id,
        email,
        company_id,
        vendor_id,
        invited_by,
        invited_at,
        accepted_at,
        status,
        created_user_id,
        vendor:vendors(id, name, vendor_type),
        company:companies(id, name, display_name)
      `)
      .eq("email", TARGET_EMAIL)
      .order("invited_at", { ascending: false })
      .limit(10);

    if (inviteError) throw inviteError;
    if (!inviteRows || inviteRows.length === 0) {
      return new Response(
        JSON.stringify({ error: `No vendor invitations found for ${TARGET_EMAIL}` }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const invite = inviteRows[0] as any;
    const vendorType = safeString(invite?.vendor?.vendor_type).toLowerCase();
    const externalRole = vendorType === "design_professional" ? "design_professional" : "vendor";

    let targetUserId = safeString(invite.created_user_id);

    if (!targetUserId) {
      const { data: profileByEmail, error: profileByEmailError } = await supabase
        .from("profiles")
        .select("user_id, email, vendor_id")
        .eq("email", TARGET_EMAIL)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profileByEmailError) throw profileByEmailError;
      if (profileByEmail?.user_id) {
        targetUserId = safeString(profileByEmail.user_id);
      }
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: `No profile or created user found for ${TARGET_EMAIL}` }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name, display_name")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;

    const firstName = safeString(existingProfile?.first_name);
    const lastName = safeString(existingProfile?.last_name);
    const displayName = safeString(existingProfile?.display_name) || [firstName, lastName].filter(Boolean).join(" ").trim() || TARGET_EMAIL;

    const notesPayload = {
      requestType: "external_access_signup",
      requestedRole: externalRole,
      businessName: safeString(invite?.vendor?.name) || null,
      homeCompanyId: safeString(invite.company_id) || null,
      homeCompanyName: safeString(invite?.company?.display_name || invite?.company?.name) || null,
      externalCompanyId: safeString(invite.company_id) || null,
      requestedAt: approvedAt,
      email: TARGET_EMAIL,
      source: "rfp_vendor_invitation_repair",
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        user_id: targetUserId,
        email: TARGET_EMAIL,
        first_name: firstName || null,
        last_name: lastName || null,
        display_name: displayName,
        role: externalRole,
        current_company_id: invite.company_id,
        default_company_id: invite.company_id,
        status: "approved",
        approved_at: approvedAt,
        approved_by: invite.invited_by || targetUserId,
        vendor_id: invite.vendor_id,
      }, { onConflict: "user_id" });
    if (profileError) throw profileError;

    const { error: accessError } = await supabase
      .from("user_company_access")
      .upsert({
        user_id: targetUserId,
        company_id: invite.company_id,
        role: externalRole,
        is_active: true,
        granted_by: invite.invited_by || targetUserId,
      }, { onConflict: "user_id,company_id" });
    if (accessError) throw accessError;

    const { data: existingRequest, error: existingRequestError } = await supabase
      .from("company_access_requests")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("company_id", invite.company_id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingRequestError) throw existingRequestError;

    if (existingRequest?.id) {
      const { error: requestUpdateError } = await supabase
        .from("company_access_requests")
        .update({
          status: "approved",
          requested_at: approvedAt,
          reviewed_at: approvedAt,
          reviewed_by: invite.invited_by || targetUserId,
          notes: JSON.stringify(notesPayload),
        })
        .eq("id", existingRequest.id);
      if (requestUpdateError) throw requestUpdateError;
    } else {
      const { error: requestInsertError } = await supabase
        .from("company_access_requests")
        .insert({
          user_id: targetUserId,
          company_id: invite.company_id,
          status: "approved",
          requested_at: approvedAt,
          reviewed_at: approvedAt,
          reviewed_by: invite.invited_by || targetUserId,
          notes: JSON.stringify(notesPayload),
        });
      if (requestInsertError) throw requestInsertError;
    }

    const { error: inviteUpdateError } = await supabase
      .from("vendor_invitations")
      .update({
        status: "accepted",
        accepted_at: invite.accepted_at || approvedAt,
        created_user_id: targetUserId,
      })
      .eq("email", TARGET_EMAIL)
      .eq("company_id", invite.company_id);
    if (inviteUpdateError) throw inviteUpdateError;

    return new Response(
      JSON.stringify({
        success: true,
        repairedEmail: TARGET_EMAIL,
        userId: targetUserId,
        companyId: invite.company_id,
        vendorId: invite.vendor_id,
        role: externalRole,
        companyName: invite?.company?.display_name || invite?.company?.name || null,
        vendorName: invite?.vendor?.name || null,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("repair-carson-vendor-signup error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to repair Carson Concrete vendor signup" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
