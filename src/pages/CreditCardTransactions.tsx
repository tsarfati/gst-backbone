import { useEffect, useState } from "react";
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
import { ArrowLeft, Upload, Plus, Paperclip, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Papa from "papaparse";
import { CurrencyInput } from "@/components/ui/currency-input";

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
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCoders, setSelectedCoders] = useState<string[]>([]);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  
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
          requested_coder:requested_coder_id(user_id, first_name, last_name)
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
          
          // Fetch existing transactions to check for duplicates
          const { data: existingTransactions } = await supabase
            .from("credit_card_transactions")
            .select("transaction_date, amount, description, merchant_name")
            .eq("credit_card_id", id);

          const existingSet = new Set(
            (existingTransactions || []).map(t => 
              `${t.transaction_date}-${t.amount}-${t.description || t.merchant_name}`
            )
          );

          let duplicateCount = 0;
          
          const transactions = results.data
            .filter((row: any) => {
              if (isChaseFormat) {
                // Chase format: has Transaction Date, Description, Amount, and Type
                return row['Transaction Date'] && row.Description && row.Amount && row.Type;
              } else {
                // Generic format
                return row.Date && row.Description && row.Amount;
              }
            })
            .map((row: any) => {
              if (isChaseFormat) {
                // Parse Chase CSV format
                const transactionDate = row['Transaction Date'];
                const postDate = row['Post Date'];
                const description = row.Description || "";
                const category = row.Category || null;
                const type = row.Type || "";
                const memo = row.Memo || null;
                
                // Parse amount - Chase uses negative for charges/fees, positive for payments
                let amount = parseFloat(row.Amount.replace(/[^0-9.-]/g, ""));
                
                // For payments (positive amounts), we skip them or handle differently
                // For charges/fees (negative amounts), make them positive
                if (amount > 0 && type === 'Payment') {
                  // Skip payments - they're not charges
                  return null;
                }
                
                amount = Math.abs(amount);
                
                // Check for duplicate
                const key = `${new Date(transactionDate).toISOString().split('T')[0]}-${amount}-${description}`;
                if (existingSet.has(key)) {
                  duplicateCount++;
                  return null;
                }
                
                // Determine transaction type based on Type column
                let transactionType = type;
                if (type === 'Sale') {
                  transactionType = 'purchase';
                } else if (type === 'Fee') {
                  transactionType = 'fee';
                }

                return {
                  credit_card_id: id,
                  company_id: currentCompany.id,
                  transaction_date: new Date(transactionDate).toISOString().split('T')[0],
                  post_date: postDate ? new Date(postDate).toISOString().split('T')[0] : null,
                  description: description,
                  merchant_name: description, // Use description as merchant for Chase format
                  amount: amount,
                  category: category,
                  transaction_type: transactionType,
                  notes: memo,
                  reference_number: row.Card || null, // Store card number as reference
                  created_by: user?.id,
                  imported_from_csv: true,
                  coding_status: 'uncoded',
                };
              } else {
                // Parse generic CSV format
                const transactionDate = new Date(row.Date).toISOString().split('T')[0];
                const amount = Math.abs(parseFloat(row.Amount.replace(/[^0-9.-]/g, "")));
                const description = row.Description || "";
                
                // Check for duplicate
                const key = `${transactionDate}-${amount}-${description}`;
                if (existingSet.has(key)) {
                  duplicateCount++;
                  return null;
                }
                
                return {
                  credit_card_id: id,
                  company_id: currentCompany.id,
                  transaction_date: transactionDate,
                  description: description,
                  merchant_name: row.Merchant || description,
                  amount: amount,
                  category: row.Category || null,
                  reference_number: row.Reference || null,
                  created_by: user?.id,
                  imported_from_csv: true,
                  coding_status: 'uncoded',
                };
              }
            })
            .filter((t: any) => t !== null); // Remove null entries (like payments and duplicates)

          setDuplicatesFound(duplicateCount);

          if (transactions.length === 0) {
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

          const { error } = await supabase
            .from("credit_card_transactions")
            .insert(transactions);

          if (error) throw error;

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

          const message = duplicateCount > 0
            ? `Imported ${transactions.length} transactions (${duplicateCount} duplicates skipped)`
            : `Imported ${transactions.length} transactions`;

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

  const handleJobChange = async (transactionId: string, jobId: string | null) => {
    try {
      const { error } = await supabase
        .from("credit_card_transactions")
        .update({ 
          job_id: jobId,
          cost_code_id: null, // Reset cost code when job changes
        })
        .eq("id", transactionId);

      if (error) throw error;
      
      // Update local state
      setSelectedTransaction((prev: any) => prev ? { ...prev, job_id: jobId, cost_code_id: null } : null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCostCodeChange = async (transactionId: string, costCodeId: string | null) => {
    try {
      const { error } = await supabase
        .from("credit_card_transactions")
        .update({ 
          cost_code_id: costCodeId,
          coding_status: costCodeId ? 'coded' : 'uncoded',
        })
        .eq("id", transactionId);

      if (error) throw error;
      
      // Update local state
      setSelectedTransaction((prev: any) => prev ? { ...prev, cost_code_id: costCodeId, coding_status: costCodeId ? 'coded' : 'uncoded' } : null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRequestCoding = async (transactionId: string, coderIds: string[]) => {
    try {
      if (coderIds.length === 0) {
        // Remove all coding requests
        await supabase
          .from("credit_card_transactions")
          .update({ 
            requested_coder_id: null,
            coding_status: 'uncoded',
          })
          .eq("id", transactionId);

        await supabase
          .from("credit_card_coding_requests")
          .delete()
          .eq("transaction_id", transactionId);
      } else {
        // Create coding requests for multiple users
        const firstCoderId = coderIds[0];
        await supabase
          .from("credit_card_transactions")
          .update({ 
            requested_coder_id: firstCoderId,
            coding_status: 'pending',
          })
          .eq("id", transactionId);

        // Delete existing requests
        await supabase
          .from("credit_card_coding_requests")
          .delete()
          .eq("transaction_id", transactionId);

        // Insert new requests for all selected coders
        const requests = coderIds.map(coderId => ({
          transaction_id: transactionId,
          company_id: currentCompany?.id,
          requested_by: user?.id,
          requested_coder_id: coderId,
          status: 'pending',
          message: `Coding assistance requested for transaction`,
        }));

        await supabase
          .from("credit_card_coding_requests")
          .insert(requests);
      }

      toast({
        title: "Success",
        description: coderIds.length > 0 ? `Coding request sent to ${coderIds.length} user(s)` : "Coding requests removed",
      });

      setSelectedTransaction((prev: any) => prev ? { 
        ...prev, 
        requested_coder_id: coderIds[0] || null,
        coding_status: coderIds.length > 0 ? 'pending' : 'uncoded'
      } : null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAttachmentUpload = async (transactionId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany?.id}/${transactionId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("credit-card-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("credit-card-attachments")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("credit_card_transactions")
        .update({ attachment_url: publicUrl })
        .eq("id", transactionId);

      if (updateError) throw updateError;

      // Create preview for images and PDFs
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setAttachmentPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        setAttachmentPreview(publicUrl);
      }

      toast({
        title: "Success",
        description: "Attachment uploaded successfully",
      });

      setSelectedTransaction((prev: any) => prev ? { ...prev, attachment_url: publicUrl } : null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openTransactionDetail = async (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
    setAttachmentPreview(null);
    setSelectedCoders([]);

    // Fetch all coding requests for this transaction
    const { data: requests } = await supabase
      .from("credit_card_coding_requests")
      .select("requested_coder_id")
      .eq("transaction_id", transaction.id)
      .eq("status", "pending");

    if (requests && requests.length > 0) {
      setSelectedCoders(requests.map(r => r.requested_coder_id));
    }

    // Load attachment preview if exists
    if (transaction.attachment_url) {
      if (transaction.attachment_url.includes('.jpg') || 
          transaction.attachment_url.includes('.jpeg') || 
          transaction.attachment_url.includes('.png')) {
        setAttachmentPreview(transaction.attachment_url);
      } else if (transaction.attachment_url.includes('.pdf')) {
        setAttachmentPreview(transaction.attachment_url);
      }
    }
  };

  const getStatusBadge = (transaction: any) => {
    if (transaction.requested_coder_id) {
      return <Badge className="bg-purple-500">Assistance Requested</Badge>;
    }
    if (transaction.coding_status === 'coded') {
      return <Badge className="bg-green-500">Coded</Badge>;
    }
    return <Badge variant="destructive">Uncoded</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!creditCard) {
    return <div className="flex items-center justify-center h-screen">Credit card not found</div>;
  }

  const filteredCostCodes = (jobId: string | null) => {
    if (!jobId) return [];
    return costCodes.filter(cc => !cc.job_id || cc.job_id === jobId);
  };

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
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No transactions found. Import a CSV or add transactions manually.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((trans) => (
                  <TableRow 
                    key={trans.id} 
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => openTransactionDetail(trans)}
                  >
                    <TableCell>
                      {new Date(trans.transaction_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{trans.description}</p>
                        {trans.merchant_name && trans.merchant_name !== trans.description && (
                          <p className="text-sm text-muted-foreground">{trans.merchant_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${Number(trans.amount).toLocaleString()}
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
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-6">
              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-sm text-muted-foreground">Date</Label>
                  <p className="font-medium">
                    {new Date(selectedTransaction.transaction_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Amount</Label>
                  <p className="text-lg font-semibold">
                    ${Number(selectedTransaction.amount).toLocaleString()}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm text-muted-foreground">Description</Label>
                  <p className="font-medium">{selectedTransaction.description}</p>
                </div>
                {selectedTransaction.merchant_name && (
                  <div className="col-span-2">
                    <Label className="text-sm text-muted-foreground">Merchant</Label>
                    <p>{selectedTransaction.merchant_name}</p>
                  </div>
                )}
                {selectedTransaction.category && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Category</Label>
                    <p>{selectedTransaction.category}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedTransaction)}</div>
                </div>
              </div>

              {/* Job Selection */}
              <div>
                <Label>Job</Label>
                <Select
                  value={selectedTransaction.job_id || "none"}
                  onValueChange={(value) => handleJobChange(selectedTransaction.id, value === "none" ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Job</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cost Code Selection */}
              <div>
                <Label>Cost Code</Label>
                <Select
                  value={selectedTransaction.cost_code_id || "none"}
                  onValueChange={(value) => handleCostCodeChange(selectedTransaction.id, value === "none" ? null : value)}
                  disabled={!selectedTransaction.job_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cost code" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Cost Code</SelectItem>
                    {filteredCostCodes(selectedTransaction.job_id).map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.code} - {cc.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedTransaction.job_id && (
                  <p className="text-xs text-muted-foreground mt-1">Select a job first</p>
                )}
              </div>

              {/* Request Assistance - Multi-select */}
              <div>
                <Label>Request Coding Assistance (Select Multiple Users)</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  {users.map((u) => (
                    <div key={u.user_id} className="flex items-center space-x-2">
                      <Checkbox
                        id={u.user_id}
                        checked={selectedCoders.includes(u.user_id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const newCoders = [...selectedCoders, u.user_id];
                            setSelectedCoders(newCoders);
                          } else {
                            const newCoders = selectedCoders.filter(id => id !== u.user_id);
                            setSelectedCoders(newCoders);
                          }
                        }}
                      />
                      <label
                        htmlFor={u.user_id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {u.first_name} {u.last_name}
                      </label>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full mt-2"
                  size="sm"
                  onClick={() => handleRequestCoding(selectedTransaction.id, selectedCoders)}
                >
                  Update Coding Requests
                </Button>
              </div>

              {/* Attachment Upload with Preview */}
              <div>
                <Label>Attachment</Label>
                {selectedTransaction.attachment_url ? (
                  <div className="space-y-3 mt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(selectedTransaction.attachment_url, '_blank')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Full Size
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          supabase
                            .from("credit_card_transactions")
                            .update({ attachment_url: null })
                            .eq("id", selectedTransaction.id)
                            .then(() => {
                              setSelectedTransaction({ ...selectedTransaction, attachment_url: null });
                              setAttachmentPreview(null);
                              fetchData();
                            });
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                    
                    {/* Embedded Preview */}
                    {attachmentPreview && (
                      <div className="border rounded-lg overflow-hidden bg-muted">
                        {attachmentPreview.includes('.pdf') ? (
                          <iframe
                            src={attachmentPreview}
                            className="w-full h-96"
                            title="PDF Preview"
                          />
                        ) : (
                          <img
                            src={attachmentPreview}
                            alt="Attachment preview"
                            className="w-full h-auto max-h-96 object-contain"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAttachmentUpload(selectedTransaction.id, file);
                      }}
                    />
                    <Button size="sm" variant="outline" asChild className="mt-2">
                      <span>
                        <Paperclip className="h-4 w-4 mr-2" />
                        Upload Attachment
                      </span>
                    </Button>
                  </label>
                )}
              </div>

              {/* Suggested Receipt Matches */}
              {matchedReceipts.has(selectedTransaction.id) && (
                <div>
                  <Label>Suggested Receipt Matches</Label>
                  <div className="mt-2 space-y-2">
                    {matchedReceipts.get(selectedTransaction.id)?.map((receipt: any) => (
                      <div
                        key={receipt.id}
                        className="p-3 border rounded-lg hover:bg-accent cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{receipt.vendor_name}</p>
                          <p className="text-sm text-muted-foreground">
                            ${Number(receipt.amount).toFixed(2)} on{" "}
                            {new Date(receipt.receipt_date).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/uncoded?receipt=${receipt.id}`, '_blank')}
                        >
                          View Receipt
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
