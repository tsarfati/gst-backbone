import nodemailer from "npm:nodemailer@6.9.10";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type ResendClient = {
  emails: {
    send: (payload: Record<string, unknown>) => Promise<any>;
  };
};

export async function sendTransactionalEmailWithFallback(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  resend: ResendClient | null;
  companyId?: string | null;
  defaultFrom: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  context: string;
}) {
  const {
    supabaseUrl,
    serviceRoleKey,
    resend,
    companyId,
    defaultFrom,
    to,
    subject,
    html,
    text,
    context,
  } = params;

  let usedTransport: "company_smtp" | "builderlynk_resend" = "builderlynk_resend";
  let providerMessageId: string | null = null;

  if (companyId) {
    try {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: companyEmailSettings, error } = await (admin as any)
        .from("company_email_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) {
        console.warn(`[${context}] Could not load company_email_settings`, error);
      } else if (
        companyEmailSettings?.is_configured &&
        companyEmailSettings?.smtp_host &&
        companyEmailSettings?.smtp_port &&
        companyEmailSettings?.smtp_username &&
        companyEmailSettings?.smtp_password_encrypted &&
        companyEmailSettings?.from_email
      ) {
        const sender = companyEmailSettings.from_name
          ? `${companyEmailSettings.from_name} <${companyEmailSettings.from_email}>`
          : companyEmailSettings.from_email;

        const transporter = nodemailer.createTransport({
          host: companyEmailSettings.smtp_host,
          port: Number(companyEmailSettings.smtp_port),
          secure: !!companyEmailSettings.use_ssl,
          auth: {
            user: companyEmailSettings.smtp_username,
            pass: companyEmailSettings.smtp_password_encrypted,
          },
        });

        const smtpResponse = await transporter.sendMail({
          from: sender,
          to: to.join(", "),
          subject,
          html,
          text,
        });

        usedTransport = "company_smtp";
        providerMessageId = smtpResponse?.messageId || null;
        return { usedTransport, providerMessageId };
      }
    } catch (smtpError) {
      console.warn(`[${context}] Company SMTP send failed; falling back to BuilderLYNK`, smtpError);
    }
  }

  if (!resend) {
    throw new Error("RESEND_API_KEY is missing and no company SMTP configuration is available.");
  }

  const resendResponse = await resend.emails.send({
    from: defaultFrom,
    to,
    subject,
    html,
    text,
  });

  providerMessageId = resendResponse?.data?.id || null;
  return { usedTransport, providerMessageId };
}
