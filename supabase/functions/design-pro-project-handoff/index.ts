import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type HandoffMode = "copy" | "transfer";

type HandoffPayload = {
  jobId: string;
  targetCompanyId: string;
  mode: HandoffMode;
};

const ELEVATED_ROLES = new Set([
  "admin",
  "company_admin",
  "controller",
  "owner",
  "project_manager",
  "design_professional",
]);

const handler = async (req: Request): Promise<Response> => {
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

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const actorUserId = authData.user.id;

    const { jobId, targetCompanyId, mode }: HandoffPayload = await req.json();
    if (!jobId || !targetCompanyId || !mode || !["copy", "transfer"].includes(mode)) {
      return new Response(JSON.stringify({ error: "jobId, targetCompanyId and valid mode are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: jobRow, error: jobError } = await admin
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (jobError || !jobRow) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const sourceCompanyId = String((jobRow as any).company_id || "");
    if (!sourceCompanyId) {
      return new Response(JSON.stringify({ error: "Project does not have a source company" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (sourceCompanyId === targetCompanyId) {
      return new Response(JSON.stringify({ error: "Target company must be different from source company" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const [{ data: sourceAccess, error: sourceAccessError }, { data: targetAccess, error: targetAccessError }] = await Promise.all([
      admin.from("user_company_access").select("role, is_active").eq("user_id", actorUserId).eq("company_id", sourceCompanyId),
      admin.from("user_company_access").select("role, is_active").eq("user_id", actorUserId).eq("company_id", targetCompanyId),
    ]);
    if (sourceAccessError) throw sourceAccessError;
    if (targetAccessError) throw targetAccessError;

    const canManageSource = (sourceAccess || []).some((row: any) => row.is_active === true && ELEVATED_ROLES.has(String(row.role || "").toLowerCase()));
    if (!canManageSource) {
      return new Response(JSON.stringify({ error: "You do not have permission to hand off this project" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const hasTargetAccess = (targetAccess || []).some((row: any) => row.is_active === true);
    if (!hasTargetAccess) {
      return new Response(JSON.stringify({ error: "You do not have access to the target company" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: targetCompany, error: targetCompanyError } = await admin
      .from("companies")
      .select("id, name, display_name, company_type, is_active")
      .eq("id", targetCompanyId)
      .maybeSingle();
    if (targetCompanyError || !targetCompany || targetCompany.is_active === false) {
      return new Response(JSON.stringify({ error: "Target company not found or inactive" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (String(targetCompany.company_type || "").toLowerCase() !== "construction") {
      return new Response(JSON.stringify({ error: "Target company must be a construction company" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: handoffResult, error: handoffError } = await admin.rpc("design_pro_handoff_project_deep" as any, {
      p_job_id: jobId,
      p_target_company_id: targetCompanyId,
      p_mode: mode,
      p_actor_user_id: actorUserId,
    });
    if (handoffError) throw handoffError;

    const resultJobId =
      String((handoffResult as any)?.result_job_id || "") ||
      (mode === "copy" ? null : jobId);

    return new Response(JSON.stringify({
      success: true,
      mode,
      sourceJobId: jobId,
      resultJobId,
      targetCompanyId,
      details: handoffResult || null,
      message: mode === "copy"
        ? "Project and related records copied to target company."
        : "Project ownership and related records transferred to target company.",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in design-pro-project-handoff:", error);
    return new Response(JSON.stringify({ error: error?.message || "Failed to process project handoff" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
