import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Posts coded credit card transactions to the GL by creating balanced journal entries.
//
// This implementation supports two coding paths:
// 1) Simple: transaction has a single expense account/cost code
// 2) Distributed: one or more rows exist in credit_card_transaction_distributions
//    and each row is posted as a separate debit line (with job/cost code),
//    all balanced against the credit card liability account.
export function usePostCreditCardTransactions() {
  const { toast } = useToast();

  const postTransactionsToGL = async (
    transactionIds: string[],
    userId: string
  ) => {
    try {
      // Fetch all transactions with their details
      const { data: transactions, error: fetchError } = await supabase
        .from("credit_card_transactions")
        .select(`
          *,
          credit_cards!inner(id, liability_account_id, company_id, card_name),
          cost_codes(id, chart_account_id, code),
          vendors(id, name)
        `)
        .in("id", transactionIds);

      if (fetchError) throw fetchError;
      if (!transactions || transactions.length === 0) {
        throw new Error("No transactions found");
      }

      const errors: string[] = [];
      const posted: string[] = [];

      // Preload any distribution lines for the selected transactions so we can
      // post detailed expense splits when they exist
      const { data: distRows, error: distError } = await supabase
        .from("credit_card_transaction_distributions")
        .select(`
          id,
          transaction_id,
          amount,
          job_id,
          cost_code_id,
          cost_codes:cost_code_id(id, code, chart_account_id)
        `)
        .in("transaction_id", transactionIds);

      if (distError) throw distError;

      const distsByTransaction = new Map<string, any[]>();
      (distRows || []).forEach((row: any) => {
        const key = row.transaction_id as string;
        const existing = distsByTransaction.get(key) || [];
        existing.push(row);
        distsByTransaction.set(key, existing);
      });

      type ExpenseLine = {
        journal_entry_id?: string;
        account_id: string;
        debit_amount: number;
        credit_amount: number;
        description: string;
        job_id?: string | null;
        cost_code_id?: string | null;
      };

      for (const trans of transactions as any[]) {
        try {
          const transDescription =
            trans.description || trans.merchant_name || "Transaction";

          // Skip if already posted
          if (trans.journal_entry_id) {
            errors.push(`${transDescription}: Already posted to GL`);
            continue;
          }

          // Skip if not coded
          if (trans.coding_status !== "coded") {
            errors.push(`${transDescription}: Not fully coded`);
            continue;
          }

          // Skip payments - they're handled separately
          if (trans.transaction_type === "payment") {
            errors.push(
              `${transDescription}: Payments cannot be posted this way`
            );
            continue;
          }

          // Get the liability account from credit card
          const liabilityAccountId = trans.credit_cards?.liability_account_id;
          if (!liabilityAccountId) {
            errors.push(
              `${transDescription}: Credit card has no liability account`
            );
            continue;
          }

          const companyId: string = trans.credit_cards.company_id;
          const transDists = distsByTransaction.get(trans.id) || [];

          const expenseLines: ExpenseLine[] = [];
          let totalDebitAmount = 0;

          if (transDists.length > 0) {
            // Distributed path: each distribution row becomes an expense line
            let distributionHasError = false;

            for (const dist of transDists) {
              const lineAmount = Math.abs(Number(dist.amount));
              if (!lineAmount) continue;

              let lineAccountId: string | null | undefined = null;

              // 1) Prefer job-level expense account, if configured
              if (dist.job_id) {
                const { data: jobAccount } = await supabase
                  .from("account_associations")
                  .select("account_id")
                  .eq("job_id", dist.job_id)
                  .eq("company_id", companyId)
                  .eq("association_type", "job_expense")
                  .maybeSingle();

                lineAccountId = jobAccount?.account_id;
              }

              // 2) Fall back to cost code association record if no job expense account
              if (!lineAccountId && dist.cost_code_id) {
                const { data: ccAssoc } = await supabase
                  .from("account_associations")
                  .select("account_id")
                  .eq("cost_code_id", dist.cost_code_id)
                  .eq("company_id", companyId)
                  .maybeSingle();

                if (ccAssoc?.account_id) {
                  lineAccountId = ccAssoc.account_id;
                }
              }

              // 3) Finally fall back to cost code's own account or transaction's account
              if (!lineAccountId) {
                lineAccountId = dist.cost_codes?.chart_account_id || trans.chart_account_id;
              }

              if (!lineAccountId) {
                if (dist.job_id) {
                  errors.push(
                    `${transDescription}: Job has no expense GL account assigned. Please assign a GL account to this job in Account Association settings.`
                  );
                } else if (dist.cost_code_id && !dist.cost_codes?.chart_account_id) {
                  errors.push(
                    `${transDescription}: Cost code "${
                      dist.cost_codes?.code || "selected"
                    }" has no GL account assigned. Please assign a GL account to this cost code in Cost Code settings.`
                  );
                } else {
                  errors.push(
                    `${transDescription}: No GL account for distribution line. Please assign a GL account.`
                  );
                }
                distributionHasError = true;
                break;
              }

              expenseLines.push({
                account_id: lineAccountId,
                debit_amount: lineAmount,
                credit_amount: 0,
                description: transDescription,
                job_id: dist.job_id,
                cost_code_id: dist.cost_code_id,
              });
              totalDebitAmount += lineAmount;
            }

            if (distributionHasError) {
              continue;
            }
          } else {
            // Simple path: single transaction-level coding
            let expenseAccountId: string | null | undefined = null;

            // 1) Prefer job-level expense account, if configured
            if (trans.job_id) {
              const { data: jobAccount } = await supabase
                .from("account_associations")
                .select("account_id")
                .eq("job_id", trans.job_id)
                .eq("company_id", companyId)
                .eq("association_type", "job_expense")
                .maybeSingle();

              expenseAccountId = jobAccount?.account_id;
            }

            // 2) Fall back to cost code association record if no job expense account
            if (!expenseAccountId && trans.cost_code_id) {
              const { data: ccAssoc } = await supabase
                .from("account_associations")
                .select("account_id")
                .eq("cost_code_id", trans.cost_code_id)
                .eq("company_id", companyId)
                .maybeSingle();

              if (ccAssoc?.account_id) {
                expenseAccountId = ccAssoc.account_id;
              }
            }

            // 3) Finally fall back to cost code's account or transaction's chart account
            if (!expenseAccountId) {
              if (trans.cost_code_id && trans.cost_codes?.chart_account_id) {
                expenseAccountId = trans.cost_codes.chart_account_id;
              } else {
                expenseAccountId = trans.chart_account_id;
              }
            }

            if (!expenseAccountId) {
              if (trans.job_id) {
                errors.push(
                  `${transDescription}: Job has no expense GL account assigned. Please assign a GL account to this job in Account Association settings.`
                );
              } else if (trans.cost_code_id && !trans.cost_codes?.chart_account_id) {
                errors.push(
                  `${transDescription}: Cost code "${
                    trans.cost_codes?.code || "selected"
                  }" has no GL account assigned. Please assign a GL account to this cost code in Cost Code settings.`
                );
              } else {
                errors.push(
                  `${transDescription}: No GL account selected. Please select a GL account or assign one to the job.`
                );
              }
              continue;
            }

            const singleAmount = Math.abs(Number(trans.amount));

            expenseLines.push({
              account_id: expenseAccountId,
              debit_amount: singleAmount,
              credit_amount: 0,
              description: transDescription,
              job_id: trans.job_id,
              cost_code_id: trans.cost_code_id,
            });
            totalDebitAmount = singleAmount;
          }

          if (!expenseLines.length || totalDebitAmount <= 0) {
            errors.push(`${transDescription}: No expense lines to post`);
            continue;
          }

          const amount = totalDebitAmount;

          // Create journal entry
          const { data: journalEntry, error: jeError } = await supabase
            .from("journal_entries")
            .insert({
              company_id: companyId,
              entry_date: trans.transaction_date,
              description: `Credit Card: ${trans.credit_cards.card_name} - ${transDescription}`,
              status: "posted",
              created_by: userId,
              reference: trans.reference_number ?? null,
            })
            .select()
            .single();

          if (jeError) throw jeError;

          // Create journal entry lines
          const linesToInsert = [
            ...expenseLines.map((line) => ({
              journal_entry_id: journalEntry.id,
              account_id: line.account_id,
              debit_amount: line.debit_amount,
              credit_amount: line.credit_amount,
              description: line.description,
              job_id: line.job_id ?? null,
              cost_code_id: line.cost_code_id ?? null,
            })),
            {
              journal_entry_id: journalEntry.id,
              account_id: liabilityAccountId,
              debit_amount: 0,
              credit_amount: amount,
              description: `${trans.credit_cards.card_name} - ${transDescription}`,
            },
          ];

          const { error: linesError } = await supabase
            .from("journal_entry_lines")
            .insert(linesToInsert);

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
                console.error(
                  "Failed to update invoice status:",
                  invoiceError
                );
              }

              // Create payment record
              const { data: payment, error: paymentError } = await supabase
                .from("payments")
                .insert({
                  amount: Math.abs(Number(trans.amount)),
                  payment_date: trans.transaction_date,
                  payment_method: "credit_card",
                  payment_number: `CC-${trans.credit_cards.card_name}-${trans.transaction_date}`,
                  vendor_id: invoice.vendor_id,
                  journal_entry_id: journalEntry.id,
                  created_by: userId,
                  memo: `Credit Card Payment via ${trans.credit_cards.card_name} - ${trans.description}`,
                  status: "cleared",
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

          posted.push(transDescription);
        } catch (err: any) {
          const transDescription =
            (trans as any)?.description ||
            (trans as any)?.merchant_name ||
            "Transaction";
          errors.push(`${transDescription}: ${err.message}`);
        }
      }

      return { posted, errors };
    } catch (error: any) {
      throw error;
    }
  };

  return { postTransactionsToGL };
}
