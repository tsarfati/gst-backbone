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
              entry_type: "credit_card_transaction",
              status: "posted",
              created_by: userId,
              reference_number: trans.reference_number,
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
              vendor_id: trans.vendor_id,
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

          // If matched to a bill, mark the bill as paid
          if (trans.matched_bill_id) {
            const { error: billError } = await (supabase as any)
              .from("bills")
              .update({ 
                status: "paid",
                payment_date: trans.transaction_date,
                payment_method: "Credit Card"
              })
              .eq("id", trans.matched_bill_id);

            if (billError) {
              console.error("Failed to update bill status:", billError);
              // Don't throw - transaction was posted successfully
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
