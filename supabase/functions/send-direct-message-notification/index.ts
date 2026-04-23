import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const safeString = (value: unknown) => String(value ?? "").trim();

const truncate = (value: string, max = 180) => {
  const clean = safeString(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
};

const buildEmailHtml = ({
  actorName,
  preview,
  buttonUrl,
}: {
  actorName: string;
  preview: string;
  buttonUrl: string;
}) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f4f4f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#1e3a5f;color:#ffffff;padding:20px 24px;">
                <h1 style="margin:0;font-size:24px;font-weight:700;">New Direct Message</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px 0;color:#374151;font-size:16px;line-height:1.6;">
                  <strong>${actorName}</strong> sent you a new message in BuilderLYNK.
                </p>
                <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;color:#374151;font-size:15px;line-height:1.6;">
                  ${preview}
                </div>
                <div style="margin-top:24px;text-align:center;">
                  <a href="${buttonUrl}" style="display:inline-block;background:#E88A2D;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
                    Open Messages
                  </a>
                </div>
                <p style="margin:20px 0 0 0;color:#6b7280;font-size:12px;">
                  This is an automated BuilderLYNK notification.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json();
    const companyId = safeString(body?.companyId);
    const subject = safeString(body?.subject);
    const content = truncate(safeString(body?.content), 220);
    const actorUserId = safeString(body?.actorUserId || authData.user.id);
    const recipientUserIds = Array.from(
      new Set(((body?.recipientUserIds || []) as unknown[]).map((value) => safeString(value)).filter(Boolean)),
    ).filter((userId) => userId !== actorUserId);

    if (!companyId || !content || recipientUserIds.length === 0) {
      throw new Error("Missing companyId, content, or recipients");
    }

    const { data: actorProfile } = await admin
      .from("profiles")
      .select("display_name, first_name, last_name")
      .eq("user_id", actorUserId)
      .maybeSingle();
    const actorName =
      safeString((actorProfile as any)?.display_name) ||
      [safeString((actorProfile as any)?.first_name), safeString((actorProfile as any)?.last_name)].filter(Boolean).join(" ") ||
      safeString(authData.user.email) ||
      "A teammate";

    const { data: settingsRows, error: settingsError } = await admin
      .from("notification_settings")
      .select("user_id, in_app_enabled, email_enabled, chat_direct_message_notifications")
      .eq("company_id", companyId)
      .in("user_id", recipientUserIds);
    if (settingsError) throw settingsError;

    const settingsMap = new Map<string, any>();
    (settingsRows || []).forEach((row: any) => {
      settingsMap.set(safeString(row.user_id), row);
    });

    const inAppRecipients = recipientUserIds.filter((userId) => {
      const settings = settingsMap.get(userId);
      if (settings?.in_app_enabled === false) return false;
      return settings?.chat_direct_message_notifications !== false;
    });

    if (inAppRecipients.length > 0) {
      const { error: insertError } = await admin.from("notifications").insert(
        inAppRecipients.map((userId) => ({
          user_id: userId,
          title: "New Direct Message",
          message: subject ? `${actorName}: ${subject}` : `${actorName} sent you a new direct message.`,
          type: "/messages",
          read: false,
        })),
      );
      if (insertError) throw insertError;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    let sent = 0;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const recipientEmails: string[] = [];

      for (const userId of recipientUserIds) {
        const settings = settingsMap.get(userId);
        if (settings?.email_enabled === false) continue;
        if (settings?.chat_direct_message_notifications === false) continue;
        const { data: authUser } = await admin.auth.admin.getUserById(userId);
        const email = safeString(authUser?.user?.email).toLowerCase();
        if (email) recipientEmails.push(email);
      }

      const uniqueEmails = Array.from(new Set(recipientEmails));
      if (uniqueEmails.length > 0) {
        const appBaseUrl =
          Deno.env.get("APP_BASE_URL") ||
          Deno.env.get("SITE_URL") ||
          "https://builderlynk.com";
        await resend.emails.send({
          from: resolveBuilderlynkFrom(
            Deno.env.get("NOTIFICATIONS_EMAIL_FROM"),
            EMAIL_FROM.NOTIFICATIONS,
            "send-direct-message-notification",
          ),
          to: uniqueEmails,
          subject: subject ? `New message: ${subject}` : "New direct message in BuilderLYNK",
          html: buildEmailHtml({
            actorName,
            preview: content,
            buttonUrl: `${appBaseUrl.replace(/\/+$/, "")}/messages`,
          }),
        });
        sent = uniqueEmails.length;
      }
    }

    return new Response(JSON.stringify({ success: true, notifications: inAppRecipients.length, sent }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-direct-message-notification error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
