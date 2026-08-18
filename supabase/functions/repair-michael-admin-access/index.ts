import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment configuration");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const michaelUserId = "dcdfec98-5141-4559-adb2-fe1d70bfce98";
    const greenstarCompanyId = "dcdfec98-5141-4559-adb2-fe1d70bfce98";

    const { data: companies, error: companiesError } = await admin
      .from("companies")
      .select("id, name, display_name")
      .or([
        `id.eq.${greenstarCompanyId}`,
        "name.eq.Sigma Construction",
        "name.eq.Higher Limits Development",
        "name.eq.GST, LLC",
        "display_name.eq.GreenStarTeam,LLC",
        "display_name.eq.GST, LLC",
      ].join(","));

    if (companiesError) {
      throw companiesError;
    }

    const targetCompanyIds = Array.from(
      new Set((companies || []).map((company) => String(company.id || "").trim()).filter(Boolean)),
    );

    if (targetCompanyIds.length === 0) {
      throw new Error("No target companies found for Michael admin repair");
    }

    for (const companyId of targetCompanyIds) {
      const { error: accessError } = await admin
        .from("user_company_access")
        .upsert(
          {
            user_id: michaelUserId,
            company_id: companyId,
            role: "admin",
            is_active: true,
            granted_by: michaelUserId,
            granted_at: new Date().toISOString(),
          },
          { onConflict: "user_id,company_id" },
        );

      if (accessError) {
        throw accessError;
      }
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: "admin",
        status: "approved",
        has_global_job_access: true,
        default_company_id: greenstarCompanyId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", michaelUserId);

    if (profileError) {
      throw profileError;
    }

    const { error: authError } = await admin.auth.admin.updateUserById(michaelUserId, {
      user_metadata: {
        role: "admin",
      },
      app_metadata: {
        role: "admin",
      },
    });

    if (authError) {
      throw authError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        repairedUserId: michaelUserId,
        companyIds: targetCompanyIds,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("repair-michael-admin-access error", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unexpected error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
