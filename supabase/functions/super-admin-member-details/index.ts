import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isRequesterSuperAdmin = async (supabaseAdmin: ReturnType<typeof createClient>, userId: string) => {
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("is_super_admin", {
    _user_id: userId,
  });
  if (!rpcError && !!rpcData) return true;

  const { data: row } = await supabaseAdmin
    .from("super_admins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  return !!row;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = await isRequesterSuperAdmin(supabaseAdmin, authUser.id);
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select(
        "user_id, display_name, first_name, last_name, email, phone, role, status, avatar_url, created_at, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle();

    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const fallbackEmail = authUserData?.user?.email ?? null;

    const { data: loginAudit } = await supabaseAdmin
      .from("user_login_audit")
      .select("id, login_time, logout_time, login_method, success, app_source, user_agent, ip_address")
      .eq("user_id", userId)
      .order("login_time", { ascending: false })
      .limit(250);

    const { data: companyAudit } = await supabaseAdmin
      .from("company_audit_log")
      .select("id, created_at, company_id, table_name, action, field_name, old_value, new_value, reason")
      .eq("changed_by", userId)
      .order("created_at", { ascending: false })
      .limit(250);

    return new Response(
      JSON.stringify({
        profile: profile
          ? {
              ...profile,
              // Login credential email must come from auth.users, not profile mirror fields.
              email: fallbackEmail || profile.email,
            }
          : null,
        loginAudit: loginAudit || [],
        companyAudit: companyAudit || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
