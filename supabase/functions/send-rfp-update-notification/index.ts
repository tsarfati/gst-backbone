import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PreferenceKey =
  | "rfp_update_notifications"
  | "rfp_plan_update_notifications"
  | "rfp_comment_update_notifications";

const safeString = (value: unknown) => String(value ?? "").trim();

const truncate = (value: string, max = 180) => {
  const clean = safeString(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
};

const buildEmailHtml = ({
  companyName,
  rfpNumber,
  rfpTitle,
  message,
  buttonUrl,
}: {
  companyName: string;
  rfpNumber: string;
  rfpTitle: string;
  message: string;
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
                <h1 style="margin:0;font-size:24px;font-weight:700;">RFP Update</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px 0;color:#374151;font-size:16px;line-height:1.6;">
                  <strong>${companyName}</strong> updated <strong>${rfpNumber}</strong> - <strong>${rfpTitle}</strong>.
                </p>
                <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;color:#374151;font-size:15px;line-height:1.6;">
                  ${message}
                </div>
                <div style="margin-top:24px;text-align:center;">
                  <a href="${buttonUrl}" style="display:inline-block;background:#E88A2D;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
                    Open RFP
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
    const rfpId = safeString(body?.rfpId);
    const companyId = safeString(body?.companyId);
    const title = safeString(body?.title) || "RFP Updated";
    const message = truncate(safeString(body?.message) || "An RFP you are attached to was updated.", 240);
    const preferenceKey = safeString(body?.preferenceKey) as PreferenceKey;

    if (!rfpId || !companyId || !preferenceKey) {
      throw new Error("Missing rfpId, companyId, or preferenceKey");
    }

    const allowedKeys: PreferenceKey[] = [
      "rfp_update_notifications",
      "rfp_plan_update_notifications",
      "rfp_comment_update_notifications",
    ];
    if (!allowedKeys.includes(preferenceKey)) {
      throw new Error("Invalid notification preference key");
    }

    const { data: rfpRow, error: rfpError } = await admin
      .from("rfps")
      .select("id, company_id, rfp_number, title")
      .eq("id", rfpId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (rfpError) throw rfpError;
    if (!rfpRow) {
      return new Response(JSON.stringify({ success: true, notifications: 0, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: companyRow, error: companyError } = await admin
      .from("companies")
      .select("name, display_name")
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) throw companyError;

    const { data: invitedVendorRows, error: invitedVendorError } = await admin
      .from("rfp_invited_vendors")
      .select("vendor_id")
      .eq("rfp_id", rfpId)
      .eq("company_id", companyId);
    if (invitedVendorError) throw invitedVendorError;

    const vendorIds = Array.from(
      new Set((invitedVendorRows || []).map((row: any) => safeString(row.vendor_id)).filter(Boolean)),
    );
    if (vendorIds.length === 0) {
      return new Response(JSON.stringify({ success: true, notifications: 0, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: invitationRows, error: invitationError } = await admin
      .from("vendor_invitations")
      .select("created_user_id, vendor_id")
      .eq("company_id", companyId)
      .in("vendor_id", vendorIds)
      .eq("status", "accepted");
    if (invitationError) throw invitationError;

    const { data: externalProfiles, error: profileError } = await admin
      .from("profiles")
      .select("user_id, vendor_id, role, status")
      .in("vendor_id", vendorIds);
    if (profileError) throw profileError;

    const { data: accessRows, error: accessError } = await admin
      .from("user_company_access")
      .select("user_id, role, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true);
    if (accessError) throw accessError;

    const activeAccessUserIds = new Set(
      (accessRows || []).map((row: any) => safeString(row.user_id)).filter(Boolean),
    );
    const recipientUserIds = Array.from(
      new Set([
        ...(invitationRows || []).map((row: any) => safeString(row.created_user_id)).filter(Boolean),
        ...(externalProfiles || [])
          .filter((row: any) => {
            const role = safeString(row.role).toLowerCase();
            const status = safeString(row.status).toLowerCase();
            return (
              (role === "vendor" || role === "design_professional") &&
              status !== "deleted" &&
              status !== "disabled" &&
              status !== "inactive" &&
              activeAccessUserIds.has(safeString(row.user_id))
            );
          })
          .map((row: any) => safeString(row.user_id)),
      ]).filter(Boolean),
    ).filter((userId) => userId !== authData.user.id);

    if (recipientUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, notifications: 0, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: settingsRows, error: settingsError } = await admin
      .from("notification_settings")
      .select(`user_id, in_app_enabled, email_enabled, ${preferenceKey}`)
      .eq("company_id", companyId)
      .in("user_id", recipientUserIds);
    if (settingsError) throw settingsError;

    const settingsMap = new Map<string, any>();
    (settingsRows || []).forEach((row: any) => {
      settingsMap.set(safeString(row.user_id), row);
    });

    const notificationPath = `/vendor/rfps/${rfpId}`;
    const inAppRecipients = recipientUserIds.filter((userId) => {
      const settings = settingsMap.get(userId);
      if (settings?.in_app_enabled === false) return false;
      return settings?.[preferenceKey] !== false;
    });

    if (inAppRecipients.length > 0) {
      const { error: notificationInsertError } = await admin.from("notifications").insert(
        inAppRecipients.map((userId) => ({
          user_id: userId,
          title,
          message,
          type: notificationPath,
          read: false,
        })),
      );
      if (notificationInsertError) throw notificationInsertError;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    let sent = 0;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const recipientEmails: string[] = [];

      for (const userId of recipientUserIds) {
        const settings = settingsMap.get(userId);
        if (settings?.email_enabled === false) continue;
        if (settings?.[preferenceKey] === false) continue;

        const { data: authUser } = await admin.auth.admin.getUserById(userId);
        const email = safeString(authUser?.user?.email).toLowerCase();
        if (email) recipientEmails.push(email);
      }

      const uniqueRecipientEmails = Array.from(new Set(recipientEmails));
      if (uniqueRecipientEmails.length > 0) {
        const appBaseUrl =
          Deno.env.get("APP_BASE_URL") ||
          Deno.env.get("SITE_URL") ||
          "https://builderlynk.com";
        const buttonUrl = `${appBaseUrl.replace(/\/+$/, "")}${notificationPath}`;
        const subject = `${title}: ${safeString((rfpRow as any).rfp_number) || "RFP"} - ${safeString((rfpRow as any).title) || "Untitled RFP"}`;

        await resend.emails.send({
          from: resolveBuilderlynkFrom(
            Deno.env.get("NOTIFICATIONS_EMAIL_FROM"),
            EMAIL_FROM.NOTIFICATIONS,
            "send-rfp-update-notification",
          ),
          to: uniqueRecipientEmails,
          subject,
          html: buildEmailHtml({
            companyName: safeString((companyRow as any)?.display_name || (companyRow as any)?.name) || "BuilderLYNK",
            rfpNumber: safeString((rfpRow as any).rfp_number) || "RFP",
            rfpTitle: safeString((rfpRow as any).title) || "Untitled RFP",
            message,
            buttonUrl,
          }),
        });
        sent = uniqueRecipientEmails.length;
      }
    }

    return new Response(JSON.stringify({ success: true, notifications: inAppRecipients.length, sent }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-rfp-update-notification error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
