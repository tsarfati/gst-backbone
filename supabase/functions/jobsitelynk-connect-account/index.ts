import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const elevatedRoles = new Set(["super_admin", "owner", "admin", "company_admin", "controller"]);
const trimTrailingSlashes = (value: string) => value.replace(/\/+$/g, "");
const DEFAULT_JOBSITELYNK_BASE_URL = "https://buzavvtxdwsyskroyrpl.supabase.co";
const LEGACY_JOBSITELYNK_BASE_URL = "https://jobsitelynk.com";

const resolveJobSiteLynkBaseUrl = (value: unknown) => {
  const normalized = trimTrailingSlashes(String(value || "").trim());
  if (!normalized || normalized === LEGACY_JOBSITELYNK_BASE_URL) {
    return DEFAULT_JOBSITELYNK_BASE_URL;
  }
  return normalized;
};

type MembershipRow = {
  role: string | null;
  is_active: boolean | null;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let step = "init";

  try {
    step = "env";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    step = "auth_client";
    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    step = "auth_user";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    step = "parse_body";
    const body = await req.json().catch(() => ({}));
    const companyId = String(body.companyId || "").trim();
    const jobsitelynkEmail = String(body.jobsitelynk_email || "").trim();
    const jobsitelynkPassword = String(body.jobsitelynk_password || "");

    if (!companyId || !jobsitelynkEmail || !jobsitelynkPassword) {
      return new Response(JSON.stringify({ error: "companyId, jobsitelynk_email, and jobsitelynk_password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    step = "load_memberships";
    const { data: memberships, error: membershipError } = await admin
      .from("user_company_access")
      .select("role, is_active")
      .eq("company_id", companyId)
      .eq("user_id", authData.user.id);
    if (membershipError) throw membershipError;

    step = "load_profile";
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, email, first_name, last_name, display_name")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const hasElevatedAccess = ((memberships || []) as MembershipRow[]).some((row) => row.is_active && elevatedRoles.has(String(row.role || "").toLowerCase()))
      || String(profile?.role || "").toLowerCase() === "super_admin";

    if (!hasElevatedAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    step = "load_integration";
    const { data: integration, error: integrationError } = await admin
      .from("company_jobsitelynk_integrations")
      .select("company_id, jobsitelynk_base_url, external_company_id, shared_secret")
      .eq("company_id", companyId)
      .maybeSingle();
    if (integrationError) throw integrationError;

    const baseUrl = resolveJobSiteLynkBaseUrl(integration?.jobsitelynk_base_url);


    const endpoint = `${baseUrl}/functions/v1/builderlink-connect-account`;
    const externalUserName = String(profile?.display_name || "").trim() || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || authData.user.email || jobsitelynkEmail;

    step = "request_jobsitelynk";
    console.log("jobsitelynk-connect-account request", JSON.stringify({
      endpoint,
      companyId,
      externalCompanyId: String(integration?.external_company_id || companyId),
      userId: authData.user.id,
      jobsitelynkEmail,
    }));

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "builderlink",
          external_company_id: String(integration.external_company_id || companyId),
          external_admin_user_id: String(authData.user.id),
          external_admin_user_email: String(profile?.email || authData.user.email || ""),
          external_admin_user_name: externalUserName,
          jobsitelynk_email: jobsitelynkEmail,
          jobsitelynk_password: jobsitelynkPassword,
        }),
      });
    } catch (fetchError) {
      console.error("jobsitelynk-connect-account fetch failed", JSON.stringify({
        step,
        endpoint,
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
      }));
      throw new Error(`Could not reach JobSiteLynk at ${baseUrl}.`);
    }

    step = "parse_jobsitelynk_response";
    const responseJson = await response.json().catch(() => ({}));

    if (!response.ok) {
      await admin
        .from("company_jobsitelynk_integrations")
        .update({
          connection_status: "error",
          last_connection_error: String(responseJson?.error || responseJson?.message || "Connection failed"),
        })
        .eq("company_id", companyId);

      return new Response(JSON.stringify({
        error: responseJson?.error || responseJson?.message || "JobSiteLynk connection failed",
        details: responseJson,
        step,
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    step = "update_integration";
    const updatePayload = {
      connection_status: "connected",
      connected_account_email: String(responseJson?.connected_account_email || jobsitelynkEmail),
      connected_account_name: String(responseJson?.connected_account_name || responseJson?.organization_name || "").trim() || null,
      connected_at: new Date().toISOString(),
      last_connection_error: null,
    };

    const { error: updateError } = await admin
      .from("company_jobsitelynk_integrations")
      .update(updatePayload)
      .eq("company_id", companyId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({
      success: true,
      connected_account_email: updatePayload.connected_account_email,
      connected_account_name: updatePayload.connected_account_name,
      connected_at: updatePayload.connected_at,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in jobsitelynk-connect-account:", JSON.stringify({
      step,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    }));
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Failed to connect JobSiteLynk account",
      step,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
