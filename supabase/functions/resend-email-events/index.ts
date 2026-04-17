import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    emailId?: string;
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const buildCorsHeaders = (req: Request) => ({
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    req.headers.get("Access-Control-Request-Headers") || corsHeaders["Access-Control-Allow-Headers"],
});

const rawWebhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET")?.trim() || "";
const webhookSecret = rawWebhookSecret.includes(",")
  ? rawWebhookSecret.split(",").pop()?.trim() || ""
  : rawWebhookSecret;

function getJwtRoleFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1]));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function normalizeWebhookHeaders(req: Request): Record<string, string> {
  const headers = Object.fromEntries(req.headers.entries());

  if (!headers["webhook-id"] && headers["svix-id"]) {
    headers["webhook-id"] = headers["svix-id"];
  }
  if (!headers["webhook-timestamp"] && headers["svix-timestamp"]) {
    headers["webhook-timestamp"] = headers["svix-timestamp"];
  }
  if (!headers["webhook-signature"] && headers["svix-signature"]) {
    headers["webhook-signature"] = headers["svix-signature"];
  }

  return headers;
}

function extractMessageId(payload: ResendWebhookPayload): string | null {
  const fromData = payload.data?.email_id || payload.data?.emailId || payload.data?.id;
  const topLevel =
    (payload as Record<string, unknown>)?.email_id || (payload as Record<string, unknown>)?.emailId;

  const messageId = typeof fromData === "string" ? fromData : typeof topLevel === "string" ? topLevel : null;
  return messageId?.trim() || null;
}

function normalizeEventType(payload: ResendWebhookPayload): string {
  const eventType =
    payload.type ||
    (typeof payload.event === "string" ? payload.event : undefined) ||
    (typeof payload.data?.type === "string" ? (payload.data.type as string) : undefined) ||
    "";

  return eventType.toLowerCase().trim();
}

serve(async (req: Request): Promise<Response> => {
  const responseCorsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: responseCorsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...responseCorsHeaders },
    });
  }

  const payloadText = await req.text();
  const headers = normalizeWebhookHeaders(req);
  const hasWebhookSignature =
    !!headers["webhook-id"] && !!headers["webhook-timestamp"] && !!headers["webhook-signature"];
  const callerRole = getJwtRoleFromAuthHeader(req.headers.get("authorization"));
  const isServiceRoleCaller = callerRole === "service_role";

  let payload: ResendWebhookPayload;

  if (hasWebhookSignature) {
    if (!webhookSecret) {
      console.error("Missing RESEND_WEBHOOK_SECRET while webhook signature headers are present");
      return new Response(JSON.stringify({ error: "Missing webhook secret" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...responseCorsHeaders },
      });
    }

    try {
      const verifier = new Webhook(webhookSecret);
      payload = verifier.verify(payloadText, headers) as ResendWebhookPayload;
    } catch (error) {
      console.error("Webhook verification failed:", error);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...responseCorsHeaders },
      });
    }
  } else if (isServiceRoleCaller) {
    try {
      payload = JSON.parse(payloadText) as ResendWebhookPayload;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...responseCorsHeaders },
      });
    }
  } else {
    return new Response(JSON.stringify({ error: "Missing required webhook headers" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...responseCorsHeaders },
    });
  }

  const eventType = normalizeEventType(payload);
  const messageId = extractMessageId(payload);

  if (!messageId) {
    return new Response(
      JSON.stringify({ success: true, ignored: true, reason: "missing_message_id", eventType }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...responseCorsHeaders },
      },
    );
  }

  const eventTimestamp =
    (typeof payload.created_at === "string" && payload.created_at) || new Date().toISOString();

  const updatePayload: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };

  if (eventType === "email.delivered" || eventType === "delivered") {
    updatePayload.email_status = "delivered";
    updatePayload.email_delivered_at = eventTimestamp;
  } else if (eventType === "email.opened" || eventType === "opened") {
    updatePayload.email_status = "opened";
    updatePayload.email_opened_at = eventTimestamp;
  } else if (
    eventType === "email.bounced" ||
    eventType === "email.complained" ||
    eventType === "bounced" ||
    eventType === "complained"
  ) {
    updatePayload.email_status = "bounced";
    updatePayload.email_bounced_at = eventTimestamp;
  } else {
    return new Response(
      JSON.stringify({ success: true, ignored: true, reason: "unsupported_event", eventType, messageId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...responseCorsHeaders },
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...responseCorsHeaders },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("user_invitations")
    .update(updatePayload)
    .eq("resend_message_id", messageId)
    .select("id");

  if (error) {
    console.error("Failed updating user_invitations from webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...responseCorsHeaders },
    });
  }

  const { data: designInviteData, error: designInviteError } = await supabase
    .from("design_professional_job_invites")
    .update(updatePayload)
    .eq("resend_message_id", messageId)
    .select("id");

  if (designInviteError) {
    console.error("Failed updating design_professional_job_invites from webhook:", designInviteError);
    return new Response(JSON.stringify({ error: designInviteError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...responseCorsHeaders },
    });
  }

  const { data: rfpInviteData, error: rfpInviteError } = await supabase
    .from("rfp_invited_vendors")
    .update({
      email_status: updatePayload.email_status,
      email_delivered_at: updatePayload.email_delivered_at,
      email_opened_at: updatePayload.email_opened_at,
      email_bounced_at: updatePayload.email_bounced_at,
    })
    .eq("resend_message_id", messageId)
    .select("id");

  if (rfpInviteError) {
    console.error("Failed updating rfp_invited_vendors from webhook:", rfpInviteError);
    return new Response(JSON.stringify({ error: rfpInviteError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...responseCorsHeaders },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      eventType,
      messageId,
      matchedInvitations: data?.length || 0,
      matchedDesignProfessionalInvites: designInviteData?.length || 0,
      matchedRfpInvites: rfpInviteData?.length || 0,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...responseCorsHeaders },
    },
  );
});
