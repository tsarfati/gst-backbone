import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { CurrencyInput } from "@/components/ui/currency-input";

interface Payment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  memo?: string;
  check_number?: string;
  bank_fee?: number;
  vendor_id: string;
  bank_account_id: string;
  journal_entry_id?: string;
  vendor?: {
    id: string;
    name: string;
  };
  bank_account?: {
    id: string;
    account_name: string;
  };
}

export default function PaymentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (id && currentCompany) {
      loadPayment();
    }
  }, [id, currentCompany]);

  const loadPayment = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          vendor:vendors(id, name),
          bank_account:bank_accounts(id, account_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setPayment(data as any);
    } catch (error: any) {
      console.error("Error loading payment:", error);
      toast({
        title: "Error",
        description: "Failed to load payment details",
        variant: "destructive",
      });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!payment || !currentCompany) return;

    try {
      setSaving(true);

      // Update payment record
      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          payment_date: payment.payment_date,
          amount: payment.amount,
          memo: payment.memo || null,
          check_number: payment.check_number || null,
          bank_fee: payment.bank_fee || 0,
        })
        .eq("id", payment.id);

      if (paymentError) throw paymentError;

      // If there's a journal entry, update it
      if (payment.journal_entry_id) {
        const total = Number(payment.amount) + Number(payment.bank_fee || 0);
        
        const { error: jeError } = await supabase
          .from("journal_entries")
          .update({
            entry_date: payment.payment_date,
            total_debit: total,
            total_credit: total,
          })
          .eq("id", payment.journal_entry_id);

        if (jeError) throw jeError;

        // Update journal entry lines for payment amount
        const { data: jeLines } = await supabase
          .from("journal_entry_lines")
          .select("*")
          .eq("journal_entry_id", payment.journal_entry_id)
          .order("line_order");

        if (jeLines && jeLines.length >= 2) {
          // Update main payment lines (AP debit and cash credit)
          await supabase
            .from("journal_entry_lines")
            .update({ debit_amount: payment.amount })
            .eq("id", jeLines[0].id);

          await supabase
            .from("journal_entry_lines")
            .update({ credit_amount: payment.amount })
            .eq("id", jeLines[1].id);

          // Update bank fee lines if they exist
          if (jeLines.length >= 4 && payment.bank_fee && payment.bank_fee > 0) {
            await supabase
              .from("journal_entry_lines")
              .update({ debit_amount: payment.bank_fee })
              .eq("id", jeLines[2].id);

            await supabase
              .from("journal_entry_lines")
              .update({ credit_amount: payment.bank_fee })
              .eq("id", jeLines[3].id);
          }
        }
      }

      toast({
        title: "Success",
        description: "Payment updated successfully",
      });

      navigate(`/payables/payments/${payment.id}`);
    } catch (error: any) {
      console.error("Error updating payment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update payment",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground">Payment not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Payment {payment.payment_number}</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input
                value={payment.vendor?.name || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Bank Account</Label>
              <Input
                value={payment.bank_account?.account_name || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Input
                value={payment.payment_method}
                disabled
                className="bg-muted capitalize"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={payment.payment_date}
                onChange={(e) =>
                  setPayment({ ...payment, payment_date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount</Label>
              <CurrencyInput
                id="amount"
                value={payment.amount}
                onChange={(value) =>
                  setPayment({ ...payment, amount: parseFloat(value) || 0 })
                }
              />
            </div>

            {(payment.payment_method === 'check' || payment.payment_method === 'CHECK') && (
              <div className="space-y-2">
                <Label htmlFor="check_number">Check Number</Label>
                <Input
                  id="check_number"
                  value={payment.check_number || ""}
                  onChange={(e) =>
                    setPayment({ ...payment, check_number: e.target.value })
                  }
                />
              </div>
            )}

            {(payment.payment_method === 'wire' || payment.payment_method === 'ach' || 
              payment.payment_method === 'WIRE' || payment.payment_method === 'ACH') && (
              <div className="space-y-2">
                <Label htmlFor="bank_fee">Bank Fee (Optional)</Label>
                <CurrencyInput
                  id="bank_fee"
                  value={payment.bank_fee || 0}
                  onChange={(value) =>
                    setPayment({ ...payment, bank_fee: parseFloat(value) || 0 })
                  }
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="memo">Memo (Optional)</Label>
            <Textarea
              id="memo"
              value={payment.memo || ""}
              onChange={(e) =>
                setPayment({ ...payment, memo: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
