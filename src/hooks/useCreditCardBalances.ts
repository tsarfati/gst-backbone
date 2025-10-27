import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CardBalance {
  cardId: string;
  balance: number;
}

/**
 * Fetches computed balances for all credit cards in a company.
 * Balance = sum(transactions) - sum(payments via journal entries)
 */
export function useCreditCardBalances(companyId?: string) {
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    if (!companyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // 1. Get all credit cards with their liability accounts
      const { data: cards, error: cardsError } = await supabase
        .from("credit_cards")
        .select("id, liability_account_id")
        .eq("company_id", companyId);
      
      if (cardsError) throw cardsError;
      if (!cards || cards.length === 0) {
        setBalances(new Map());
        return;
      }

      const cardIds = cards.map(c => c.id);
      const liabilityAccountIds = cards
        .map(c => c.liability_account_id)
        .filter(id => id != null);

      // 2. Get sum of transactions per card
      const { data: transactions, error: txErr } = await supabase
        .from("credit_card_transactions")
        .select("credit_card_id, amount, transaction_type")
        .in("credit_card_id", cardIds);
      
      if (txErr) throw txErr;

      const transactionTotals = new Map<string, number>();
      (transactions || [])
        .filter((tx: any) => tx.transaction_type !== 'payment')
        .forEach((tx: any) => {
          const current = transactionTotals.get(tx.credit_card_id) || 0;
          transactionTotals.set(tx.credit_card_id, current + (Number(tx.amount) || 0));
        });

      // 3. Get sum of payments (debits to liability accounts)
      const { data: payments, error: payErr } = await supabase
        .from("journal_entry_lines")
        .select("account_id, debit_amount")
        .in("account_id", liabilityAccountIds);
      
      if (payErr) throw payErr;

      // Map liability account to card
      const accountToCard = new Map<string, string>();
      cards.forEach(card => {
        if (card.liability_account_id) {
          accountToCard.set(card.liability_account_id, card.id);
        }
      });

      const paymentTotals = new Map<string, number>();
      (payments || []).forEach((p: any) => {
        const cardId = accountToCard.get(p.account_id);
        if (cardId) {
          const current = paymentTotals.get(cardId) || 0;
          paymentTotals.set(cardId, current + (Number(p.debit_amount) || 0));
        }
      });

      // 4. Compute final balances
      const balanceMap = new Map<string, number>();
      cardIds.forEach(cardId => {
        const txTotal = transactionTotals.get(cardId) || 0;
        const payTotal = paymentTotals.get(cardId) || 0;
        balanceMap.set(cardId, txTotal - payTotal);
      });

      setBalances(balanceMap);
    } catch (e: any) {
      setError(e.message || "Failed to compute balances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return { balances, loading, error, refresh: fetchBalances };
}
