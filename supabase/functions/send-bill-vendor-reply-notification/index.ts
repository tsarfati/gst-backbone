import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const NOTIFICATION_COOLDOWN_MINUTES = 15;

const truncate = (value: string, max = 180) => {
  const clean = String(value || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
};

const buildEmailHtml = ({
  vendorName,
  invoiceNumber,
  jobName,
  preview,
  buttonUrl,
}: {
  vendorName: string;
  invoiceNumber: string;
  jobName: string;
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
                <h1 style="margin:0;font-size:24px;font-weight:700;">Vendor Replied To Bill Revision</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px 0;color:#374151;font-size:16px;line-height:1.6;">
                  <strong>${vendorName}</strong> replied to bill <strong>${invoiceNumber}</strong>${jobName ? ` for <strong>${jobName}</strong>` : ""}.
                </p>
                <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;color:#374151;font-size:15px;line-height:1.6;">
                  ${preview}
                </div>
                <div style="margin-top:24px;text-align:center;">
                  <a href="${buttonUrl}" style="display:inline-block;background:#E88A2D;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
                    Open Bill
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

    const { billId } = await req.json();
    const normalizedBillId = String(billId || "").trim();
    if (!normalizedBillId) {
      throw new Error("Missing billId");
    }

    const { data: actorProfile, error: actorProfileError } = await admin
      .from("profiles")
      .select("user_id, role, vendor_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (actorProfileError) throw actorProfileError;

    const { data: bill, error: billError } = await admin
      .from("invoices")
      .select(`
        id,
        company_id,
        vendor_id,
        invoice_number,
        job_id,
        description,
        jobs(name),
        vendors(name)
      `)
      .eq("id", normalizedBillId)
      .maybeSingle();
    if (billError) throw billError;
    if (!bill) {
      return new Response(JSON.stringify({ success: true, sent: 0, notifications: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (
      String(actorProfile?.role || "").toLowerCase() !== "vendor" ||
      String(actorProfile?.vendor_id || "") !== String((bill as any).vendor_id || "")
    ) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: latestReply, error: latestReplyError } = await admin
      .from("messages")
      .select("id, content, created_at")
      .eq("thread_id", normalizedBillId)
      .eq("attachment_type", "bill_vendor_thread")
      .eq("from_user_id", authData.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestReplyError) throw latestReplyError;

    const preview = truncate(
      String(latestReply?.content || `Updated response from ${(bill as any).vendors?.name || "Vendor"}`),
      240,
    );

    const { data: accessRows, error: accessError } = await admin
      .from("user_company_access")
      .select("user_id")
      .eq("company_id", (bill as any).company_id)
      .eq("is_active", true);
    if (accessError) throw accessError;

    const candidateUserIds = Array.from(
      new Set((accessRows || []).map((row: any) => String(row.user_id || "")).filter(Boolean)),
    ).filter((userId) => userId !== authData.user.id);

    if (candidateUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, notifications: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: candidateProfiles, error: candidateProfilesError } = await admin
      .from("profiles")
      .select("user_id, role")
      .in("user_id", candidateUserIds);
    if (candidateProfilesError) throw candidateProfilesError;

    const builderUserIds = (candidateProfiles || [])
      .filter((profile: any) => String(profile.role || "").toLowerCase() !== "vendor")
      .map((profile: any) => String(profile.user_id || ""))
      .filter(Boolean);

    if (builderUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, notifications: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: settingsRows } = await admin
      .from("notification_settings")
      .select("user_id, in_app_enabled, email_enabled, bill_revision_reply_notifications")
      .eq("company_id", (bill as any).company_id)
      .in("user_id", builderUserIds);

    const settingsMap = new Map<string, any>();
    (settingsRows || []).forEach((row: any) => {
      settingsMap.set(String(row.user_id), row);
    });

    const appBaseUrl =
      Deno.env.get("APP_BASE_URL") ||
      Deno.env.get("SITE_URL") ||
      "https://builderlynk.com";
    const billUrl = `${appBaseUrl.replace(/\/+$/, "")}/invoices/${normalizedBillId}`;
    const vendorName = String((bill as any).vendors?.name || "Vendor");
    const invoiceNumber = String((bill as any).invoice_number || `INV-${normalizedBillId.slice(0, 8)}`);
    const jobName = String((bill as any).jobs?.name || "");
    const notificationType = `/invoices/${normalizedBillId}`;
    const cooldownCutoff = new Date(Date.now() - NOTIFICATION_COOLDOWN_MINUTES * 60 * 1000).toISOString();

    const { data: recentNotificationRows } = await admin
      .from("notifications")
      .select("user_id, created_at")
      .eq("type", notificationType)
      .eq("title", "Vendor Replied To Bill Revision")
      .gte("created_at", cooldownCutoff)
      .in("user_id", builderUserIds);

    const usersRecentlyNotified = new Set(
      (recentNotificationRows || []).map((row: any) => String(row.user_id || "")).filter(Boolean),
    );

    const inAppRecipients = builderUserIds.filter(
      (userId) =>
        settingsMap.get(userId)?.in_app_enabled !== false &&
        settingsMap.get(userId)?.bill_revision_reply_notifications !== false &&
        !usersRecentlyNotified.has(userId),
    );
    if (inAppRecipients.length > 0) {
      await admin.from("notifications").insert(
        inAppRecipients.map((userId) => ({
          user_id: userId,
          title: "Vendor Replied To Bill Revision",
          message: `${vendorName} replied on ${invoiceNumber}${jobName ? ` for ${jobName}` : ""}.`,
          type: notificationType,
          read: false,
        })),
      );
    }

    const emailRecipients: string[] = [];
    for (const userId of builderUserIds) {
      const settings = settingsMap.get(userId);
      if (settings?.email_enabled === false) continue;
      if (settings?.bill_revision_reply_notifications === false) continue;
      if (usersRecentlyNotified.has(userId)) continue;
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      const email = String(authUser?.user?.email || "").trim();
      if (email) emailRecipients.push(email);
    }

    let sent = 0;
    if (emailRecipients.length > 0) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const notificationsFrom = resolveBuilderlynkFrom(
          Deno.env.get("NOTIFICATIONS_EMAIL_FROM"),
          EMAIL_FROM.NOTIFICATIONS,
          "send-bill-vendor-reply-notification",
        );
        const subject = `Vendor Replied To Bill Revision - ${vendorName}`;
        const html = buildEmailHtml({
          vendorName,
          invoiceNumber,
          jobName,
          preview,
          buttonUrl: billUrl,
        });
        await resend.emails.send({
          from: notificationsFrom,
          to: emailRecipients,
          subject,
          html,
        });
        sent = emailRecipients.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications: inAppRecipients.length,
        sent,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("send-bill-vendor-reply-notification error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
