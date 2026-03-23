import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { BUILDERLYNK_EMAIL_LOGO_URL, resolveCompanyLogoEmailUrl } from "../_shared/emailAssets.ts";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";
import { sendTransactionalEmailWithFallback } from "../_shared/transactionalEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MentionEmailPayload = {
  companyId: string;
  actorUserId: string;
  actorName: string;
  contextLabel: string;
  targetPath: string;
  content: string;
  mentionedUserIds: string[];
  emailPreferenceKey?: "mention_email_notifications" | "task_timeline_mention_notifications";
};

const truncate = (value: string, max = 180) => {
  const clean = String(value || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
};

const buildBrandedMentionEmailHtml = ({
  heading,
  intro,
  quote,
  buttonUrl,
  companyName,
  companyLogoUrl,
}: {
  heading: string;
  intro: string;
  quote: string;
  buttonUrl: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
}) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:#1e3a5f;padding:16px 20px;text-align:center;">
            <img src="${BUILDERLYNK_EMAIL_LOGO_URL}" alt="BuilderLYNK" style="display:block;margin:0 auto;height:150px;width:auto;max-width:420px;" />
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px;">
            ${companyLogoUrl ? `<div style="text-align:center;margin-bottom:24px;"><img src="${companyLogoUrl}" alt="${companyName || "Company"}" style="max-height:72px;max-width:240px;object-fit:contain;" /></div>` : ""}
            <h1 style="color:#1e3a5f;font-size:24px;font-weight:700;margin:0 0 16px 0;text-align:center;">${heading}</h1>
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 14px 0;">${intro}</p>
            <div style="margin:0 0 18px 0;padding:14px 16px;border-radius:10px;background:#f8fafc;border:1px solid #e5e7eb;color:#374151;font-size:15px;line-height:1.6;">
              "${quote}"
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr><td align="center">
              <a href="${buttonUrl}" style="display:inline-block;background-color:#E88A2D;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:8px;">View Mention</a>
            </td></tr></table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#1e3a5f;padding:18px 24px;text-align:center;">
            <p style="color:#ffffff;font-size:12px;margin:0;">© ${new Date().getFullYear()} BuilderLYNK. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload = (await req.json()) as MentionEmailPayload;
    const companyId = String(payload.companyId || "");
    const actorUserId = String(payload.actorUserId || "");
    const actorName = String(payload.actorName || "A teammate");
    const contextLabel = String(payload.contextLabel || "a conversation");
    const targetPath = String(payload.targetPath || "/dashboard");
    const content = String(payload.content || "");
    const mentionedUserIds = Array.from(new Set(payload.mentionedUserIds || [])).filter(Boolean).slice(0, 25);
    const emailPreferenceKey = payload.emailPreferenceKey || "mention_email_notifications";

    if (!companyId || !actorUserId || !mentionedUserIds.length) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (authData.user.id !== actorUserId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Ensure actor has access to company.
    const { data: actorAccess, error: actorAccessError } = await admin
      .from("user_company_access")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("user_id", actorUserId)
      .eq("is_active", true)
      .maybeSingle();
    if (actorAccessError || !actorAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Mention targets must be active in same company.
    const { data: eligibleUsers, error: eligibleError } = await admin
      .from("user_company_access")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .in("user_id", mentionedUserIds);
    if (eligibleError) throw eligibleError;
    const eligibleIds = new Set((eligibleUsers || []).map((row: any) => row.user_id));

    if (eligibleIds.size === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Respect user notification preferences.
    const { data: settingsRows } = await admin
      .from("notification_settings")
      .select("user_id, email_enabled, mention_email_notifications, task_timeline_mention_notifications")
      .eq("company_id", companyId)
      .in("user_id", Array.from(eligibleIds));

    const settingsMap = new Map<string, any>();
    (settingsRows || []).forEach((row: any) => {
      settingsMap.set(row.user_id, row);
    });

    const finalRecipientIds = Array.from(eligibleIds).filter((id) => {
      const setting = settingsMap.get(id);
      if (!setting) return true; // default allow if row missing
      return setting.email_enabled !== false && setting[emailPreferenceKey] !== false;
    });

    if (finalRecipientIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const resend = resendApiKey ? new Resend(resendApiKey) : null;
    const fromEmail = resolveBuilderlynkFrom(
      Deno.env.get("NOTIFICATIONS_EMAIL_FROM"),
      EMAIL_FROM.NOTIFICATIONS,
      "send-mention-email",
    );

    const appBaseUrl =
      Deno.env.get("APP_BASE_URL") ||
      Deno.env.get("SITE_URL") ||
      "https://builderlynk.com";
    const targetUrl = `${appBaseUrl.replace(/\/+$/, "")}${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`;
    const subject = `${actorName} mentioned you in ${contextLabel}`;

    const { data: companyRow, error: companyError } = await admin
      .from("companies")
      .select("name, display_name, logo_url")
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) throw companyError;
    const companyName = String((companyRow as any)?.display_name || (companyRow as any)?.name || "your company");
    const companyLogoUrl = resolveCompanyLogoEmailUrl((companyRow as any)?.logo_url);

    let sent = 0;
    for (const recipientId of finalRecipientIds) {
      const { data: authUser } = await admin.auth.admin.getUserById(recipientId);
      const email = String(authUser?.user?.email || "").trim();
      if (!email) continue;

      const html = buildBrandedMentionEmailHtml({
        heading: "You were mentioned",
        intro: `<strong>${actorName}</strong> mentioned you in <strong>${contextLabel}</strong> for <strong>${companyName}</strong>.`,
        quote: truncate(content),
        buttonUrl: targetUrl,
        companyName,
        companyLogoUrl,
      });

      await sendTransactionalEmailWithFallback({
        supabaseUrl,
        serviceRoleKey: serviceKey,
        resend: resend as any,
        companyId,
        defaultFrom: fromEmail,
        to: [email],
        subject,
        html,
        text: `${actorName} mentioned you in ${contextLabel} for ${companyName}: "${truncate(content)}". Open: ${targetUrl}`,
        context: "send-mention-email",
      });
      sent += 1;
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-mention-email error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
