import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TestEmailRequest {
  email: string;
  companyId: string;
  companyName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, companyId, companyName }: TestEmailRequest = await req.json();

    if (!email || !companyId) {
      return new Response(
        JSON.stringify({ error: "Email and company ID are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Sending test email to ${email} for company ${companyName}`);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">✅ Test Email Successful</h1>
          </div>
          
          <div style="background-color: #f9fafb; padding: 40px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 18px; margin-bottom: 20px; color: #10b981; font-weight: 600;">
              🎉 Congratulations! Your email server is configured correctly.
            </p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
              <h2 style="margin-top: 0; font-size: 18px; color: #374151;">Email Configuration Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Company:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 600;">${companyName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Recipient:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 600;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Sent At:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 600;">${new Date().toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Status:</td>
                  <td style="padding: 8px 0; color: #10b981; font-weight: 600;">✓ Delivered Successfully</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;">
                <strong>What's Next?</strong><br>
                Your notification system is ready to send automated emails for overdue bills, payment reminders, and other important updates.
              </p>
            </div>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="margin-top: 0; font-size: 16px; color: #374151;">Active Notifications:</h3>
              <ul style="color: #6b7280; padding-left: 20px; margin-bottom: 0;">
                <li style="margin-bottom: 8px;">📧 Daily overdue bill notifications</li>
                <li style="margin-bottom: 8px;">💳 Credit card payment reminders</li>
                <li style="margin-bottom: 8px;">📝 Receipt coding requests</li>
                <li style="margin-bottom: 8px;">🔔 Job and task assignments</li>
              </ul>
            </div>
            
            <div style="margin-top: 30px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                This is a test email to verify your email configuration.<br>
                You can safely ignore or delete this message.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data, error: emailError } = await resend.emails.send({
      from: "System Notifications <system@builderlynk.com>",
      to: [email],
      subject: "✅ Test Email - Email Server Configuration Successful",
      html: htmlContent,
    });

    if (emailError) {
      console.error("Failed to send test email:", emailError);
      
      // Log failed attempt to database
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase.from("email_history").insert({
        company_id: companyId,
        recipient_email: email,
        subject: "Test Email",
        email_type: "test",
        status: "failed",
        error_message: emailError.message,
        metadata: { error: emailError },
      });

      return new Response(
        JSON.stringify({ error: emailError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Test email sent successfully:", data);

    // Log successful send to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    await supabase.from("email_history").insert({
      company_id: companyId,
      recipient_email: email,
      subject: "Test Email - Email Server Configuration Successful",
      email_type: "test",
      status: "sent",
      metadata: { resend_id: data?.id },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Test email sent successfully",
        emailId: data?.id
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-test-email:", error);
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
