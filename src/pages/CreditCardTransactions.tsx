import { useEffect, useState, useMemo } from "react";
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
import { ArrowLeft, Upload, Plus, Smile, Frown, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Papa from "papaparse";
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
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [duplicatesFound, setDuplicatesFound] = useState<number>(0);
  const [matchedReceipts, setMatchedReceipts] = useState<Map<string, any[]>>(new Map());
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
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
          cost_codes:cost_code_id(id, code, description),
          requested_coder:requested_coder_id(user_id, first_name, last_name),
          vendors:vendor_id(id, name),
          chart_of_accounts:chart_account_id(id, account_number, account_name)
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

      // Fetch cost codes
      const { data: costCodesData } = await supabase
        .from("cost_codes")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .eq("is_active", true)
        .order("code");

      setCostCodes(costCodesData || []);

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
          
          // Check if amount is within 1% tolerance
          const amountMatch = Math.abs(
            Number(receipt.amount) - Number(transaction.amount)
          ) / Number(transaction.amount) < 0.01;

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

  const handleCsvUpload = async () => {
    if (!csvFile || !currentCompany) return;

    setUploadingCsv(true);
    setDuplicatesFound(0);
    
    try {
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          // Detect CSV format by checking column names
          const headers = results.meta.fields || [];
          const isChaseFormat = headers.includes('Card') && headers.includes('Transaction Date') && headers.includes('Post Date');
          
          // Fetch existing transactions to check for duplicates and merge with coded transactions
          const { data: existingTransactions } = await supabase
            .from("credit_card_transactions")
            .select("id, transaction_date, amount, description, merchant_name, invoice_id, coding_status")
            .eq("credit_card_id", id);

          const existingSet = new Set(
            (existingTransactions || []).map(t => 
              `${t.transaction_date}-${t.amount}-${t.description || t.merchant_name}`
            )
          );

          // Create a map of invoice_id to existing transaction for merging
          const invoiceTransactionMap = new Map(
            (existingTransactions || [])
              .filter(t => t.invoice_id && t.coding_status === 'coded')
              .map(t => [t.invoice_id, t])
          );

          let duplicateCount = 0;
          let mergedCount = 0;
          const transactionsToInsert: any[] = [];
          const transactionsToUpdate: any[] = [];
          
          // Process each transaction to check for merging with coded transactions
          for (const transaction of results.data) {
            if (!transaction) continue;
            
            let parsedTransaction: any;
            
            if (isChaseFormat) {
              // Parse Chase CSV format
              const transactionDate = transaction['Transaction Date'];
              const postDate = transaction['Post Date'];
              const description = transaction.Description || "";
              const category = transaction.Category || null;
              const type = transaction.Type || "";
              const memo = transaction.Memo || null;
              
              if (!transactionDate || !description || !transaction.Amount || !type) continue;
              
              // Parse amount - Chase uses negative for charges/fees, positive for payments
              let amount = parseFloat(transaction.Amount.replace(/[^0-9.-]/g, ""));
              
              // For payments (positive amounts), we skip them or handle differently
              if (amount > 0 && type === 'Payment') continue;
              
              amount = Math.abs(amount);
              const formattedDate = new Date(transactionDate).toISOString().split('T')[0];
              
              // Check for duplicate
              const key = `${formattedDate}-${amount}-${description}`;
              if (existingSet.has(key)) {
                duplicateCount++;
                continue;
              }
              
              // Check if this matches a coded transaction by amount and date (within tolerance)
              let matchedTransaction = null;
              for (const [invoiceId, existingTrans] of invoiceTransactionMap.entries()) {
                const amountMatch = Math.abs(existingTrans.amount - amount) < 0.01; // Within 1 cent
                const transDate = new Date(formattedDate);
                const existDate = new Date(existingTrans.transaction_date);
                const daysDiff = Math.abs((transDate.getTime() - existDate.getTime()) / (1000 * 60 * 60 * 24));
                const dateMatch = daysDiff <= 7; // Within 7 days
                
                if (amountMatch && dateMatch) {
                  matchedTransaction = existingTrans;
                  break;
                }
              }
              
              // Determine transaction type based on Type column
              let transactionType = type;
              if (type === 'Sale') {
                transactionType = 'purchase';
              } else if (type === 'Fee') {
                transactionType = 'fee';
              }
              
              parsedTransaction = {
                credit_card_id: id,
                company_id: currentCompany.id,
                transaction_date: formattedDate,
                post_date: postDate ? new Date(postDate).toISOString().split('T')[0] : null,
                description: description,
                merchant_name: description,
                amount: amount,
                category: category,
                transaction_type: transactionType,
                notes: memo,
                reference_number: transaction.Card || null,
                created_by: user?.id,
                imported_from_csv: true,
                coding_status: matchedTransaction ? 'coded' : 'uncoded',
              };
              
              if (matchedTransaction) {
                // Merge with existing coded transaction
                transactionsToUpdate.push({
                  id: matchedTransaction.id,
                  ...parsedTransaction,
                  invoice_id: matchedTransaction.invoice_id,
                  job_id: matchedTransaction.job_id,
                  cost_code_id: matchedTransaction.cost_code_id,
                  coding_status: 'coded',
                });
                mergedCount++;
                invoiceTransactionMap.delete(matchedTransaction.invoice_id); // Remove so we don't match again
              } else {
                transactionsToInsert.push(parsedTransaction);
              }
            } else {
              // Parse generic CSV format
              if (!transaction.Date || !transaction.Description || !transaction.Amount) continue;
              
              const transactionDate = new Date(transaction.Date).toISOString().split('T')[0];
              const amount = Math.abs(parseFloat(transaction.Amount.replace(/[^0-9.-]/g, "")));
              const description = transaction.Description || "";
              
              // Check for duplicate
              const key = `${transactionDate}-${amount}-${description}`;
              if (existingSet.has(key)) {
                duplicateCount++;
                continue;
              }
              
              // Check if this matches a coded transaction
              let matchedTransaction = null;
              for (const [invoiceId, existingTrans] of invoiceTransactionMap.entries()) {
                const amountMatch = Math.abs(existingTrans.amount - amount) < 0.01;
                const transDate = new Date(transactionDate);
                const existDate = new Date(existingTrans.transaction_date);
                const daysDiff = Math.abs((transDate.getTime() - existDate.getTime()) / (1000 * 60 * 60 * 24));
                const dateMatch = daysDiff <= 7;
                
                if (amountMatch && dateMatch) {
                  matchedTransaction = existingTrans;
                  break;
                }
              }
              
              parsedTransaction = {
                credit_card_id: id,
                company_id: currentCompany.id,
                transaction_date: transactionDate,
                description: description,
                merchant_name: transaction.Merchant || description,
                amount: amount,
                category: transaction.Category || null,
                reference_number: transaction.Reference || null,
                created_by: user?.id,
                imported_from_csv: true,
                coding_status: matchedTransaction ? 'coded' : 'uncoded',
              };
              
              if (matchedTransaction) {
                transactionsToUpdate.push({
                  id: matchedTransaction.id,
                  ...parsedTransaction,
                  invoice_id: matchedTransaction.invoice_id,
                  job_id: matchedTransaction.job_id,
                  cost_code_id: matchedTransaction.cost_code_id,
                  coding_status: 'coded',
                });
                mergedCount++;
                invoiceTransactionMap.delete(matchedTransaction.invoice_id);
              } else {
                transactionsToInsert.push(parsedTransaction);
              }
            }
          }

          setDuplicatesFound(duplicateCount);

          if (transactionsToInsert.length === 0 && transactionsToUpdate.length === 0) {
            if (duplicateCount > 0) {
              toast({
                title: "No New Transactions",
                description: `All ${duplicateCount} transactions were duplicates and skipped`,
              });
            } else {
              throw new Error("No valid transactions found in CSV");
            }
            setCsvFile(null);
            return;
          }

          // Insert new transactions
          if (transactionsToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from("credit_card_transactions")
              .insert(transactionsToInsert);

            if (insertError) throw insertError;
          }

          // Update existing coded transactions with CSV data
          if (transactionsToUpdate.length > 0) {
            for (const trans of transactionsToUpdate) {
              const { id, ...updateData } = trans;
              const { error: updateError } = await supabase
                .from("credit_card_transactions")
                .update(updateData)
                .eq("id", id);

              if (updateError) {
                console.error('Error updating transaction:', updateError);
              }
            }
          }
          
          // Update credit card statistics
          const { data: currentCard } = await supabase
            .from("credit_cards")
            .select("csv_import_count")
            .eq("id", id)
            .single();

          await supabase
            .from("credit_cards")
            .update({ 
              csv_import_count: (currentCard?.csv_import_count || 0) + 1,
              last_csv_import_date: new Date().toISOString(),
              last_csv_import_by: user?.id,
            })
            .eq("id", id);

          let message = '';
          if (mergedCount > 0 && transactionsToInsert.length > 0) {
            message = `Imported ${transactionsToInsert.length} new transactions, merged ${mergedCount} with existing bills`;
            if (duplicateCount > 0) {
              message += ` (${duplicateCount} duplicates skipped)`;
            }
          } else if (mergedCount > 0) {
            message = `Merged ${mergedCount} transactions with existing bills`;
            if (duplicateCount > 0) {
              message += ` (${duplicateCount} duplicates skipped)`;
            }
          } else {
            message = `Imported ${transactionsToInsert.length} transactions`;
            if (duplicateCount > 0) {
              message += ` (${duplicateCount} duplicates skipped)`;
            }
          }

          toast({
            title: "Success",
            description: message,
          });

          setCsvFile(null);
          fetchData();
        },
        error: (error: any) => {
          throw new Error(`CSV parsing error: ${error.message}`);
        },
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingCsv(false);
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
      // Payment transactions reduce the balance (they're already negative or marked as payment type)
      if (trans.transaction_type === 'payment' || trans.amount < 0) {
        balance += trans.amount; // Amount is negative for payments
      } else {
        balance += Number(trans.amount); // Add charges
      }
      balanceMap.set(trans.id, balance);
    });
    
    return balanceMap;
  }, [transactions]);

  const openTransactionDetail = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setShowDetailModal(true);
  };

  const getStatusBadge = (t: any) => {
    const badges: JSX.Element[] = [];

    // For payments: show reconciliation status only
    if (t.transaction_type === 'payment') {
      const isReconciled = !!t.is_reconciled;
      badges.push(
        isReconciled
          ? <Badge className="bg-green-500 text-white" key="reconciled">Reconciled</Badge>
          : <Badge variant="secondary" key="unreconciled">Unreconciled</Badge>
      );
      return <div className="flex items-center gap-1">{badges}</div>;
    }

    // For charges: show coding status
    const hasVendor = !!t.vendor_id;
    const hasJobOrAccount = !!t.job_id || !!t.chart_account_id;
    const hasCostCode = t.job_id ? !!t.cost_code_id : true; // cost code required only when job selected
    const hasAttachment = !!t.attachment_url;
    const bypass = !!t.bypass_attachment_requirement;
    const hasMatches = !!t.invoice_id || !!t.receipt_id;
    const matchConfirmed = !!t.match_confirmed;
    const coded = hasVendor && hasJobOrAccount && hasCostCode && (bypass ? true : hasAttachment);

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

    if (t.is_reconciled && !hasAttachment) {
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
    <div className="container mx-auto p-6 space-y-6">
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
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Transactions from CSV</DialogTitle>
                <DialogDescription>
                  Upload a CSV from your bank; payments are ignored, purchases are imported.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>CSV File</Label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>Supported formats:</strong><br />
                    <span className="text-xs">
                      • Generic: Date, Description, Merchant, Amount, Category, Reference<br />
                      • Chase: Card, Transaction Date, Post Date, Description, Category, Type, Amount, Memo
                    </span>
                  </p>
                </div>
                <Button
                  onClick={handleCsvUpload}
                  disabled={!csvFile || uploadingCsv}
                  className="w-full"
                >
                  {uploadingCsv ? "Importing..." : "Import Transactions"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Running Balance</TableHead>
                <TableHead>Attachment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No transactions found. Import a CSV or add transactions manually.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((trans) => (
                  <TableRow 
                    key={trans.id} 
                    className="cursor-pointer border-y border-x hover:border-primary hover:bg-primary/5 hover:shadow-md hover:rounded-lg transition-all duration-200 group"
                    onClick={() => openTransactionDetail(trans.id)}
                  >
                    <TableCell>
                      {new Date(trans.transaction_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">{trans.description}</p>
                        {trans.merchant_name && trans.merchant_name !== trans.description && (
                          <p className="text-sm text-muted-foreground">{trans.merchant_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      <span className={trans.transaction_type === 'payment' || trans.amount < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {trans.transaction_type === 'payment' || trans.amount < 0 
                          ? `${formatCurrency(Math.abs(trans.amount))}`
                          : formatCurrency(trans.amount)
                        }
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(runningBalances.get(trans.id) || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const hasVendor = !!trans.vendor_id;
                        const hasJobOrAccount = !!trans.job_id || !!trans.chart_account_id;
                        const hasCostCode = trans.job_id ? !!trans.cost_code_id : true;
                        const hasAttachment = !!trans.attachment_url;
                        const bypass = !!trans.bypass_attachment_requirement;
                        const coded = hasVendor && hasJobOrAccount && hasCostCode && (bypass ? true : hasAttachment);
                        
                        // Show smiley if coded with attachment
                        if (coded && hasAttachment) {
                          return <Smile className="h-5 w-5 text-green-500 inline-block" />;
                        }
                        
                        // Show sad face ONLY if coded without attachment (bypass was used)
                        if (coded && !hasAttachment && bypass) {
                          return <Frown className="h-5 w-5 text-amber-500 inline-block" />;
                        }
                        
                        // Show nothing for uncoded transactions
                        return <span className="text-muted-foreground">-</span>;
                      })()}
                    </TableCell>
                    <TableCell>
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
          onComplete={fetchData}
          initialMatches={matchedReceipts.get(selectedTransactionId) || []}
        />
      )}
    </div>
  );
}
