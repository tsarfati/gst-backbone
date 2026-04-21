import nodemailer from "https://esm.sh/nodemailer@6.9.10";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type ResendClient = {
  emails: {
    send: (payload: Record<string, unknown>) => Promise<any>;
  };
};

const hasWorkingSmtpConfig = (row: any) =>
  Boolean(
    row?.is_configured &&
      row?.smtp_host &&
      row?.smtp_username &&
      row?.smtp_password_encrypted,
  );

const buildSenderAddress = (row: any) => {
  const senderEmail = row?.smtp_username || row?.from_email || null;
  if (!senderEmail) return null;
  return row?.from_name ? `${row.from_name} <${senderEmail}>` : senderEmail;
};

const extractSenderEmail = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const angleMatch = raw.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim().toLowerCase();
  return raw.toLowerCase();
};

export async function sendTransactionalEmailWithFallback(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  resend: ResendClient | null;
  senderUserId?: string | null;
  companyId?: string | null;
  defaultFrom: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
  context: string;
}) {
  const {
    supabaseUrl,
    serviceRoleKey,
    resend,
    senderUserId,
    companyId,
    defaultFrom,
    to,
    subject,
    html,
    text,
    replyTo,
    context,
  } = params;

  let usedTransport: "user_smtp" | "company_smtp" | "builderlynk_resend" = "builderlynk_resend";
  let providerMessageId: string | null = null;
  let senderEmail: string | null = extractSenderEmail(defaultFrom);
  const admin = createClient(supabaseUrl, serviceRoleKey);

  if (senderUserId) {
    try {
      const { data: userEmailSettings, error } = await (admin as any)
        .from("user_email_settings")
        .select("*")
        .eq("user_id", senderUserId)
        .maybeSingle();

      if (error) {
        console.warn(`[${context}] Could not load user_email_settings`, error);
      } else if (hasWorkingSmtpConfig(userEmailSettings)) {
        const sender = buildSenderAddress(userEmailSettings);
        if (!sender) {
          console.warn(`[${context}] User SMTP sender address is missing; falling back`);
        } else {
          senderEmail = extractSenderEmail(sender);
          const transporter = nodemailer.createTransport({
            host: userEmailSettings.smtp_host,
            port: Number(userEmailSettings.smtp_port || 587),
            secure: !!userEmailSettings.use_ssl,
            auth: {
              user: userEmailSettings.smtp_username,
              pass: userEmailSettings.smtp_password_encrypted,
            },
          });

          const smtpResponse = await transporter.sendMail({
            from: sender,
            to: to.join(", "),
            subject,
            html,
            text,
            replyTo,
          });

          usedTransport = "user_smtp";
          providerMessageId = smtpResponse?.messageId || null;
          return { usedTransport, providerMessageId, senderEmail };
        }
      }
    } catch (userSmtpError) {
      console.warn(`[${context}] User SMTP send failed; falling back`, userSmtpError);
    }
  }

  if (companyId) {
    try {
      const { data: companyEmailSettings, error } = await (admin as any)
        .from("company_email_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) {
        console.warn(`[${context}] Could not load company_email_settings`, error);
      } else if (hasWorkingSmtpConfig(companyEmailSettings)) {
        const sender = buildSenderAddress(companyEmailSettings);
        if (!sender) {
          console.warn(`[${context}] Company SMTP sender address is missing; falling back to BuilderLYNK`);
        } else {
          senderEmail = extractSenderEmail(sender);
          const transporter = nodemailer.createTransport({
            host: companyEmailSettings.smtp_host,
            port: Number(companyEmailSettings.smtp_port || 587),
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
            replyTo,
          });

          usedTransport = "company_smtp";
          providerMessageId = smtpResponse?.messageId || null;
          return { usedTransport, providerMessageId, senderEmail };
        }
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
    ...(replyTo ? { reply_to: replyTo } : {}),
  });

  providerMessageId = resendResponse?.data?.id || null;
  return { usedTransport, providerMessageId, senderEmail };
}
