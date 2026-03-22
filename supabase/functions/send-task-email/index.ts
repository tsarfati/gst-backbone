import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTaskEmailRequest {
  taskId: string;
  toEmails: string[];
  subject: string;
  body: string;
}

const randomSuffix = () => Math.random().toString(36).slice(2, 8);
const extractEmailAddress = (fromValue: string) => {
  const match = fromValue.match(/<([^>]+)>/);
  return (match ? match[1] : fromValue).trim().toLowerCase();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const inboundDomain = Deno.env.get("TASK_EMAIL_INBOUND_DOMAIN") || "send.builderlynk.com";
    const outboundFrom = resolveBuilderlynkFrom(
      Deno.env.get("NOTIFICATIONS_EMAIL_FROM") || Deno.env.get("SYSTEM_EMAIL_FROM"),
      EMAIL_FROM.NOTIFICATIONS,
      "send-task-email",
    );
    if (!supabaseUrl || !serviceRole || !resendApiKey) {
      throw new Error("Missing required function environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRole);
    const resend = new Resend(resendApiKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = userData.user.id;
    const { taskId, toEmails, subject, body }: SendTaskEmailRequest = await req.json();
    const resolvedRecipients = (Array.isArray(toEmails) ? toEmails : [])
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    if (!taskId || resolvedRecipients.length === 0 || !subject?.trim() || !body?.trim()) {
      return new Response(JSON.stringify({ error: "taskId, toEmails, subject and body are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: taskRow, error: taskError } = await supabase
      .from("tasks")
      .select("id, company_id, title")
      .eq("id", taskId)
      .single();
    if (taskError || !taskRow) throw taskError || new Error("Task not found");

    const { data: access } = await supabase
      .from("user_company_access")
      .select("role, is_active")
      .eq("user_id", userId)
      .eq("company_id", (taskRow as any).company_id)
      .maybeSingle();
    const role = String((access as any)?.role || "");
    if (!access || access.is_active === false || role === "vendor" || role === "design_professional") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let { data: channel } = await supabase
      .from("task_email_channels")
      .select("id, tracking_local_part, tracking_email")
      .eq("task_id", taskId)
      .maybeSingle();

    if (!channel) {
      const localPart = `task-${taskId.slice(0, 8)}-${randomSuffix()}`;
      const trackingEmail = `${localPart}@${inboundDomain}`.toLowerCase();
      const { data: inserted, error: insertError } = await supabase
        .from("task_email_channels")
        .insert({
          task_id: taskId,
          company_id: (taskRow as any).company_id,
          tracking_local_part: localPart,
          tracking_email: trackingEmail,
          created_by: userId,
        })
        .select("id, tracking_local_part, tracking_email")
        .single();
      if (insertError) throw insertError;
      channel = inserted;
    }

    const taskTitle = (taskRow as any)?.title || "Task";
    const taggedSubject = subject.includes(taskTitle) ? subject : `[Task: ${taskTitle}] ${subject}`;

    const sendResult = await resend.emails.send({
      from: outboundFrom,
      to: resolvedRecipients,
      subject: taggedSubject,
      reply_to: channel.tracking_email,
      text: body,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
          <p>${body.replace(/\n/g, "<br/>")}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
          <p style="font-size:12px;color:#6b7280;">
            Task: ${taskTitle}<br/>
            Reply tracking: ${channel.tracking_email}
          </p>
        </div>
      `,
    });

    await supabase.from("task_email_messages").insert({
      task_id: taskId,
      company_id: (taskRow as any).company_id,
      direction: "outbound",
      from_email: extractEmailAddress(outboundFrom),
      to_emails: resolvedRecipients,
      subject: taggedSubject,
      body_text: body,
      body_html: null,
      provider_message_id: (sendResult as any)?.data?.id || null,
      provider_thread_id: null,
      message_source: "email",
      sent_by_user_id: userId,
    });

    await supabase.from("task_activity").insert({
      task_id: taskId,
      actor_user_id: userId,
      activity_type: "task_updated",
      content: `Sent email to ${resolvedRecipients.join(", ")}`,
      metadata: {
        email_subject: taggedSubject,
        to_emails: resolvedRecipients,
      },
    } as any);

    return new Response(
      JSON.stringify({
        success: true,
        trackingEmail: channel.tracking_email,
        messageId: (sendResult as any)?.data?.id || null,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("send-task-email error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
