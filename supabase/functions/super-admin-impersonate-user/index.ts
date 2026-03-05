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

const normalizeImpersonationRedirect = (redirectTo: string | null, originHeader: string | null) => {
  const defaultOrigin = originHeader || "https://builderlynk.com";
  const fallback = `${defaultOrigin}/auth?impersonating=1`;
  if (!redirectTo) return fallback;

  try {
    const parsed = new URL(redirectTo);
    if (parsed.pathname !== "/auth") {
      return `${parsed.origin}/auth?impersonating=1`;
    }
    parsed.searchParams.set("impersonating", "1");
    return parsed.toString();
  } catch {
    return fallback;
  }
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
    const redirectTo = body?.redirectTo ? String(body.redirectTo) : null;
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

    const { data: userData, error: userFetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
    const targetEmail = userData?.user?.email?.trim().toLowerCase();

    if (userFetchError || !targetEmail) {
      return new Response(JSON.stringify({ error: "Target user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedRedirectTo = normalizeImpersonationRedirect(redirectTo, req.headers.get("origin"));
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: { redirectTo: normalizedRedirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ error: linkError?.message || "Failed to generate impersonation link" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        actionLink: linkData.properties.action_link,
        email: targetEmail,
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
