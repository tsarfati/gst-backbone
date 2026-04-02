import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const elevatedRoles = new Set(["super_admin", "owner", "admin", "company_admin", "controller"]);
const trimTrailingSlashes = (value: string) => value.replace(/\/+$/g, "");

type MembershipRow = {
  role: string | null;
  is_active: boolean | null;
};

serve(async (req: Request) => {
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const companyId = String(body.companyId || "").trim();
    const query = String(body.query || "").trim();

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: memberships, error: membershipError } = await admin
      .from("user_company_access")
      .select("role, is_active")
      .eq("company_id", companyId)
      .eq("user_id", authData.user.id);
    if (membershipError) throw membershipError;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
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

    const { data: integration, error: integrationError } = await admin
      .from("company_jobsitelynk_integrations")
      .select("jobsitelynk_base_url, external_company_id, shared_secret, connection_status")
      .eq("company_id", companyId)
      .maybeSingle();
    if (integrationError) throw integrationError;

    if (!integration?.jobsitelynk_base_url || !integration.shared_secret) {
      return new Response(JSON.stringify({ error: "JobSiteLynk is not configured for this company." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (String(integration.connection_status || "") !== "connected") {
      return new Response(JSON.stringify({ error: "Connect a JobSiteLynk account in Company Settings first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = `${trimTrailingSlashes(String(integration.jobsitelynk_base_url))}/functions/v1/builderlink-list-projects`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${integration.shared_secret}`,
        "x-builderlink-secret": integration.shared_secret,
      },
      body: JSON.stringify({
        provider: "builderlink",
        external_company_id: String(integration.external_company_id || companyId),
        query,
        limit: 50,
      }),
    });

    const responseJson = await response.json().catch(() => ({}));
    if (!response.ok) {
      return new Response(JSON.stringify({
        error: responseJson?.error || responseJson?.message || "Failed to load JobSiteLynk projects",
        details: responseJson,
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      projects: Array.isArray(responseJson?.projects) ? responseJson.projects : [],
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in jobsitelynk-list-projects:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed to load JobSiteLynk projects" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
