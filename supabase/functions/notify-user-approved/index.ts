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
const BUILDERLYNK_EMAIL_LOGO =
  "https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/builder%20lynk.png";

const resolveCompanyLogoUrl = (logoUrl?: string | null): string | null => {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  const cleaned = String(logoUrl).replace(/^company-logos\//, "").replace(/^\/+/, "");
  return `https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/${cleaned}`;
};

const buildBrandedEmailHtml = ({
  title,
  greeting,
  paragraphs,
  ctaLabel,
  ctaUrl,
  companyLogoUrl,
  brandPrimary = "#E88A2D",
  brandNavy = "#1e3a5f",
}: {
  title: string;
  greeting: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  companyLogoUrl?: string | null;
  brandPrimary?: string;
  brandNavy?: string;
}) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:${brandNavy};padding:16px 20px;text-align:center;">
            <img src="${BUILDERLYNK_EMAIL_LOGO}" alt="BuilderLYNK" style="display:block;margin:0 auto;height:150px;width:auto;max-width:420px;" />
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px;">
            ${companyLogoUrl ? `<div style="text-align:center;margin-bottom:24px;"><img src="${companyLogoUrl}" alt="Company logo" style="max-height:72px;max-width:240px;object-fit:contain;" /></div>` : ""}
            <h1 style="color:${brandNavy};font-size:24px;font-weight:700;margin:0 0 16px 0;text-align:center;">${title}</h1>
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px 0;">${greeting}</p>
            ${paragraphs.map((p) => `<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 14px 0;">${p}</p>`).join("")}
            ${ctaLabel && ctaUrl ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr><td align="center"><a href="${ctaUrl}" style="display:inline-block;background-color:${brandPrimary};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:8px;">${ctaLabel}</a></td></tr></table>` : ""}
          </td>
        </tr>
        <tr>
          <td style="background-color:${brandNavy};padding:18px 24px;text-align:center;">
            <p style="color:#ffffff;font-size:12px;margin:0;">© ${new Date().getFullYear()} BuilderLYNK. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

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
      .select("name, display_name, logo_url")
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
    const companyLogoUrl = resolveCompanyLogoUrl((companyRow as any)?.logo_url);
    const userDisplayName =
      String(profileRow.display_name || `${profileRow.first_name || ""} ${profileRow.last_name || ""}`.trim() || userEmail);
    const appUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://builderlynk.com";

    await resend.emails.send({
      from: inviteEmailFrom,
      to: [userEmail],
      subject: `Your ${companyDisplayName} access has been approved`,
      html: buildBrandedEmailHtml({
        title: "Access Approved",
        greeting: `Hello ${userDisplayName},`,
        companyLogoUrl,
        paragraphs: [
          `Your account for <strong>${companyDisplayName}</strong> has been approved.`,
          `You can now sign in and start using BuilderLYNK.`,
        ],
        ctaLabel: "Sign in to BuilderLYNK",
        ctaUrl: `${appUrl}/auth`,
      }),
    });

    return send(200, { success: true });
  } catch (error: any) {
    console.error("notify-user-approved error:", error);
    return send(500, { error: error?.message || "Unknown error" });
  }
});
