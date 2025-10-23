import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OverdueBill {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  vendor_name: string;
  company_name: string;
  company_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking for overdue bills...");

    // Get all overdue bills (due date before today, not yet paid)
    const today = new Date().toISOString().split('T')[0];
    
    const { data: overdueBills, error: billsError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        amount,
        due_date,
        vendors!inner (
          name,
          company_id,
          companies!inner (
            name
          )
        )
      `)
      .lt("due_date", today)
      .in("status", ["pending", "pending_payment"])
      .order("due_date", { ascending: true });

    if (billsError) {
      console.error("Error fetching overdue bills:", billsError);
      throw billsError;
    }

    console.log(`Found ${overdueBills?.length || 0} overdue bills`);

    if (!overdueBills || overdueBills.length === 0) {
      return new Response(
        JSON.stringify({ message: "No overdue bills found", count: 0 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Group bills by company
    const billsByCompany = new Map<string, OverdueBill[]>();
    
    overdueBills.forEach((bill: any) => {
      const companyId = bill.vendors?.company_id;
      const companyName = bill.vendors?.companies?.name;
      
      if (!companyId || !companyName) return;
      
      if (!billsByCompany.has(companyId)) {
        billsByCompany.set(companyId, []);
      }
      
      billsByCompany.get(companyId)?.push({
        id: bill.id,
        invoice_number: bill.invoice_number,
        amount: bill.amount,
        due_date: bill.due_date,
        vendor_name: bill.vendors?.name || 'Unknown',
        company_name: companyName,
        company_id: companyId,
      });
    });

    console.log(`Grouped bills into ${billsByCompany.size} companies`);

    // For each company, get admin/controller users and send them an email
    const emailsSent: string[] = [];
    
    for (const [companyId, bills] of billsByCompany.entries()) {
      // Get company admins and controllers
      const { data: companyUsers, error: usersError } = await supabase
        .from("user_company_access")
        .select(`
          user_id,
          profiles!inner (
            user_id,
            email,
            first_name,
            last_name
          )
        `)
        .eq("company_id", companyId)
        .eq("is_active", true)
        .in("role", ["admin", "controller"]);

      if (usersError) {
        console.error(`Error fetching users for company ${companyId}:`, usersError);
        continue;
      }

      if (!companyUsers || companyUsers.length === 0) {
        console.log(`No admin/controller users found for company ${companyId}`);
        continue;
      }

      // Calculate total overdue amount
      const totalOverdue = bills.reduce((sum, bill) => sum + Number(bill.amount), 0);
      
      // Get unique emails
      const uniqueEmails = Array.from(
        new Set(
          companyUsers
            .map((u: any) => u.profiles?.email)
            .filter(Boolean)
        )
      );

      console.log(`Sending notification to ${uniqueEmails.length} users for company ${companyId}`);

      // Create HTML email content
      const billsListHtml = bills
        .map(bill => {
          const daysOverdue = Math.floor(
            (new Date().getTime() - new Date(bill.due_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          return `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${bill.invoice_number}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${bill.vendor_name}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">$${Number(bill.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${new Date(bill.due_date).toLocaleDateString()}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-weight: 600;">${daysOverdue} days</td>
            </tr>
          `;
        })
        .join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">⚠️ Overdue Bills Alert</h1>
            </div>
            
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                You have <strong>${bills.length} overdue bill${bills.length !== 1 ? 's' : ''}</strong> totaling 
                <strong style="color: #dc2626;">$${totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> 
                for ${bills[0].company_name}.
              </p>
              
              <table style="width: 100%; background-color: white; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Invoice #</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Vendor</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Amount</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Due Date</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Days Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  ${billsListHtml}
                </tbody>
              </table>
              
              <div style="margin-top: 30px; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0; color: #92400e;">
                  <strong>Action Required:</strong> Please review and process these overdue payments as soon as possible to maintain good vendor relationships and avoid late fees.
                </p>
              </div>
              
              <div style="margin-top: 20px; text-align: center;">
                <p style="color: #6b7280; font-size: 14px;">
                  This is an automated daily notification for overdue bills.
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      // Send email to all admins/controllers
      for (const email of uniqueEmails) {
        try {
          const { data: emailData, error: emailError } = await resend.emails.send({
            from: "System Notifications <system@greenstarteam.com>",
            to: [email],
            subject: `⚠️ ${bills.length} Overdue Bill${bills.length !== 1 ? 's' : ''} - Action Required`,
            html: htmlContent,
          });

          if (emailError) {
            console.error(`Failed to send email to ${email}:`, emailError);
            
            // Log failed email
            await supabase.from("email_history").insert({
              company_id: companyId,
              recipient_email: email,
              subject: `⚠️ ${bills.length} Overdue Bill${bills.length !== 1 ? 's' : ''} - Action Required`,
              email_type: "overdue_bills",
              status: "failed",
              error_message: emailError.message,
              metadata: { bill_count: bills.length, bills: bills.map(b => b.id) },
            });
          } else {
            emailsSent.push(email);
            console.log(`Email sent successfully to ${email}`);
            
            // Log successful email
            await supabase.from("email_history").insert({
              company_id: companyId,
              recipient_email: email,
              subject: `⚠️ ${bills.length} Overdue Bill${bills.length !== 1 ? 's' : ''} - Action Required`,
              email_type: "overdue_bills",
              status: "sent",
              metadata: { 
                bill_count: bills.length, 
                bills: bills.map(b => b.id),
                resend_id: emailData?.id
              },
            });
          }
        } catch (emailErr) {
          console.error(`Exception sending email to ${email}:`, emailErr);
        }
      }
    }

    console.log(`Notification process complete. Emails sent: ${emailsSent.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        overdueCount: overdueBills.length,
        companiesNotified: billsByCompany.size,
        emailsSent: emailsSent.length,
        recipients: emailsSent,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-overdue-bill-notifications:", error);
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
