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
  const [communications, setCommunications] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [requestedUsers, setRequestedUsers] = useState<any[]>([]);
  
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

  const handleJobChange = async (transactionId: string, jobId: string | null) => {
    try {
      await supabase
        .from("credit_card_transactions")
        .update({ 
          job_id: jobId,
          cost_code_id: null, // Reset cost code when job changes
        })
        .eq("id", transactionId);

      const updatedTransaction = { ...selectedTransaction, job_id: jobId, cost_code_id: null };
      setSelectedTransaction(updatedTransaction);
      
      await updateCodingStatus(transactionId, updatedTransaction);
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
      // Update cost code
      await supabase
        .from("credit_card_transactions")
        .update({ cost_code_id: costCodeId })
        .eq("id", transactionId);

      // Update local state
      const updatedTransaction = { ...selectedTransaction, cost_code_id: costCodeId };
      setSelectedTransaction(updatedTransaction);
      
      // Check if transaction should be marked as coded
      await updateCodingStatus(transactionId, updatedTransaction);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateCodingStatus = async (transactionId: string, transaction: any) => {
    // A transaction is only coded if:
    // 1. Has a job assigned
    // 2. Has a cost code assigned (if job is assigned)
    // 3. Has an attachment
    const hasJob = !!transaction.job_id;
    const hasCostCode = !!transaction.cost_code_id;
    const hasAttachment = !!transaction.attachment_url;
    
    const isCoded = hasJob && hasCostCode && hasAttachment;
    const newStatus = isCoded ? 'coded' : 'uncoded';

    const { error } = await supabase
      .from("credit_card_transactions")
      .update({ coding_status: newStatus })
      .eq("id", transactionId);

    if (!error && selectedTransaction) {
      setSelectedTransaction({ ...transaction, coding_status: newStatus });
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

      await supabase
        .from("credit_card_transactions")
        .update({ attachment_url: publicUrl })
        .eq("id", transactionId);

      // Create preview for images and PDFs
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setAttachmentPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        setAttachmentPreview(publicUrl);
      }

      const updatedTransaction = { ...selectedTransaction, attachment_url: publicUrl };
      setSelectedTransaction(updatedTransaction);
      
      await updateCodingStatus(transactionId, updatedTransaction);
      
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

  const openTransactionDetail = async (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
    setAttachmentPreview(null);
    setSelectedCoders([]);
    setNewMessage("");

    // Fetch all coding requests for this transaction with user details
    const { data: requests } = await supabase
      .from("credit_card_coding_requests")
      .select("requested_coder_id")
      .eq("transaction_id", transaction.id)
      .eq("status", "pending");

    if (requests && requests.length > 0) {
      const coderIds = requests.map(r => r.requested_coder_id);
      setSelectedCoders(coderIds);
      
      // Fetch user details for requested coders
      const { data: userDetails } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", coderIds);
      
      setRequestedUsers(userDetails || []);
    } else {
      setRequestedUsers([]);
    }

    // Fetch communications for this transaction
    const { data: comms } = await supabase
      .from("credit_card_transaction_communications")
      .select(`
        *,
        user:user_id(user_id, first_name, last_name)
      `)
      .eq("transaction_id", transaction.id)
      .order("created_at", { ascending: true });

    setCommunications(comms || []);

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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTransaction) return;

    try {
      const { error } = await supabase
        .from("credit_card_transaction_communications")
        .insert({
          transaction_id: selectedTransaction.id,
          company_id: currentCompany?.id,
          user_id: user?.id,
          message: newMessage.trim(),
        });

      if (error) throw error;

      // Refresh communications
      const { data: comms } = await supabase
        .from("credit_card_transaction_communications")
        .select(`
          *,
          user:user_id(user_id, first_name, last_name)
        `)
        .eq("transaction_id", selectedTransaction.id)
        .order("created_at", { ascending: true });

      setCommunications(comms || []);
      setNewMessage("");

      toast({
        title: "Success",
        description: "Message sent to all administrators, controllers, and assigned coders",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (transaction: any) => {
    if (transaction.requested_coder_id) {
      return <Badge className="bg-purple-500 text-white">Assistance Requested</Badge>;
    }
    if (transaction.coding_status === 'coded') {
      return <Badge className="bg-green-500 text-white">Coded</Badge>;
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
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {getStatusBadge(selectedTransaction)}
                    {requestedUsers.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {requestedUsers.map((u: any) => (
                          <Badge key={u.user_id} variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                            {u.first_name} {u.last_name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
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
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox
                      id="all-users"
                      checked={selectedCoders.length === users.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCoders(users.map(u => u.user_id));
                        } else {
                          setSelectedCoders([]);
                        }
                      }}
                    />
                    <label
                      htmlFor="all-users"
                      className="text-sm font-bold leading-none cursor-pointer"
                    >
                      All Users
                    </label>
                  </div>
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

              {/* Communication Section */}
              <div className="border-t pt-6">
                <Label className="text-lg font-semibold">Discussion</Label>
                <div className="mt-3 space-y-3 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                  {communications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No messages yet. Start the discussion below.
                    </p>
                  ) : (
                    communications.map((comm: any) => (
                      <div key={comm.id} className="bg-background p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">
                            {comm.user?.first_name} {comm.user?.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comm.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{comm.message}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    size="sm"
                  >
                    Send
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
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
