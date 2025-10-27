import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Computes a credit card balance as: sum(transactions.amount) - sum(liability debits tagged as payments)
 * Payments are journal entry lines that DEBIT the card's liability account (reduces liability).
 */
export function useCreditCardBalance(
  creditCardId?: string,
  liabilityAccountId?: string | null
) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canQuery = useMemo(() => !!creditCardId && !!liabilityAccountId, [creditCardId, liabilityAccountId]);

  const fetchBalance = async () => {
    if (!canQuery) return;
    setLoading(true);
    setError(null);
    try {
      // 1) Sum all credit card transactions
      const { data: txns, error: txErr } = await supabase
        .from("credit_card_transactions")
        .select("amount")
        .eq("credit_card_id", creditCardId);
      if (txErr) throw txErr;
      const totalTransactions = (txns || []).reduce((sum, t: any) => sum + (Number(t.amount) || 0), 0);

      // 2) Sum all payments (journal entry lines debiting the liability account)
      const { data: jel, error: jeErr } = await supabase
        .from("journal_entry_lines")
        .select("debit_amount, description, account_id")
        .eq("account_id", liabilityAccountId);
      if (jeErr) throw jeErr;
      // Consider debits as payments; optionally filter to descriptions that start with 'Payment'
      const totalPayments = (jel || [])
        .filter((l: any) => Number(l.debit_amount) > 0)
        .reduce((sum, l: any) => sum + (Number(l.debit_amount) || 0), 0);

      setBalance(totalTransactions - totalPayments);
    } catch (e: any) {
      setError(e.message || "Failed to compute balance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditCardId, liabilityAccountId]);

  return { balance, loading, error, refresh: fetchBalance };
}
