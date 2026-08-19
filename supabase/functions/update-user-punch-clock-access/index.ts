import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MANAGER_ROLES = new Set(["owner", "admin", "company_admin", "controller", "project_manager"]);

const normalizeRole = (value: unknown) => String(value || "").trim().toLowerCase();
const normalizeId = (value: unknown) => String(value || "").trim();

type RequestBody = {
  userId?: string;
  companyId?: string;
  assignedJobs?: string[];
  assignedCostCodes?: string[];
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

    const { userId, companyId, assignedJobs, assignedCostCodes }: RequestBody = await req.json();
    const normalizedUserId = normalizeId(userId);
    const normalizedCompanyId = normalizeId(companyId);
    const requestedJobIds = Array.isArray(assignedJobs)
      ? Array.from(new Set(assignedJobs.map((jobId) => normalizeId(jobId)).filter(Boolean)))
      : [];
    const requestedCostCodeIds = Array.isArray(assignedCostCodes)
      ? Array.from(new Set(assignedCostCodes.map((costCodeId) => normalizeId(costCodeId)).filter(Boolean)))
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

    const { data: companyCostCodesData, error: companyCostCodesError } = await admin
      .from("cost_codes")
      .select("id, job_id")
      .eq("company_id", normalizedCompanyId)
      .eq("is_active", true);
    if (companyCostCodesError) throw companyCostCodesError;

    const allowedCostCodeRows = (companyCostCodesData || []).filter((row: any) => {
      const costCodeId = normalizeId(row.id);
      const jobId = normalizeId(row.job_id);
      return requestedCostCodeIds.includes(costCodeId) && allowedJobIds.includes(jobId);
    });
    const allowedCostCodeIds = allowedCostCodeRows.map((row: any) => normalizeId(row.id));

    const { error: settingsError } = await admin
      .from("employee_timecard_settings")
      .upsert(
        {
          user_id: normalizedUserId,
          company_id: normalizedCompanyId,
          assigned_jobs: allowedJobIds,
          assigned_cost_codes: allowedCostCodeIds,
          created_by: requesterUserId,
        },
        { onConflict: "user_id,company_id" },
      );
    if (settingsError) throw settingsError;

    if (companyJobIds.length > 0) {
      const { error: deleteCostCodeError } = await admin
        .from("user_job_cost_codes")
        .delete()
        .eq("user_id", normalizedUserId)
        .in("job_id", companyJobIds);
      if (deleteCostCodeError) throw deleteCostCodeError;
    }

    if (allowedCostCodeRows.length > 0) {
      const costCodeEntries = allowedCostCodeRows.map((row: any) => ({
        user_id: normalizedUserId,
        job_id: normalizeId(row.job_id),
        cost_code_id: normalizeId(row.id),
        granted_by: requesterUserId,
      }));

      const { error: insertCostCodeError } = await admin
        .from("user_job_cost_codes")
        .insert(costCodeEntries);
      if (insertCostCodeError) throw insertCostCodeError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        assignedJobs: allowedJobIds,
        assignedCostCodes: allowedCostCodeIds,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("update-user-punch-clock-access error", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
