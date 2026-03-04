import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, companyId, password } = await req.json();
    if (!userId || !companyId || !password) {
      return new Response(JSON.stringify({ error: "userId, companyId and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (String(password).length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: requesterAccess, error: requesterAccessError } = await supabaseAdmin
      .from("user_company_access")
      .select("role")
      .eq("user_id", requestingUser.id)
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

    let hasCustomPermission = false;
    if (!isAdminLike) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("custom_role_id")
        .eq("user_id", requestingUser.id)
        .maybeSingle();

      const customRoleId = (profile as any)?.custom_role_id as string | null | undefined;
      if (customRoleId) {
        const { data: customPerm } = await supabaseAdmin
          .from("custom_role_permissions")
          .select("can_access")
          .eq("custom_role_id", customRoleId)
          .eq("menu_item", "user-settings-change-password")
          .maybeSingle();
        hasCustomPermission = !!customPerm?.can_access;
      } else {
        const { data: rolePerm } = await supabaseAdmin
          .from("role_permissions")
          .select("can_access")
          .eq("role", requesterRole as any)
          .eq("menu_item", "user-settings-change-password")
          .maybeSingle();
        hasCustomPermission = !!rolePerm?.can_access;
      }
    }

    if (!isAdminLike && !hasCustomPermission) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetAccess, error: targetAccessError } = await supabaseAdmin
      .from("user_company_access")
      .select("user_id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (targetAccessError || !targetAccess) {
      return new Response(JSON.stringify({ error: "Target user is not active in this company" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: String(password),
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("set-user-password error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Failed to set password" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

