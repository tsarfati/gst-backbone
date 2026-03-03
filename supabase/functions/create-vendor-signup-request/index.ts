import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestedRole = "vendor" | "design_professional";

type RequestPayload = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  companyId: string;
  requestedRole: RequestedRole;
  businessName?: string | null;
};

const safeString = (value: unknown) => String(value || "").trim();

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestPayload;
    const userId = safeString(body.userId);
    const email = safeString(body.email).toLowerCase();
    const firstName = safeString(body.firstName);
    const lastName = safeString(body.lastName);
    const companyId = safeString(body.companyId);
    const requestedRole = body.requestedRole === "design_professional" ? "design_professional" : "vendor";
    const businessName = safeString(body.businessName || "");
    const phone = safeString(body.phone || "");

    if (!userId || !email || !firstName || !lastName || !companyId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authEmail = safeString(authUser.user.email).toLowerCase();
    if (authEmail !== email) {
      return new Response(JSON.stringify({ error: "User/email mismatch" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id,name,display_name,is_active")
      .eq("id", companyId)
      .single();
    if (companyError || !company || !company.is_active) {
      return new Response(JSON.stringify({ error: "Company not found or inactive" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          email,
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`.trim(),
          phone: phone || null,
          current_company_id: companyId,
          default_company_id: companyId,
          role: requestedRole,
          status: "pending",
          approved_at: null,
          approved_by: null,
        },
        { onConflict: "user_id" },
      );
    if (profileError) throw profileError;

    const { error: accessError } = await supabase
      .from("user_company_access")
      .upsert({
        user_id: userId,
        company_id: companyId,
        role: requestedRole,
        is_active: true,
        granted_by: userId,
      }, { onConflict: "user_id,company_id" });
    if (accessError) throw accessError;

    const notesPayload = {
      requestType: "vendor_self_signup",
      requestedRole,
      businessName: businessName || null,
      requestedAt: new Date().toISOString(),
      email,
    };

    const { data: existingPendingRequest, error: existingPendingRequestError } = await supabase
      .from("company_access_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingPendingRequestError) throw existingPendingRequestError;

    if (existingPendingRequest?.id) {
      const { error: updateRequestError } = await supabase
        .from("company_access_requests")
        .update({
          notes: JSON.stringify(notesPayload),
          reviewed_at: null,
          reviewed_by: null,
          requested_at: new Date().toISOString(),
        })
        .eq("id", existingPendingRequest.id);
      if (updateRequestError) throw updateRequestError;
    } else {
      const { error: requestError } = await supabase.from("company_access_requests").insert({
        user_id: userId,
        company_id: companyId,
        status: "pending",
        requested_at: new Date().toISOString(),
        notes: JSON.stringify(notesPayload),
      });
      if (requestError) throw requestError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        companyName: company.display_name || company.name,
        requestedRole,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error in create-vendor-signup-request:", error);
    return new Response(JSON.stringify({
      error: error?.message || "Failed to create signup request",
      code: error?.code || null,
      details: error?.details || null,
      hint: error?.hint || null,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
