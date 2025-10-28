import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Calculator, Edit } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface PaymentDetails {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  status: string;
  memo?: string;
  check_number?: string;
  reference?: string;
  created_at: string;
  created_by: string;
  vendor?: {
    id: string;
    name: string;
  };
  bank_account?: {
    id: string;
    account_name: string;
  };
  credit_card?: {
    id: string;
    card_name: string;
    company_id: string;
  };
  created_by_user?: {
    first_name: string;
    last_name: string;
  };
  reconciliation?: {
    reconciled_at: string;
    reconciled_by_user?: {
      first_name: string;
      last_name: string;
    };
  };
  journal_entry?: {
    id: string;
    entry_date: string;
    description: string;
    total_debit: number;
    total_credit: number;
    lines: Array<{
      id: string;
      debit_amount: number;
      credit_amount: number;
      description: string;
      line_order: number;
      account: {
        account_number: string;
        account_name: string;
      };
    }>;
  };
  invoices: Array<{
    id: string;
    invoice_number: string;
    amount: number;
    payment_amount: number;
  }>;
}

export default function PaymentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && currentCompany) {
      loadPaymentDetails();
    }
  }, [id, currentCompany]);

  const loadPaymentDetails = async () => {
    try {
      setLoading(true);

      // Fetch payment with vendor, bank account, and created by user
      const { data: paymentData, error: paymentError } = await (supabase
        .from("payments") as any)
        .select(`
          *,
          vendor:vendors(id, name, company_id),
          bank_account:bank_accounts(id, account_name)
        `)
        .eq("id", id)
        .maybeSingle();

      console.log('Payment query result:', { paymentData, paymentError, id });

      if (paymentError) throw paymentError;
      let paymentDataAny: any = paymentData;

      if (!paymentDataAny) {
        // Fallback: allow navigating by payment number (legacy links)
        const { data: byNumber } = await (supabase
          .from("payments") as any)
          .select(`
            *,
            vendor:vendors(id, name, company_id),
            bank_account:bank_accounts(id, account_name)
          `)
          .eq("payment_number", id)
          .maybeSingle();
        paymentDataAny = byNumber;
      }

      if (!paymentDataAny) {
        toast.error("Payment not found");
        setLoading(false);
        return;
      }

      // Fetch credit card if credit_card_id exists
      let creditCard = null;
      if (paymentDataAny.credit_card_id) {
        const { data: ccData } = await supabase
          .from("credit_cards")
          .select("id, card_name, company_id")
          .eq("id", paymentDataAny.credit_card_id)
          .maybeSingle();
        creditCard = ccData;
      }

      // Access guard: ensure payment belongs to current company via vendor or credit card
      const paymentCompanyId = paymentDataAny.vendor?.company_id || creditCard?.company_id;
      if (currentCompany?.id && paymentCompanyId && paymentCompanyId !== currentCompany.id) {
        toast.error("Payment not found");
        setLoading(false);
        return;
      }

      // Fetch created by user
      let createdByUser = null;
      if (paymentDataAny.created_by) {
        const { data: userData } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", paymentDataAny.created_by)
          .maybeSingle();
        createdByUser = userData;
      }

      // Fetch associated invoices
      const { data: invoiceLines, error: invoiceError } = await supabase
        .from("payment_invoice_lines")
        .select(`
          amount_paid,
          invoice:invoices(
            id,
            invoice_number,
            amount
          )
        `)
        .eq("payment_id", id);

      if (invoiceError) throw invoiceError;

      // Fetch reconciliation info (regardless of stored status)
      let reconciliationInfo = null;
      {
        const { data: reconData } = await supabase
          .from("bank_reconciliation_items")
          .select(`
            cleared_at,
            bank_reconciliations!inner(
              reconciled_at,
              reconciled_by,
              status
            )
          `)
          .eq("transaction_id", id)
          .eq("transaction_type", "payment")
          .maybeSingle();

        if (reconData) {
          let reconciledByUser = null;
          if (reconData.bank_reconciliations.reconciled_by) {
            const { data: reconUserData } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("user_id", reconData.bank_reconciliations.reconciled_by)
              .maybeSingle();
            reconciledByUser = reconUserData;
          }
          reconciliationInfo = {
            reconciled_at: reconData.bank_reconciliations.reconciled_at,
            reconciled_by_user: reconciledByUser,
          };
        }
      }

      // Ensure journal entry exists for GL if missing
      if (!paymentDataAny.journal_entry_id && paymentDataAny.bank_account_id && currentCompany?.id) {
        try {
          // Resolve cash (bank) account and bank fee account
          let cashAccountId: string | null = null;
          let bankFeeAccountId: string | null = null;
          const { data: bank } = await supabase
            .from('bank_accounts')
            .select('chart_account_id, bank_fee_account_id')
            .eq('id', paymentDataAny.bank_account_id)
            .maybeSingle();
          cashAccountId = (bank as any)?.chart_account_id || null;
          bankFeeAccountId = (bank as any)?.bank_fee_account_id || null;

          // Resolve Accounts Payable account
          const { data: apAcct } = await (supabase
            .from('chart_of_accounts') as any)
            .select('id')
            .eq('company_id', currentCompany.id)
            .or('account_category.eq.accounts_payable,account_number.eq.2000')
            .order('is_system_account', { ascending: false })
            .limit(1)
            .maybeSingle();
          const apAccountId = (apAcct as any)?.id || null;

          if (cashAccountId && apAccountId) {
            const total = Number(paymentDataAny.amount || 0) + Number(paymentDataAny.bank_fee || 0);
            const { data: je } = await (supabase
              .from('journal_entries') as any)
              .insert({
                description: `Payment ${paymentDataAny.payment_number}`,
                entry_date: paymentDataAny.payment_date,
                reference: paymentDataAny.payment_number,
                total_debit: total,
                total_credit: total,
                created_by: paymentDataAny.created_by,
                status: 'posted',
                company_id: currentCompany.id,
              })
              .select('id')
              .single();

            if (je?.id) {
              const lines: any[] = [
                {
                  journal_entry_id: je.id,
                  account_id: apAccountId,
                  debit_amount: paymentDataAny.amount,
                  credit_amount: 0,
                  description: 'Payment to vendor',
                  line_order: 1,
                },
                {
                  journal_entry_id: je.id,
                  account_id: cashAccountId,
                  debit_amount: 0,
                  credit_amount: paymentDataAny.amount,
                  description: 'Cash payment',
                  line_order: 2,
                },
              ];

              if ((paymentDataAny.bank_fee || 0) > 0 && bankFeeAccountId) {
                lines.push(
                  {
                    journal_entry_id: je.id,
                    account_id: bankFeeAccountId,
                    debit_amount: paymentDataAny.bank_fee,
                    credit_amount: 0,
                    description: `Bank fee (${paymentDataAny.payment_method})`,
                    line_order: 3,
                  },
                  {
                    journal_entry_id: je.id,
                    account_id: cashAccountId,
                    debit_amount: 0,
                    credit_amount: paymentDataAny.bank_fee,
                    description: 'Bank fee deducted',
                    line_order: 4,
                  }
                );
              }

              await supabase.from('journal_entry_lines').insert(lines).select('id');
              await supabase.from('payments').update({ journal_entry_id: je.id }).eq('id', paymentDataAny.id);
              paymentDataAny.journal_entry_id = je.id;
            }
          }
        } catch (e) {
          console.warn('Payment loaded but journal entry missing and could not be backfilled:', e);
        }
      }

      // Fetch journal entry if exists
      let journalEntry = null;
      if (paymentDataAny.journal_entry_id) {
        const { data: jeData, error: jeError } = await supabase
          .from("journal_entries")
          .select(`
            *,
            lines:journal_entry_lines(
              id,
              debit_amount,
              credit_amount,
              description,
              line_order,
              account:chart_of_accounts(
                account_number,
                account_name
              )
            )
          `)
          .eq("id", paymentDataAny.journal_entry_id)
          .maybeSingle();

        if (!jeError && jeData) {
          journalEntry = jeData;
          // Sort lines by line_order
          journalEntry.lines.sort((a: any, b: any) => a.line_order - b.line_order);
        }
      }

      const computedStatus = reconciliationInfo ? 'cleared' : 'paid';

      setPayment({
        ...paymentDataAny,
        status: computedStatus,
        created_by_user: createdByUser,
        credit_card: creditCard,
        reconciliation: reconciliationInfo,
        journal_entry: journalEntry,
        invoices: invoiceLines?.map((line: any) => ({
          id: line.invoice.id,
          invoice_number: line.invoice.invoice_number,
          amount: line.invoice.amount,
          payment_amount: line.amount_paid,
        })) || [],
      });
    } catch (error: any) {
      console.error("Error loading payment details:", error);
      toast.error("Failed to load payment details");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "success" | "warning"> = {
      pending: "warning",
      cleared: "success",
      voided: "default",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Payment not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Payment {payment.payment_number}</h1>
            <p className="text-muted-foreground">
              {format(new Date(payment.payment_date), "MMMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(payment.status)}
          {payment.status !== 'cleared' && (
            <Button onClick={() => navigate(`/payables/payments/${payment.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Payment Number</p>
                <p className="font-medium">{payment.payment_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-medium text-lg">
                  ${payment.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="font-medium capitalize">{payment.payment_method}</p>
              </div>
              {payment.check_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Check Number</p>
                  <p className="font-medium">{payment.check_number}</p>
                </div>
              )}
              {payment.vendor && (
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium">{payment.vendor.name}</p>
                </div>
              )}
              {payment.credit_card && (
                <div>
                  <p className="text-sm text-muted-foreground">Credit Card</p>
                  <p className="font-medium">{payment.credit_card.card_name}</p>
                </div>
              )}
              {payment.bank_account && (
                <div>
                  <p className="text-sm text-muted-foreground">Bank Account</p>
                  <p className="font-medium">{payment.bank_account.account_name}</p>
                </div>
              )}
            </div>
            {payment.memo && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Memo</p>
                  <p className="font-medium">{payment.memo}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Associated Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Associated Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payment.invoices.length > 0 ? (
              <div className="space-y-2">
                {payment.invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => navigate(`/bills/${invoice.id}`)}
                  >
                    <div>
                      <p className="font-medium text-primary hover:underline">
                        Invoice #{invoice.invoice_number}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total: ${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        ${invoice.payment_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-muted-foreground">Paid</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No invoices associated</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Journal Entry */}
      {payment.journal_entry && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Journal Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Entry Date</p>
                  <p className="font-medium">
                    {format(new Date(payment.journal_entry.entry_date), "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Description</p>
                  <p className="font-medium">{payment.journal_entry.description}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">
                    ${payment.journal_entry.total_debit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-medium">Account</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-right p-3 font-medium">Debit</th>
                      <th className="text-right p-3 font-medium">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payment.journal_entry.lines.map((line: any) => (
                      <tr key={line.id} className="border-t">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{line.account.account_number}</p>
                            <p className="text-sm text-muted-foreground">{line.account.account_name}</p>
                          </div>
                        </td>
                        <td className="p-3 text-sm">{line.description}</td>
                        <td className="p-3 text-right font-medium">
                          {line.debit_amount > 0
                            ? `$${line.debit_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {line.credit_amount > 0
                            ? `$${line.credit_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted font-medium">
                    <tr>
                      <td colSpan={2} className="p-3 text-right">
                        Totals:
                      </td>
                      <td className="p-3 text-right">
                        ${payment.journal_entry.total_debit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right">
                        ${payment.journal_entry.total_credit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Information */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{format(new Date(payment.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
              {payment.created_by_user && (
                <p className="text-sm text-muted-foreground">
                  by {payment.created_by_user.first_name} {payment.created_by_user.last_name}
                </p>
              )}
            </div>
            {payment.reconciliation && (
              <div>
                <p className="text-muted-foreground">Reconciled</p>
                <p className="font-medium">
                  {format(new Date(payment.reconciliation.reconciled_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
                {payment.reconciliation.reconciled_by_user && (
                  <p className="text-sm text-muted-foreground">
                    by {payment.reconciliation.reconciled_by_user.first_name}{" "}
                    {payment.reconciliation.reconciled_by_user.last_name}
                  </p>
                )}
              </div>
            )}
            {payment.reference && (
              <div>
                <p className="text-muted-foreground">Reference</p>
                <p className="font-medium">{payment.reference}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
