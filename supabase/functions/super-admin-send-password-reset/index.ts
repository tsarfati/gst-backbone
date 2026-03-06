import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const authFrom = resolveBuilderlynkFrom(
  Deno.env.get("AUTH_EMAIL_FROM") || Deno.env.get("INVITE_EMAIL_FROM"),
  EMAIL_FROM.AUTH,
  "super-admin-send-password-reset",
);

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

const normalizeRecoveryRedirect = (redirectTo: string | null, originHeader: string | null) => {
  const defaultOrigin = originHeader || "https://builderlynk.com";
  const fallback = `${defaultOrigin}/auth?type=recovery`;
  if (!redirectTo) return fallback;

  try {
    const parsed = new URL(redirectTo);
    if (parsed.pathname !== "/auth") {
      return `${parsed.origin}/auth?type=recovery`;
    }
    parsed.searchParams.set("type", "recovery");
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
    const providedEmail = String(body?.email || "").trim().toLowerCase();
    const redirectTo = body?.redirectTo ? String(body.redirectTo) : null;
    if (!userId && !providedEmail) {
      return new Response(JSON.stringify({ error: "userId or email is required" }), {
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

    let targetEmail = providedEmail;
    if (!targetEmail && userId) {
      const { data: userData, error: userFetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userFetchError || !userData?.user?.email) {
        return new Response(JSON.stringify({ error: "Target user not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetEmail = userData.user.email.toLowerCase();
    }

    const normalizedRedirectTo = normalizeRecoveryRedirect(redirectTo, req.headers.get("origin"));
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: targetEmail,
      options: { redirectTo: normalizedRedirectTo },
    });

    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family:Arial,sans-serif;background:#f8f9fb;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
          <h2 style="margin:0 0 12px;color:#111827;">Reset your BuilderLynk password</h2>
          <p style="margin:0 0 16px;color:#374151;">A super admin requested a password reset for your account.</p>
          <a href="${linkData.properties.action_link}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;">Reset Password</a>
          <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">If you did not request this, you can ignore this email.</p>
        </div>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: authFrom,
      to: [targetEmail],
      subject: "Reset Your BuilderLynk Password",
      html,
    });

    if (emailError) {
      return new Response(JSON.stringify({ error: emailError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
