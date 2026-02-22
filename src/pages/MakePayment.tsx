import { useState, useEffect } from "react";
import { getStoragePathForDb } from '@/utils/storageUtils';
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft,
  Plus, 
  Save, 
  DollarSign, 
  FileText, 
  Building,
  CreditCard,
  Printer,
  Check,
  ChevronsUpDown
} from "lucide-react";
import BillAttachmentsModal from "@/components/BillAttachmentsModal";
import UrlPdfInlinePreview from "@/components/UrlPdfInlinePreview";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";

interface Vendor {
  id: string;
  name: string;
  payment_terms: string;
}

interface Job {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
}

interface CreditCard {
  id: string;
  card_name: string;
  issuer: string;
  card_number_last_four: string;
  liability_account_id: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  vendor_id: string;
  vendor: Vendor;
  description: string;
  job_id: string;
  jobs?: Job;
  cost_code_id?: string;
  chart_account_id?: string;
  amount_paid?: number;
  balance_due?: number;
}

interface Payment {
  id?: string;
  payment_number: string;
  vendor_id: string;
  payment_method: string;
  payment_date: string;
  amount: number;
  memo: string;
  status: string;
  check_number?: string;
  bank_account_id?: string;
  is_partial_payment?: boolean;
  payment_document_url?: string;
  bank_fee?: number;
}

interface CodedReceipt {
  id: string;
  file_url: string;
  amount: number;
  vendor_name: string;
  description: string;
  suggested_payment_amount: number;
}

export default function MakePayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [codedReceipts, setCodedReceipts] = useState<CodedReceipt[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [paymentDocument, setPaymentDocument] = useState<File | null>(null);
  const [payment, setPayment] = useState<Payment>({
    payment_number: '',
    vendor_id: '',
    payment_method: 'check',
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    memo: '',
    status: 'draft',
    check_number: '',
    bank_account_id: '',
    is_partial_payment: false,
    payment_document_url: '',
    bank_fee: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [bankFeeJobOrAccount, setBankFeeJobOrAccount] = useState<string | null>(null);
  const [isBankFeeJob, setIsBankFeeJob] = useState(false);
  const [bankFeeCostCodeId, setBankFeeCostCodeId] = useState<string | null>(null);
  const [bankFeeJobCostCodes, setBankFeeJobCostCodes] = useState<any[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [bankFeeAccountPickerOpen, setBankFeeAccountPickerOpen] = useState(false);
  const [bankFeeCostCodePickerOpen, setBankFeeCostCodePickerOpen] = useState(false);
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);
  const [attachmentsInvoiceId, setAttachmentsInvoiceId] = useState<string | null>(null);
  const [invoiceDocuments, setInvoiceDocuments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentCompany) {
      loadData();
      generatePaymentNumber();
    }
  }, [currentCompany]);

  // Handle pre-selected bill from navigation state
  useEffect(() => {
    if (location.state?.billId && allInvoices.length > 0) {
      const bill = allInvoices.find(inv => inv.id === location.state.billId);
      if (bill) {
        setSelectedVendor(bill.vendor_id);
        setSelectedInvoices([bill.id]);
        // If there's a prior payment, default to the remaining balance
        const paymentAmount = bill.balance_due ?? bill.amount;
        setIsPartialPayment(bill.amount_paid && bill.amount_paid > 0);
        setPayment(prev => ({ ...prev, vendor_id: bill.vendor_id, amount: paymentAmount }));
      }
    }
  }, [location.state, allInvoices]);

  useEffect(() => {
    if (selectedVendor || selectedJob) {
      filterInvoices();
    }
  }, [selectedVendor, selectedJob, allInvoices]);

  const loadData = async () => {
    try {
      if (!currentCompany) {
        toast({
          title: "Error",
          description: "No company selected",
          variant: "destructive",
        });
        return;
      }

      // Load all approved unpaid invoices for current company
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          vendors!inner (
            id,
            name,
            payment_terms,
            company_id
          ),
          jobs (
            id,
            name
          )
        `)
        .in('status', ['approved', 'pending_payment'])
        .eq('vendors.company_id', currentCompany.id)
        .order('due_date');

      if (invoicesError) throw invoicesError;
      
      // Fetch payments made on each invoice to calculate balance due
      const invoiceIds = (invoicesData || []).map(inv => inv.id);
      const { data: paymentLinesData } = await supabase
        .from('payment_invoice_lines')
        .select('invoice_id, amount_paid')
        .in('invoice_id', invoiceIds);
      
      // Fetch distributions with job info for invoices that might not have direct job_id
      const { data: distributions } = await supabase
        .from('invoice_cost_distributions')
        .select(`
          invoice_id,
          cost_codes(job_id, jobs(id, name))
        `)
        .in('invoice_id', invoiceIds);

      // Build a map of invoice_id -> job info from distributions
      const distributionJobMap = new Map<string, { id: string; name: string }[]>();
      distributions?.forEach((dist: any) => {
        const invoiceId = dist.invoice_id;
        const job = dist.cost_codes?.jobs;
        if (job?.id && job?.name) {
          if (!distributionJobMap.has(invoiceId)) {
            distributionJobMap.set(invoiceId, []);
          }
          const existing = distributionJobMap.get(invoiceId)!;
          if (!existing.find(j => j.id === job.id)) {
            existing.push({ id: job.id, name: job.name });
          }
        }
      });
      
      // Calculate amount paid per invoice
      const paidByInvoice: Record<string, number> = {};
      (paymentLinesData || []).forEach(pl => {
        paidByInvoice[pl.invoice_id] = (paidByInvoice[pl.invoice_id] || 0) + Number(pl.amount_paid || 0);
      });
      
      const formattedInvoices = (invoicesData || []).map(invoice => {
        const amountPaid = paidByInvoice[invoice.id] || 0;
        const balanceDue = Number(invoice.amount) - amountPaid;
        
        // Use direct job if available, otherwise get from distributions
        let jobInfo = invoice.jobs;
        if (!jobInfo) {
          const distJobs = distributionJobMap.get(invoice.id);
          if (distJobs && distJobs.length > 0) {
            jobInfo = distJobs.length === 1 
              ? distJobs[0] 
              : { id: distJobs[0].id, name: `${distJobs[0].name} (+${distJobs.length - 1})` };
          }
        }
        
        return {
          ...invoice,
          vendor: invoice.vendors,
          jobs: jobInfo,
          amount_paid: amountPaid,
          balance_due: balanceDue
        };
      }).filter(inv => inv.balance_due > 0); // Only show invoices with remaining balance
      
      setAllInvoices(formattedInvoices);
      setInvoices(formattedInvoices);

      // Extract unique vendors from invoices
      const uniqueVendors = Array.from(
        new Map(formattedInvoices.map(inv => [inv.vendor.id, inv.vendor])).values()
      );
      setVendors(uniqueVendors);

      // Extract unique jobs from invoices (now includes jobs from distributions)
      const uniqueJobs = Array.from(
        new Map(
          formattedInvoices
            .filter(inv => inv.jobs)
            .map(inv => [inv.jobs!.id, inv.jobs!])
        ).values()
      );
      setJobs(uniqueJobs);

      // Load bank accounts
      const { data: bankAccountsData, error: bankAccountsError } = await supabase
        .from('bank_accounts')
        .select('id, account_name, bank_name')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('account_name');

      if (bankAccountsError) throw bankAccountsError;
      setBankAccounts(bankAccountsData || []);

      // Load expense accounts for bank fee coding
      const { data: expenseAccountsData } = await supabase
        .from('chart_of_accounts')
        .select('id, account_number, account_name, account_type')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .in('account_type', ['expense', 'operating_expense', 'cost_of_goods_sold'])
        .or('account_number.lt.50000,account_number.gt.58000')
        .order('account_number');
      
      setExpenseAccounts(expenseAccountsData || []);

      // Load credit cards
      const { data: creditCardsData, error: creditCardsError } = await supabase
        .from('credit_cards')
        .select('id, card_name, issuer, card_number_last_four, liability_account_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('card_name');

      if (creditCardsError) throw creditCardsError;
      setCreditCards(creditCardsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    let filtered = [...allInvoices];

    if (selectedVendor && selectedVendor !== "all") {
      filtered = filtered.filter(inv => inv.vendor_id === selectedVendor);
    }

    if (selectedJob && selectedJob !== "all") {
      filtered = filtered.filter(inv => inv.job_id === selectedJob);
    }

    setInvoices(filtered);
  };

  const generatePaymentNumber = async (): Promise<string> => {
    try {
      // Get the maximum payment number by extracting the numeric portion
      const { data, error } = await supabase
        .from('payments')
        .select('payment_number')
        .like('payment_number', 'PAY-%')
        .order('payment_number', { ascending: false })
        .limit(100);

      if (error) throw error;

      let maxNumber = 0;
      if (data && data.length > 0) {
        // Find the highest number by parsing all payment numbers
        for (const payment of data) {
          const numStr = payment.payment_number?.replace('PAY-', '') || '0';
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      }

      const nextNumber = maxNumber + 1;
      const newPaymentNumber = `PAY-${nextNumber.toString().padStart(6, '0')}`;

      setPayment(prev => ({
        ...prev,
        payment_number: newPaymentNumber
      }));

      return newPaymentNumber;
    } catch (error) {
      console.error('Error generating payment number:', error);
      // Fallback: use timestamp-based number to avoid conflicts
      const fallbackNumber = `PAY-${Date.now()}`;
      setPayment(prev => ({
        ...prev,
        payment_number: fallbackNumber
      }));
      return fallbackNumber;
    }
  };

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendor(vendorId);
    if (vendorId) {
      setPayment(prev => ({ ...prev, vendor_id: vendorId }));
    }
    setSelectedInvoices([]);
    setIsPartialPayment(false);
    setPayment(prev => ({ ...prev, amount: 0 }));
  };
  
  const handleInvoiceSelection = async (invoiceId: string, checked: boolean) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    let newSelectedInvoices: string[];
    
    if (checked) {
      // Check if we already have invoices from a different vendor
      if (selectedInvoices.length > 0) {
        const firstSelectedInvoice = invoices.find(inv => inv.id === selectedInvoices[0]);
        if (firstSelectedInvoice && firstSelectedInvoice.vendor_id !== invoice.vendor_id) {
          toast({
            title: "Different Vendor",
            description: "You can only pay bills from the same vendor in one payment",
            variant: "destructive",
          });
          return;
        }
      }
      newSelectedInvoices = [...selectedInvoices, invoiceId];
      
      // Fetch document for newly selected invoice
      const { data: doc } = await supabase
        .from('invoice_documents')
        .select('file_url')
        .eq('invoice_id', invoiceId)
        .order('uploaded_at', { ascending: false })
        .maybeSingle();
      
      if (doc?.file_url) {
        setInvoiceDocuments(prev => ({ ...prev, [invoiceId]: doc.file_url }));
      }
    } else {
      newSelectedInvoices = selectedInvoices.filter(id => id !== invoiceId);
      // Remove document from state
      setInvoiceDocuments(prev => {
        const updated = { ...prev };
        delete updated[invoiceId];
        return updated;
      });
    }
    
    setSelectedInvoices(newSelectedInvoices);
    
    // Calculate total amount from selected invoices (use balance_due if available)
    if (newSelectedInvoices.length > 0) {
      const totalAmount = newSelectedInvoices.reduce((sum, id) => {
        const inv = invoices.find(i => i.id === id);
        return sum + (inv?.balance_due ?? inv?.amount ?? 0);
      }, 0);
      
      setPayment(prev => ({ 
        ...prev, 
        vendor_id: invoice.vendor_id,
        amount: isPartialPayment ? prev.amount : totalAmount
      }));
      setSelectedVendor(invoice.vendor_id);
    } else {
      setPayment(prev => ({ ...prev, vendor_id: '', amount: 0 }));
      setIsPartialPayment(false);
    }
  };

  const handleJobChange = (jobId: string) => {
    setSelectedJob(jobId);
    setSelectedInvoices([]);
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPaymentDocument(file);
  };

  const uploadPaymentDocument = async (paymentId: string): Promise<string | null> => {
    if (!paymentDocument || !currentCompany) return null;

    try {
      setUploadingDocument(true);
      const fileExt = paymentDocument.name.split('.').pop();
      const fileName = `payment-${paymentId}-${Date.now()}.${fileExt}`;
      const filePath = `${currentCompany.id}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('receipts')
        .upload(filePath, paymentDocument);

      if (uploadError) throw uploadError;

      return getStoragePathForDb('receipts', filePath);
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Warning",
        description: "Payment saved but document upload failed",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingDocument(false);
    }
  };

  const savePayment = async () => {
    if (!payment.vendor_id || selectedInvoices.length === 0) {
      toast({
        title: "Invalid Payment",
        description: "Please select at least one invoice to pay",
        variant: "destructive",
      });
      return;
    }

    // Validate bank account or credit card based on payment method
    const requiresBankAccount = ['check', 'ach', 'wire'].includes(payment.payment_method);
    const requiresCreditCard = payment.payment_method === 'credit_card';
    
    if (requiresBankAccount && !payment.bank_account_id) {
      toast({
        title: "Invalid Payment",
        description: "Please select a pay from account",
        variant: "destructive",
      });
      return;
    }

    if (requiresCreditCard && !payment.bank_account_id) {
      toast({
        title: "Invalid Payment",
        description: "Please select a credit card",
        variant: "destructive",
      });
      return;
    }

    // Validate check number if payment method is check
    if (payment.payment_method === 'check' && !payment.check_number) {
      toast({
        title: "Invalid Payment",
        description: "Please enter a check number",
        variant: "destructive",
      });
      return;
    }

    // Validate that bills are properly coded before payment
    for (const invoiceId of selectedInvoices) {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) continue;

      // Check if bill has cost distributions (multi-line coding)
      const { data: distributionCheck } = await supabase
        .from('invoice_cost_distributions')
        .select('id, cost_code_id, amount')
        .eq('invoice_id', invoiceId);

      const hasDistributions = distributionCheck && distributionCheck.length > 0;

      if (hasDistributions) {
        // Validate all distribution lines have cost codes
        for (const dist of distributionCheck!) {
          if (!dist.cost_code_id) {
            toast({
              title: "Uncoded Bill",
              description: `Bill #${invoice.invoice_number || invoiceId.substring(0, 8)} has distribution lines that are not coded to cost codes. Please code all lines before paying.`,
              variant: "destructive",
            });
            return;
          }
        }
      } else {
        // Single-line bill - validate the main invoice fields
        if (invoice.job_id && !invoice.cost_code_id) {
          toast({
            title: "Uncoded Bill",
            description: `Bill #${invoice.invoice_number || invoiceId.substring(0, 8)} is assigned to a job but has no cost code. Please code the bill before paying.`,
            variant: "destructive",
          });
          return;
        }

        if (!invoice.job_id && !invoice.chart_account_id) {
          toast({
            title: "Uncoded Bill",
            description: `Bill #${invoice.invoice_number || invoiceId.substring(0, 8)} is not assigned to a job or expense account. Please code the bill before paying.`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Validate payment amount
    if (payment.amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Payment amount must be greater than $0",
        variant: "destructive",
      });
      return;
    }

    // Validate bank fee account when bank fee is entered
    if (payment.bank_fee && payment.bank_fee > 0) {
      if (!bankFeeJobOrAccount) {
        toast({
          title: "Invalid Payment",
          description: "Please select an expense account for the bank fee",
          variant: "destructive",
        });
        return;
      }
      
      if (isBankFeeJob && !bankFeeCostCodeId) {
        toast({
          title: "Invalid Payment",
          description: "Please select a cost code for the bank fee",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      
      // Generate fresh payment number right before save to avoid conflicts
      const freshPaymentNumber = await generatePaymentNumber();
      
      // Create payment - payments start as 'pending' and progress to 'sent'/'cleared' via workflow
      const paymentToInsert = {
        payment_number: freshPaymentNumber,
        vendor_id: payment.vendor_id,
        payment_method: payment.payment_method,
        payment_date: payment.payment_date,
        amount: payment.amount,
        memo: payment.memo,
        status: 'pending',
        check_number: payment.payment_method === 'check' ? (payment.check_number || null) : null,
        bank_account_id: payment.payment_method === 'credit_card' ? null : payment.bank_account_id,
        is_partial_payment: isPartialPayment,
        bank_fee: payment.bank_fee || 0,
        created_by: user.data.user?.id
      };

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert(paymentToInsert)
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Upload document if provided
      let documentUrl = null;
      if (paymentDocument) {
        documentUrl = await uploadPaymentDocument(paymentData.id);
        if (documentUrl) {
          await supabase
            .from('payments')
            .update({ payment_document_url: documentUrl })
            .eq('id', paymentData.id);
        }
      }

      // Create payment invoice lines for all selected invoices
      const paymentLines = selectedInvoices.map(invoiceId => {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        return {
          payment_id: paymentData.id,
          invoice_id: invoiceId,
          amount_paid: invoice?.amount || 0
        };
      });

      const { error: linesError } = await supabase
        .from('payment_invoice_lines')
        .insert(paymentLines);

      if (linesError) throw linesError;

      // Update invoice statuses to paid if fully paid
      if (!isPartialPayment) {
        await supabase
          .from('invoices')
          .update({ status: 'paid' })
          .in('id', selectedInvoices);
      } else {
        // For partial payments, check each invoice to see if total payments now cover the full amount
        for (const invoiceId of selectedInvoices) {
          const { data: invoice } = await supabase
            .from('invoices')
            .select('amount')
            .eq('id', invoiceId)
            .single();
          
          const { data: allPaymentLines } = await supabase
            .from('payment_invoice_lines')
            .select('amount_paid')
            .eq('invoice_id', invoiceId);
          
          if (invoice && allPaymentLines) {
            const totalPaidForInvoice = allPaymentLines.reduce((sum, pl) => sum + (Number(pl.amount_paid) || 0), 0);
            if (totalPaidForInvoice >= Number(invoice.amount) - 0.01) {
              await supabase
                .from('invoices')
                .update({ status: 'paid' })
                .eq('id', invoiceId);
            } else {
              // Mark as pending_payment if partially paid
              await supabase
                .from('invoices')
                .update({ status: 'pending_payment' })
                .eq('id', invoiceId);
            }
          }
        }
      }

      // For credit card payments, create credit card transactions
      if (payment.payment_method === 'credit_card' && payment.bank_account_id) {
        const creditCard = creditCards.find(cc => cc.id === payment.bank_account_id);
        
        // Create credit card transactions for each invoice
        for (const invoiceId of selectedInvoices) {
          const invoice = invoices.find(inv => inv.id === invoiceId);
          if (!invoice) continue;

          // Get the bill details to extract job and cost code information
          const { data: billData } = await supabase
            .from('invoices')
            .select(`
              *,
              invoice_distributions(
                job_id,
                cost_code_id,
                chart_account_id,
                amount
              )
            `)
            .eq('id', invoiceId)
            .single();

          const distributions = Array.isArray(billData?.invoice_distributions) 
            ? billData.invoice_distributions 
            : [];
          const distribution = distributions[0];
          
          // Try to merge with existing imported CSV transaction (avoid duplicates)
          const payDate = new Date(payment.payment_date);
          const startDate = new Date(payDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const endDate = new Date(payDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const minAmount = Number(invoice.amount) - 0.01;
          const maxAmount = Number(invoice.amount) + 0.01;

          const { data: candidates } = await supabase
            .from('credit_card_transactions')
            .select('id, transaction_date, amount, invoice_id, coding_status')
            .eq('credit_card_id', payment.bank_account_id)
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate)
            .gte('amount', minAmount)
            .lte('amount', maxAmount)
            .order('transaction_date', { ascending: true });

          const candidate = (candidates || []).find(c => !c.invoice_id);

          if (candidate) {
            // Update existing CSV transaction to become the coded bill payment
            await supabase
              .from('credit_card_transactions')
              .update({
                company_id: currentCompany.id,
                description: invoice.description || `Payment for ${invoice.invoice_number}`,
                merchant_name: invoice.vendor?.name || 'Unknown Vendor',
                invoice_id: invoiceId,
                job_id: distribution?.job_id || invoice.job_id,
                cost_code_id: distribution?.cost_code_id || null,
                coding_status: 'coded',
                imported_from_csv: true,
                created_by: user.data.user?.id,
                notes: payment.memo || null,
                transaction_type: 'payment',
              })
              .eq('id', candidate.id);
          } else {
            // Insert a new credit card transaction
            await supabase
              .from('credit_card_transactions')
              .insert({
                credit_card_id: payment.bank_account_id,
                company_id: currentCompany.id,
                transaction_date: payment.payment_date,
                description: invoice.description || `Payment for ${invoice.invoice_number}`,
                merchant_name: invoice.vendor?.name || 'Unknown Vendor',
                amount: invoice.amount,
                invoice_id: invoiceId,
                job_id: distribution?.job_id || invoice.job_id,
                cost_code_id: distribution?.cost_code_id || null,
                coding_status: 'coded',
                imported_from_csv: false,
                created_by: user.data.user?.id,
                notes: payment.memo || null,
                transaction_type: 'payment',
              });
          }

          // Create journal entry for credit card payment
          if (creditCard?.liability_account_id && distribution?.chart_account_id) {
            const { data: journalData } = await supabase
              .from('journal_entries')
              .insert({
                company_id: currentCompany.id,
                entry_date: payment.payment_date,
                description: `Credit card payment for ${invoice.invoice_number}`,
                reference_number: invoice.invoice_number,
                created_by: user.data.user?.id,
                status: 'posted',
              })
              .select()
              .single();

            if (journalData) {
              // Debit credit card liability (increase liability)
              await supabase
                .from('journal_entry_lines')
                .insert([
                  {
                    journal_entry_id: journalData.id,
                    account_id: creditCard.liability_account_id,
                    debit_amount: invoice.amount,
                    credit_amount: 0,
                    description: `Credit card charge - ${invoice.vendor?.name}`,
                    line_order: 1,
                  },
                  // Credit expense account
                  {
                    journal_entry_id: journalData.id,
                    account_id: distribution.chart_account_id,
                    debit_amount: 0,
                    credit_amount: invoice.amount,
                    description: `Credit card payment - ${invoice.vendor?.name}`,
                    line_order: 2,
                  }
                ])
                .select('id');
            }
          }
        }
      }

      // Journal entry posting for non-credit card payments is handled by a database trigger
      // (public.create_payment_journal_entry). No frontend posting needed for those.

      // Handle bank fee journal entry if bank fee exists
      if (payment.bank_fee && payment.bank_fee > 0 && bankFeeJobOrAccount) {
        const [type, id] = bankFeeJobOrAccount.split('_');
        const expenseAccountId = type === 'account' ? id : null;
        const jobId = type === 'job' ? id : null;

        // Get cash account from bank account
        const { data: bankAccountData } = await supabase
          .from('bank_accounts')
          .select('chart_account_id')
          .eq('id', payment.bank_account_id)
          .single();

        // For job selection, we need to find an appropriate expense account
        // Typically "Bank Charges" or similar in the job's expense range
        let targetExpenseAccountId = expenseAccountId;
        
        if (!targetExpenseAccountId && jobId) {
          // Try to find a bank charges or fees account for this company
          const { data: bankChargesAccount } = await supabase
            .from('chart_of_accounts')
            .select('id')
            .eq('company_id', currentCompany.id)
            .eq('is_active', true)
            .or('account_name.ilike.%bank charge%,account_name.ilike.%bank fee%,account_name.ilike.%other expense%')
            .limit(1)
            .single();
          
          targetExpenseAccountId = bankChargesAccount?.id || null;
        }

        if (bankAccountData?.chart_account_id && targetExpenseAccountId) {
          // Create journal entry for bank fee
          const { data: feeJournalData } = await supabase
            .from('journal_entries')
            .insert({
              company_id: currentCompany.id,
              entry_date: payment.payment_date,
              description: `Bank fee for payment ${payment.payment_number}`,
              reference: `FEE-${paymentData.id}`,
              total_debit: payment.bank_fee,
              total_credit: payment.bank_fee,
              created_by: user.data.user?.id,
              status: 'posted',
            })
            .select()
            .single();

          if (feeJournalData) {
            const journalLines = [];
            
            // Debit bank fee expense account
            journalLines.push({
              journal_entry_id: feeJournalData.id,
              account_id: targetExpenseAccountId,
              debit_amount: payment.bank_fee,
              credit_amount: 0,
              description: 'Bank fee expense',
              job_id: jobId || null,
              cost_code_id: jobId ? bankFeeCostCodeId : null,
              line_order: 1,
            });

            // Credit cash account
            journalLines.push({
              journal_entry_id: feeJournalData.id,
              account_id: bankAccountData.chart_account_id,
              debit_amount: 0,
              credit_amount: payment.bank_fee,
              description: 'Bank fee paid from account',
              line_order: 2,
            });

            await supabase
              .from('journal_entry_lines')
              .insert(journalLines);
          }
        }
      }

      toast({
        title: "Success",
        description: "Payment created successfully",
      });

      navigate('/invoices/payments');
    } catch (error) {
      console.error('Error saving payment:', error);
      toast({
        title: "Error",
        description: "Failed to create payment",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const printCheck = () => {
    // Navigate to print checks with this payment
    navigate('/banking/print-checks', { 
      state: { paymentId: payment.id } 
    });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/invoices/payments')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Make Payment</h1>
            <p className="text-muted-foreground">Create payments and manage vendor bills</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printCheck} disabled={!payment.id}>
            <Printer className="h-4 w-4 mr-2" />
            Print Check
          </Button>
          <Button onClick={savePayment} disabled={saving || selectedInvoices.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Create Payment'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Details */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="payment_number">Payment Number</Label>
                <Input
                  id="payment_number"
                  value={payment.payment_number}
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="vendor">Vendor (Optional Filter)</Label>
                <Select value={selectedVendor || "all"} onValueChange={handleVendorChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All vendors</SelectItem>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="job">Job (Optional Filter)</Label>
                <Select value={selectedJob || "all"} onValueChange={handleJobChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All jobs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All jobs</SelectItem>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select 
                  value={payment.payment_method} 
                  onValueChange={(value) => {
                    setPayment(prev => ({ 
                      ...prev, 
                      payment_method: value, 
                      bank_account_id: '', // Clear account/card when method changes
                      check_number: value === 'check' ? prev.check_number : '', // Keep check number only for checks
                      bank_fee: ['ach', 'wire'].includes(value) ? prev.bank_fee : 0 // Keep bank fee only for ACH/Wire
                    }));
                    // Clear bank fee related fields when switching from ACH/Wire
                    if (!['ach', 'wire'].includes(value)) {
                      setBankFeeJobOrAccount(null);
                      setIsBankFeeJob(false);
                      setBankFeeCostCodeId(null);
                      setBankFeeJobCostCodes([]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {['check', 'ach', 'wire'].includes(payment.payment_method) && (
                <div>
                  <Label htmlFor="bank_account_id">Pay From Account *</Label>
                  <Select 
                    value={payment.bank_account_id} 
                    onValueChange={(value) => setPayment(prev => ({ ...prev, bank_account_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_name} - {account.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {payment.payment_method === 'credit_card' && (
                <div>
                  <Label htmlFor="credit_card_id">Credit Card *</Label>
                  <Select 
                    value={payment.bank_account_id} 
                    onValueChange={(value) => setPayment(prev => ({ ...prev, bank_account_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select credit card" />
                    </SelectTrigger>
                    <SelectContent>
                      {creditCards.map(card => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.card_name} - {card.issuer} ****{card.card_number_last_four}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="payment_date">Payment Date</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={payment.payment_date}
                  onChange={(e) => setPayment(prev => ({ ...prev, payment_date: e.target.value }))}
                />
              </div>

              {payment.payment_method === 'check' && (
                <div>
                  <Label htmlFor="check_number">Check Number *</Label>
                  <Input
                    id="check_number"
                    value={payment.check_number || ''}
                    onChange={(e) => setPayment(prev => ({ ...prev, check_number: e.target.value }))}
                    placeholder="Enter check number"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="partial_payment"
                  checked={isPartialPayment}
                  onCheckedChange={(checked) => {
                    setIsPartialPayment(!!checked);
                    if (!checked && selectedInvoices.length > 0) {
                      const totalAmount = selectedInvoices.reduce((sum, id) => {
                        const invoice = invoices.find(inv => inv.id === id);
                        return sum + (invoice?.amount || 0);
                      }, 0);
                      setPayment(prev => ({ ...prev, amount: totalAmount }));
                    }
                  }}
                  disabled={selectedInvoices.length === 0}
                />
                <Label htmlFor="partial_payment" className="cursor-pointer">
                  Partial Payment
                </Label>
              </div>

              <div>
                <Label htmlFor="amount">Payment Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={payment.amount}
                  onChange={(e) => setPayment(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  disabled={selectedInvoices.length === 0 || !isPartialPayment}
                  className={selectedInvoices.length === 0 || !isPartialPayment ? 'bg-muted' : ''}
                />
              </div>

              {['ach', 'wire'].includes(payment.payment_method) && (
                <>
                  <div>
                    <Label htmlFor="bank_fee">Bank Fee (Optional)</Label>
                    <Input
                      id="bank_fee"
                      type="number"
                      step="0.01"
                      value={payment.bank_fee || 0}
                      onChange={(e) => setPayment(prev => ({ ...prev, bank_fee: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter any transaction fee charged by the bank
                    </p>
                  </div>

                  {payment.bank_fee && payment.bank_fee > 0 && (
                    <>
                      <div>
                        <Label>Bank Fee Expense Account *</Label>
                        <Popover open={bankFeeAccountPickerOpen} onOpenChange={setBankFeeAccountPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              {bankFeeJobOrAccount ? (
                                isBankFeeJob ? (
                                  jobs.find(j => j.id === bankFeeJobOrAccount.split('_')[1])?.name
                                ) : (
                                  expenseAccounts.find(a => a.id === bankFeeJobOrAccount.split('_')[1])?.account_name
                                )
                              ) : (
                                "Select job or expense account"
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search jobs or accounts..." />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                
                                <CommandGroup heading="Jobs">
                                  {jobs.map((job) => (
                                    <CommandItem
                                      key={job.id}
                                      value={`job_${job.id}`}
                                      onSelect={async () => {
                                        setBankFeeJobOrAccount(`job_${job.id}`);
                                        setIsBankFeeJob(true);
                                        setBankFeeCostCodeId(null);
                                        setBankFeeAccountPickerOpen(false);
                                        
                                        // Load cost codes for this job
                                        const { data: costCodesData } = await supabase
                                          .from('cost_codes')
                                          .select('*')
                                          .eq('job_id', job.id)
                                          .eq('company_id', currentCompany?.id || '')
                                          .eq('is_active', true)
                                          .eq('is_dynamic_group', false)
                                          .in('code', (await supabase
                                            .from('cost_codes')
                                            .select('code')
                                            .eq('job_id', job.id)
                                            .or('code.ilike.%-material,code.ilike.%-other')
                                          ).data?.map(c => c.code) || [])
                                          .order('code');
                                        
                                        setBankFeeJobCostCodes(costCodesData || []);
                                      }}
                                    >
                                      {job.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                
                                <CommandSeparator />
                                
                                <CommandGroup heading="Expense Accounts">
                                  {expenseAccounts.map((account) => (
                                    <CommandItem
                                      key={account.id}
                                      value={`account_${account.id}`}
                                      onSelect={() => {
                                        setBankFeeJobOrAccount(`account_${account.id}`);
                                        setIsBankFeeJob(false);
                                        setBankFeeCostCodeId(null);
                                        setBankFeeJobCostCodes([]);
                                        setBankFeeAccountPickerOpen(false);
                                      }}
                                    >
                                      {account.account_number} - {account.account_name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {isBankFeeJob && bankFeeJobCostCodes.length > 0 && (
                        <div>
                          <Label>Cost Code *</Label>
                          <Popover open={bankFeeCostCodePickerOpen} onOpenChange={setBankFeeCostCodePickerOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                              >
                                {bankFeeCostCodeId ? (
                                  bankFeeJobCostCodes.find(cc => cc.id === bankFeeCostCodeId)?.code + ' - ' +
                                  bankFeeJobCostCodes.find(cc => cc.id === bankFeeCostCodeId)?.description
                                ) : (
                                  "Select cost code"
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search cost codes..." />
                                <CommandList>
                                  <CommandEmpty>No cost codes found.</CommandEmpty>
                                  <CommandGroup>
                                    {bankFeeJobCostCodes.map((costCode) => (
                                      <CommandItem
                                        key={costCode.id}
                                        value={costCode.id}
                                        onSelect={() => {
                                          setBankFeeCostCodeId(costCode.id);
                                          setBankFeeCostCodePickerOpen(false);
                                        }}
                                      >
                                        {costCode.code} - {costCode.description}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div>
                <Label htmlFor="memo">Memo</Label>
                <Textarea
                  id="memo"
                  value={payment.memo}
                  onChange={(e) => setPayment(prev => ({ ...prev, memo: e.target.value }))}
                  placeholder="Payment memo..."
                />
              </div>

              <div>
                <Label htmlFor="payment_document">Attach Document (Optional)</Label>
                <div className="space-y-2">
                  <Input
                    id="payment_document"
                    type="file"
                    onChange={handleDocumentUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  {paymentDocument && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {paymentDocument.name}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Select Bills to Pay
              </CardTitle>
              {selectedInvoices.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedInvoices.length} bill{selectedInvoices.length > 1 ? 's' : ''} selected. Select multiple bills from the same vendor to pay together.
                </p>
              )}
            </CardHeader>

            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <div className="mb-2">No approved unpaid invoices found</div>
                  <div className="text-sm">Select vendor or job filters to narrow results</div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Bill Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(invoice => {
                      const isSelected = selectedInvoices.includes(invoice.id);
                      const isFromDifferentVendor = selectedInvoices.length > 0 && 
                        selectedInvoices[0] !== invoice.id &&
                        invoices.find(inv => inv.id === selectedInvoices[0])?.vendor_id !== invoice.vendor_id;
                      
                      return (
                        <TableRow 
                          key={invoice.id}
                          className={isSelected ? "bg-muted/50" : isFromDifferentVendor ? "opacity-50" : "cursor-pointer hover:bg-muted/30"}
                          onClick={() => {
                            if (isFromDifferentVendor) return;
                            setAttachmentsInvoiceId(invoice.id);
                            setAttachmentsModalOpen(true);
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              disabled={isFromDifferentVendor}
                              onCheckedChange={(checked) => {
                                handleInvoiceSelection(invoice.id, !!checked);
                              }}
                            />
                          </TableCell>
                          <TableCell>{invoice.invoice_number || 'N/A'}</TableCell>
                          <TableCell>{invoice.vendor?.name || 'N/A'}</TableCell>
                          <TableCell>{invoice.jobs?.name || 'N/A'}</TableCell>
                          <TableCell className="max-w-xs truncate">{invoice.description}</TableCell>
                          <TableCell>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</TableCell>
                          <TableCell className="font-medium">${invoice.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            {invoice.amount_paid && invoice.amount_paid > 0 ? (
                              <span className="text-green-600">${invoice.amount_paid.toFixed(2)}</span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className={`font-medium ${invoice.amount_paid && invoice.amount_paid > 0 ? 'text-orange-600' : ''}`}>
                            ${(invoice.balance_due ?? invoice.amount).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Inline Document Previews */}
          {selectedInvoices.length > 0 && Object.keys(invoiceDocuments).length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Bill Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedInvoices.map((invoiceId) => {
                  const invoice = invoices.find(inv => inv.id === invoiceId);
                  const documentUrl = invoiceDocuments[invoiceId];
                  
                  if (!documentUrl || !invoice) return null;
                  
                  return (
                    <div key={invoiceId} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Invoice #{invoice.invoice_number}</h4>
                          <p className="text-sm text-muted-foreground">{invoice.vendor?.name}</p>
                        </div>
                        <div className="text-right">
                          {invoice.amount_paid && invoice.amount_paid > 0 ? (
                            <>
                              <p className="text-sm text-muted-foreground line-through">${invoice.amount.toFixed(2)}</p>
                              <Badge variant="outline" className="text-orange-600">Balance: ${(invoice.balance_due ?? invoice.amount).toFixed(2)}</Badge>
                            </>
                          ) : (
                            <Badge variant="outline">${invoice.amount.toFixed(2)}</Badge>
                          )}
                        </div>
                      </div>
                      <UrlPdfInlinePreview 
                        url={documentUrl} 
                        className="max-h-[600px] overflow-auto"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      <BillAttachmentsModal
        invoiceId={attachmentsInvoiceId}
        open={attachmentsModalOpen}
        onOpenChange={(open) => {
          setAttachmentsModalOpen(open);
          if (!open) setAttachmentsInvoiceId(null);
        }}
      />

      {/* Summary */}
      {selectedInvoices.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Payment Amount:</span>
                <span>${payment.amount.toFixed(2)}</span>
              </div>
              {payment.bank_fee && payment.bank_fee > 0 && (
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Bank Fee:</span>
                  <span>${payment.bank_fee.toFixed(2)}</span>
                </div>
              )}
              {payment.bank_fee && payment.bank_fee > 0 && (
                <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                  <span>Total Amount:</span>
                  <span>${(payment.amount + payment.bank_fee).toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {isPartialPayment ? 'Partial payment' : 'Full payment'} for {selectedInvoices.length} invoice(s)
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}