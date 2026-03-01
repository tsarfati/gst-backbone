import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_ROLES = new Set(["admin", "company_admin", "controller", "owner", "super_admin"]);

type NotifyPayload = {
  userId?: string;
  companyId?: string;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const send = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const inviteEmailFrom =
      Deno.env.get("INVITE_EMAIL_FROM") ||
      Deno.env.get("AUTH_EMAIL_FROM") ||
      "BuilderLYNK <no-reply@builderlynk.com>";
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return send(401, { error: "Missing Authorization header" });

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return send(401, { error: "Missing bearer token" });

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) return send(401, { error: "Unauthorized" });

    const { userId, companyId }: NotifyPayload = await req.json().catch(() => ({}));
    if (!userId || !companyId) {
      return send(400, { error: "userId and companyId are required" });
    }

    const { data: requesterAccessRows, error: requesterAccessError } = await admin
      .from("user_company_access")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", authData.user.id)
      .eq("is_active", true);
    if (requesterAccessError) throw requesterAccessError;

    const canNotify = (requesterAccessRows || []).some((row: any) =>
      ADMIN_ROLES.has(String(row.role || "").toLowerCase())
    );
    if (!canNotify) return send(403, { error: "Forbidden" });

    const { data: profileRow, error: profileError } = await admin
      .from("profiles")
      .select("status, first_name, last_name, display_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw profileError;

    if (!profileRow || String(profileRow.status || "").toLowerCase() !== "approved") {
      return send(200, { success: true, skipped: true, reason: "User is not approved" });
    }

    const { data: companyRow, error: companyError } = await admin
      .from("companies")
      .select("name, display_name")
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) throw companyError;

    const { data: userAuthData, error: userAuthError } = await admin.auth.admin.getUserById(userId);
    if (userAuthError) throw userAuthError;
    const userEmail = userAuthData?.user?.email?.trim().toLowerCase();
    if (!userEmail) return send(200, { success: true, skipped: true, reason: "User email missing" });

    if (!resend) {
      console.warn("RESEND_API_KEY is missing; skipping approval notification email.");
      return send(200, { success: true, skipped: true, reason: "RESEND_API_KEY missing" });
    }

    const companyDisplayName = String(companyRow?.display_name || companyRow?.name || "your company").trim();
    const userDisplayName =
      String(profileRow.display_name || `${profileRow.first_name || ""} ${profileRow.last_name || ""}`.trim() || userEmail);
    const appUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://builderlynk.com";

    await resend.emails.send({
      from: inviteEmailFrom,
      to: [userEmail],
      subject: `Your ${companyDisplayName} access has been approved`,
      html: `
        <p>Hello ${userDisplayName},</p>
        <p>Your account for <strong>${companyDisplayName}</strong> has been approved.</p>
        <p>You can now sign in and start using BuilderLYNK.</p>
        <p><a href="${appUrl}/auth">Sign in to BuilderLYNK</a></p>
      `,
    });

    return send(200, { success: true });
  } catch (error: any) {
    console.error("notify-user-approved error:", error);
    return send(500, { error: error?.message || "Unknown error" });
  }
});

