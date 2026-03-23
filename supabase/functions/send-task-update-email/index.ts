import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";
import { sendTransactionalEmailWithFallback } from "../_shared/transactionalEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TaskUpdateEmailPayload = {
  taskId: string;
  companyId: string;
  actorUserId?: string | null;
  title: string;
  message: string;
  additionalRecipientUserIds?: string[];
  recipientUserIds?: string[];
  preferenceKey?: "task_update_notifications" | "task_team_assignment_notifications" | "task_timeline_activity_notifications";
};

const uniq = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));

const truncate = (value: string, max = 180) => {
  const clean = String(value || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
};

const BUILDERLYNK_EMAIL_LOGO =
  "https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/builder%20lynk.png";

const resolveCompanyLogoUrl = (logoUrl?: string | null): string | null => {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  const cleaned = String(logoUrl).replace(/^company-logos\//, "").replace(/^\/+/, "");
  return `https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/${cleaned}`;
};

const buildBrandedTaskEmailHtml = ({
  title,
  heading,
  intro,
  message,
  buttonLabel,
  buttonUrl,
  companyName,
  companyLogoUrl,
}: {
  title: string;
  heading: string;
  intro: string;
  message: string;
  buttonLabel: string;
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
            <img src="${BUILDERLYNK_EMAIL_LOGO}" alt="BuilderLYNK" style="display:block;margin:0 auto;height:150px;width:auto;max-width:420px;" />
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px;">
            ${companyLogoUrl ? `<div style="text-align:center;margin-bottom:24px;"><img src="${companyLogoUrl}" alt="${companyName || "Company"}" style="max-height:72px;max-width:240px;object-fit:contain;" /></div>` : ""}
            <h1 style="color:#1e3a5f;font-size:24px;font-weight:700;margin:0 0 16px 0;text-align:center;">${heading}</h1>
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 14px 0;">${intro}</p>
            <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 18px 0;">${message}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr><td align="center">
              <a href="${buttonUrl}" style="display:inline-block;background-color:#E88A2D;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:8px;">${buttonLabel}</a>
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

    const payload = (await req.json()) as TaskUpdateEmailPayload;
    const taskId = String(payload.taskId || "");
    const companyId = String(payload.companyId || "");
    const actorUserId = String(payload.actorUserId || authData.user.id || "");
    const title = String(payload.title || "Task update");
    const message = String(payload.message || "There is new activity on a task.");
    const additionalRecipientUserIds = Array.from(new Set(payload.additionalRecipientUserIds || [])).filter(Boolean);
    const preferenceKey = payload.preferenceKey || "task_timeline_activity_notifications";
    const explicitRecipientUserIds = Array.from(new Set(payload.recipientUserIds || [])).filter(Boolean);

    if (!taskId || !companyId || !title || !message) {
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

    const { data: taskRow, error: taskError } = await admin
      .from("tasks")
      .select("id, title, leader_user_id")
      .eq("id", taskId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!taskRow) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: assigneeRows, error: assigneeError } = await admin
      .from("task_assignees")
      .select("user_id")
      .eq("task_id", taskId);
    if (assigneeError) throw assigneeError;

    const teamRecipientUserIds = uniq([
      (taskRow as any)?.leader_user_id,
      ...((assigneeRows || []) as any[]).map((row) => row.user_id),
    ]);
    const recipientUserIds = uniq([
      ...(explicitRecipientUserIds.length > 0 ? explicitRecipientUserIds : teamRecipientUserIds),
      ...additionalRecipientUserIds,
    ]).filter((userId) => userId !== actorUserId);

    if (recipientUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: eligibleUsers, error: eligibleError } = await admin
      .from("user_company_access")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .in("user_id", recipientUserIds);
    if (eligibleError) throw eligibleError;
    const eligibleIds = new Set((eligibleUsers || []).map((row: any) => row.user_id));

    if (eligibleIds.size === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: settingsRows } = await admin
      .from("notification_settings")
      .select("user_id, email_enabled, task_update_notifications, task_team_assignment_notifications, task_timeline_activity_notifications")
      .eq("company_id", companyId)
      .in("user_id", Array.from(eligibleIds));

    const settingsMap = new Map<string, any>();
    (settingsRows || []).forEach((row: any) => {
      settingsMap.set(row.user_id, row);
    });

    const finalRecipientIds = Array.from(eligibleIds).filter((id) => {
      const setting = settingsMap.get(id);
      if (!setting) return true;
      const preferenceValue =
        setting[preferenceKey] ??
        (preferenceKey === "task_timeline_activity_notifications" ? setting.task_update_notifications : undefined);
      return setting.email_enabled !== false && preferenceValue !== false;
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
      "send-task-update-email",
    );

    const appBaseUrl =
      Deno.env.get("APP_BASE_URL") ||
      Deno.env.get("SITE_URL") ||
      "https://builderlynk.com";
    const targetUrl = `${appBaseUrl.replace(/\/+$/, "")}/tasks/${taskId}`;
    const taskTitle = String((taskRow as any)?.title || "Task");
    const companyName = String((companyRow as any)?.display_name || (companyRow as any)?.name || "your company");
    const companyLogoUrl = resolveCompanyLogoUrl((companyRow as any)?.logo_url);

    let sent = 0;
    for (const recipientId of finalRecipientIds) {
      const { data: authUser } = await admin.auth.admin.getUserById(recipientId);
      const email = String(authUser?.user?.email || "").trim();
      if (!email) continue;

      const html = buildBrandedTaskEmailHtml({
        title,
        heading: title,
        intro: `<strong>${taskTitle}</strong> has new activity in <strong>${companyName}</strong>.`,
        message: truncate(message),
        buttonLabel: "Open Task",
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
        subject: `${title} - ${taskTitle}`,
        html,
        text: `${title}\n\n${taskTitle} has new activity in ${companyName}.\n\n${truncate(message)}\n\nOpen: ${targetUrl}`,
        context: "send-task-update-email",
      });
      sent += 1;
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-task-update-email error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
    const { data: companyRow, error: companyError } = await admin
      .from("companies")
      .select("name, display_name, logo_url")
      .eq("id", companyId)
      .maybeSingle();
    if (companyError) throw companyError;
