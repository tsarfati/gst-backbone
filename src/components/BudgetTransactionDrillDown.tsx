import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/utils/formatNumber";
import { Loader2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface BudgetTransactionDrillDownProps {
  jobId: string;
  costCodeId: string;
  costCodeDescription: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'bill' | 'credit_card' | 'journal_entry';
  source_id: string;
  reference_number?: string;
}

export default function BudgetTransactionDrillDown({
  jobId,
  costCodeId,
  costCodeDescription,
  open,
  onOpenChange,
}: BudgetTransactionDrillDownProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      loadTransactions();
    }
  }, [open, jobId, costCodeId]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      // Get all journal entry lines for this job and cost code
      const { data: journalLines, error: journalError } = await supabase
        .from('journal_entry_lines')
        .select(`
          id,
          debit_amount,
          credit_amount,
          description,
          created_at,
          journal_entries!inner(
            id,
            entry_date,
            reference_number,
            source_type,
            source_id
          )
        `)
        .eq('job_id', jobId)
        .eq('cost_code_id', costCodeId)
        .order('created_at', { ascending: false });

      if (journalError) throw journalError;

      const transactionList: Transaction[] = [];

      for (const line of journalLines || []) {
        const je = (line as any).journal_entries;
        const amount = Number(line.debit_amount || 0);
        
        // Only include debit amounts (expenses)
        if (amount > 0) {
          let type: 'bill' | 'credit_card' | 'journal_entry' = 'journal_entry';
          
          // Determine transaction type from source
          if (je.source_type === 'bill' || je.source_id?.includes('bill')) {
            type = 'bill';
          } else if (je.source_type === 'credit_card' || je.source_id?.includes('credit_card')) {
            type = 'credit_card';
          }

          transactionList.push({
            id: line.id,
            date: je.entry_date,
            description: line.description || je.reference_number || 'Transaction',
            amount,
            type,
            source_id: je.source_id || je.id,
            reference_number: je.reference_number,
          });
        }
      }

      // Also get invoices directly (for bills that may not be posted yet or for completeness)
      const { data: invoices, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          issue_date,
          amount,
          description,
          vendors!inner(
            id,
            name
          )
        `)
        .eq('job_id', jobId)
        .eq('cost_code_id', costCodeId);

      if (invoiceError) throw invoiceError;

      for (const invoice of invoices || []) {
        const vendorName = invoice.vendors?.name || 'Unknown Vendor';
        
        // Check if we already have this from journal entries
        const alreadyExists = transactionList.some(t => 
          t.source_id === invoice.id || t.reference_number === invoice.invoice_number
        );

        if (!alreadyExists) {
          transactionList.push({
            id: invoice.id,
            date: invoice.issue_date,
            description: `${vendorName} - ${invoice.invoice_number || invoice.description || 'Bill'}`,
            amount: Number(invoice.amount),
            type: 'bill',
            source_id: invoice.id,
            reference_number: invoice.invoice_number,
          });
        }
      }

      // Sort by date descending
      transactionList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(transactionList);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionClick = (transaction: Transaction) => {
    if (transaction.type === 'bill') {
      // Navigate to bill/invoice details page
      navigate(`/bills/${transaction.source_id}`);
    } else if (transaction.type === 'credit_card') {
      // Navigate to credit cards transactions page
      // Note: The transaction modal can't be opened directly from URL, so user will need to find and click it
      navigate(`/credit-cards/transactions`);
    }
    onOpenChange(false);
  };

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Transaction Details - {costCodeDescription}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions found for this cost code
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow 
                    key={transaction.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleTransactionClick(transaction)}
                  >
                    <TableCell>
                      {format(new Date(transaction.date), 'MM/dd/yyyy')}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {transaction.type.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>{transaction.reference_number || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/30">
                  <TableCell colSpan={4} className="text-right">Total:</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(totalAmount)}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
