import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function usePostCreditCardTransactions() {
  const { toast } = useToast();

  const postTransactionsToGL = async (transactionIds: string[], userId: string) => {
    try {
      // Fetch all transactions with their details
      const { data: transactions, error: fetchError } = await supabase
        .from("credit_card_transactions")
        .select(`
          *,
          credit_cards!inner(id, liability_account_id, company_id, card_name),
          cost_codes(id, chart_account_id),
          vendors(id, name)
        `)
        .in("id", transactionIds);

      if (fetchError) throw fetchError;
      if (!transactions || transactions.length === 0) {
        throw new Error("No transactions found");
      }

      const errors: string[] = [];
      const posted: string[] = [];

      for (const trans of transactions) {
        try {
          // Skip if already posted
          if (trans.journal_entry_id) {
            errors.push(`${trans.description}: Already posted to GL`);
            continue;
          }

          // Skip if not coded
          if (trans.coding_status !== 'coded') {
            errors.push(`${trans.description}: Not fully coded`);
            continue;
          }

          // Skip payments - they're handled separately
          if (trans.transaction_type === 'payment') {
            errors.push(`${trans.description}: Payments cannot be posted this way`);
            continue;
          }

          // Get the liability account from credit card
          const liabilityAccountId = trans.credit_cards?.liability_account_id;
          if (!liabilityAccountId) {
            errors.push(`${trans.description}: Credit card has no liability account`);
            continue;
          }

          // Determine the expense account
          let expenseAccountId = trans.chart_account_id;
          
          // If job selected, try to get account from cost code
          if (trans.job_id && trans.cost_code_id && trans.cost_codes?.chart_account_id) {
            expenseAccountId = trans.cost_codes.chart_account_id;
          }

          if (!expenseAccountId) {
            errors.push(`${trans.description}: No expense account assigned`);
            continue;
          }

          const companyId = trans.credit_cards.company_id;
          const amount = Math.abs(Number(trans.amount));

          // Create journal entry
          const { data: journalEntry, error: jeError } = await supabase
            .from("journal_entries")
            .insert({
              company_id: companyId,
              entry_date: trans.transaction_date,
              description: `Credit Card: ${trans.credit_cards.card_name} - ${trans.description}`,
              status: "posted",
              created_by: userId,
              reference: trans.reference_number ?? null,
            })
            .select()
            .single();

          if (jeError) throw jeError;

          // Create journal entry lines
          const lines = [
            {
              journal_entry_id: journalEntry.id,
              account_id: expenseAccountId,
              debit_amount: amount,
              credit_amount: 0,
              description: trans.description || trans.merchant_name,
              job_id: trans.job_id,
              cost_code_id: trans.cost_code_id,
            },
            {
              journal_entry_id: journalEntry.id,
              account_id: liabilityAccountId,
              debit_amount: 0,
              credit_amount: amount,
              description: `${trans.credit_cards.card_name} - ${trans.description || trans.merchant_name}`,
            },
          ];

          const { error: linesError } = await supabase
            .from("journal_entry_lines")
            .insert(lines);

          if (linesError) throw linesError;

          // Link the journal entry back to the transaction
          const { error: updateError } = await supabase
            .from("credit_card_transactions")
            .update({ journal_entry_id: journalEntry.id })
            .eq("id", trans.id);

          if (updateError) throw updateError;

          // If linked to an invoice (matched_bill_id or invoice_id), mark it as paid and create payment record
          const linkedInvoiceId = trans.matched_bill_id || trans.invoice_id;
          if (linkedInvoiceId) {
            // Fetch invoice details to get vendor_id
            const { data: invoice, error: invError } = await supabase
              .from("invoices")
              .select("vendor_id, amount, invoice_number")
              .eq("id", linkedInvoiceId)
              .single();

            if (invError || !invoice) {
              console.error("Failed to fetch invoice:", invError);
            } else {
              // Update invoice status to paid
              const { error: invoiceError } = await supabase
                .from("invoices")
                .update({ status: "paid" })
                .eq("id", linkedInvoiceId);

              if (invoiceError) {
                console.error("Failed to update invoice status:", invoiceError);
              }

              // Create payment record
              const { data: payment, error: paymentError } = await supabase
                .from("payments")
                .insert({
                  amount: Math.abs(Number(trans.amount)),
                  payment_date: trans.transaction_date,
                  payment_method: "card",
                  payment_number: `CC-${trans.credit_cards.card_name}-${trans.transaction_date}`,
                  vendor_id: invoice.vendor_id,
                  journal_entry_id: journalEntry.id,
                  created_by: userId,
                  memo: `Credit Card Payment via ${trans.credit_cards.card_name} - ${trans.description}`,
                  status: "completed",
                  company_id: companyId,
                })
                .select()
                .single();

              if (paymentError) {
                console.error("Failed to create payment record:", paymentError);
              } else if (payment) {
                // Create payment_invoice_line
                const { error: lineError } = await supabase
                  .from("payment_invoice_lines")
                  .insert({
                    payment_id: payment.id,
                    invoice_id: linkedInvoiceId,
                    amount_paid: Math.abs(Number(trans.amount)),
                  });

                if (lineError) {
                  console.error("Failed to create payment line:", lineError);
                }
              }
            }
          }

          posted.push(trans.description || trans.merchant_name || "Transaction");
        } catch (err: any) {
          errors.push(`${trans.description}: ${err.message}`);
        }
      }

      return { posted, errors };
    } catch (error: any) {
      throw error;
    }
  };

  return { postTransactionsToGL };
}
