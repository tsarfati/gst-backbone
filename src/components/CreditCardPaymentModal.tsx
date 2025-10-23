import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/ui/currency-input";

interface CreditCardPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCardId: string;
  onPaymentComplete: () => void;
}

export function CreditCardPaymentModal({ 
  open, 
  onOpenChange, 
  creditCardId,
  onPaymentComplete 
}: CreditCardPaymentModalProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [creditCard, setCreditCard] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [paymentFromAccount, setPaymentFromAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    if (open && creditCardId && currentCompany) {
      fetchData();
    }
  }, [open, creditCardId, currentCompany]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: cardData, error: cardError } = await supabase
        .from("credit_cards")
        .select(`
          *,
          liability_account:liability_account_id(
            id,
            account_name,
            account_number
          )
        `)
        .eq("id", creditCardId)
        .eq("company_id", currentCompany?.id)
        .single();

      if (cardError) throw cardError;
      setCreditCard(cardData);

      const { data: bankData, error: bankError } = await supabase
        .from("bank_accounts")
        .select(`
          id,
          account_name,
          bank_name,
          current_balance,
          chart_account:chart_account_id(
            id,
            account_name,
            account_number
          )
        `)
        .eq("company_id", currentCompany?.id)
        .eq("is_active", true)
        .order("account_name");

      if (bankError) throw bankError;
      setBankAccounts(bankData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!paymentFromAccount || !amount || !paymentDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!creditCard?.liability_account_id) {
      toast({
        title: "Error",
        description: "Credit card does not have a liability account configured",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const paymentAmount = parseFloat(amount);
      
      const selectedBankAccount = bankAccounts.find(ba => ba.id === paymentFromAccount);
      if (!selectedBankAccount?.chart_account?.id) {
        throw new Error("Selected bank account does not have a chart account configured");
      }

      let attachmentUrl = null;
      if (attachmentFile) {
        const fileExt = attachmentFile.name.split('.').pop();
        const fileName = `${currentCompany?.id}/credit-card-payments/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("credit-card-attachments")
          .upload(fileName, attachmentFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("credit-card-attachments")
          .getPublicUrl(fileName);
        
        attachmentUrl = publicUrl;
      }

      const { data: journalEntry, error: jeError } = await supabase
        .from("journal_entries")
        .insert({
          company_id: currentCompany?.id,
          entry_date: paymentDate,
          description: `Credit Card Payment - ${creditCard.card_name}${attachmentUrl ? ' (Receipt attached)' : ''}`,
          reference: `CC Payment - ${creditCard.card_number_last_four}`,
          created_by: user?.id,
          status: "posted",
        })
        .select()
        .single();

      if (jeError) throw jeError;

      const lines = [
        {
          journal_entry_id: journalEntry.id,
          account_id: creditCard.liability_account_id,
          debit: paymentAmount,
          credit: 0,
          description: `Payment to ${creditCard.card_name}`,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: selectedBankAccount.chart_account.id,
          debit: 0,
          credit: paymentAmount,
          description: `Payment from ${selectedBankAccount.account_name}`,
        },
      ];

      const { error: linesError } = await supabase
        .from("journal_entry_lines")
        .insert(lines);

      if (linesError) throw linesError;

      const newBalance = Number(creditCard.current_balance || 0) - paymentAmount;
      await supabase
        .from("credit_cards")
        .update({ 
          current_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", creditCardId);

      const newBankBalance = Number(selectedBankAccount.current_balance || 0) - paymentAmount;
      await supabase
        .from("bank_accounts")
        .update({ 
          current_balance: newBankBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentFromAccount);

      toast({
        title: "Success",
        description: `Payment of $${paymentAmount.toLocaleString()} recorded successfully`,
      });

      setPaymentFromAccount("");
      setAmount("");
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setAttachmentFile(null);
      onPaymentComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Make Payment - {creditCard?.card_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Current Balance</span>
              <span className="text-lg font-semibold text-destructive">
                ${Number(creditCard?.current_balance || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Credit Limit</span>
              <span className="text-lg font-semibold">
                ${Number(creditCard?.credit_limit || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Payment From Account *</Label>
              <Select value={paymentFromAccount} onValueChange={setPaymentFromAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name} - {account.bank_name} 
                      (${Number(account.current_balance || 0).toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payment Amount *</Label>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Attachment (Optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                {attachmentFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAttachmentFile(null)}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !paymentFromAccount || !amount || !paymentDate}
              className="flex-1"
            >
              {submitting ? "Processing..." : "Record Payment"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
