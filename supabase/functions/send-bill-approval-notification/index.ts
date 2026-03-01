import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { billId, userId, userEmail, requestType, companyId } = await req.json();

    if (!billId || !userId || !userEmail || !requestType) {
      throw new Error("Missing required parameters");
    }

    // Fetch bill details
    const { data: bill, error: billError } = await supabase
      .from("invoices")
      .select(`
        *,
        vendors(name),
        jobs(name)
      `)
      .eq("id", billId)
      .single();

    if (billError) throw billError;

    const subject = requestType === 'approval' 
      ? `Bill Approval Required - ${bill.vendors?.name || 'Unknown Vendor'}`
      : `Bill Coding Required - ${bill.vendors?.name || 'Unknown Vendor'}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 20px; border: 1px solid #e5e7eb; }
            .bill-details { background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: 600; color: #6b7280; }
            .amount { font-size: 24px; font-weight: bold; color: #2563eb; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
            .button:hover { background: #1d4ed8; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${requestType === 'approval' ? '✓ Bill Approval Needed' : '📝 Bill Coding Needed'}</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You have been requested to ${requestType === 'approval' ? 'approve' : 'cost code'} the following bill:</p>
              
              <div class="bill-details">
                <div class="detail-row">
                  <span class="detail-label">Vendor:</span>
                  <span>${bill.vendors?.name || 'Unknown'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Job:</span>
                  <span>${bill.jobs?.name || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Invoice Number:</span>
                  <span>${bill.invoice_number || 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Due Date:</span>
                  <span>${new Date(bill.due_date).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount:</span>
                  <span class="amount">$${bill.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                </div>
              </div>

              ${bill.description ? `
              <div style="margin: 20px 0;">
                <strong>Description:</strong>
                <p style="background: #f9fafb; padding: 12px; border-radius: 6px; margin-top: 8px;">${bill.description}</p>
              </div>
              ` : ''}

              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get("SUPABASE_URL")}/bills/${billId}" class="button">
                  ${requestType === 'approval' ? 'Review & Approve Bill' : 'Cost Code Bill'}
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This is an automated notification. To update your notification preferences, visit your account settings.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Bill Notifications <notifications@greenstarteam.com>",
      to: [userEmail],
      subject,
      html,
    });

    // Log to email history
    if (companyId) {
      await supabase.from("email_history").insert({
        company_id: companyId,
        recipient_email: userEmail,
        subject,
        email_type: requestType === 'approval' ? 'bill_approval_request' : 'bill_coding_request',
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }

    console.log("Bill notification email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bill-approval-notification function:", error);
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
