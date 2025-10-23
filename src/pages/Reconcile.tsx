import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  current_balance: number;
  chart_account_id?: string | null;
}

interface ChartAccountOption {
  id: string;
  account_name: string;
  account_number: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  type: 'deposit' | 'payment';
  is_cleared: boolean;
  transactionType?: 'journal_entry_line' | 'payment' | 'deposit';
}

export default function Reconcile() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const accountId = searchParams.get("account");
  
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Transaction[]>([]);
  const [searchDeposits, setSearchDeposits] = useState("");
  const [searchPayments, setSearchPayments] = useState("");
  const [depositsExpanded, setDepositsExpanded] = useState(true);
  const [paymentsExpanded, setPaymentsExpanded] = useState(true);
  const [calculationsExpanded, setCalculationsExpanded] = useState(false);
  const [chartAccounts, setChartAccounts] = useState<ChartAccountOption[]>([]);
  
  // Reconciliation state
  const [beginningBalance, setBeginningBalance] = useState(0);
  const [endingBalance, setEndingBalance] = useState<number | null>(null);
  const [endingDate, setEndingDate] = useState<Date>(new Date());
  const [beginningDate, setBeginningDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [reconciliationId, setReconciliationId] = useState<string | null>(null);
  const [glCashBalance, setGlCashBalance] = useState<number>(0);
  const loadTxnInFlight = useRef(false);

  useEffect(() => {
    if (currentCompany) {
      loadChartAccounts();
    }
  }, [currentCompany]);
  // Bank statement upload state
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [statementUploading, setStatementUploading] = useState(false);
  const [uploadedStatementId, setUploadedStatementId] = useState<string | null>(null);
  const [uploadedStatementName, setUploadedStatementName] = useState<string | null>(null);
  const [uploadedStatementUrl, setUploadedStatementUrl] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany && accountId) {
      loadBankAccount();
      loadLastReconciliation();
    }
  }, [currentCompany, accountId]);

  useEffect(() => {
    if (currentCompany && accountId && account) {
      loadInProgressReconciliation();
      loadTransactions();
      loadGLBalance();
    }
  }, [currentCompany, accountId, account?.chart_account_id, endingDate]);

  const loadBankAccount = async () => {
    if (!accountId || !currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, account_name, bank_name, current_balance, chart_account_id")
        .eq("id", accountId)
        .eq("company_id", currentCompany.id)
        .single();

      if (error) throw error;
      setAccount(data);
    } catch (error: any) {
      console.error("Error loading bank account:", error);
      toast.error("Failed to load bank account");
    }
  };

  const loadLastReconciliation = async () => {
    if (!accountId || !currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from("bank_reconciliations")
        .select("*")
        .eq("bank_account_id", accountId)
        .eq("company_id", currentCompany.id)
        .eq("status", "completed")
        .order("ending_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setBeginningBalance(data.ending_balance);
        setBeginningDate(new Date(data.ending_date));
      } else if (account) {
        setBeginningBalance(account.current_balance);
      }
    } catch (error: any) {
      console.error("Error loading last reconciliation:", error);
    }
  };

  const loadInProgressReconciliation = async () => {
    if (!accountId || !currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from("bank_reconciliations")
        .select("*")
        .eq("bank_account_id", accountId)
        .eq("company_id", currentCompany.id)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Restore state from in-progress reconciliation
        setReconciliationId(data.id);
        if (typeof data.ending_balance === "number" && data.ending_balance !== endingBalance) {
          setEndingBalance(data.ending_balance);
        }
        const newEndDate = new Date(data.ending_date);
        if (!endingDate || endingDate.getTime() !== newEndDate.getTime()) {
          setEndingDate(newEndDate);
        }
        if (data.bank_statement_id && data.bank_statement_id !== uploadedStatementId) {
          setUploadedStatementId(data.bank_statement_id);
        }

        // Load saved items and restore checked state
        const { data: items, error: itemsError } = await supabase
          .from("bank_reconciliation_items")
          .select("*")
          .eq("reconciliation_id", data.id);

        if (!itemsError && items) {
          const clearedDepositIds = new Set(
            items.filter(i => i.transaction_type === 'deposit' && i.is_cleared).map(i => i.transaction_id)
          );
          const clearedPaymentIds = new Set(
            items.filter(i => i.transaction_type === 'payment' && i.is_cleared).map(i => i.transaction_id)
          );

          // Update transaction states after they're loaded
          setTimeout(() => {
            setDeposits(prev => prev.map(d => ({
              ...d,
              is_cleared: clearedDepositIds.has(d.id)
            })));
            setPayments(prev => prev.map(p => ({
              ...p,
              is_cleared: clearedPaymentIds.has(p.id)
            })));
          }, 500);
        }

        toast.info("Restored in-progress reconciliation");
      }
    } catch (error: any) {
      console.error("Error loading in-progress reconciliation:", error);
    }
  };

  const loadGLBalance = async () => {
    if (!account?.chart_account_id || !currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("current_balance")
        .eq("id", account.chart_account_id)
        .eq("company_id", currentCompany.id)
        .single();

      if (error) throw error;
      if (data) {
        setGlCashBalance(data.current_balance || 0);
      }
    } catch (error: any) {
      console.error("Error loading GL balance:", error);
    }
  };

  const loadChartAccounts = async () => {
    if (!currentCompany) return;
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, account_name, account_number, is_active')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      if (error) throw error;
      setChartAccounts((data || []) as any);
    } catch (e) {
      console.error('Error loading chart accounts', e);
    }
  };

  const handleLinkChartAccount = async (chartId: string) => {
    if (!currentCompany || !accountId) return;
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ chart_account_id: chartId })
        .eq('id', accountId)
        .eq('company_id', currentCompany.id);
      if (error) throw error;
      toast.success('Linked cash GL account');
      setAccount(prev => prev ? { ...prev, chart_account_id: chartId } : prev);
      await loadGLBalance();
      await loadTransactions();
    } catch (e) {
      console.error('Failed to link GL account', e);
      toast.error('Failed to link GL account');
    }
  };

  const loadTransactions = async () => {
    if (!accountId || !currentCompany) return;

    if (loadTxnInFlight.current) {
      console.log("loadTransactions skipped: in-flight");
      return;
    }
    loadTxnInFlight.current = true;
    
    try {
      setLoading(true);
      console.log("Loading transactions for account:", accountId, "chart account:", account?.chart_account_id);

      // Get IDs of completed reconciliations for this account
      const { data: reconciliations, error: recError } = await supabase
        .from("bank_reconciliations")
        .select("id")
        .eq("bank_account_id", accountId)
        .eq("company_id", currentCompany.id)
        .eq("status", "completed");

      if (recError) throw recError;
      const recIds = (reconciliations || []).map((r: any) => r.id);

      let reconciledPaymentIds = new Set<string>();
      let reconciledDepositIds = new Set<string>();

      if (recIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from("bank_reconciliation_items")
          .select("transaction_id, transaction_type, reconciliation_id")
          .in("reconciliation_id", recIds);
        if (itemsError) throw itemsError;

        reconciledPaymentIds = new Set(
          (items || [])
            .filter((i: any) => i.transaction_type === 'payment')
            .map((i: any) => i.transaction_id)
        );
        reconciledDepositIds = new Set(
          (items || [])
            .filter((i: any) => i.transaction_type === 'deposit')
            .map((i: any) => i.transaction_id)
        );
      }
      
      // Load all payments for this bank account up to the ending date
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("id, payment_date, payment_number, amount, payment_method, status, bank_account_id")
        .eq("bank_account_id", accountId)
        .lte("payment_date", format(endingDate, 'yyyy-MM-dd'))
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;
      console.log("Payments loaded:", paymentsData?.length || 0);

      // Prepare journal-based transactions arrays
      let withdrawalsJournalData: any[] = [];
      let depositsData: any[] = [];

      if (account?.chart_account_id) {
        try {
          // Load withdrawals (credits to cash account) up to ending date
          const { data, error } = await supabase
            .from("journal_entry_lines")
            .select(`
              id,
              credit_amount,
              debit_amount,
              description,
              journal_entries!inner(
                entry_date,
                reference,
                status
              )
            `)
            .eq("account_id", account.chart_account_id)
            .eq("journal_entries.status", "posted")
            .lte("journal_entries.entry_date", format(endingDate, 'yyyy-MM-dd'))
            .gt("credit_amount", 0);
          if (error) throw error;
          withdrawalsJournalData = data || [];
          console.log("Journal withdrawals loaded:", withdrawalsJournalData.length);
        } catch (e) {
          console.warn("Withdrawals journal load failed, continuing without:", e);
        }

        try {
          // Load deposits (debits to cash account) up to ending date
          const { data, error } = await supabase
            .from("journal_entry_lines")
            .select(`
              id,
              credit_amount,
              debit_amount,
              description,
              journal_entries!inner(
                entry_date,
                reference,
                status
              )
            `)
            .eq("account_id", account.chart_account_id)
            .eq("journal_entries.status", "posted")
            .lte("journal_entries.entry_date", format(endingDate, 'yyyy-MM-dd'))
            .gt("debit_amount", 0);
          if (error) throw error;
          depositsData = data || [];
          console.log("Journal deposits loaded:", depositsData.length);
        } catch (e) {
          console.warn("Deposits journal load failed, continuing without:", e);
        }
      }

      // Format payments and filter out already reconciled ones
      const apPayments: Transaction[] = (paymentsData || [])
        .filter((p: any) => !reconciledPaymentIds.has(p.id))
        .map((p: any) => ({
          id: p.id,
          date: p.payment_date,
          description: `${p.payment_method || 'Payment'} - ${p.payment_number || 'No reference'}`,
          reference: p.payment_number || '',
          amount: p.amount,
          type: 'payment' as const,
          is_cleared: false
        }));

      const journalPayments: Transaction[] = (withdrawalsJournalData || [])
        .filter((d: any) => !reconciledPaymentIds.has(d.id))
        .map((d: any) => ({
          id: d.id,
          date: d.journal_entries?.entry_date || '',
          description: `JE Check - ${d.description || 'Bank withdrawal'}`,
          reference: d.journal_entries?.reference || '',
          amount: d.credit_amount,
          type: 'payment' as const,
          is_cleared: false,
          transactionType: 'journal_entry_line' as const
        }));

      const formattedPayments: Transaction[] = [...apPayments, ...journalPayments];
      console.log("Total payments:", formattedPayments.length);

      // Format deposits and filter out already reconciled ones
      const formattedDeposits: Transaction[] = (depositsData || [])
        .filter((d: any) => !reconciledDepositIds.has(d.id))
        .map((d: any) => ({
          id: d.id,
          date: d.journal_entries?.entry_date || '',
          description: `JE Deposit - ${d.description || 'Bank deposit'}`,
          reference: d.journal_entries?.reference || '',
          amount: d.debit_amount,
          type: 'deposit' as const,
          is_cleared: false,
          transactionType: 'journal_entry_line' as const
        }));

      console.log("Total deposits:", formattedDeposits.length);

      setPayments(formattedPayments);
      setDeposits(formattedDeposits);
    } catch (error: any) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
      loadTxnInFlight.current = false;
    }
  };

  const handleStatementFileChange = (e: any) => {
    const file = e.target.files?.[0] || null;
    setStatementFile(file);
  };

  const handleUploadStatement = async () => {
    if (!statementFile || !currentCompany || !accountId || !user) {
      toast.error("Select a statement PDF first");
      return;
    }
    setStatementUploading(true);
    try {
      const path = `${currentCompany.id}/${accountId}/${Date.now()}-${statementFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('bank-statements')
        .upload(path, statementFile);
      if (uploadError) throw uploadError;

      const { data: signed, error: signedErr } = await supabase.storage
        .from('bank-statements')
        .createSignedUrl(path, 315360000);
      if (signedErr) throw signedErr;

      const month = (endingDate?.getMonth?.() ?? new Date().getMonth()) + 1;
      const year = (endingDate?.getFullYear?.() ?? new Date().getFullYear());
      const { data: inserted, error: insertErr } = await supabase
        .from('bank_statements')
        .insert({
          bank_account_id: accountId,
          company_id: currentCompany.id,
          statement_date: `${year}-${String(month).padStart(2,'0')}-01`,
          statement_month: month,
          statement_year: year,
          file_name: statementFile.name,
          display_name: statementFile.name.replace(/\.[^/.]+$/, ''),
          file_url: signed.signedUrl,
          file_size: statementFile.size,
          uploaded_by: user.id,
        })
        .select('id, display_name, file_url')
        .single();
      if (insertErr) throw insertErr;

      setUploadedStatementId(inserted.id);
      setUploadedStatementName(inserted.display_name);
      setUploadedStatementUrl(inserted.file_url);
      toast.success('Bank statement uploaded');
    } catch (err: any) {
      console.error('Upload statement error:', err);
      toast.error('Failed to upload bank statement');
    } finally {
      setStatementUploading(false);
    }
  };

  const handleToggleCleared = async (id: string, type: 'deposit' | 'payment') => {
    if (type === 'deposit') {
      const deposit = deposits.find(d => d.id === id);
      const newClearedState = !deposit?.is_cleared;
      
      setDeposits(prev => prev.map(d => 
        d.id === id ? { ...d, is_cleared: newClearedState } : d
      ));

      // If it's a journal entry line, mark the entire journal entry as reconciled/unreconciled
      if (deposit?.transactionType === 'journal_entry_line') {
        try {
          const { data: lineInfo } = await supabase
            .from('journal_entry_lines')
            .select('journal_entry_id')
            .eq('id', id)
            .single();

          console.log('Reconciling deposit journal entry line:', id, 'Entry ID:', lineInfo?.journal_entry_id, 'New state:', newClearedState);

          if (lineInfo?.journal_entry_id) {
            if (newClearedState) {
              const { data: { user } } = await supabase.auth.getUser();
              const { error } = await supabase
                .from('journal_entry_lines')
                .update({
                  is_reconciled: true,
                  reconciled_at: new Date().toISOString(),
                  reconciled_by: user?.id
                })
                .eq('journal_entry_id', lineInfo.journal_entry_id);
              
              if (error) {
                console.error('Error marking JE lines as reconciled:', error);
                toast.error('Failed to mark journal entry as reconciled');
              } else {
                console.log('Successfully marked all lines in journal entry as reconciled');
              }
            } else {
              const { error } = await supabase
                .from('journal_entry_lines')
                .update({
                  is_reconciled: false,
                  reconciled_at: null,
                  reconciled_by: null
                })
                .eq('journal_entry_id', lineInfo.journal_entry_id);
              
              if (error) {
                console.error('Error unmarking JE lines as reconciled:', error);
                toast.error('Failed to unmark journal entry as reconciled');
              } else {
                console.log('Successfully unmarked all lines in journal entry as reconciled');
              }
            }
          }
        } catch (error) {
          console.error('Error updating JE reconciliation status:', error);
          toast.error('Failed to update journal entry reconciliation status');
        }
      }
    } else {
      const payment = payments.find(p => p.id === id);
      const newClearedState = !payment?.is_cleared;
      
      setPayments(prev => prev.map(p => 
        p.id === id ? { ...p, is_cleared: newClearedState } : p
      ));

      // If it's a journal entry line, mark the entire journal entry as reconciled/unreconciled
      if (payment?.transactionType === 'journal_entry_line') {
        try {
          const { data: lineInfo } = await supabase
            .from('journal_entry_lines')
            .select('journal_entry_id')
            .eq('id', id)
            .single();

          console.log('Reconciling payment journal entry line:', id, 'Entry ID:', lineInfo?.journal_entry_id, 'New state:', newClearedState);

          if (lineInfo?.journal_entry_id) {
            if (newClearedState) {
              const { data: { user } } = await supabase.auth.getUser();
              const { error } = await supabase
                .from('journal_entry_lines')
                .update({
                  is_reconciled: true,
                  reconciled_at: new Date().toISOString(),
                  reconciled_by: user?.id
                })
                .eq('journal_entry_id', lineInfo.journal_entry_id);
              
              if (error) {
                console.error('Error marking JE lines as reconciled:', error);
                toast.error('Failed to mark journal entry as reconciled');
              } else {
                console.log('Successfully marked all lines in journal entry as reconciled');
              }
            } else {
              const { error } = await supabase
                .from('journal_entry_lines')
                .update({
                  is_reconciled: false,
                  reconciled_at: null,
                  reconciled_by: null
                })
                .eq('journal_entry_id', lineInfo.journal_entry_id);
              
              if (error) {
                console.error('Error unmarking JE lines as reconciled:', error);
                toast.error('Failed to unmark journal entry as reconciled');
              } else {
                console.log('Successfully unmarked all lines in journal entry as reconciled');
              }
            }
          }
        } catch (error) {
          console.error('Error updating JE reconciliation status:', error);
          toast.error('Failed to update journal entry reconciliation status');
        }
      }
    }
  };

  const handleSaveProgress = async () => {
    if (!currentCompany || !accountId || !user || endingBalance === null) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const clearedDepositsTotal = deposits
        .filter(d => d.is_cleared)
        .reduce((sum, d) => sum + d.amount, 0);
      
      const clearedPaymentsTotal = payments
        .filter(p => p.is_cleared)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const clearedBalance = beginningBalance + clearedDepositsTotal - clearedPaymentsTotal;
      const adjustedBalance = clearedBalance;

      // Check if we're updating existing in-progress reconciliation or creating new one
      let currentReconciliationId = reconciliationId;
      
      if (currentReconciliationId) {
        // Update existing in-progress reconciliation
        const { error: updateError } = await supabase
          .from("bank_reconciliations")
          .update({
            ending_balance: endingBalance,
            ending_date: format(endingDate, 'yyyy-MM-dd'),
            cleared_balance: clearedBalance,
            adjusted_balance: adjustedBalance,
            bank_statement_id: uploadedStatementId
          })
          .eq("id", currentReconciliationId);

        if (updateError) throw updateError;

        // Delete old items and insert new ones
        await supabase
          .from("bank_reconciliation_items")
          .delete()
          .eq("reconciliation_id", currentReconciliationId);
      } else {
        // Create new in-progress reconciliation
        const { data: reconciliation, error: reconciliationError } = await supabase
          .from("bank_reconciliations")
          .insert({
            company_id: currentCompany.id,
            bank_account_id: accountId,
            beginning_balance: beginningBalance,
            ending_balance: endingBalance,
            beginning_date: format(beginningDate, 'yyyy-MM-dd'),
            ending_date: format(endingDate, 'yyyy-MM-dd'),
            cleared_balance: clearedBalance,
            adjusted_balance: adjustedBalance,
            status: 'in_progress',
            created_by: user.id,
            bank_statement_id: uploadedStatementId
          })
          .select()
          .single();

        if (reconciliationError) throw reconciliationError;
        currentReconciliationId = reconciliation.id;
        setReconciliationId(reconciliation.id);
      }

      // Save all items (cleared and uncleared) to preserve state
      const allItems = [
        ...deposits.map(d => ({
          reconciliation_id: currentReconciliationId,
          transaction_type: 'deposit',
          transaction_id: d.id,
          amount: d.amount,
          is_cleared: d.is_cleared,
          cleared_at: d.is_cleared ? new Date().toISOString() : null,
        })),
        ...payments.map(p => ({
          reconciliation_id: currentReconciliationId,
          transaction_type: 'payment',
          transaction_id: p.id,
          amount: p.amount,
          is_cleared: p.is_cleared,
          cleared_at: p.is_cleared ? new Date().toISOString() : null,
        })),
      ];

      if (allItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("bank_reconciliation_items")
          .insert(allItems);

        if (itemsError) throw itemsError;
      }

      toast.success("Progress saved successfully");
    } catch (error: any) {
      console.error("Error saving progress:", error);
      toast.error("Failed to save progress");
    }
  };

  const handleReconcile = async () => {
    if (!currentCompany || !accountId || !user || endingBalance === null) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!isClearedBalanced) {
      toast.error("Cannot reconcile - cleared balance does not match ending balance");
      return;
    }

    try {
      const clearedDepositsTotal = deposits
        .filter(d => d.is_cleared)
        .reduce((sum, d) => sum + d.amount, 0);
      
      const clearedPaymentsTotal = payments
        .filter(p => p.is_cleared)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const clearedBalance = beginningBalance + clearedDepositsTotal - clearedPaymentsTotal;
      const adjustedBalance = clearedBalance;

      // Update or create the reconciliation as completed
      let finalReconciliationId = reconciliationId;
      
      if (reconciliationId) {
        const { error: updateError } = await supabase
          .from("bank_reconciliations")
          .update({
            ending_balance: endingBalance,
            ending_date: format(endingDate, 'yyyy-MM-dd'),
            cleared_balance: clearedBalance,
            adjusted_balance: adjustedBalance,
            status: 'completed',
            reconciled_by: user.id,
            reconciled_at: new Date().toISOString(),
            bank_statement_id: uploadedStatementId
          })
          .eq("id", reconciliationId);

        if (updateError) throw updateError;
      } else {
        // If a completed reconciliation already exists for this period, update it instead of inserting a duplicate
        const { data: existing } = await supabase
          .from('bank_reconciliations')
          .select('id')
          .eq('company_id', currentCompany.id)
          .eq('bank_account_id', accountId)
          .eq('ending_date', format(endingDate, 'yyyy-MM-dd'))
          .eq('status', 'completed')
          .maybeSingle();

        if (existing?.id) {
          finalReconciliationId = existing.id;
          const { error: updErr } = await supabase
            .from('bank_reconciliations')
            .update({
              ending_balance: endingBalance,
              cleared_balance: clearedBalance,
              adjusted_balance: adjustedBalance,
              reconciled_by: user.id,
              reconciled_at: new Date().toISOString(),
              bank_statement_id: uploadedStatementId
            })
            .eq('id', existing.id);
          if (updErr) throw updErr;
        } else {
          const { data: reconciliation, error: reconciliationError } = await supabase
            .from("bank_reconciliations")
            .insert({
              company_id: currentCompany.id,
              bank_account_id: accountId,
              beginning_balance: beginningBalance,
              ending_balance: endingBalance,
              beginning_date: format(beginningDate, 'yyyy-MM-dd'),
              ending_date: format(endingDate, 'yyyy-MM-dd'),
              cleared_balance: clearedBalance,
              adjusted_balance: adjustedBalance,
              status: 'completed',
              created_by: user.id,
              reconciled_by: user.id,
              reconciled_at: new Date().toISOString(),
              bank_statement_id: uploadedStatementId
            })
            .select()
            .single();

          if (reconciliationError) throw reconciliationError;
          finalReconciliationId = reconciliation.id;
        }
      }

      // Save cleared items to this reconciliation (so the report shows details)
      if (finalReconciliationId) {
        const { error: delItemsErr } = await supabase
          .from('bank_reconciliation_items')
          .delete()
          .eq('reconciliation_id', finalReconciliationId);
        if (delItemsErr) console.warn('Could not clear old reconciliation items', delItemsErr);

        const clearedItems = [
          ...deposits.filter(d => d.is_cleared).map(d => ({
            reconciliation_id: finalReconciliationId,
            transaction_type: 'deposit',
            transaction_id: d.id,
            amount: d.amount,
            is_cleared: true,
            cleared_at: new Date().toISOString(),
          })),
          ...payments.filter(p => p.is_cleared).map(p => ({
            reconciliation_id: finalReconciliationId,
            transaction_type: 'payment',
            transaction_id: p.id,
            amount: p.amount,
            is_cleared: true,
            cleared_at: new Date().toISOString(),
          })),
        ];
        if (clearedItems.length) {
          const { error: insItemsErr } = await supabase
            .from('bank_reconciliation_items')
            .insert(clearedItems);
          if (insItemsErr) throw insItemsErr;
        }
      }

      // Mark entire journal entries as reconciled for any cleared JE lines
      const clearedJeLineIds = [
        ...deposits.filter(d => d.is_cleared && d.transactionType === 'journal_entry_line').map(d => d.id),
        ...payments.filter(p => p.is_cleared && p.transactionType === 'journal_entry_line').map(p => p.id),
      ];
      console.log('Finalizing reconciliation - Cleared JE line IDs:', clearedJeLineIds);
      
      if (clearedJeLineIds.length) {
        const { data: parentIds, error: fetchError } = await supabase
          .from('journal_entry_lines')
          .select('journal_entry_id')
          .in('id', clearedJeLineIds);
        
        if (fetchError) {
          console.error('Error fetching journal entry IDs:', fetchError);
        } else {
          const distinctEntryIds = Array.from(new Set((parentIds || []).map((r: any) => r.journal_entry_id)));
          console.log('Marking all lines in journal entries as reconciled:', distinctEntryIds);
          
          if (distinctEntryIds.length) {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const { error: updateError } = await supabase
              .from('journal_entry_lines')
              .update({
                is_reconciled: true,
                reconciled_at: new Date().toISOString(),
                reconciled_by: authUser?.id
              })
              .in('journal_entry_id', distinctEntryIds);
            
            if (updateError) {
              console.error('Error marking journal entry lines as reconciled:', updateError);
              toast.error('Warning: Some journal entry lines may not have been marked as reconciled');
            } else {
              console.log('Successfully marked all journal entry lines as reconciled');
            }
          }
        }
      }

      // Ensure attached bank statement period matches ending date
      if (uploadedStatementId) {
        const month = (endingDate?.getMonth?.() ?? new Date().getMonth()) + 1;
        const year = (endingDate?.getFullYear?.() ?? new Date().getFullYear());
        const { error: stmtUpdateErr } = await supabase
          .from('bank_statements')
          .update({
            statement_date: format(endingDate, 'yyyy-MM-dd'),
            statement_month: month,
            statement_year: year,
          })
          .eq('id', uploadedStatementId);
        
        if (stmtUpdateErr) {
          console.error('Error updating bank statement period:', stmtUpdateErr);
        }
      }

      // Update bank account balance and as-of date
      const { error: balanceError } = await supabase
        .from("bank_accounts")
        .update({ 
          current_balance: endingBalance,
          balance_date: format(endingDate, 'yyyy-MM-dd')
        })
        .eq("id", accountId)
        .eq('company_id', currentCompany.id);

      if (balanceError) throw balanceError;

      toast.success("Reconciliation completed successfully");
      navigate(`/banking/accounts/${accountId}`);
    } catch (error: any) {
      console.error("Error completing reconciliation:", error);
      toast.error("Failed to complete reconciliation");
    }
  };

  const filteredDeposits = deposits.filter(d =>
    d.description.toLowerCase().includes(searchDeposits.toLowerCase()) ||
    d.reference.toLowerCase().includes(searchDeposits.toLowerCase())
  );

  const filteredPayments = payments.filter(p =>
    p.description.toLowerCase().includes(searchPayments.toLowerCase()) ||
    p.reference.toLowerCase().includes(searchPayments.toLowerCase())
  );

  const clearedDepositsTotal = deposits
    .filter(d => d.is_cleared)
    .reduce((sum, d) => sum + d.amount, 0);
  
  const unclearedDepositsTotal = deposits
    .filter(d => !d.is_cleared)
    .reduce((sum, d) => sum + d.amount, 0);

  const clearedPaymentsTotal = payments
    .filter(p => p.is_cleared)
    .reduce((sum, p) => sum + p.amount, 0);
  
  const unclearedPaymentsTotal = payments
    .filter(p => !p.is_cleared)
    .reduce((sum, p) => sum + p.amount, 0);

  const clearedBalance = beginningBalance + clearedDepositsTotal - clearedPaymentsTotal;
  
  // Adjusted Cash Balance = Total Cash Balance - Unreconciled Deposits + Unreconciled Checks
  const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalCashBalance = beginningBalance + totalDeposits - totalPayments;
  const adjustedBalance = totalCashBalance - unclearedDepositsTotal + unclearedPaymentsTotal;
  
  // Cleared Balance is balanced when it equals the ending balance entered by user
  const isClearedBalanced = endingBalance !== null && Math.abs(clearedBalance - endingBalance) < 0.01;
  
  // Adjusted Cash Balance is balanced when it equals the cleared balance
  const isAdjustedBalanced = Math.abs(adjustedBalance - clearedBalance) < 0.01;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };


  if (!account && !loading) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Bank account not found</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/banking/accounts/${accountId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account Details
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bank Reconciliation</h1>
            <p className="text-muted-foreground">
              {account.account_name} - {account.bank_name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/banking/accounts/${accountId}`)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveProgress}
            >
              Save Progress
            </Button>
            <Button
              onClick={handleReconcile}
              disabled={!isClearedBalanced}
            >
              Reconcile
            </Button>
          </div>
        </div>
      </div>

      {/* Account Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Account to Reconcile</Label>
              <div className="p-2 border rounded bg-muted">
                {account.account_name} - {account.bank_name}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Beginning Balance</Label>
              <div className="p-2 border rounded bg-muted">
                {formatCurrency(beginningBalance)}
                <span className="text-xs text-muted-foreground ml-2">
                  (as of {format(beginningDate, "MM/dd/yyyy")})
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endingBalance">Ending Balance *</Label>
              <Input
                id="endingBalance"
                type="number"
                step="0.01"
                value={endingBalance || ''}
                onChange={(e) => setEndingBalance(parseFloat(e.target.value) || null)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Beginning Date</Label>
              <div className="p-2 border rounded bg-muted">
                {format(beginningDate, "MM/dd/yyyy")}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ending Statement Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {format(endingDate, "MM/dd/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endingDate}
                    onSelect={(date) => date && setEndingDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Statement Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Bank Statement (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-end gap-3">
            <div className="space-y-2 w-full md:w-auto">
              <Label htmlFor="statementUpload">Attach Statement PDF</Label>
              <Input 
                id="statementUpload" 
                type="file" 
                accept=".pdf" 
                onChange={handleStatementFileChange}
              />
            </div>
            <Button 
              onClick={handleUploadStatement} 
              disabled={!statementFile || statementUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {statementUploading ? 'Uploading...' : 'Upload Statement'}
            </Button>
          </div>
          {uploadedStatementName && uploadedStatementUrl && (
            <div className="mt-3 p-3 border rounded bg-accent">
              <p className="text-sm font-medium">Statement Attached:</p>
              <a 
                href={uploadedStatementUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="text-sm underline text-primary hover:text-primary/80"
              >
                {uploadedStatementName}
              </a>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            The uploaded statement will be attached to this reconciliation and listed under Bank Statements.
          </p>
        </CardContent>
      </Card>

      {/* Reconciliation Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Reconciliation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Ending Balance Card */}
            <div className="p-4 border-l-4 rounded border-success bg-success/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{endingBalance !== null ? formatCurrency(endingBalance) : '--'}</div>
                  <div className="text-sm font-medium mt-1">Ending Balance</div>
                </div>
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
            </div>

            {/* Cleared Balance Card */}
            <div className={`p-4 border-l-4 rounded ${!isClearedBalanced ? 'border-destructive bg-destructive/20' : 'border-success bg-success/20'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{formatCurrency(clearedBalance)}</div>
                  <div className="text-sm font-medium mt-1">Cleared Balance</div>
                </div>
                {!isClearedBalanced ? <XCircle className="h-6 w-6 text-destructive" /> : <CheckCircle className="h-6 w-6 text-success" />}
              </div>
            </div>


            {/* Adjusted Cash Balance Card */}
            <div className={`p-4 border-l-4 rounded ${!isAdjustedBalanced ? 'border-destructive bg-destructive/20' : 'border-success bg-success/20'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{formatCurrency(adjustedBalance)}</div>
                  <div className="text-sm font-medium mt-1">Adjusted Cash Balance</div>
                </div>
                {!isAdjustedBalanced ? <XCircle className="h-6 w-6 text-destructive" /> : <CheckCircle className="h-6 w-6 text-success" />}
              </div>
            </div>
          </div>


          {/* Shared Expand Section */}
          <Collapsible open={calculationsExpanded} onOpenChange={setCalculationsExpanded}>
            <CollapsibleContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                {/* Ending Balance Details */}
                <div className="space-y-2 text-sm">
                  <div className="font-semibold mb-3">Ending Balance</div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Ending Balance (from statement)</span>
                    <span className="font-medium">{endingBalance !== null ? formatCurrency(endingBalance) : '--'}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="text-xs text-muted-foreground mt-2">
                    This is the ending balance from your bank statement on {format(endingDate, 'MM/dd/yyyy')}.
                  </div>
                </div>

                {/* Cleared Balance Details */}
                <div className="space-y-2 text-sm">
                  <div className="font-semibold mb-3">Cleared Balance</div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Bank statement Balance on start date</span>
                    <span className="font-medium">{formatCurrency(beginningBalance)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(+) Cleared Deposits and other Increases</span>
                    <span className="font-medium">{formatCurrency(clearedDepositsTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(−) Cleared Checks and other decreases</span>
                    <span className="font-medium">{formatCurrency(clearedPaymentsTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(−) Cleared ACH batches and reversals</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between py-1 font-semibold">
                    <span>Cleared Balance</span>
                    <span>{formatCurrency(clearedBalance)}</span>
                  </div>
                  {!isClearedBalanced && endingBalance !== null && (
                    <div className="flex justify-between py-1 text-destructive font-semibold mt-2">
                      <span>Out of Balance:</span>
                      <span>{formatCurrency(Math.abs(clearedBalance - endingBalance))}</span>
                    </div>
                  )}
                </div>

                {/* Adjusted Cash Balance Details */}
                <div className="space-y-2 text-sm">
                  <div className="font-semibold mb-3">Adjusted Cash Balance</div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Total Cash Balance</span>
                    <span className="font-medium">{formatCurrency(totalCashBalance)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(−) Unreconciled Deposits</span>
                    <span className="font-medium">{formatCurrency(unclearedDepositsTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(−) Unreconciled Receipts Deposited after Reconciliation</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(−) Receipts Reversed after Reconciliation Which Have Not Been Deposited</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(−) Pending Online Receipts Which Have Not Been Deposited</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(+) Unreconciled Checks</span>
                    <span className="font-medium">{formatCurrency(unclearedPaymentsTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(+) Unreconciled ACH Batches and Reversals</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(+) Unreconciled Payments from ACH Batches Generated after Reconciliation</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">(+) Unreconciled Checks Voided after Reconciliation Period</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between py-1 font-semibold">
                    <span>Total Adjusted Balance</span>
                    <span>{formatCurrency(adjustedBalance)}</span>
                  </div>
                  {!isAdjustedBalanced && (
                    <div className="flex justify-between py-1 text-destructive font-semibold mt-2">
                      <span>Out of Balance:</span>
                      <span>{formatCurrency(Math.abs(adjustedBalance - clearedBalance))}</span>
                    </div>
                  )}
                  {isAdjustedBalanced && (
                    <div className="text-success font-semibold text-center mt-2">
                      Balanced ✓
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
            
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-auto mx-auto block mt-4">
                {calculationsExpanded ? 'Hide Calculation Details' : 'View Calculation Details'}
                {calculationsExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Deposits and other Credits */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setDepositsExpanded(!depositsExpanded)}>
            <div className="flex items-center gap-2">
              {depositsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Deposits and other Credits
              </CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search"
                value={searchDeposits}
                onChange={(e) => setSearchDeposits(e.target.value)}
                className="w-64"
                onClick={(e) => e.stopPropagation()}
              />
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardHeader>
        {depositsExpanded && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Deposit #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeposits.map((deposit) => (
                  <TableRow 
                    key={deposit.id}
                    className="hover:bg-accent cursor-pointer"
                    onClick={() => handleToggleCleared(deposit.id, 'deposit')}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={deposit.is_cleared}
                        onCheckedChange={() => handleToggleCleared(deposit.id, 'deposit')}
                      />
                    </TableCell>
                    <TableCell onClick={() => handleToggleCleared(deposit.id, 'deposit')}>{format(new Date(deposit.date), 'MM/dd/yyyy')}</TableCell>
                    <TableCell onClick={() => handleToggleCleared(deposit.id, 'deposit')}>{deposit.reference}</TableCell>
                    <TableCell onClick={() => handleToggleCleared(deposit.id, 'deposit')}>{deposit.description}</TableCell>
                    <TableCell className="text-right font-medium text-green-600" onClick={() => handleToggleCleared(deposit.id, 'deposit')}>
                      {formatCurrency(deposit.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-between mt-4 pt-4 border-t text-sm">
              <div>
                Uncleared {deposits.filter(d => !d.is_cleared).length} of {deposits.length}: {formatCurrency(unclearedDepositsTotal)}
              </div>
              <div>
                Cleared {deposits.filter(d => d.is_cleared).length} of {deposits.length}: {formatCurrency(clearedDepositsTotal)}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Checks and other Payments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setPaymentsExpanded(!paymentsExpanded)}>
            <div className="flex items-center gap-2">
              {paymentsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Checks and other Payments
              </CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search"
                value={searchPayments}
                onChange={(e) => setSearchPayments(e.target.value)}
                className="w-64"
                onClick={(e) => e.stopPropagation()}
              />
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardHeader>
        {paymentsExpanded && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Check #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow 
                    key={payment.id}
                    className="hover:bg-accent cursor-pointer"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={payment.is_cleared}
                        onCheckedChange={() => handleToggleCleared(payment.id, 'payment')}
                      />
                    </TableCell>
                    <TableCell onClick={() => navigate(`/payables/payments/${payment.id}`)}>{format(new Date(payment.date), 'MM/dd/yyyy')}</TableCell>
                    <TableCell onClick={() => navigate(`/payables/payments/${payment.id}`)}>{payment.reference}</TableCell>
                    <TableCell onClick={() => navigate(`/payables/payments/${payment.id}`)}>{payment.description}</TableCell>
                    <TableCell className="text-right font-medium text-red-600" onClick={() => navigate(`/payables/payments/${payment.id}`)}>
                      {formatCurrency(payment.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-between mt-4 pt-4 border-t text-sm">
              <div>
                Uncleared {payments.filter(p => !p.is_cleared).length} of {payments.length}: {formatCurrency(unclearedPaymentsTotal)}
              </div>
              <div>
                Cleared {payments.filter(p => p.is_cleared).length} of {payments.length}: {formatCurrency(clearedPaymentsTotal)}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
