import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Webhook } from "https://esm.sh/svix@1.61.0";

const BID_ATTACHMENTS_BUCKET = "bid-attachments";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface InboundPayload {
  to?: string | string[];
  from?: string;
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;
  thread_id?: string;
  id?: string;
  data?: {
    to?: unknown;
    from?: unknown;
    attachments?: unknown[];
    subject?: string;
    text?: string;
    html?: string;
    message_id?: string;
    thread_id?: string;
    id?: string;
    email_id?: string;
  };
}

interface InboundAttachment {
  id?: string;
  filename?: string;
  content_type?: string;
  size?: number;
  content_disposition?: string;
  download_url?: string;
  content?: string;
  data?: string;
}

interface ResendEmailContent {
  html: string | null;
  text: string | null;
}

const parseEmails = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === "string") return v.trim().toLowerCase();
        if (v && typeof v === "object") {
          const obj = v as Record<string, unknown>;
          const email = obj.email ?? obj.address ?? obj.value;
          return email ? String(email).trim().toLowerCase() : "";
        }
        return "";
      })
      .filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
};

const parseSingleEmail = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const email = obj.email ?? obj.address ?? obj.value;
    return email ? String(email).trim().toLowerCase() : "";
  }
  return "";
};

const parseResendEmailContent = (value: unknown): ResendEmailContent => {
  if (!value || typeof value !== "object") return { html: null, text: null };
  const obj = value as Record<string, unknown>;
  const directHtml = typeof obj.html === "string" ? obj.html : null;
  const directText = typeof obj.text === "string" ? obj.text : null;
  const data = obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : null;
  const nestedHtml = data && typeof data.html === "string" ? data.html : null;
  const nestedText = data && typeof data.text === "string" ? data.text : null;
  return {
    html: directHtml || nestedHtml || null,
    text: directText || nestedText || null,
  };
};

const normalizeBase64 = (value: string): string =>
  value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;

const base64ToBytes = (value: string): Uint8Array => {
  const normalized = normalizeBase64(value).replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const sanitizeFilename = (value: string): string => {
  const safe = value.replace(/[^\w.\-() ]/g, "_").trim();
  return safe || "attachment";
};

const parseAttachment = (value: unknown): InboundAttachment | null => {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  return {
    id: obj.id ? String(obj.id) : undefined,
    filename: obj.filename ? String(obj.filename) : undefined,
    content_type: obj.content_type ? String(obj.content_type) : undefined,
    size: typeof obj.size === "number" ? obj.size : undefined,
    content_disposition: obj.content_disposition ? String(obj.content_disposition) : undefined,
    download_url: obj.download_url ? String(obj.download_url) : undefined,
    content: typeof obj.content === "string" ? obj.content : undefined,
    data: typeof obj.data === "string" ? obj.data : undefined,
  };
};

const downloadAttachmentBytes = async (
  attachment: InboundAttachment,
  emailId: string | null,
  resendApiKey: string,
): Promise<Uint8Array | null> => {
  const inlineContent = attachment.data || attachment.content;
  if (inlineContent) {
    try {
      return base64ToBytes(inlineContent);
    } catch {
      // Continue with network fetch fallbacks.
    }
  }

  if (attachment.download_url) {
    const directResp = await fetch(attachment.download_url);
    if (directResp.ok) {
      return new Uint8Array(await directResp.arrayBuffer());
    }
  }

  if (!emailId || !attachment.id || !resendApiKey) return null;
  const endpoint = `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachment.id)}`;
  const apiResp = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
    },
  });
  if (!apiResp.ok) return null;

  const contentType = apiResp.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await apiResp.json().catch(() => null);
    const possible =
      body?.content ||
      body?.data ||
      body?.attachment?.content ||
      body?.attachment?.data ||
      body?.attachment?.download_url;
    if (typeof possible === "string") {
      if (possible.startsWith("http://") || possible.startsWith("https://")) {
        const fileResp = await fetch(possible);
        if (!fileResp.ok) return null;
        return new Uint8Array(await fileResp.arrayBuffer());
      }
      try {
        return base64ToBytes(possible);
      } catch {
        return null;
      }
    }
    return null;
  }

  return new Uint8Array(await apiResp.arrayBuffer());
};

const fetchResendEmailContent = async (
  emailId: string | null,
  resendApiKey: string,
): Promise<ResendEmailContent> => {
  if (!emailId || !resendApiKey) return { html: null, text: null };

  const candidateUrls = [
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    `https://api.resend.com/emails/${encodeURIComponent(emailId)}`,
    `https://api.resend.com/emails/${encodeURIComponent(emailId)}/content`,
  ];

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
        },
      });
      if (!resp.ok) continue;
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) continue;
      const payload = await resp.json();
      const parsed = parseResendEmailContent(payload);
      if (parsed.html || parsed.text) return parsed;
    } catch {
      // Try next endpoint.
    }
  }

  return { html: null, text: null };
};

const getCandidateWebhookSecrets = (): string[] => {
  const rawValues = [
    Deno.env.get("RESEND_WEBHOOK_SIGNING_SECRET") || "",
    Deno.env.get("BID_EMAIL_WEBHOOK_SECRET") || "",
  ];

  const secrets = rawValues
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);

  return Array.from(new Set(secrets));
};

const validateWebhook = async (req: Request, rawBody: string): Promise<boolean> => {
  const secrets = getCandidateWebhookSecrets();
  const svixId = req.headers.get("svix-id") || req.headers.get("webhook-id");
  const svixTimestamp = req.headers.get("svix-timestamp") || req.headers.get("webhook-timestamp");
  const svixSignature = req.headers.get("svix-signature") || req.headers.get("webhook-signature");

  if (secrets.length > 0 && svixId && svixTimestamp && svixSignature) {
    for (const secret of secrets) {
      try {
        const webhook = new Webhook(secret);
        webhook.verify(rawBody, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        });
        return true;
      } catch {
        // Try next configured secret.
      }
    }
    return false;
  }

  const fallbackSecret = secrets[0] || "";
  const suppliedSecret = req.headers.get("x-webhook-secret") || "";
  return Boolean(fallbackSecret && suppliedSecret === fallbackSecret);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const isValidWebhook = await validateWebhook(req, rawBody);
    if (!isValidWebhook) {
      return new Response(JSON.stringify({ error: "Unauthorized webhook call" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRole) {
      throw new Error("Missing required function environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRole);
    const payload: InboundPayload = JSON.parse(rawBody || "{}");
    const data = payload.data && typeof payload.data === "object" ? payload.data : null;
    const toEmails = parseEmails(data?.to ?? payload.to);
    const fromEmail = parseSingleEmail(data?.from ?? payload.from);
    const subject = String(data?.subject ?? payload.subject ?? "").trim();
    const payloadBodyText = String(data?.text ?? payload.text ?? "");
    const payloadBodyHtml = String(data?.html ?? payload.html ?? "");
    const providerMessageId = String(data?.message_id ?? payload.message_id ?? data?.id ?? payload.id ?? "").trim() || null;
    const providerThreadId = String(data?.thread_id ?? payload.thread_id ?? "").trim() || null;
    const emailId = String(data?.email_id ?? data?.id ?? payload.id ?? "").trim() || null;
    const inboundAttachments = Array.isArray(data?.attachments)
      ? data.attachments.map(parseAttachment).filter((value): value is InboundAttachment => Boolean(value))
      : [];
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const fetchedBody = await fetchResendEmailContent(emailId, resendApiKey);
    const bodyText = payloadBodyText || fetchedBody.text || "";
    const bodyHtml = payloadBodyHtml || fetchedBody.html || null;

    if (toEmails.length === 0 || !fromEmail) {
      return new Response(JSON.stringify({ error: "Missing to/from email values" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: channel, error: channelError } = await supabase
      .from("bid_email_channels")
      .select("bid_id, company_id, vendor_id, tracking_email, created_by")
      .in("tracking_email", toEmails)
      .eq("is_active", true)
      .maybeSingle();
    if (channelError) throw channelError;

    if (!channel) {
      return new Response(JSON.stringify({ ok: true, ignored: "No bid tracking email matched" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let existingInboundMessageId: string | null = null;
    if (providerMessageId) {
      const { data: existingMessageRows } = await supabase
        .from("bid_email_messages")
        .select("id, body_text, body_html")
        .eq("bid_id", channel.bid_id)
        .eq("direction", "inbound")
        .eq("provider_message_id", providerMessageId)
        .limit(1);
      if (existingMessageRows && existingMessageRows.length > 0) {
        const existing = existingMessageRows[0] as { id: string; body_text: string | null; body_html: string | null };
        existingInboundMessageId = existing.id;
        const hasExistingBody = Boolean((existing.body_text || "").trim() || (existing.body_html || "").trim());
        const hasIncomingBody = Boolean((bodyText || "").trim() || (bodyHtml || "").trim());
        if (!hasExistingBody && hasIncomingBody) {
          const { error: hydrateError } = await supabase
            .from("bid_email_messages")
            .update({
              body_text: bodyText || null,
              body_html: bodyHtml || null,
              from_email: fromEmail || null,
              to_emails: toEmails,
              subject: subject || null,
              provider_thread_id: providerThreadId,
            })
            .eq("id", existing.id);
          if (hydrateError) throw hydrateError;
        }
      }
    }

    if (!existingInboundMessageId) {
      const { error: insertMessageError } = await supabase.from("bid_email_messages").insert({
        bid_id: channel.bid_id,
        company_id: channel.company_id,
        vendor_id: channel.vendor_id,
        direction: "inbound",
        from_email: fromEmail,
        to_emails: toEmails,
        subject: subject || null,
        body_text: bodyText || null,
        body_html: bodyHtml,
        provider_message_id: providerMessageId,
        provider_thread_id: providerThreadId,
        message_source: "email",
        sent_by_user_id: null,
      });
      if (insertMessageError) throw insertMessageError;
    }

    let uploadedBy = (channel as any).created_by as string | null;
    if (!uploadedBy) {
      const { data: fallbackUsers } = await supabase
        .from("user_company_access")
        .select("user_id")
        .eq("company_id", channel.company_id)
        .eq("is_active", true)
        .limit(1);
      uploadedBy = fallbackUsers?.[0]?.user_id || null;
    }

    let attachmentCount = 0;
    if (uploadedBy && inboundAttachments.length > 0) {
      for (const attachment of inboundAttachments) {
        if ((attachment.content_disposition || "").toLowerCase() !== "attachment") {
          continue;
        }
        try {
          const bytes = await downloadAttachmentBytes(attachment, emailId, resendApiKey);
          if (!bytes || bytes.byteLength === 0) continue;

          const filename = sanitizeFilename(attachment.filename || attachment.id || `email-attachment-${Date.now()}`);
          const objectPath = `${channel.company_id}/${channel.bid_id}/email/${providerMessageId || emailId || Date.now().toString()}-${filename}`;
          const { error: uploadError } = await supabase.storage
            .from(BID_ATTACHMENTS_BUCKET)
            .upload(objectPath, bytes, {
              contentType: attachment.content_type || "application/octet-stream",
              upsert: false,
            });
          if (uploadError) {
            console.error("Failed to upload inbound email attachment:", uploadError);
            continue;
          }

          const { data: publicData } = supabase.storage.from(BID_ATTACHMENTS_BUCKET).getPublicUrl(objectPath);
          const { error: attachmentInsertError } = await supabase.from("bid_attachments").insert({
            bid_id: channel.bid_id,
            company_id: channel.company_id,
            file_name: filename,
            file_url: publicData.publicUrl,
            file_size: attachment.size || bytes.byteLength,
            file_type: attachment.content_type || null,
            uploaded_by: uploadedBy,
            attachment_type: "other",
          } as any);
          if (attachmentInsertError) {
            console.error("Failed to insert inbound email attachment row:", attachmentInsertError);
            continue;
          }
          attachmentCount += 1;
        } catch (attachmentError) {
          console.error("Inbound email attachment processing failed:", attachmentError);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, bidId: channel.bid_id, attachmentsImported: attachmentCount }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("receive-bid-email-webhook error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
