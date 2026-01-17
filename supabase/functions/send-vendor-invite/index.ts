import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "BuilderLynk <noreply@greenstarteam.com>",
      to: [vendorEmail],
      subject: `You've been invited to join ${companyName} on BuilderLynk`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${vendorName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              <strong>${companyName}</strong> has invited you to create a vendor account on BuilderLynk. 
              This will allow you to submit bids, view projects, and collaborate on construction work.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Create Your Account
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
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