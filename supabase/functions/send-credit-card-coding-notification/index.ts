import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const notificationsFrom = resolveBuilderlynkFrom(
  Deno.env.get("NOTIFICATIONS_EMAIL_FROM"),
  EMAIL_FROM.NOTIFICATIONS,
  "send-credit-card-coding-notification",
);

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

    const { transactionId, userId, userEmail, companyId } = await req.json();

    if (!transactionId || !userId || !userEmail) {
      throw new Error("Missing required parameters");
    }

    // Fetch transaction details
    const { data: transaction, error: txError } = await supabase
      .from("credit_card_transactions")
      .select(`
        *,
        credit_cards(last_four, card_type)
      `)
      .eq("id", transactionId)
      .single();

    if (txError) throw txError;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 20px; border: 1px solid #e5e7eb; }
            .transaction-details { background: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fef3c7; }
            .detail-label { font-weight: 600; color: #92400e; }
            .amount { font-size: 24px; font-weight: bold; color: #f59e0b; }
            .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
            .button:hover { background: #d97706; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💳 Credit Card Transaction Coding Required</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You have been requested to help code the following credit card transaction:</p>
              
              <div class="transaction-details">
                <div class="detail-row">
                  <span class="detail-label">Card:</span>
                  <span>${transaction.credit_cards?.card_type || 'Credit Card'} ending in ${transaction.credit_cards?.last_four || 'XXXX'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Merchant:</span>
                  <span>${transaction.merchant_name || 'Unknown'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span>${new Date(transaction.transaction_date).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Amount:</span>
                  <span class="amount">$${transaction.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                </div>
                ${transaction.description ? `
                <div class="detail-row">
                  <span class="detail-label">Description:</span>
                  <span>${transaction.description}</span>
                </div>
                ` : ''}
              </div>

              <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 3px solid #f59e0b;">
                <strong style="color: #92400e;">Action Required:</strong>
                <p style="margin: 8px 0 0 0; color: #78350f;">
                  Please assign the appropriate cost code and job to this transaction.
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get("SUPABASE_URL")}/credit-cards/transactions/${transactionId}" class="button">
                  Code Transaction
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
      from: notificationsFrom,
      to: [userEmail],
      subject: `Credit Card Transaction Coding Required - ${transaction.merchant_name || 'Transaction'}`,
      html,
    });

    // Log to email history
    if (companyId) {
      await supabase.from("email_history").insert({
        company_id: companyId,
        recipient_email: userEmail,
        subject: `Credit Card Transaction Coding Required - ${transaction.merchant_name || 'Transaction'}`,
        email_type: "credit_card_coding_request",
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }

    console.log("Credit card coding notification sent successfully:", emailResponse);

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
    console.error("Error in send-credit-card-coding-notification function:", error);
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
