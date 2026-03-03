import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const companyId = String(body?.companyId || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!userId || !companyId || !email) {
      return new Response(JSON.stringify({ error: "userId, companyId, and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!emailPattern.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: requesterAccess, error: requesterAccessError } = await supabaseAdmin
      .from("user_company_access")
      .select("role")
      .eq("user_id", authUser.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (requesterAccessError || !requesterAccess) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requesterRole = String((requesterAccess as any)?.role || "").toLowerCase();
    const isAdminLike = ["admin", "company_admin"].includes(requesterRole);
    let hasPermission = isAdminLike;

    if (!hasPermission) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("custom_role_id")
        .eq("user_id", authUser.id)
        .maybeSingle();

      const customRoleId = (profile as any)?.custom_role_id as string | null | undefined;
      if (customRoleId) {
        const { data: customPerm } = await supabaseAdmin
          .from("custom_role_permissions")
          .select("can_access")
          .eq("custom_role_id", customRoleId)
          .eq("menu_item", "user-settings-edit-email")
          .maybeSingle();
        hasPermission = !!customPerm?.can_access;
      } else {
        const { data: rolePerm } = await supabaseAdmin
          .from("role_permissions")
          .select("can_access")
          .eq("role", requesterRole as any)
          .eq("menu_item", "user-settings-edit-email")
          .maybeSingle();
        hasPermission = !!rolePerm?.can_access;
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure target user belongs to the same company.
    const { data: targetAccess, error: targetAccessError } = await supabaseAdmin
      .from("user_company_access")
      .select("user_id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (targetAccessError || !targetAccess) {
      return new Response(JSON.stringify({ error: "Target user not found in company" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email });
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message || "Failed to update user email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

