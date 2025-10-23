import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Plus, Paperclip, FileText } from "lucide-react";
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
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRequestCoding = async (transactionId: string, requestedCoderId: string | null) => {
    try {
      if (!requestedCoderId) {
        // Remove coding request
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
        // Create coding request
        await supabase
          .from("credit_card_transactions")
          .update({ 
            requested_coder_id: requestedCoderId,
            coding_status: 'pending',
          })
          .eq("id", transactionId);

        await supabase
          .from("credit_card_coding_requests")
          .insert({
            transaction_id: transactionId,
            company_id: currentCompany?.id,
            requested_by: user?.id,
            requested_coder_id: requestedCoderId,
            status: 'pending',
            message: `Coding assistance requested for transaction`,
          });
      }

      toast({
        title: "Success",
        description: requestedCoderId ? "Coding request sent" : "Coding request removed",
      });

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

      toast({
        title: "Success",
        description: "Attachment uploaded successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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
                <TableHead>Job</TableHead>
                <TableHead>Cost Code</TableHead>
                <TableHead>Request Coding</TableHead>
                <TableHead>Attachment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No transactions found. Import a CSV or add transactions manually.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((trans) => (
                  <TableRow key={trans.id}>
                    <TableCell>
                      {new Date(trans.transaction_date).toLocaleDateString()}
                    </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{trans.description}</p>
                    {trans.merchant_name && (
                      <p className="text-sm text-muted-foreground">{trans.merchant_name}</p>
                    )}
                    {matchedReceipts.has(trans.id) && (
                      <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs font-semibold text-blue-700 mb-1">
                          🔗 Possible receipt matches:
                        </p>
                        {matchedReceipts.get(trans.id)?.slice(0, 2).map((receipt: any) => (
                          <div key={receipt.id} className="text-xs text-blue-600 mb-1">
                            {receipt.vendor_name} - ${Number(receipt.amount).toFixed(2)} on{" "}
                            {new Date(receipt.receipt_date).toLocaleDateString()}
                            <Button
                              size="sm"
                              variant="link"
                              className="h-auto p-0 ml-2 text-xs"
                              onClick={() => window.open(`/uncoded?receipt=${receipt.id}`, '_blank')}
                            >
                              View Receipt
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TableCell>
                    <TableCell className="font-semibold">
                      ${Number(trans.amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={trans.job_id || "none"}
                        onValueChange={(value) => handleJobChange(trans.id, value === "none" ? null : value)}
                      >
                        <SelectTrigger className="w-[200px]">
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
                    </TableCell>
                    <TableCell>
                      <Select
                        value={trans.cost_code_id || "none"}
                        onValueChange={(value) => handleCostCodeChange(trans.id, value === "none" ? null : value)}
                        disabled={!trans.job_id}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select cost code" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Cost Code</SelectItem>
                          {filteredCostCodes(trans.job_id).map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.code} - {cc.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={trans.requested_coder_id || "none"}
                        onValueChange={(value) => handleRequestCoding(trans.id, value === "none" ? null : value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Request help" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Request</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                              {u.first_name} {u.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {trans.attachment_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(trans.attachment_url, '_blank')}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleAttachmentUpload(trans.id, file);
                            }}
                          />
                          <Button size="sm" variant="outline" asChild>
                            <span>
                              <Paperclip className="h-4 w-4" />
                            </span>
                          </Button>
                        </label>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trans.coding_status === 'coded' ? 'bg-green-100 text-green-800' :
                        trans.coding_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {trans.coding_status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
