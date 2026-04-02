import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/g, "");
const DEFAULT_JOBSITELYNK_BASE_URL = "https://buzavvtxdwsyskroyrpl.supabase.co";
const LEGACY_JOBSITELYNK_BASE_URL = "https://jobsitelynk.com";
const DEFAULT_JOBSITELYNK_APP_URL = "https://jobsitelynk.com";

const resolveJobSiteLynkBaseUrl = (value: unknown) => {
  const normalized = trimTrailingSlashes(String(value || "").trim());
  if (!normalized || normalized === LEGACY_JOBSITELYNK_BASE_URL) {
    return DEFAULT_JOBSITELYNK_BASE_URL;
  }
  return normalized;
};

const resolveJobSiteLynkAppUrl = () =>
  trimTrailingSlashes(String(Deno.env.get("JOBSITELYNK_APP_BASE_URL") || DEFAULT_JOBSITELYNK_APP_URL).trim());

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
    const jobId = String(body.jobId || "").trim();

    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    step = "load_job";
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

    step = "check_access";
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

    step = "load_integration";
    const { data: integration, error: integrationError } = await admin
      .from("company_jobsitelynk_integrations")
      .select("jobsitelynk_base_url, external_company_id, shared_secret")
      .eq("company_id", job.company_id)
      .maybeSingle();
    if (integrationError) throw integrationError;
    const baseUrl = resolveJobSiteLynkBaseUrl(integration?.jobsitelynk_base_url);

    if (!integration?.external_company_id) {
      return new Response(JSON.stringify({ error: "JobSiteLynk is not configured for this company." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    step = "load_profile";
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

    step = "build_payload";
    const embedRequestPayload = {
      provider: "builderlink",
      external_company_id: String(integration.external_company_id || job.company_id),
      external_job_id: String(job.id),
      external_user_id: String(authData.user.id),
      external_user_email: String(profile?.email || authData.user.email || ""),
      external_user_name: externalUserName,
      requested_mode: "embed",
      external_project_code: String(job.jobsitelynk_project_id),
    };

    const endpoint = `${baseUrl}/functions/v1/builderlink-embed-session`;

    step = "request_jobsitelynk";
    console.log("jobsitelynk-embed-session request", JSON.stringify({
      endpoint,
      jobId: job.id,
      companyId: job.company_id,
      externalCompanyId: integration.external_company_id,
      externalProjectCode: job.jobsitelynk_project_id,
      userId: authData.user.id,
    }));

    let embedResponse: Response;
    try {
      embedResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(embedRequestPayload),
      });
    } catch (fetchError) {
      console.error("jobsitelynk-embed-session fetch failed", JSON.stringify({
        step,
        endpoint,
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
      }));
      throw new Error(`Could not reach JobSiteLynk at ${baseUrl}.`);
    }

    step = "parse_jobsitelynk_response";
    const embedJson = await embedResponse.json().catch(() => ({}));

    if (!embedResponse.ok) {
      console.error("jobsitelynk-embed-session downstream error", JSON.stringify({
        step,
        status: embedResponse.status,
        endpoint,
        response: embedJson,
      }));
      return new Response(JSON.stringify({
        error: embedJson?.error || embedJson?.message || "JobSiteLynk embed session request failed",
        details: embedJson,
        step,
      }), {
        status: embedResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    step = "validate_launch_url";
    const launchUrlCandidate =
      embedJson?.absolute_launch_url ??
      embedJson?.launch_url ??
      embedJson?.launchUrl ??
      embedJson?.embed_url ??
      embedJson?.iframe_url ??
      embedJson?.url ??
      null;

    console.log("jobsitelynk-embed-session success payload", JSON.stringify({
      step,
      endpoint,
      keys: embedJson && typeof embedJson === "object" ? Object.keys(embedJson) : [],
      launchUrlCandidate,
    }));

    let launchUrl = String(launchUrlCandidate || "").trim();
    if (!launchUrl) {
      return new Response(JSON.stringify({
        error: "JobSiteLynk did not return a launch URL.",
        step,
        details: {
          keys: embedJson && typeof embedJson === "object" ? Object.keys(embedJson) : [],
          response: embedJson,
        },
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (launchUrl.startsWith("/")) {
      launchUrl = `${resolveJobSiteLynkAppUrl()}${launchUrl}`;
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
    console.error("Error in jobsitelynk-embed-session:", JSON.stringify({
      step,
      message: error?.message || String(error),
      stack: error?.stack || null,
    }));
    return new Response(JSON.stringify({
      error: error?.message || "Failed to create JobSiteLynk embed session",
      step,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
