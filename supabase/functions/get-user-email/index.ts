import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.info("[get-user-email] request", { requestId, method: req.method });

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

    // Validate JWT and extract claims (verify_jwt is disabled in config)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      console.warn("[get-user-email] invalid token", { requestId, claimsError });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestingUserId = String(claimsData.claims.sub);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const userId = body?.userId as string | undefined;
    const userIds = body?.user_ids as string[] | undefined;
    const companyId = body?.companyId as string | undefined;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Handle batch lookup (user_ids array)
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // Check requester's company role via user_company_access (not profiles)
      const { data: requesterAccesses } = await supabaseAdmin
        .from("user_company_access")
        .select("role, company_id")
        .eq("user_id", requestingUserId)
        .eq("is_active", true);

      const allowedRoles = new Set(["admin", "controller", "company_admin", "project_manager"]);
      const hasElevatedRole = (requesterAccesses || []).some((a: any) => allowedRoles.has(a.role));

      // Allow if user has elevated role in any company or is requesting their own email
      if (!hasElevatedRole && !userIds.includes(requestingUserId)) {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch all user emails
      const users: { id: string; email: string }[] = [];
      for (const uid of userIds) {
        try {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (userData?.user?.email) {
            users.push({ id: uid, email: userData.user.email });
          }
        } catch {
          // Skip users that can't be fetched
        }
      }

      return new Response(JSON.stringify({ users }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle single user lookup (original behavior)
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId or user_ids is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization:
    // - Users can always fetch their own email
    // - Otherwise, requester must have elevated access in the provided company
    if (requestingUserId !== userId) {
      if (!companyId) {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: requesterAccess, error: requesterAccessError } = await supabaseAdmin
        .from("user_company_access")
        .select("role, is_active")
        .eq("user_id", requestingUserId)
        .eq("company_id", companyId)
        .eq("is_active", true)
        .maybeSingle();

      if (requesterAccessError) throw requesterAccessError;

      const requesterRole = (requesterAccess as any)?.role as string | undefined;
      const allowedRoles = new Set(["admin", "controller", "company_admin"]);

      if (!requesterRole || !allowedRoles.has(requesterRole)) {
        console.warn("[get-user-email] insufficient permissions", {
          requestId,
          requestingUserId,
          companyId,
          requesterRole,
        });
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure the target user is part of the same company (prevents cross-company email lookup)
      const { data: targetAccess, error: targetAccessError } = await supabaseAdmin
        .from("user_company_access")
        .select("user_id")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .eq("is_active", true)
        .maybeSingle();

      if (targetAccessError) throw targetAccessError;

      if (!targetAccess) {
        return new Response(JSON.stringify({ email: null }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch user email from auth.users
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData?.user) {
      console.warn("[get-user-email] target user not found", { requestId, userId, userError });
      return new Response(JSON.stringify({ email: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ email: userData.user.email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = (error as any)?.message ?? String(error);
    console.error("[get-user-email] error", { requestId, message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});