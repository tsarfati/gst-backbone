import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";
import { sendTransactionalEmailWithFallback } from "../_shared/transactionalEmail.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const inviteFrom = resolveBuilderlynkFrom(
  Deno.env.get("INVITE_EMAIL_FROM") || Deno.env.get("AUTH_EMAIL_FROM"),
  EMAIL_FROM.INVITE,
  "send-rfi-invite",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RfiInviteRequest {
  rfiId: string;
  rfiNumber: string;
  subject: string;
  dueDate?: string | null;
  recipientName?: string | null;
  recipientEmail: string;
  companyId: string;
  companyName: string;
  message?: string | null;
  baseUrl?: string | null;
}

const DEFAULT_PUBLIC_ORIGIN = "https://builderlynk.com";

const escapeHtml = (value: string): string =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const resolvePublicBaseUrl = (value: string | null | undefined) => {
  try {
    const url = new URL(String(value || "").trim());
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".lovable.app") ||
      hostname === "lovable.app" ||
      hostname.endsWith(".lovableproject.com") ||
      hostname === "lovableproject.com"
    ) {
      return DEFAULT_PUBLIC_ORIGIN;
    }
    return url.origin;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const {
      rfiId,
      rfiNumber,
      subject,
      dueDate,
      recipientName,
      recipientEmail,
      companyId,
      companyName,
      message,
      baseUrl,
    }: RfiInviteRequest = await req.json();

    if (!rfiId || !recipientEmail || !companyId || !companyName) {
      return new Response(
        JSON.stringify({ error: "rfiId, recipientEmail, companyId, and companyName are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const publicBaseUrl = resolvePublicBaseUrl(baseUrl);
    const rfiHref = `${publicBaseUrl}/design-professional/jobs/rfis`;
    const dueDateFormatted = dueDate
      ? new Date(dueDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Not specified";

    const escapedRecipient = escapeHtml(recipientName || recipientEmail);
    const escapedCompanyName = escapeHtml(companyName);
    const escapedRfiNumber = escapeHtml(rfiNumber || "RFI");
    const escapedSubject = escapeHtml(subject || "RFI");
    const escapedDueDate = escapeHtml(dueDateFormatted);
    const trimmedMessage = String(message || "").trim();
    const escapedMessage = escapeHtml(trimmedMessage).replace(/\n/g, "<br />");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">Request for Information</h1>
          <p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;font-size:16px;">Assignment Notification</p>
        </div>
        <div style="background:#ffffff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:16px;margin-bottom:20px;">Hello <strong>${escapedRecipient}</strong>,</p>
          <p style="font-size:16px;margin-bottom:20px;">
            <strong>${escapedCompanyName}</strong> submitted an RFI for your review in BuilderLYNK.
          </p>

          <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:20px 0;">
            <h2 style="margin:0 0 15px 0;color:#1e40af;font-size:20px;">${escapedRfiNumber}</h2>
            <p style="margin:5px 0;font-size:14px;"><strong>Subject:</strong> ${escapedSubject}</p>
            <p style="margin:5px 0;font-size:14px;"><strong>Due Date:</strong> ${escapedDueDate}</p>
          </div>

          ${trimmedMessage ? `
          <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:16px 18px;margin:20px 0;">
            <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#9a3412;">Message from ${escapedCompanyName}</p>
            <p style="margin:0;font-size:15px;color:#7c2d12;">${escapedMessage}</p>
          </div>
          ` : ""}

          <p style="font-size:16px;margin-bottom:20px;">
            Open BuilderLYNK to review the RFI details, attachments, and respond inside the shared project workflow.
          </p>

          <div style="text-align:center;margin:24px 0;">
            <a href="${escapeHtml(rfiHref)}" style="display:inline-block;background-color:#E88A2D;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px;">
              Open RFI
            </a>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailText = [
      `Hello ${recipientName || recipientEmail},`,
      "",
      `${companyName} submitted an RFI for your review in BuilderLYNK.`,
      `${rfiNumber || "RFI"}: ${subject || "RFI"}`,
      `Due Date: ${dueDateFormatted}`,
      trimmedMessage ? "" : null,
      trimmedMessage ? `Message from ${companyName}:` : null,
      trimmedMessage || null,
      "",
      `Open RFI: ${rfiHref}`,
    ]
      .filter((line): line is string => typeof line === "string")
      .join("\n");

    const emailResponse = await sendTransactionalEmailWithFallback({
      supabaseUrl,
      serviceRoleKey,
      resend,
      senderUserId: authData.user.id,
      companyId,
      defaultFrom: inviteFrom,
      to: [recipientEmail],
      subject: `${rfiNumber || "RFI"}: ${subject || "Request for Information"}`,
      html: emailHtml,
      text: emailText,
      context: "send-rfi-invite",
    });

    return new Response(
      JSON.stringify({
        success: true,
        providerMessageId: emailResponse?.providerMessageId || null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-rfi-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
