import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, DollarSign, Upload, Paperclip } from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";

export default function CreditCardMakePayment() {
  const { id } = useParams();
  const navigate = useNavigate();
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
    if (id && currentCompany) {
      fetchData();
    }
  }, [id, currentCompany]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch credit card with liability account
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
        .eq("id", id)
        .eq("company_id", currentCompany?.id)
        .single();

      if (cardError) throw cardError;
      setCreditCard(cardData);

      // Fetch bank accounts with their chart accounts
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
      
      // Get the selected bank account's chart account
      const selectedBankAccount = bankAccounts.find(ba => ba.id === paymentFromAccount);
      if (!selectedBankAccount?.chart_account?.id) {
        throw new Error("Selected bank account does not have a chart account configured");
      }

      // Upload attachment if provided
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

      // Create journal entry
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

      // Create journal entry lines
      const lines = [
        {
          journal_entry_id: journalEntry.id,
          account_id: creditCard.liability_account_id, // Debit credit card liability
          debit: paymentAmount,
          credit: 0,
          description: `Payment to ${creditCard.card_name}`,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: selectedBankAccount.chart_account.id, // Credit cash account
          debit: 0,
          credit: paymentAmount,
          description: `Payment from ${selectedBankAccount.account_name}`,
        },
      ];

      const { error: linesError } = await supabase
        .from("journal_entry_lines")
        .insert(lines);

      if (linesError) throw linesError;

      // Update credit card balance
      const newBalance = Number(creditCard.current_balance || 0) - paymentAmount;
      await supabase
        .from("credit_cards")
        .update({ 
          current_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      // Update bank account balance
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

      navigate(`/payables/credit-cards/${id}`);
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
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!creditCard) {
    return <div className="flex items-center justify-center h-screen">Credit card not found</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(`/payables/credit-cards/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          Make Payment - {creditCard.card_name}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Current Balance</span>
                <span className="text-lg font-semibold text-destructive">
                  ${Number(creditCard.current_balance || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Credit Limit</span>
                <span className="text-lg font-semibold">
                  ${Number(creditCard.credit_limit || 0).toLocaleString()}
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
                <p className="text-xs text-muted-foreground mt-1">
                  Select the bank account to pay from
                </p>
              </div>

              <div>
                <Label>Payment Amount *</Label>
                <CurrencyInput
                  value={amount}
                  onChange={setAmount}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the payment amount
                </p>
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
                <p className="text-xs text-muted-foreground mt-1">
                  Attach a receipt or confirmation (optional)
                </p>
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
                onClick={() => navigate(`/payables/credit-cards/${id}`)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accounting Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Journal Entry</Label>
              <p className="text-sm">
                A journal entry will be created with the following:
              </p>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted rounded">
                <p className="font-medium text-green-600">Debit</p>
                <p className="mt-1">
                  {creditCard.liability_account?.account_name || "Credit Card Liability"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {creditCard.liability_account?.account_number || "Not configured"}
                </p>
              </div>

              <div className="p-3 bg-muted rounded">
                <p className="font-medium text-red-600">Credit</p>
                <p className="mt-1">
                  {paymentFromAccount 
                    ? bankAccounts.find(ba => ba.id === paymentFromAccount)?.chart_account?.account_name || "Bank Account"
                    : "Select bank account"
                  }
                </p>
                {paymentFromAccount && (
                  <p className="text-xs text-muted-foreground">
                    {bankAccounts.find(ba => ba.id === paymentFromAccount)?.chart_account?.account_number || ""}
                  </p>
                )}
              </div>
            </div>

            {!creditCard.liability_account_id && (
              <div className="p-3 bg-destructive/10 rounded text-sm text-destructive">
                ⚠️ Credit card does not have a liability account configured. Please configure it in settings.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
