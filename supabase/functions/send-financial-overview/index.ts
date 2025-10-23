import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FinancialOverviewData {
  approvedBillsAwaitingPayment: any[];
  overdueBills: any[];
  outstandingInvoices: any[];
  totalApprovedBills: number;
  totalOverdueBills: number;
  totalOutstandingInvoices: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, userId, userEmail } = await req.json();

    if (!companyId || !userId || !userEmail) {
      throw new Error("Missing required parameters");
    }

    // Fetch approved bills awaiting payment
    const { data: approvedBills, error: approvedError } = await supabase
      .from("invoices")
      .select(`
        *,
        vendors(name),
        jobs(name)
      `)
      .eq("company_id", companyId)
      .eq("status", "pending_payment")
      .order("due_date", { ascending: true });

    if (approvedError) throw approvedError;

    // Fetch overdue bills
    const today = new Date().toISOString().split('T')[0];
    const { data: overdueBills, error: overdueError } = await supabase
      .from("invoices")
      .select(`
        *,
        vendors(name),
        jobs(name)
      `)
      .eq("company_id", companyId)
      .in("status", ["pending_payment", "pending_approval"])
      .lt("due_date", today)
      .order("due_date", { ascending: true });

    if (overdueError) throw overdueError;

    // Fetch outstanding customer invoices (if they exist in your schema)
    const { data: outstandingInvoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(`
        *,
        vendors(name),
        jobs(name)
      `)
      .eq("company_id", companyId)
      .eq("status", "pending_payment")
      .order("issue_date", { ascending: false });

    if (invoicesError) throw invoicesError;

    // Calculate totals
    const totalApprovedBills = approvedBills?.reduce((sum, bill) => sum + (bill.amount || 0), 0) || 0;
    const totalOverdueBills = overdueBills?.reduce((sum, bill) => sum + (bill.amount || 0), 0) || 0;
    const totalOutstandingInvoices = outstandingInvoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

    // Generate HTML email
    const html = generateFinancialOverviewHtml({
      approvedBillsAwaitingPayment: approvedBills || [],
      overdueBills: overdueBills || [],
      outstandingInvoices: outstandingInvoices || [],
      totalApprovedBills,
      totalOverdueBills,
      totalOutstandingInvoices,
    });

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Financial Reports <reports@greenstarteam.com>",
      to: [userEmail],
      subject: `Financial Overview Report - ${new Date().toLocaleDateString()}`,
      html,
    });

    // Log to email history
    await supabase.from("email_history").insert({
      company_id: companyId,
      recipient_email: userEmail,
      subject: `Financial Overview Report - ${new Date().toLocaleDateString()}`,
      email_type: "financial_overview",
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    console.log("Financial overview email sent successfully:", emailResponse);

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
    console.error("Error in send-financial-overview function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateFinancialOverviewHtml(data: FinancialOverviewData): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .section { background: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .summary { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .summary-card { background: white; padding: 15px; border-radius: 8px; flex: 1; margin: 0 10px; border-left: 4px solid #2563eb; }
          .summary-card.warning { border-left-color: #f59e0b; }
          .summary-card.danger { border-left-color: #ef4444; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; background: white; }
          th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; }
          td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          .amount { font-weight: 600; }
          .overdue { color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Financial Overview Report</h1>
            <p>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div class="summary">
            <div class="summary-card">
              <h3>Approved Bills</h3>
              <p class="amount">${formatCurrency(data.totalApprovedBills)}</p>
              <p>${data.approvedBillsAwaitingPayment.length} bills awaiting payment</p>
            </div>
            <div class="summary-card danger">
              <h3>Overdue Bills</h3>
              <p class="amount overdue">${formatCurrency(data.totalOverdueBills)}</p>
              <p>${data.overdueBills.length} overdue bills</p>
            </div>
            <div class="summary-card warning">
              <h3>Outstanding Invoices</h3>
              <p class="amount">${formatCurrency(data.totalOutstandingInvoices)}</p>
              <p>${data.outstandingInvoices.length} customer invoices</p>
            </div>
          </div>

          ${data.overdueBills.length > 0 ? `
          <div class="section">
            <h2>⚠️ Overdue Bills (${data.overdueBills.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Job</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.overdueBills.map(bill => `
                  <tr>
                    <td>${bill.vendors?.name || 'Unknown'}</td>
                    <td>${bill.jobs?.name || 'N/A'}</td>
                    <td class="overdue">${new Date(bill.due_date).toLocaleDateString()}</td>
                    <td class="amount overdue">${formatCurrency(bill.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${data.approvedBillsAwaitingPayment.length > 0 ? `
          <div class="section">
            <h2>📋 Approved Bills Awaiting Payment (${data.approvedBillsAwaitingPayment.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Job</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.approvedBillsAwaitingPayment.map(bill => `
                  <tr>
                    <td>${bill.vendors?.name || 'Unknown'}</td>
                    <td>${bill.jobs?.name || 'N/A'}</td>
                    <td>${new Date(bill.due_date).toLocaleDateString()}</td>
                    <td class="amount">${formatCurrency(bill.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${data.outstandingInvoices.length > 0 ? `
          <div class="section">
            <h2>💰 Outstanding Customer Invoices (${data.outstandingInvoices.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Job</th>
                  <th>Issue Date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.outstandingInvoices.map(inv => `
                  <tr>
                    <td>${inv.vendors?.name || 'Unknown'}</td>
                    <td>${inv.jobs?.name || 'N/A'}</td>
                    <td>${new Date(inv.issue_date).toLocaleDateString()}</td>
                    <td class="amount">${formatCurrency(inv.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div style="margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 8px; text-align: center;">
            <p style="color: #6b7280; margin: 0;">
              This is an automated financial overview report. To update your notification preferences, visit your account settings.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

serve(handler);
