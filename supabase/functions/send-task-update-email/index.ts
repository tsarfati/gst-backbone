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
};

const uniq = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));

const truncate = (value: string, max = 180) => {
  const clean = String(value || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
};

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

    const recipientUserIds = uniq([
      (taskRow as any)?.leader_user_id,
      ...((assigneeRows || []) as any[]).map((row) => row.user_id),
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
      .select("user_id, email_enabled, task_update_notifications")
      .eq("company_id", companyId)
      .in("user_id", Array.from(eligibleIds));

    const settingsMap = new Map<string, { email_enabled: boolean; task_update_notifications: boolean | null }>();
    (settingsRows || []).forEach((row: any) => {
      settingsMap.set(row.user_id, {
        email_enabled: row.email_enabled !== false,
        task_update_notifications: row.task_update_notifications,
      });
    });

    const finalRecipientIds = Array.from(eligibleIds).filter((id) => {
      const setting = settingsMap.get(id);
      if (!setting) return true;
      return setting.email_enabled !== false && setting.task_update_notifications !== false;
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

    let sent = 0;
    for (const recipientId of finalRecipientIds) {
      const { data: authUser } = await admin.auth.admin.getUserById(recipientId);
      const email = String(authUser?.user?.email || "").trim();
      if (!email) continue;

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
          <h2 style="margin:0 0 12px 0">${title}</h2>
          <p style="margin:0 0 10px 0"><strong>${taskTitle}</strong> has new activity.</p>
          <p style="margin:0 0 14px 0;color:#374151">${truncate(message)}</p>
          <a href="${targetUrl}" style="display:inline-block;padding:10px 16px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">
            Open Task
          </a>
        </div>
      `;

      await sendTransactionalEmailWithFallback({
        supabaseUrl,
        serviceRoleKey: serviceKey,
        resend: resend as any,
        companyId,
        defaultFrom: fromEmail,
        to: [email],
        subject: `${title} - ${taskTitle}`,
        html,
        text: `${title}\n\n${taskTitle} has new activity.\n\n${truncate(message)}\n\nOpen: ${targetUrl}`,
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
