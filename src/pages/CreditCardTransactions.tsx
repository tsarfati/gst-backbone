import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Smile, Frown, Pencil, Trash2, Send, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePostCreditCardTransactions } from "@/hooks/usePostCreditCardTransactions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyInput } from "@/components/ui/currency-input";
import { CreditCardTransactionModal } from "@/components/CreditCardTransactionModal";
import { formatCurrency } from "@/utils/formatNumber";

export default function CreditCardTransactions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [creditCard, setCreditCard] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [costCodes, setCostCodes] = useState<any[]>([]);
  const [distsByTx, setDistsByTx] = useState<Record<string, any[]>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [matchedReceipts, setMatchedReceipts] = useState<Map<string, any[]>>(new Map());
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [postingToGL, setPostingToGL] = useState(false);
  const { postTransactionsToGL } = usePostCreditCardTransactions();
  const [sortColumn, setSortColumn] = useState<'date' | 'amount' | 'attachment' | 'status' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const scrollPositionRef = useRef<number>(0);
  
  // New transaction form
  const [newTransaction, setNewTransaction] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    description: "",
    merchant_name: "",
    amount: "",
    category: "",
    notes: "",
  });

  useEffect(() => {
    if (id && currentCompany) {
      fetchData();
    }
  }, [id, currentCompany]);

  useEffect(() => {
    if (transactions.length > 0) {
      findReceiptMatches();
    }
  }, [transactions]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch credit card
      const { data: cardData, error: cardError } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("id", id)
        .eq("company_id", currentCompany?.id)
        .single();

      if (cardError) throw cardError;
      setCreditCard(cardData);

      // Fetch transactions
      const { data: transData, error: transError } = await supabase
        .from("credit_card_transactions")
        .select(`
          *,
          jobs:job_id(id, name),
          cost_codes:cost_code_id(id, code, description, require_attachment),
          requested_coder:requested_coder_id(user_id, first_name, last_name),
          vendors:vendor_id(id, name),
          chart_of_accounts:chart_account_id(id, account_number, account_name, require_attachment)
        `)
        .eq("credit_card_id", id)
        .order("transaction_date", { ascending: false });

      if (transError) throw transError;
      setTransactions(transData || []);

      // Fetch jobs
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("id, name")
        .eq("company_id", currentCompany?.id)
        .eq("status", "active")
        .order("name");

      setJobs(jobsData || []);

      // Fetch cost codes (company-wide only, job-specific codes are handled separately)
      const { data: costCodesData } = await supabase
        .from("cost_codes")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .eq("is_active", true)
        .is("job_id", null)
        .order("code");

      setCostCodes(costCodesData || []);

      // Fetch distributions for all listed transactions and hydrate with cost code metadata
      const txIds = (transData || []).map((t: any) => t.id);
      if (txIds.length > 0) {
        const { data: distRows } = await supabase
          .from('credit_card_transaction_distributions')
          .select('transaction_id, job_id, amount, percentage, cost_codes:cost_code_id(id, code, type, require_attachment)')
          .in('transaction_id', txIds);
        const map: Record<string, any[]> = {};
        (distRows || []).forEach((row: any) => {
          if (!map[row.transaction_id]) map[row.transaction_id] = [];
          map[row.transaction_id].push(row);
        });
        setDistsByTx(map);
      }

      // Fetch users for coding requests (admins, controllers, project managers)
      const { data: usersData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, role")
        .in("role", ["admin", "controller", "project_manager"])
        .order("first_name");

      setUsers(usersData || []);
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

  const findReceiptMatches = async () => {
    try {
      // Fetch all receipts from the company
      const { data: receipts, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("receipt_date", { ascending: false });

      if (error) throw error;

      const matches = new Map();

      // For each transaction, find potential receipt matches
      transactions.forEach((transaction) => {
        const potentialMatches = (receipts || []).filter((receipt) => {
          // Check if receipt is already linked to a bill or credit card transaction
          // We'll assume receipts with status 'coded' and attached to something are excluded
          // This would need proper tracking - for now we include all receipts
          
          // Require exact amount match
          const amountMatch = Math.abs(
            Number(receipt.amount) - Number(transaction.amount)
          ) < 0.01;

          // Check if dates are within 3 days
          const transDate = new Date(transaction.transaction_date);
          const receiptDate = new Date(receipt.receipt_date);
          const daysDiff = Math.abs(
            (transDate.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          const dateMatch = daysDiff <= 3;

          // Check if vendor name matches (fuzzy matching)
          const vendorMatch = receipt.vendor_name &&
            transaction.merchant_name &&
            (receipt.vendor_name.toLowerCase().includes(transaction.merchant_name.toLowerCase().substring(0, 5)) ||
             transaction.merchant_name.toLowerCase().includes(receipt.vendor_name.toLowerCase().substring(0, 5)));

          return amountMatch && dateMatch && vendorMatch;
        });

        if (potentialMatches.length > 0) {
          matches.set(transaction.id, potentialMatches);
        }
      });

      setMatchedReceipts(matches);
    } catch (error: any) {
      console.error("Error finding receipt matches:", error);
    }
  };


  const handleAddTransaction = async () => {
    if (!currentCompany || !newTransaction.description || !newTransaction.amount) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("credit_card_transactions")
        .insert({
          credit_card_id: id,
          company_id: currentCompany.id,
          transaction_date: newTransaction.transaction_date,
          description: newTransaction.description,
          merchant_name: newTransaction.merchant_name || newTransaction.description,
          amount: parseFloat(newTransaction.amount),
          category: newTransaction.category || null,
          notes: newTransaction.notes || null,
          created_by: user?.id,
          imported_from_csv: false,
          coding_status: 'uncoded',
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Transaction added successfully",
      });

      setNewTransaction({
        transaction_date: new Date().toISOString().split('T')[0],
        description: "",
        merchant_name: "",
        amount: "",
        category: "",
        notes: "",
      });
      setShowAddDialog(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };


  // Calculate running balance for all transactions
  const runningBalances = useMemo(() => {
    const balanceMap = new Map<string, number>();
    
    // Sort transactions chronologically (oldest first)
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    
    let balance = 0;
    sortedTransactions.forEach((trans) => {
      const amt = Math.abs(Number(trans.amount));
      const reduces = trans.transaction_type === 'payment' || Number(trans.amount) < 0;
      if (reduces) {
        balance -= amt; // Credits/payments reduce
      } else {
        balance += amt; // Charges/fees increase
      }
      balanceMap.set(trans.id, balance);
    });
    
    return balanceMap;
  }, [transactions]);

  const sortedTransactions = useMemo(() => {
    if (!sortColumn) return transactions;
    
    return [...transactions].sort((a, b) => {
      let comparison = 0;
      
      if (sortColumn === 'date') {
        comparison = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
      } else if (sortColumn === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortColumn === 'attachment') {
        const aHasAttachment = a.attachment_url ? 1 : 0;
        const bHasAttachment = b.attachment_url ? 1 : 0;
        comparison = aHasAttachment - bHasAttachment;
      } else if (sortColumn === 'status') {
        const statusOrder = { 'uncoded': 0, 'request_coding': 1, 'coded': 2, 'posted': 3 };
        const aStatus = a.journal_entry_id ? 3 : (statusOrder[a.coding_status as keyof typeof statusOrder] ?? 0);
        const bStatus = b.journal_entry_id ? 3 : (statusOrder[b.coding_status as keyof typeof statusOrder] ?? 0);
        comparison = aStatus - bStatus;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [transactions, sortColumn, sortDirection]);

  const handleSort = (column: 'date' | 'amount' | 'attachment' | 'status') => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with descending as default
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: 'date' | 'amount' | 'attachment' | 'status') => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline-block opacity-30" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 inline-block" />
      : <ArrowDown className="h-4 w-4 ml-1 inline-block" />;
  };

  const openTransactionDetail = (transactionId: string) => {
    // Save current scroll position
    scrollPositionRef.current = window.scrollY;
    setSelectedTransactionId(transactionId);
    setShowDetailModal(true);
  };

  const handleModalComplete = async () => {
    await fetchData();
    // Restore scroll position after data is fetched
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPositionRef.current);
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTransactions(new Set(transactions.map(t => t.id)));
    } else {
      setSelectedTransactions(new Set());
    }
  };

  const handleSelectTransaction = (transactionId: string, checked: boolean) => {
    const newSelected = new Set(selectedTransactions);
    if (checked) {
      newSelected.add(transactionId);
    } else {
      newSelected.delete(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) return;

    try {
      const { error } = await supabase
        .from("credit_card_transactions")
        .delete()
        .in("id", Array.from(selectedTransactions));

      if (error) throw error;

      toast({
        title: "Success",
        description: `Deleted ${selectedTransactions.size} transaction${selectedTransactions.size > 1 ? 's' : ''}`,
      });

      setSelectedTransactions(new Set());
      setShowBulkDeleteDialog(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePostToGL = async (transactionIds: string[]) => {
    if (!user?.id || transactionIds.length === 0) return;

    setPostingToGL(true);
    try {
      const { posted, errors } = await postTransactionsToGL(transactionIds, user.id);

      if (posted.length > 0) {
        toast({
          title: "Success",
          description: `Posted ${posted.length} transaction${posted.length > 1 ? 's' : ''} to GL`,
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Some Transactions Failed",
          description: errors.slice(0, 3).join(", ") + (errors.length > 3 ? "..." : ""),
          variant: "destructive",
        });
      }

      setSelectedTransactions(new Set());
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPostingToGL(false);
    }
  };

  const handlePostAllCoded = async () => {
    const codedNotPosted = transactions
      .filter(t => isTransactionCoded(t) && !t.journal_entry_id)
      .map(t => t.id);

    if (codedNotPosted.length === 0) {
      toast({
        title: "No Transactions",
        description: "No coded transactions to post",
      });
      return;
    }

  await handlePostToGL(codedNotPosted);
  };

  // Helper to resolve whether attachment is required based on cost code/account
  const requiresAttachmentFor = (t: any): boolean => {
    const core = (s: any) => String(s ?? "").toLowerCase().replace(/\s+/g, "").replace(/[^0-9.]/g, "");
    if (t.job_id && t.cost_code_id) {
      const ccJob = t.cost_codes;
      if (ccJob) {
        const companyMatches = (costCodes || []).filter((c: any) => core(c.code) === core(ccJob.code));
        if (companyMatches.some((c: any) => c.require_attachment === false) || ccJob?.require_attachment === false) return false;
        const typeMatch = ccJob?.type ? companyMatches.find((c: any) => String(c.type || '').toLowerCase() === String(ccJob.type || '').toLowerCase()) : null;
        const resolved = typeMatch || companyMatches[0] || ccJob;
        return resolved?.require_attachment ?? true;
      }
      return true;
    }
    if (t.chart_account_id && t.chart_of_accounts) {
      return t.chart_of_accounts.require_attachment ?? true;
    }
    return true;
  };

  const isTransactionCoded = (t: any): boolean => {
    // Primary source of truth: stored coding_status flag from DB
    if (t.coding_status === "coded") {
      return true;
    }

    // Fallback: infer coding based on current field values (legacy/partial rows)
    // First, honor distribution-based coding
    const dist = distsByTx[t.id] || [];
    if (dist.length > 0) {
      const totalAmt = Math.abs(Number(t.amount || 0));
      const distSum = dist.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
      const validLines = dist.every((d: any) => d.job_id && d.cost_codes?.id && Number(d.amount) > 0);
      const hasVendor = !!t.vendor_id;
      const hasAttachment = !!t.attachment_url;

      // Determine if any line requires an attachment using company-level overrides by code/type
      const core = (s: any) => String(s ?? "").toLowerCase().replace(/\s+/g, "").replace(/[^0-9.]/g, "");
      const perLineRequires = dist.map((line: any) => {
        const jobCC = line.cost_codes; // { id, code, type, require_attachment }
        if (!jobCC) return true; // default require if unknown
        const companyMatches = (costCodes || []).filter((c: any) => core(c.code) === core(jobCC.code));
        if (jobCC.require_attachment === false || companyMatches.some((c: any) => c.require_attachment === false)) return false;
        const typeMatch = jobCC?.type ? companyMatches.find((c: any) => String(c.type || '').toLowerCase() === String(jobCC.type || '').toLowerCase()) : null;
        const resolved = typeMatch || companyMatches[0] || jobCC;
        return resolved?.require_attachment ?? true;
      });
      const requiresByCode = perLineRequires.some(Boolean);

      const coded = validLines && Math.abs(distSum - totalAmt) < 0.01 && hasVendor && (requiresByCode ? hasAttachment : true);
      console.log('CC coded calc (dist)', { id: t.id, validLines, distSum, totalAmt, hasVendor, requiresByCode, hasAttachment, coded });
      return coded;
    }

    // Fallback: single-code determination
    const hasVendor = !!t.vendor_id;
    const hasJobOrAccount = !!t.job_id || !!t.chart_account_id;
    const hasCostCode = t.job_id ? !!t.cost_code_id : true;
    const hasAttachment = !!t.attachment_url;
    const requiresByCode = requiresAttachmentFor(t);
    const attachmentSatisfied = requiresByCode ? hasAttachment : true;
    const coded = hasVendor && hasJobOrAccount && hasCostCode && attachmentSatisfied;
    console.log('CC coded calc', { id: t.id, hasVendor, hasJobOrAccount, hasCostCode, hasAttachment, requiresByCode, coded, ccJob: t.cost_codes, acct: t.chart_of_accounts });
    return coded;
  };

  const getStatusBadge = (t: any) => {
    const badges: JSX.Element[] = [];

    // Check if posted to GL
    if (t.journal_entry_id) {
      badges.push(<Badge className="bg-blue-500 text-white" key="posted">Posted</Badge>);
      return <div className="flex items-center gap-1">{badges}</div>;
    }

    // Payments show reconciliation status only when not being coded (no job/account)
    // Extra guard: only treat as true payment if description/merchant indicates a payment, not a credit/refund
    const paymentText = `${t.description || ''} ${t.merchant_name || ''}`;
    const looksLikePayment = t.transaction_type === 'payment'
      && /payment|pmt/i.test(paymentText)
      && !/credit|refund/i.test(paymentText);
    if (looksLikePayment && !t.job_id && !t.chart_account_id) {
      const isReconciled = !!t.is_reconciled;
      badges.push(
        isReconciled
          ? <Badge className="bg-green-500 text-white" key="reconciled">Reconciled</Badge>
          : <Badge variant="secondary" key="unreconciled">Unreconciled</Badge>
      );
      return <div className="flex items-center gap-1">{badges}</div>;
    }

    // For all other cases (charges, credits, refunds, or misclassified payments being coded): show coding status
    const hasMatches = !!t.invoice_id || !!t.receipt_id;
    const matchConfirmed = !!t.match_confirmed;
    const coded = isTransactionCoded(t);

    // Show match confirmation status if there are potential matches
    if (hasMatches && !matchConfirmed) {
      badges.push(<Badge className="bg-amber-500 text-white" key="needsconfirm">Matches Found</Badge>);
    }

    if (t.requested_coder_id) {
      badges.push(<Badge className="bg-purple-500 text-white" key="assist">Assistance Requested</Badge>);
    }

    badges.push(
      coded
        ? <Badge className="bg-green-500 text-white" key="coded">Coded</Badge>
        : <Badge variant="destructive" key="uncoded">Uncoded</Badge>
    );

    if (t.is_reconciled && !t.attachment_url) {
      badges.push(<Badge variant="outline" key="noattach">*</Badge>);
    }

    return <div className="flex items-center gap-1">{badges}</div>;
  };
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!creditCard) {
    return <div className="flex items-center justify-center h-screen">Credit card not found</div>;
  }


  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/payables/credit-cards/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">{creditCard.card_name} - Transactions</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/payables/credit-cards/${id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Credit Card
          </Button>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Transaction</DialogTitle>
                <DialogDescription>
                  Manually add a single card transaction.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Transaction Date *</Label>
                    <Input
                      type="date"
                      value={newTransaction.transaction_date}
                      onChange={(e) => setNewTransaction({...newTransaction, transaction_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Amount *</Label>
                    <CurrencyInput
                      value={newTransaction.amount}
                      onChange={(value) => setNewTransaction({...newTransaction, amount: value})}
                    />
                  </div>
                </div>
                <div>
                  <Label>Description *</Label>
                  <Input
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                    placeholder="Transaction description"
                  />
                </div>
                <div>
                  <Label>Merchant Name</Label>
                  <Input
                    value={newTransaction.merchant_name}
                    onChange={(e) => setNewTransaction({...newTransaction, merchant_name: e.target.value})}
                    placeholder="Merchant or vendor name"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={newTransaction.category}
                    onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
                    placeholder="Transaction category"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={newTransaction.notes}
                    onChange={(e) => setNewTransaction({...newTransaction, notes: e.target.value})}
                    placeholder="Additional notes"
                  />
                </div>
                <Button onClick={handleAddTransaction} className="w-full">
                  Add Transaction
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {selectedTransactions.size > 0 && (
        <Card className="bg-primary/5 border-primary">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {selectedTransactions.size} transaction{selectedTransactions.size > 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTransactions(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handlePostToGL(Array.from(selectedTransactions))}
                  disabled={
                    postingToGL || 
                    !Array.from(selectedTransactions).every(id => {
                      const t = transactions.find(t => t.id === id);
                      return t && isTransactionCoded(t) && !t.journal_entry_id;
                    })
                  }
                >
                  <Send className="h-4 w-4 mr-2" />
                  {postingToGL ? "Posting..." : "Post to GL"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post All Coded Button */}
      {transactions.some(t => isTransactionCoded(t) && !t.journal_entry_id) && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ready to Post</p>
                <p className="text-xs text-muted-foreground">
                  {transactions.filter(t => isTransactionCoded(t) && !t.journal_entry_id).length} coded transaction(s) can be posted to GL
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={handlePostAllCoded}
                disabled={postingToGL}
              >
                <Send className="h-4 w-4 mr-2" />
                {postingToGL ? "Posting..." : "Post All Coded"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="border-separate border-spacing-0">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={transactions.length > 0 && selectedTransactions.size === transactions.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center">
                    Date
                    {getSortIcon('date')}
                  </div>
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center">
                    Amount
                    {getSortIcon('amount')}
                  </div>
                </TableHead>
                <TableHead className="text-right">Running Balance</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('attachment')}
                >
                  <div className="flex items-center justify-center">
                    Attachment
                    {getSortIcon('attachment')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No transactions found. Import a CSV or add transactions manually.
                  </TableCell>
                </TableRow>
              ) : (
                sortedTransactions.map((trans) => (
                  <TableRow 
                    key={trans.id} 
                    className="group hover:bg-primary/5 transition-colors"
                  >
                    <TableCell 
                      className="py-1 border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedTransactions.has(trans.id)}
                        onCheckedChange={(checked) => handleSelectTransaction(trans.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell 
                      className="py-1 border-y border-transparent group-hover:border-primary cursor-pointer"
                      onClick={() => openTransactionDetail(trans.id)}
                    >
                      {new Date(trans.transaction_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell 
                      className="py-1 border-y border-transparent group-hover:border-primary cursor-pointer"
                      onClick={() => openTransactionDetail(trans.id)}
                    >
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">{trans.description}</p>
                        {trans.merchant_name && trans.merchant_name !== trans.description && (
                            <p className="text-xs text-muted-foreground">{trans.merchant_name}</p>
                          )}
                      </div>
                    </TableCell>
                    <TableCell 
                      className="py-1 font-semibold border-y border-transparent group-hover:border-primary cursor-pointer"
                      onClick={() => openTransactionDetail(trans.id)}
                    >
                      {(() => {
                        const amt = Number(trans.amount);
                        const isCredit = trans.transaction_type === 'payment' || trans.transaction_type === 'credit' || trans.transaction_type === 'refund' || amt < 0;
                        return (
                          <span className={isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {isCredit ? `${formatCurrency(Math.abs(amt))} (Credit)` : formatCurrency(amt)}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell 
                      className="py-1 text-right font-semibold border-y border-transparent group-hover:border-primary cursor-pointer"
                      onClick={() => openTransactionDetail(trans.id)}
                    >
                      {formatCurrency(runningBalances.get(trans.id) || 0)}
                    </TableCell>
                    <TableCell 
                      className="py-1 text-center border-y border-transparent group-hover:border-primary cursor-pointer"
                      onClick={() => openTransactionDetail(trans.id)}
                    >
                    {(() => {
                        const hasAttachment = !!trans.attachment_url;
                        const bypass = !!trans.bypass_attachment_requirement;
                        const hasVendor = !!trans.vendor_id;
                        const hasJobOrAccount = !!trans.job_id || !!trans.chart_account_id;
                        const hasCostCode = trans.job_id ? !!trans.cost_code_id : true;
                        const coded = hasVendor && hasJobOrAccount && hasCostCode;
                        
                        // Show smiley if attachment exists (regardless of coding status)
                        if (hasAttachment) {
                          return <Smile className="h-5 w-5 text-green-500 inline-block" />;
                        }
                        
                        // Show sad face if coded without attachment (bypass was used)
                        if (coded && !hasAttachment && bypass) {
                          return <Frown className="h-5 w-5 text-amber-500 inline-block" />;
                        }
                        
                        // Show nothing for uncoded transactions without attachment
                        return <span className="text-muted-foreground">-</span>;
                      })()}
                    </TableCell>
                    <TableCell 
                      className="py-1 border-y border-transparent group-hover:border-primary cursor-pointer last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg"
                      onClick={() => openTransactionDetail(trans.id)}
                    >
                      {getStatusBadge(trans)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Detail Modal */}
      {selectedTransactionId && (
        <CreditCardTransactionModal
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
          transactionId={selectedTransactionId}
          onComplete={handleModalComplete}
          initialMatches={matchedReceipts.get(selectedTransactionId) || []}
        />
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transactions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTransactions.size} transaction{selectedTransactions.size > 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
