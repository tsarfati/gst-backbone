import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MANAGER_ROLES = new Set(["owner", "admin", "company_admin", "controller"]);

const normalizeRole = (value: unknown) => String(value || "").trim().toLowerCase();
const normalizeId = (value: unknown) => String(value || "").trim();

type RequestBody = {
  userId?: string;
  companyId?: string;
  jobIds?: string[];
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
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { userId, companyId, jobIds }: RequestBody = await req.json();
    const normalizedUserId = normalizeId(userId);
    const normalizedCompanyId = normalizeId(companyId);
    const requestedJobIds = Array.isArray(jobIds)
      ? Array.from(new Set(jobIds.map((jobId) => normalizeId(jobId)).filter(Boolean)))
      : [];

    if (!normalizedUserId || !normalizedCompanyId) {
      return new Response(JSON.stringify({ error: "userId and companyId are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const requesterUserId = authData.user.id;
    const { data: requesterAccessRows, error: requesterAccessError } = await admin
      .from("user_company_access")
      .select("role, is_active")
      .eq("company_id", normalizedCompanyId)
      .eq("user_id", requesterUserId);

    if (requesterAccessError) throw requesterAccessError;

    const canManageUsers = (requesterAccessRows || []).some((row: any) => {
      const role = normalizeRole(row.role);
      return row.is_active !== false && MANAGER_ROLES.has(role);
    });

    if (!canManageUsers) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: targetAccessRows, error: targetAccessError } = await admin
      .from("user_company_access")
      .select("company_id, is_active")
      .eq("company_id", normalizedCompanyId)
      .eq("user_id", normalizedUserId);

    if (targetAccessError) throw targetAccessError;

    const targetHasCompanyAccess = (targetAccessRows || []).some((row: any) => row.is_active !== false);
    if (!targetHasCompanyAccess) {
      return new Response(JSON.stringify({ error: "Target user does not have access to this company" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: companyJobsData, error: companyJobsError } = await admin
      .from("jobs")
      .select("id")
      .eq("company_id", normalizedCompanyId)
      .eq("is_active", true);

    if (companyJobsError) throw companyJobsError;

    const companyJobIds = Array.from(
      new Set((companyJobsData || []).map((row: any) => normalizeId(row.id)).filter(Boolean)),
    );
    const allowedJobIds = requestedJobIds.filter((jobId) => companyJobIds.includes(jobId));

    if (companyJobIds.length > 0) {
      const { error: deleteError } = await admin
        .from("user_job_access")
        .delete()
        .eq("user_id", normalizedUserId)
        .in("job_id", companyJobIds);

      if (deleteError) throw deleteError;
    }

    if (allowedJobIds.length > 0) {
      const rows = allowedJobIds.map((jobId) => ({
        user_id: normalizedUserId,
        job_id: jobId,
        granted_by: requesterUserId,
      }));

      const { error: insertError } = await admin.from("user_job_access").insert(rows);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        assignedJobIds: allowedJobIds,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("update-user-website-job-access error", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
