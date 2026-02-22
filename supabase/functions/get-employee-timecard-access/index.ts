import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AccessRequest = {
  company_id: string;
  employee_user_id: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    const {
      data: { user },
      error: userErr,
    } = await anon.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body: AccessRequest = await req.json();
    const { company_id, employee_user_id } = body || ({} as any);

    if (!company_id || !employee_user_id) {
      return new Response(JSON.stringify({ error: "company_id and employee_user_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Allow self-lookup OR managers/controllers/admins for that company
    const callerId = user.id;
    let canView = callerId === employee_user_id;

    if (!canView) {
      const { data: accessRow, error: accessErr } = await service
        .from("user_company_access")
        .select("role, is_active")
        .eq("company_id", company_id)
        .eq("user_id", callerId)
        .maybeSingle();

      if (accessErr) throw accessErr;

      const role = accessRow?.role;
      const isActive = accessRow?.is_active;
      const roleAllows = role === "admin" || role === "controller" || role === "project_manager";
      const activeAllows = isActive !== false;
      canView = !!roleAllows && !!activeAllows;
    }

    if (!canView) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // All employees now use profiles + employee_timecard_settings
    const [{ data: settings, error: settingsErr }, { data: prof, error: profErr }] = await Promise.all([
      service
        .from("employee_timecard_settings")
        .select("assigned_jobs, assigned_cost_codes")
        .eq("company_id", company_id)
        .eq("user_id", employee_user_id)
        .maybeSingle(),
      service
        .from("profiles")
        .select("has_global_job_access")
        .eq("user_id", employee_user_id)
        .maybeSingle(),
    ]);

    if (settingsErr) throw settingsErr;
    if (profErr) throw profErr;

    const assignedJobs = settings?.assigned_jobs ?? [];
    const assignedCostCodes = settings?.assigned_cost_codes ?? [];

    return new Response(
      JSON.stringify({
        access: {
          is_pin: false,
          assigned_jobs: assignedJobs,
          assigned_cost_codes: assignedCostCodes,
          has_global_job_access: prof?.has_global_job_access ?? false,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (e: any) {
    console.error("get-employee-timecard-access error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
