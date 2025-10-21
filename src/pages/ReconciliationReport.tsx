import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReconciliationData {
  id: string;
  beginning_balance: number;
  ending_balance: number;
  beginning_date: string;
  ending_date: string;
  cleared_balance: number;
  bank_statement_id?: string;
  bank_account: {
    account_name: string;
    bank_name: string;
    account_number?: string;
  };
  bank_statement?: {
    file_url: string;
    file_name: string;
  };
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  type: 'deposit' | 'payment';
  is_cleared: boolean;
}

export default function ReconciliationReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get("account");
  const { currentCompany } = useCompany();
  
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null);
  const [clearedDeposits, setClearedDeposits] = useState<Transaction[]>([]);
  const [clearedPayments, setClearedPayments] = useState<Transaction[]>([]);
  const [unclearedDeposits, setUnclearedDeposits] = useState<Transaction[]>([]);
  const [unclearedPayments, setUnclearedPayments] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany && id) {
      loadReconciliationReport();
    }
  }, [currentCompany, id]);

  const loadReconciliationReport = async () => {
    if (!currentCompany || !id) return;
    
    try {
      setLoading(true);
      
      // Load reconciliation with bank account and statement info
      const { data: reconData, error: reconError } = await supabase
        .from("bank_reconciliations")
        .select(`
          *,
          bank_account:bank_accounts(account_name, bank_name, account_number, chart_account_id),
          bank_statement:bank_statements(file_url, file_name)
        `)
        .eq("id", id)
        .eq("company_id", currentCompany.id)
        .single();

      if (reconError) throw reconError;
      setReconciliation(reconData as any);

      // Load reconciliation items
      const { data: items, error: itemsError } = await supabase
        .from("bank_reconciliation_items")
        .select("*")
        .eq("reconciliation_id", id);

      if (itemsError) throw itemsError;

      // Get all cleared transaction IDs
      const clearedPaymentIds = new Set(
        items.filter(i => i.transaction_type === 'payment' && i.is_cleared).map(i => i.transaction_id)
      );
      const clearedDepositIds = new Set(
        items.filter(i => i.transaction_type === 'deposit' && i.is_cleared).map(i => i.transaction_id)
      );

      // Load payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("id, payment_date, payment_number, amount, payment_method")
        .eq("bank_account_id", accountId)
        .lte("payment_date", reconData.ending_date);

      if (paymentsError) throw paymentsError;

      // Load journal entry lines for the cash account if linked
      let journalPaymentsData: any[] = [];
      let journalDepositsData: any[] = [];

      if (reconData.bank_account.chart_account_id) {
        const { data: withdrawals } = await supabase
          .from("journal_entry_lines")
          .select(`
            id,
            credit_amount,
            debit_amount,
            description,
            is_reconciled,
            journal_entries!inner(entry_date, reference, status)
          `)
          .eq("account_id", reconData.bank_account.chart_account_id)
          .eq("journal_entries.status", "posted")
          .lte("journal_entries.entry_date", reconData.ending_date)
          .gt("credit_amount", 0);

        journalPaymentsData = withdrawals || [];

        const { data: deposits } = await supabase
          .from("journal_entry_lines")
          .select(`
            id,
            credit_amount,
            debit_amount,
            description,
            is_reconciled,
            journal_entries!inner(entry_date, reference, status)
          `)
          .eq("account_id", reconData.bank_account.chart_account_id)
          .eq("journal_entries.status", "posted")
          .lte("journal_entries.entry_date", reconData.ending_date)
          .gt("debit_amount", 0);

        journalDepositsData = deposits || [];
      }

      // Format all transactions
      const allPayments: Transaction[] = [
        ...(paymentsData || []).map(p => ({
          id: p.id,
          date: p.payment_date,
          description: `${p.payment_method || 'Payment'} Ref ${p.payment_number || 'No reference'}`,
          reference: p.payment_number || '',
          amount: p.amount,
          type: 'payment' as const,
          is_cleared: clearedPaymentIds.has(p.id)
        })),
        ...journalPaymentsData.map(j => ({
          id: j.id,
          date: j.journal_entries?.entry_date || '',
          description: `Journal Entry - ${j.description || 'Bank withdrawal'}`,
          reference: j.journal_entries?.reference || '',
          amount: j.credit_amount,
          type: 'payment' as const,
          is_cleared: j.is_reconciled || clearedPaymentIds.has(j.id)
        }))
      ];

      const allDeposits: Transaction[] = journalDepositsData.map(j => ({
        id: j.id,
        date: j.journal_entries?.entry_date || '',
        description: `Deposit #${j.description || 'Bank deposit'}`,
        reference: j.journal_entries?.reference || '',
        amount: j.debit_amount,
        type: 'deposit' as const,
        is_cleared: j.is_reconciled || clearedDepositIds.has(j.id)
      }));

      // Separate cleared and uncleared
      setClearedPayments(allPayments.filter(p => p.is_cleared).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setUnclearedPayments(allPayments.filter(p => !p.is_cleared).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setClearedDeposits(allDeposits.filter(d => d.is_cleared).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setUnclearedDeposits(allDeposits.filter(d => !d.is_cleared).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

    } catch (error) {
      console.error("Error loading reconciliation report:", error);
      toast.error("Failed to load reconciliation report");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const clearedDepositsTotal = clearedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const clearedPaymentsTotal = clearedPayments.reduce((sum, p) => sum + p.amount, 0);
  const unclearedDepositsTotal = unclearedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const unclearedPaymentsTotal = unclearedPayments.reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Loading reconciliation report...</p>
      </div>
    );
  }

  if (!reconciliation) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Reconciliation not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto print:p-4">
      <div className="mb-6 print:hidden">
        <Button
          variant="ghost"
          onClick={() => navigate(`/banking/accounts/${accountId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account
        </Button>
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">{currentCompany?.display_name || currentCompany?.name}</h1>
          <h2 className="text-2xl font-semibold mb-4">Reconciliation Report</h2>
          <div className="space-y-1">
            <h3 className="text-xl font-medium">{reconciliation.bank_account.bank_name}</h3>
            <p className="text-muted-foreground">
              Account Name: {reconciliation.bank_account.account_name}
              {reconciliation.bank_account.account_number && ` ***${reconciliation.bank_account.account_number.slice(-4)}`}
            </p>
            <p className="text-muted-foreground">
              Ending Statement Date: {format(new Date(reconciliation.ending_date), 'MM/dd/yyyy')}
            </p>
          </div>
        </div>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    Bank Statement Starting Balance on {format(new Date(reconciliation.beginning_date), 'MM/dd/yyyy')}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(reconciliation.beginning_balance)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Cleared Deposits and other Increases</TableCell>
                  <TableCell className="text-right">{formatCurrency(clearedDepositsTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Cleared Checks and other Decreases</TableCell>
                  <TableCell className="text-right">{formatCurrency(clearedPaymentsTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Cleared ACH Batches and Reversals</TableCell>
                  <TableCell className="text-right">$0.00</TableCell>
                </TableRow>
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell>Cleared Balance</TableCell>
                  <TableCell className="text-right">{formatCurrency(reconciliation.cleared_balance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Attached Bank Statement */}
        {reconciliation.bank_statement && (
          <Card>
            <CardHeader>
              <CardTitle>Attached Bank Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded">
                <span className="font-medium">{reconciliation.bank_statement.file_name}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={reconciliation.bank_statement.file_url} target="_blank" rel="noreferrer">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={reconciliation.bank_statement.file_url} download>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cleared Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Cleared Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Cleared Deposits and other Increases ({clearedDeposits.length} Items)</h3>
              {clearedDeposits.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clearedDeposits.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell>{deposit.description}</TableCell>
                        <TableCell>{format(new Date(deposit.date), 'MM/dd/yyyy')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(deposit.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(clearedDepositsTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">No cleared deposits</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold mb-3">Cleared Checks and other Decreases ({clearedPayments.length} Items)</h3>
              {clearedPayments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clearedPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.description}</TableCell>
                        <TableCell>{format(new Date(payment.date), 'MM/dd/yyyy')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(clearedPaymentsTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">No cleared checks</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Unreconciled Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Unreconciled Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Unreconciled Deposits */}
            <div>
              <h3 className="font-semibold mb-3">
                Unreconciled Deposits and other Increases ({unclearedDeposits.length} Items)
              </h3>
              {unclearedDeposits.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unclearedDeposits.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell>{deposit.description}</TableCell>
                        <TableCell>{format(new Date(deposit.date), 'MM/dd/yyyy')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(deposit.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(unclearedDepositsTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">No unreconciled deposits</p>
              )}
            </div>

            {/* Unreconciled Checks */}
            <div>
              <h3 className="font-semibold mb-3">
                Unreconciled Checks and other Decreases ({unclearedPayments.length} Items)
              </h3>
              {unclearedPayments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unclearedPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{payment.description}</TableCell>
                        <TableCell>{format(new Date(payment.date), 'MM/dd/yyyy')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(unclearedPaymentsTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">No unreconciled checks</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}