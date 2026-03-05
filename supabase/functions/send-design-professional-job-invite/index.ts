import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";
import { sendTransactionalEmailWithFallback } from "../_shared/transactionalEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUILDERLYNK_EMAIL_LOGO = "https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/builder%20lynk.png";

const resolveCompanyLogoUrl = (logoUrl?: string | null): string | null => {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  const cleaned = String(logoUrl).replace(/^company-logos\//, "").replace(/^\/+/, "");
  return `https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/${cleaned}`;
};

const escapeHtml = (value: string): string =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

type InvitePayload = {
  companyId: string;
  jobId: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const inviteEmailFrom = resolveBuilderlynkFrom(
      Deno.env.get("INVITE_EMAIL_FROM") || Deno.env.get("AUTH_EMAIL_FROM"),
      EMAIL_FROM.INVITE,
      "send-design-professional-job-invite",
    );
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { companyId, jobId, email, firstName, lastName }: InvitePayload = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!companyId || !jobId || !normalizedEmail) {
      return new Response(JSON.stringify({ error: "companyId, jobId, and email are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: accessRows, error: accessError } = await admin
      .from("user_company_access")
      .select("role, is_active")
      .eq("company_id", companyId)
      .eq("user_id", authData.user.id);
    if (accessError) throw accessError;

    const canInvite = (accessRows || []).some((row: any) => {
      const role = String(row.role || "").toLowerCase();
      return row.is_active === true && ["admin", "company_admin", "controller", "owner", "project_manager"].includes(role);
    });
    if (!canInvite) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const [{ data: companyRow, error: companyError }, { data: jobRow, error: jobError }] = await Promise.all([
      admin.from("companies").select("id, name, display_name, logo_url").eq("id", companyId).maybeSingle(),
      admin.from("jobs").select("id, name, project_number, company_id").eq("id", jobId).maybeSingle(),
    ]);
    if (companyError || !companyRow) throw companyError || new Error("Company not found");
    if (jobError || !jobRow || jobRow.company_id !== companyId) throw jobError || new Error("Job not found");

    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: upsertError } = await admin
      .from("design_professional_job_invites")
      .upsert(
        {
          company_id: companyId,
          job_id: jobId,
          email: normalizedEmail,
          first_name: firstName || null,
          last_name: lastName || null,
          invited_by: authData.user.id,
          invite_token: inviteToken,
          status: "pending",
          accepted_by_user_id: null,
          accepted_at: null,
          expires_at: expiresAt,
          notes: {
            role: "design_professional",
          },
        },
        { onConflict: "invite_token" },
      );
    if (upsertError) throw upsertError;

    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://builderlynk.com";
    const inviteUrl = `${baseUrl}/design-professional-signup?company=${encodeURIComponent(companyId)}&jobInvite=${encodeURIComponent(inviteToken)}`;
    const companyName = escapeHtml(String(companyRow.display_name || companyRow.name || "BuilderLYNK"));
    const jobName = escapeHtml(String(jobRow.name || "Project"));
    const jobNumber = escapeHtml(String(jobRow.project_number || ""));
    const companyLogoUrl = resolveCompanyLogoUrl((companyRow as any).logo_url);

    if (resend) {
      await sendTransactionalEmailWithFallback({
        supabaseUrl,
        serviceRoleKey: supabaseServiceKey,
        resend,
        companyId,
        defaultFrom: inviteEmailFrom,
        to: [normalizedEmail],
        subject: `${companyName} invited you as a Design Professional`,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr><td style="background-color:#1e3a5f;padding:16px 20px;text-align:center;">
          <img src="${BUILDERLYNK_EMAIL_LOGO}" alt="BuilderLYNK" style="display:block;margin:0 auto;height:150px;width:auto;max-width:420px;" />
        </td></tr>
        <tr><td style="padding:32px 28px;">
          ${companyLogoUrl ? `<div style="text-align:center;margin-bottom:24px;"><img src="${companyLogoUrl}" alt="Company logo" style="max-height:72px;max-width:240px;object-fit:contain;" /></div>` : ""}
          <h1 style="color:#1e3a5f;font-size:24px;font-weight:700;margin:0 0 16px 0;text-align:center;">Design Professional Invitation</h1>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 12px 0;">You were invited by <strong>${companyName}</strong> to join job <strong>${jobName}${jobNumber ? ` (${jobNumber})` : ""}</strong> as a design professional.</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${inviteUrl}" style="display:inline-block;background-color:#E88A2D;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:8px;">Accept Invitation</a>
          </td></tr></table>
          <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:18px 0 0 0;text-align:center;">This invitation expires in 7 days.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        context: "send-design-professional-job-invite",
      });
    }

    return new Response(JSON.stringify({ success: true, inviteToken }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-design-professional-job-invite:", error);
    return new Response(JSON.stringify({ error: error?.message || "Failed to send invite" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
