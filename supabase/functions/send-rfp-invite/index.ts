import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const inviteFrom = resolveBuilderlynkFrom(
  Deno.env.get("INVITE_EMAIL_FROM") || Deno.env.get("AUTH_EMAIL_FROM"),
  EMAIL_FROM.INVITE,
  "send-rfp-invite",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RFPInviteRequest {
  rfpId: string;
  rfpTitle: string;
  rfpNumber: string;
  dueDate: string | null;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  companyId: string;
  companyName: string;
  scopeOfWork: string | null;
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const admin =
      supabaseUrl && serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey)
        : null;

    const { 
      rfpId, 
      rfpTitle, 
      rfpNumber,
      dueDate,
      vendorId, 
      vendorName, 
      vendorEmail, 
      companyId, 
      companyName,
      scopeOfWork,
      baseUrl,
    }: RFPInviteRequest = await req.json();

    console.log(`Sending RFP invite to ${vendorEmail} for RFP: ${rfpTitle}`);

    if (!vendorEmail) {
      console.error("Vendor email is required");
      return new Response(
        JSON.stringify({ error: "Vendor email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const dueDateFormatted = dueDate 
      ? new Date(dueDate).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      : 'Not specified';

    const publicBaseUrl = resolvePublicBaseUrl(baseUrl);

    const [vendorInviteResult, profileResult] = await Promise.all([
      admin
        ?.from("vendor_invitations")
        .select("token, status, expires_at")
        .eq("vendor_id", vendorId)
        .eq("email", vendorEmail)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("invited_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        ?.from("profiles")
        .select("user_id, role")
        .eq("vendor_id", vendorId)
        .limit(1)
        .maybeSingle(),
    ]);

    const pendingVendorInvite = vendorInviteResult?.data || null;
    const linkedProfile = profileResult?.data || null;

    let ctaHref = `${publicBaseUrl}/vendor-signup?company=${encodeURIComponent(companyId)}`;
    let ctaLabel = "Create Vendor Account";
    let ctaSecondaryCopy =
      "Create or open your BuilderLYNK vendor account to review this RFP, download the attached plans, and submit your bid.";

    if (pendingVendorInvite?.token) {
      ctaHref = `${publicBaseUrl}/vendor-register?token=${pendingVendorInvite.token}`;
      ctaLabel = "Accept Invitation";
      ctaSecondaryCopy =
        "Use your BuilderLYNK invitation to finish account setup, then review the RFP and submit your bid inside the vendor portal.";
    } else if (linkedProfile?.user_id) {
      const isDesignProfessional = String(linkedProfile.role || "").toLowerCase() === "design_professional";
      ctaHref = `${publicBaseUrl}${isDesignProfessional ? "/design-professional/dashboard" : "/vendor/dashboard"}`;
      ctaLabel = "Open BuilderLYNK";
      ctaSecondaryCopy =
        "Open BuilderLYNK to view this RFP, review the issued files, and submit your bid from your vendor dashboard.";
    }

    const escapedVendorName = escapeHtml(vendorName || vendorEmail);
    const escapedCompanyName = escapeHtml(companyName);
    const escapedRfpTitle = escapeHtml(rfpTitle);
    const escapedRfpNumber = escapeHtml(rfpNumber);
    const escapedDueDate = escapeHtml(dueDateFormatted);
    const escapedScopePreview = escapeHtml(
      scopeOfWork ? `${scopeOfWork.substring(0, 500)}${scopeOfWork.length > 500 ? "..." : ""}` : "",
    );
    const escapedCtaHref = escapeHtml(ctaHref);
    const escapedCtaLabel = escapeHtml(ctaLabel);
    const escapedCtaSecondaryCopy = escapeHtml(ctaSecondaryCopy);

    // Send the email
    const emailResponse = await resend.emails.send({
      from: inviteFrom,
      to: [vendorEmail],
      subject: `Invitation to Bid: ${rfpTitle} - ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Request for Proposal</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Invitation to Bid</p>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${escapedVendorName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              <strong>${escapedCompanyName}</strong> invited you to review and bid the following RFP in BuilderLYNK:
            </p>
            
            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="margin: 0 0 15px 0; color: #1e40af; font-size: 20px;">${escapedRfpTitle}</h2>
              <p style="margin: 5px 0; font-size: 14px;"><strong>RFP Number:</strong> ${escapedRfpNumber}</p>
              <p style="margin: 5px 0; font-size: 14px;"><strong>Due Date:</strong> ${escapedDueDate}</p>
              ${scopeOfWork ? `
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Scope of Work:</p>
                <p style="margin: 0; font-size: 14px; color: #4b5563;">${escapedScopePreview}</p>
              </div>
              ` : ''}
            </div>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${escapedCtaSecondaryCopy}
            </p>

            <div style="text-align:center; margin: 24px 0;">
              <a href="${escapedCtaHref}" style="display:inline-block;background-color:#E88A2D;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px;">
                ${escapedCtaLabel}
              </a>
            </div>

            <p style="font-size: 13px; color: #6b7280; margin-bottom: 20px; text-align:center;">
              Once inside BuilderLYNK, the vendor portal RFPs tab will show the invite, attachments, plan pages, and bid submission workflow.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              BuilderLynk - Construction Management Made Simple
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("RFP invite email sent successfully:", emailResponse);

    const resendMessageId = emailResponse?.data?.id || (emailResponse as any)?.id || null;

    if (admin && rfpId && vendorId) {
      const { error: trackingError } = await admin
        .from("rfp_invited_vendors")
        .update({
          email_status: "sent",
          email_sent_at: new Date().toISOString(),
          email_delivered_at: null,
          email_opened_at: null,
          email_bounced_at: null,
          resend_message_id: resendMessageId,
        })
        .eq("rfp_id", rfpId)
        .eq("vendor_id", vendorId);

      if (trackingError) {
        console.error("Failed updating rfp_invited_vendors email tracking:", trackingError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        resendMessageId,
        message: "Invitation email sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-rfp-invite function:", error);
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
