import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const inviteFrom = resolveBuilderlynkFrom(
  Deno.env.get("INVITE_EMAIL_FROM") || Deno.env.get("AUTH_EMAIL_FROM"),
  EMAIL_FROM.INVITE,
  "send-vendor-invite",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VendorInviteRequest {
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  companyId: string;
  companyName: string;
  invitedBy: string;
  baseUrl: string;
}

const BUILDERLYNK_EMAIL_LOGO = "https://builderlynk.lovable.app/email-assets/builderlynk-logo.png?v=2";

const escapeHtml = (value: string): string =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { vendorId, vendorName, vendorEmail, companyId, companyName, invitedBy, baseUrl }: VendorInviteRequest = await req.json();

    if (!vendorEmail) {
      return new Response(
        JSON.stringify({ error: "Vendor email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if there's already a pending invitation
    const { data: existingInvite } = await supabase
      .from('vendor_invitations')
      .select('id, status, expires_at')
      .eq('vendor_id', vendorId)
      .eq('email', vendorEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "An active invitation already exists for this vendor" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create the invitation
    const { data: invitation, error: insertError } = await supabase
      .from('vendor_invitations')
      .insert({
        vendor_id: vendorId,
        company_id: companyId,
        email: vendorEmail,
        invited_by: invitedBy,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating invitation:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create the invitation link
    const inviteLink = `${baseUrl}/vendor-register?token=${invitation.token}`;
    const escapedCompanyName = escapeHtml(companyName);
    const escapedVendorName = escapeHtml(vendorName || vendorEmail);

    const { data: companyRow } = await supabase
      .from("companies")
      .select("logo_url")
      .eq("id", companyId)
      .single();

    const companyLogo = companyRow?.logo_url ? escapeHtml(companyRow.logo_url) : null;

    // Send the email
    const emailResponse = await resend.emails.send({
      from: inviteFrom,
      to: [vendorEmail],
      subject: `${companyName} invited you to join BuilderLYNK`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#030B20;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#ffffff;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#030B20;padding:24px 0;">
            <tr>
              <td align="center">
                <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:94%;background:#071231;border:1px solid #1f2a44;border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:22px 20px 8px;text-align:center;">
                      <img src="${BUILDERLYNK_EMAIL_LOGO}" alt="BuilderLYNK" style="display:block;margin:0 auto;height:130px;width:auto;max-width:360px;" />
                    </td>
                  </tr>
                  ${
                    companyLogo
                      ? `
                  <tr>
                    <td style="padding:0 20px 14px;text-align:center;">
                      <img src="${companyLogo}" alt="${escapedCompanyName} logo" style="display:block;margin:0 auto;height:64px;width:auto;max-width:280px;background:#ffffff;border-radius:8px;padding:6px 10px;" />
                    </td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding:0 28px 22px;">
                      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;text-align:center;">You're Invited</h1>
                      <p style="margin:0 0 10px;color:#dbe5ff;font-size:16px;text-align:center;">Hello <strong>${escapedVendorName}</strong>,</p>
                      <p style="margin:0 0 18px;color:#dbe5ff;font-size:16px;line-height:1.6;text-align:center;">
                        <strong style="color:#ffffff;">${escapedCompanyName}</strong> invited you to join BuilderLYNK as a vendor partner.
                        Create your account to submit bids, collaborate, and manage project work.
                      </p>
                      <div style="text-align:center;margin:20px 0 16px;">
                        <a href="${inviteLink}" style="display:inline-block;background-color:#E88A2D;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:8px;">
                          Accept Invitation
                        </a>
                      </div>
                      <p style="margin:0;color:#9fb0d3;font-size:13px;line-height:1.5;text-align:center;">
                        This invitation expires in 7 days. If you weren't expecting this invite, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 28px 22px;">
                      <div style="border-top:1px solid #1f2a44;padding-top:14px;text-align:center;">
                        <p style="margin:0;color:#6f83ad;font-size:12px;">© ${new Date().getFullYear()} BuilderLYNK. All rights reserved.</p>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Vendor invite email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitationId: invitation.id,
        message: "Invitation sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-vendor-invite function:", error);
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
