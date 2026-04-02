import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/g, "");

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
    const jobId = String(body.jobId || "").trim();

    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id, company_id, name, jobsitelynk_project_id")
      .eq("id", jobId)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: accessRows, error: accessError } = await admin
      .from("user_company_access")
      .select("role, is_active")
      .eq("company_id", job.company_id)
      .eq("user_id", authData.user.id);
    if (accessError) throw accessError;

    const hasCompanyAccess = (accessRows || []).some((row: any) => row.is_active === true);
    if (!hasCompanyAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!job.jobsitelynk_project_id) {
      return new Response(JSON.stringify({ error: "This job is not linked to a JobSiteLynk project yet." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: integration, error: integrationError } = await admin
      .from("company_jobsitelynk_integrations")
      .select("jobsitelynk_base_url, external_company_id, shared_secret")
      .eq("company_id", job.company_id)
      .maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration?.jobsitelynk_base_url || !integration?.shared_secret) {
      return new Response(JSON.stringify({ error: "JobSiteLynk is not configured for this company." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("first_name, last_name, display_name, email")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const externalUserName =
      String(profile?.display_name || "").trim() ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      authData.user.email ||
      "BuilderLynk User";

    const embedRequestPayload = {
      provider: "builderlink",
      external_company_id: String(integration.external_company_id || job.company_id),
      external_job_id: String(job.id),
      external_user_id: String(authData.user.id),
      external_user_email: String(profile?.email || authData.user.email || ""),
      external_user_name: externalUserName,
      requested_mode: "embed",
    };

    const baseUrl = trimTrailingSlashes(String(integration.jobsitelynk_base_url).trim());
    const endpoint = `${baseUrl}/functions/v1/builderlink-embed-session`;

    const embedResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${integration.shared_secret}`,
        "x-builderlink-secret": integration.shared_secret,
      },
      body: JSON.stringify(embedRequestPayload),
    });

    const embedJson = await embedResponse.json().catch(() => ({}));

    if (!embedResponse.ok) {
      return new Response(JSON.stringify({
        error: embedJson?.error || embedJson?.message || "JobSiteLynk embed session request failed",
        details: embedJson,
      }), {
        status: embedResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let launchUrl = String(embedJson?.launch_url || "").trim();
    if (!launchUrl) {
      return new Response(JSON.stringify({ error: "JobSiteLynk did not return a launch URL." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (launchUrl.startsWith("/")) {
      launchUrl = `${baseUrl}${launchUrl}`;
    }

    return new Response(JSON.stringify({
      success: true,
      project_id: embedJson?.project_id || job.jobsitelynk_project_id,
      project_name: embedJson?.project_name || job.name,
      launch_url: launchUrl,
      expires_at: embedJson?.expires_at || null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in jobsitelynk-embed-session:", error);
    return new Response(JSON.stringify({ error: error?.message || "Failed to create JobSiteLynk embed session" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
