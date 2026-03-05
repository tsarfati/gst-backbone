import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendBidEmailRequest {
  bidId: string;
  toEmail?: string;
  subject: string;
  body: string;
}

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const inboundDomain = Deno.env.get("BID_EMAIL_INBOUND_DOMAIN") || "inbound.builderlynk.com";

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
    const { bidId, toEmail, subject, body }: SendBidEmailRequest = await req.json();
    if (!bidId || !subject?.trim() || !body?.trim()) {
      return new Response(JSON.stringify({ error: "bidId, subject and body are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: bidRow, error: bidError } = await supabase
      .from("bids")
      .select("id, company_id, vendor_id, rfp:rfps(rfp_number, title), vendor:vendors(name, email)")
      .eq("id", bidId)
      .single();
    if (bidError || !bidRow) throw bidError || new Error("Bid not found");

    const resolvedToEmail = (toEmail || (bidRow as any)?.vendor?.email || "").trim().toLowerCase();
    if (!resolvedToEmail) {
      return new Response(JSON.stringify({ error: "Vendor email is required for outbound bid email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: access } = await supabase
      .from("user_company_access")
      .select("role, is_active")
      .eq("user_id", userId)
      .eq("company_id", (bidRow as any).company_id)
      .maybeSingle();
    const role = String((access as any)?.role || "");
    if (!access || access.is_active === false || role === "vendor" || role === "design_professional") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let { data: channel } = await supabase
      .from("bid_email_channels")
      .select("id, tracking_local_part, tracking_email")
      .eq("bid_id", bidId)
      .maybeSingle();

    if (!channel) {
      const localPart = `bid-${bidId.slice(0, 8)}-${randomSuffix()}`;
      const trackingEmail = `${localPart}@${inboundDomain}`.toLowerCase();
      const { data: inserted, error: insertError } = await supabase
        .from("bid_email_channels")
        .insert({
          bid_id: bidId,
          company_id: (bidRow as any).company_id,
          vendor_id: (bidRow as any).vendor_id,
          tracking_local_part: localPart,
          tracking_email: trackingEmail,
          created_by: userId,
        })
        .select("id, tracking_local_part, tracking_email")
        .single();
      if (insertError) throw insertError;
      channel = inserted;
    }

    const rfpNumber = (bidRow as any)?.rfp?.rfp_number || "RFP";
    const rfpTitle = (bidRow as any)?.rfp?.title || "Bid";
    const vendorName = (bidRow as any)?.vendor?.name || "Vendor";
    const taggedSubject = subject.includes(rfpNumber) ? subject : `[${rfpNumber}] ${subject}`;

    const sendResult = await resend.emails.send({
      from: "BuilderLYNK <noreply@builderlynk.com>",
      to: [resolvedToEmail],
      subject: taggedSubject,
      reply_to: channel.tracking_email,
      text: body,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
          <p>${body.replace(/\n/g, "<br/>")}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
          <p style="font-size:12px;color:#6b7280;">
            Bid context: ${rfpNumber} - ${rfpTitle}<br/>
            Vendor: ${vendorName}<br/>
            Reply tracking: ${channel.tracking_email}
          </p>
        </div>
      `,
    });

    await supabase.from("bid_email_messages").insert({
      bid_id: bidId,
      company_id: (bidRow as any).company_id,
      vendor_id: (bidRow as any).vendor_id,
      direction: "outbound",
      from_email: "noreply@builderlynk.com",
      to_emails: [resolvedToEmail],
      subject: taggedSubject,
      body_text: body,
      body_html: null,
      provider_message_id: (sendResult as any)?.data?.id || null,
      provider_thread_id: null,
      message_source: "email",
      sent_by_user_id: userId,
    });

    await supabase.from("bid_communications" as any).insert({
      bid_id: bidId,
      company_id: (bidRow as any).company_id,
      vendor_id: (bidRow as any).vendor_id,
      user_id: userId,
      message_type: "vendor",
      message: `Email sent to ${resolvedToEmail}\nSubject: ${taggedSubject}\n\n${body}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        trackingEmail: channel.tracking_email,
        messageId: (sendResult as any)?.data?.id || null,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("send-bid-email error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
