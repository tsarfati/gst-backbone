import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Paperclip, FileText, X, ChevronsUpDown, Check, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import UrlPdfInlinePreview from "@/components/UrlPdfInlinePreview";
import QuickAddVendor from "@/components/QuickAddVendor";
import { cn } from "@/lib/utils";
interface CreditCardTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  onComplete: () => void;
  initialMatches?: any[];
}

export function CreditCardTransactionModal({
  open,
  onOpenChange,
  transactionId,
  onComplete,
  initialMatches
}: CreditCardTransactionModalProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [transaction, setTransaction] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [costCodes, setCostCodes] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoders, setSelectedCoders] = useState<string[]>([]);
  const [requestedUsers, setRequestedUsers] = useState<any[]>([]);
  const [communications, setCommunications] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [selectedJobOrAccount, setSelectedJobOrAccount] = useState<string | null>(null);
  const [isJobSelected, setIsJobSelected] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [codingRequestDropdownOpen, setCodingRequestDropdownOpen] = useState(false);
  const [jobCostCodes, setJobCostCodes] = useState<any[]>([]);
  const [openPickers, setOpenPickers] = useState<{ jobControl: boolean; costCode: boolean }>({ jobControl: false, costCode: false });
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [bypassAttachmentRequirement, setBypassAttachmentRequirement] = useState(false);
  const [requireCCAttachment, setRequireCCAttachment] = useState(false);
  const [suggestedMatches, setSuggestedMatches] = useState<any[]>([]);
  const [showMatches, setShowMatches] = useState(false);


useEffect(() => {
  if (open && transactionId && currentCompany) {
    // Preload matches passed in from parent
    if (initialMatches && initialMatches.length > 0) {
      setSuggestedMatches(initialMatches);
      setShowMatches(true);
    } else {
      setSuggestedMatches([]);
      setShowMatches(false);
    }

    // Clear state when switching transactions
    setAttachmentPreview(null);
    setSelectedVendorId(null);
    setSelectedJobOrAccount(null);
    setIsJobSelected(false);
    setJobCostCodes([]);
    fetchData();
  } else if (!open) {
    // Clear state when modal closes
    setAttachmentPreview(null);
    setSelectedVendorId(null);
    setSelectedJobOrAccount(null);
    setIsJobSelected(false);
    setJobCostCodes([]);
  }
}, [open, transactionId, currentCompany, initialMatches]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch transaction
      const { data: transData, error: transError } = await supabase
        .from("credit_card_transactions")
        .select(`
          *,
          jobs:job_id(id, name),
          cost_codes:cost_code_id(id, code, description),
          vendors:vendor_id(id, name),
          chart_of_accounts:chart_account_id(id, account_number, account_name)
        `)
        .eq("id", transactionId)
        .single();

      if (transError) throw transError;
      
      // Validate vendor belongs to current company
      if (transData.vendor_id && transData.vendors) {
        const { data: vendorCheck } = await supabase
          .from("vendors")
          .select("id")
          .eq("id", transData.vendor_id)
          .eq("company_id", currentCompany?.id)
          .maybeSingle();
        
        if (!vendorCheck) {
          // Vendor belongs to another company - clear it
          await supabase
            .from("credit_card_transactions")
            .update({ vendor_id: null })
            .eq("id", transactionId);
          transData.vendor_id = null;
          transData.vendors = null;
          toast({
            title: "Vendor Removed",
            description: "Vendor from another company was removed",
            variant: "destructive",
          });
        }
      }
      
      // Validate job belongs to current company
      if (transData.job_id && transData.jobs) {
        const { data: jobCheck } = await supabase
          .from("jobs")
          .select("id")
          .eq("id", transData.job_id)
          .eq("company_id", currentCompany?.id)
          .maybeSingle();
        
        if (!jobCheck) {
          await supabase
            .from("credit_card_transactions")
            .update({ job_id: null, cost_code_id: null })
            .eq("id", transactionId);
          transData.job_id = null;
          transData.jobs = null;
          transData.cost_code_id = null;
          transData.cost_codes = null;
        }
      }
      
      // Validate chart account belongs to current company
      if (transData.chart_account_id && transData.chart_of_accounts) {
        const { data: accountCheck } = await supabase
          .from("chart_of_accounts")
          .select("id")
          .eq("id", transData.chart_account_id)
          .eq("company_id", currentCompany?.id)
          .maybeSingle();
        
        if (!accountCheck) {
          await supabase
            .from("credit_card_transactions")
            .update({ chart_account_id: null })
            .eq("id", transactionId);
          transData.chart_account_id = null;
          transData.chart_of_accounts = null;
        }
      }
      
      // Validate cost code belongs to current company
      if (transData.cost_code_id && transData.cost_codes) {
        const { data: costCodeCheck } = await supabase
          .from("cost_codes")
          .select("id")
          .eq("id", transData.cost_code_id)
          .eq("company_id", currentCompany?.id)
          .maybeSingle();
        
        if (!costCodeCheck) {
          await supabase
            .from("credit_card_transactions")
            .update({ cost_code_id: null })
            .eq("id", transactionId);
          transData.cost_code_id = null;
          transData.cost_codes = null;
        }
      }
      
      setTransaction(transData);
      setBypassAttachmentRequirement(transData.bypass_attachment_requirement || false);

      // Fetch payables settings for attachment requirement
      const { data: payablesSettings } = await supabase
        .from('payables_settings')
        .select('require_cc_attachment')
        .eq('company_id', currentCompany?.id)
        .maybeSingle();
      
      setRequireCCAttachment(payablesSettings?.require_cc_attachment || false);

      // Set initial selection: prefer job if present
      if (transData.job_id) {
        setSelectedJobOrAccount(`job_${transData.job_id}`);
        setIsJobSelected(true);
        // Preload cost codes for the job
        const { data: jobCodes } = await supabase
          .from('cost_codes')
          .select('*')
          .eq('job_id', transData.job_id)
          .eq('company_id', currentCompany?.id || '')
          .eq('is_active', true)
          .eq('is_dynamic_group', false)
          .order('code', { ascending: true });
        setJobCostCodes(jobCodes || []);
      } else if (transData.chart_of_accounts?.id) {
        const acct = transData.chart_of_accounts;
        const isJobAcct = acct.account_number >= '50000' && acct.account_number <= '58000';
        if (!isJobAcct) {
          setSelectedJobOrAccount(`account_${acct.id}`);
          setIsJobSelected(false);
          setJobCostCodes([]);
        }
      }

      // Set vendor if exists
      if (transData.vendor_id) {
        setSelectedVendorId(transData.vendor_id);
      }

      // Fetch jobs from jobs table only
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', currentCompany?.id)
        .order('name');
      setJobs(jobsData || []);

      // Fetch expense accounts from chart of accounts (exclude 50000-58000 job range) - ordered by account_number
      const { data: expenseAccountsData } = await supabase
        .from('chart_of_accounts')
        .select('id, account_number, account_name, account_type')
        .eq('company_id', currentCompany?.id)
        .eq('is_active', true)
        .in('account_type', ['expense', 'operating_expense', 'cost_of_goods_sold'])
        .or('account_number.lt.50000,account_number.gt.58000')
        .order('account_number', { ascending: true });

       setExpenseAccounts(expenseAccountsData || []);
 
       // Fetch cost codes - ordered by code ascending
       const { data: costCodesData } = await supabase
         .from("cost_codes")
         .select("*")
         .eq("company_id", currentCompany?.id)
         .eq("is_active", true)
         .eq("is_dynamic_group", false)
         .order("code", { ascending: true });
 
       const uniqueAll = Array.from(new Map((costCodesData || []).map((cc: any) => [cc.id, cc])).values());
       setCostCodes(uniqueAll);

      // Fetch vendors
      const { data: vendorsData } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("company_id", currentCompany?.id)
        .eq("is_active", true)
        .order("name");

      setVendors(vendorsData || []);

      // Fetch users for coding requests
      const { data: usersData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, role")
        .in("role", ["admin", "controller", "project_manager"])
        .order("first_name");

      setUsers(usersData || []);

      // Fetch coding requests
      const { data: requests } = await supabase
        .from("credit_card_coding_requests")
        .select("requested_coder_id")
        .eq("transaction_id", transactionId)
        .eq("status", "pending");

      if (requests && requests.length > 0) {
        const coderIds = requests.map(r => r.requested_coder_id);
        setSelectedCoders(coderIds);

        const { data: userDetails } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", coderIds);

        setRequestedUsers(userDetails || []);
      }

      // Fetch communications (without FK join), then hydrate with profile names
      const { data: commsRaw } = await supabase
        .from("credit_card_transaction_communications")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      let comms = commsRaw || [];
      const userIds = Array.from(new Set((comms as any[]).map(c => c.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
        comms = (comms as any[]).map(c => ({ ...c, user: profileMap.get(c.user_id) || null }));
      }

      setCommunications(comms as any[]);

      // Fetch suggested matches (bills and receipts)
      await fetchSuggestedMatches(transData);

      // Set attachment preview (normalize storage paths and validate company)
      if (transData.attachment_url) {
        const toPublicUrl = (raw: string): string => {
          try {
            if (!raw) return raw;
            // Already a public URL
            if (raw.includes('/storage/v1/object/public/')) return raw;
            // Pattern: bucket/path
            if (!raw.startsWith('http') && raw.includes('/')) {
              const [bucket, ...rest] = raw.split('/');
              const filePath = rest.join('/');
              const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
              return data.publicUrl || raw;
            }
            // Pattern: signed URL
            const m = raw.match(/storage\/v1\/object\/(?:sign|auth\/signed)\/([^/]+)\/(.+?)(?:\?|$)/);
            if (m) {
              const bucket = m[1];
              const filePath = decodeURIComponent(m[2]);
              const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
              return data.publicUrl || raw;
            }
            return raw;
          } catch {
            return raw;
          }
        };
        
        const normalized = toPublicUrl(transData.attachment_url as string);
        
        // Validate company ID in attachment path
        const validateCompanyAttachment = (url: string): boolean => {
          try {
            // Extract path from public URL
            const match = url.match(/credit-card-attachments\/([^/]+)\//);
            if (match) {
              const attachmentCompanyId = match[1];
              return attachmentCompanyId === currentCompany?.id;
            }
            return true; // Allow if we can't determine company (legacy format)
          } catch {
            return true;
          }
        };
        
        if (validateCompanyAttachment(normalized)) {
          setAttachmentPreview(normalized);
          if (normalized !== transData.attachment_url) {
            // persist normalized URL for consistency
            await supabase
              .from('credit_card_transactions')
              .update({ attachment_url: normalized })
              .eq('id', transactionId);
            setTransaction((prev: any) => ({ ...prev, attachment_url: normalized }));
          }
        } else {
          // Attachment belongs to another company - remove it
          await supabase
            .from('credit_card_transactions')
            .update({ attachment_url: null })
            .eq('id', transactionId);
          setTransaction((prev: any) => ({ ...prev, attachment_url: null }));
          toast({
            title: "Attachment Removed",
            description: "Attachment from another company was removed",
            variant: "destructive",
          });
        }
      }
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

  const fetchSuggestedMatches = async (transData: any) => {
    if (!currentCompany || !transData) return;

    try {
      setShowMatches(true);
      const matches: any[] = [];
      const transactionAmount = Math.abs(Number(transData.amount));
      const transactionDate = new Date(transData.transaction_date);
      
      // Wider tolerance to catch all potential matches (15% or $50, whichever is larger)
      const tolerance = Math.max(transactionAmount * 0.15, 50);
      const minAmount = transactionAmount - tolerance;
      const maxAmount = transactionAmount + tolerance;
      
      // Wider date range: +/- 30 days to catch more matches
      const startDate = new Date(transactionDate);
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date(transactionDate);
      endDate.setDate(endDate.getDate() + 30);

      // Fetch invoices (including paid) with full details
      const invoicesQuery = await supabase
        .from("invoices" as any)
        .select(`
          id,
          invoice_number,
          issue_date,
          amount,
          status,
          job_id,
          cost_code_id,
          vendors!inner(id, name, company_id),
          jobs(id, name),
          cost_codes(id, code, description)
        ` as any)
        .eq("vendors.company_id", currentCompany.id)
        .in("status", ["pending", "approved", "pending_payment", "paid"])
        .gte("amount", minAmount)
        .lte("amount", maxAmount)
        // Do not filter by issue_date; bills might be issued long before the card charge
        .limit(10);

      const invoices = invoicesQuery.data || [];

      // Determine which invoices were paid using this credit card
      const invoiceIds = invoices.map((inv: any) => inv.id);
      let invoicesPaidByThisCard = new Set<string>();
      if (invoiceIds.length > 0) {
        const { data: ccLinks } = await supabase
          .from('credit_card_transactions')
          .select('invoice_id')
          .eq('credit_card_id', transData.credit_card_id)
          .in('invoice_id', invoiceIds);
        invoicesPaidByThisCard = new Set((ccLinks || []).map((r: any) => r.invoice_id).filter(Boolean));
      }

      invoices.forEach((inv: any) => {
        const paidByThisCard = invoicesPaidByThisCard.has(inv.id);
        const match = {
          id: inv.id,
          type: "bill",
          display: `Bill #${inv.invoice_number}`,
          amount: inv.amount,
          date: inv.issue_date,
          vendor: inv.vendors?.name,
          vendorId: inv.vendors?.id,
          status: inv.status,
          attachmentUrl: null,
          jobId: inv.job_id,
          jobName: inv.jobs?.name,
          costCodeId: inv.cost_code_id,
          costCode: inv.cost_codes ? `${inv.cost_codes.code} - ${inv.cost_codes.description}` : null,
          paidByThisCard,
          matchScore: calculateMatchScore(transData, { ...inv, paidByThisCard }, 'bill'),
        };
        matches.push(match);
      });

      // Fetch uncoded receipts
      const uncodedReceiptsQuery = await supabase
        .from("receipts" as any)
        .select(`
          id,
          file_name,
          receipt_date,
          amount,
          status,
          vendors!inner(id, name)
        ` as any)
        .eq("company_id", currentCompany.id)
        .eq("status", "uncoded")
        .gte("amount", minAmount)
        .lte("amount", maxAmount)
        .gte("receipt_date", startDate.toISOString().split('T')[0])
        .lte("receipt_date", endDate.toISOString().split('T')[0])
        .limit(5);

      const uncodedReceipts = uncodedReceiptsQuery.data;

      if (uncodedReceipts) {
        uncodedReceipts.forEach((receipt: any) => {
          const match = {
            id: receipt.id,
            type: "uncoded_receipt",
            display: receipt.file_name || `Receipt ${receipt.id.slice(0,6)}`,
            amount: receipt.amount,
            date: receipt.receipt_date,
            vendor: receipt.vendors?.name || receipt.vendor_name,
            status: receipt.status,
            matchScore: calculateMatchScore(transData, receipt, "receipt"),
          };
          matches.push(match);
        });
      }

      // Fetch coded receipts
      const codedReceiptsQuery = await supabase
        .from("receipts" as any)
        .select(`
          id,
          file_name,
          receipt_date,
          amount,
          status,
          vendors!inner(id, name)
        ` as any)
        .eq("company_id", currentCompany.id)
        .eq("status", "coded")
        .gte("amount", minAmount)
        .lte("amount", maxAmount)
        .gte("receipt_date", startDate.toISOString().split('T')[0])
        .lte("receipt_date", endDate.toISOString().split('T')[0])
        .limit(5);

      const codedReceipts = codedReceiptsQuery.data;

      if (codedReceipts) {
        codedReceipts.forEach((receipt: any) => {
          const match = {
            id: receipt.id,
            type: "coded_receipt",
            display: receipt.file_name || `Receipt ${receipt.id.slice(0,6)}`,
            amount: receipt.amount,
            date: receipt.receipt_date,
            vendor: receipt.vendors?.name || receipt.vendor_name,
            status: receipt.status,
            matchScore: calculateMatchScore(transData, receipt, "receipt"),
          };
          matches.push(match);
        });
      }

      // Fetch other credit card transactions (for matching payments to charges OR charges to payments)
      {
        const counterpartFilter = transData.transaction_type === 'payment' ? 'charge' : 'payment';
        const { data: otherTransactions, error: txError } = await supabase
          .from("credit_card_transactions")
          .select(`
            id,
            description,
            transaction_date,
            amount,
            merchant_name,
            job_id,
            cost_code_id,
            attachment_url,
            transaction_type,
            jobs(id, name),
            cost_codes(id, code, description),
            vendors(id, name)
          `)
          .eq("company_id", currentCompany.id)
          .eq("credit_card_id", transData.credit_card_id)
          .neq("id", transactionId)
          .eq("transaction_type", counterpartFilter)
          .gte("amount", minAmount)
          .lte("amount", maxAmount)
          .gte("transaction_date", startDate.toISOString().split('T')[0])
          .lte("transaction_date", endDate.toISOString().split('T')[0])
          .limit(5);

        if (otherTransactions && !txError) {
          otherTransactions.forEach((tx: any) => {
            const match = {
              id: tx.id,
              type: "transaction",
              transaction_type: tx.transaction_type,
              display: tx.description || (tx.transaction_type === 'payment' ? 'Credit Card Payment' : 'Credit Card Charge'),
              amount: tx.amount,
              date: tx.transaction_date,
              vendor: tx.vendors?.name || tx.merchant_name,
              vendorId: tx.vendors?.id,
              attachmentUrl: tx.attachment_url,
              jobId: tx.job_id,
              jobName: tx.jobs?.name,
              costCodeId: tx.cost_code_id,
              costCode: tx.cost_codes ? `${tx.cost_codes.code} - ${tx.cost_codes.description}` : null,
              matchScore: calculateMatchScore(transData, tx, "transaction"),
            };
            matches.push(match);
          });
        }
      }

      // Sort by match score (highest first) and normalize to percentage
      matches.sort((a, b) => b.matchScore - a.matchScore);
      
      // Normalize scores to percentage (max base score is 105: 60 amount + 25 vendor + 10 job + 10 date)
      // Bonuses can push it higher but we use 105 as the "perfect match" baseline
      matches.forEach(match => {
        match.matchScore = Math.min(100, Math.round((match.matchScore / 105) * 100));
      });
      
      console.log('Suggested matches found:', matches.length, 'matches:', matches);
      setSuggestedMatches(matches);
      // Show matches if not yet confirmed (including for payment transactions)
      if (matches.length > 0 && !transData.match_confirmed) {
        console.log('Setting showMatches to true');
        setShowMatches(true);
      } else {
        console.log('Not showing matches - length:', matches.length, 'confirmed:', transData.match_confirmed);
      }
    } catch (error) {
      console.error("Error fetching suggested matches:", error);
    }
  };

  const calculateMatchScore = (transaction: any, item: any, itemType: string) => {
    let score = 0;
    const transAmount = Math.abs(Number(transaction.amount));
    const itemAmount = Math.abs(Number(item.amount));
    const transDate = new Date(transaction.transaction_date);
    const itemDate = new Date(itemType === 'bill' ? item.issue_date : (item.receipt_date || item.transaction_date));

    // Amount match (0-60 points) - HIGHEST PRIORITY
    const amountDiff = Math.abs(transAmount - itemAmount);
    if (amountDiff < 0.01) {
      // Exact match
      score += 60;
    } else if (amountDiff < 1) {
      // Within $1
      score += 55;
    } else {
      // Scaled by difference
      const amountScore = Math.max(0, 60 - (amountDiff / transAmount) * 60);
      score += amountScore;
    }

    // Vendor match (0-25 points)
    if (transaction.vendor_id && item.vendors?.id === transaction.vendor_id) {
      score += 25;
    } else if (transaction.merchant_name && item.vendors?.name) {
      const merchantLower = transaction.merchant_name.toLowerCase();
      const vendorLower = item.vendors.name.toLowerCase();
      if (merchantLower.includes(vendorLower) || vendorLower.includes(merchantLower)) {
        score += 15;
      }
    }

    // Job match (0-10 points)
    if (transaction.job_id && item.jobId === transaction.job_id) {
      score += 10;
    }

    // Date proximity (0-10 points) - LOWER PRIORITY
    const daysDiff = Math.abs((transDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff === 0) {
      score += 10; // Same day
    } else if (daysDiff <= 3) {
      score += 8; // Within 3 days
    } else if (daysDiff <= 7) {
      score += 5; // Within 1 week
    } else if (daysDiff <= 14) {
      score += 2; // Within 2 weeks
    }

    // Bonuses for invoices paid by this credit card
    if (itemType === 'bill') {
      if (item.paidByThisCard) score += 50; // Very strong signal
      else if (item.status === 'paid') score += 10;
    }

    return score;
  };

  const linkToMatch = async (match: any) => {
    try {
      // Special handling: if matching to another transaction (payment/charge), merge them
      if (match.type === "transaction") {
        // Determine which one to keep (prefer charge over payment)
        const isCurrentPayment = transaction.transaction_type === 'payment';
        const isMatchPayment = match.transaction_type === 'payment';
        
        let keepId, deleteId;
        if (isCurrentPayment && !isMatchPayment) {
          // Current is payment, match is charge - keep match, delete current
          keepId = match.id;
          deleteId = transactionId;
        } else {
          // Default: keep current, delete match
          keepId = transactionId;
          deleteId = match.id;
        }
        
        // Merge data: copy any missing fields from the deleted transaction to the kept one
        const { data: deleteData } = await supabase
          .from("credit_card_transactions")
          .select("*")
          .eq("id", deleteId)
          .maybeSingle();
        
        if (deleteData) {
          const mergeUpdate: any = { match_confirmed: true };
          
          // Only copy fields if they're not already set in the kept transaction
          const { data: keepData } = await supabase
            .from("credit_card_transactions")
            .select("*")
            .eq("id", keepId)
            .maybeSingle();
          
          if (keepData) {
            if (!keepData.vendor_id && deleteData.vendor_id) mergeUpdate.vendor_id = deleteData.vendor_id;
            if (!keepData.merchant_name && deleteData.merchant_name) mergeUpdate.merchant_name = deleteData.merchant_name;
            if (!keepData.job_id && deleteData.job_id) mergeUpdate.job_id = deleteData.job_id;
            if (!keepData.cost_code_id && deleteData.cost_code_id) mergeUpdate.cost_code_id = deleteData.cost_code_id;
            if (!keepData.attachment_url && deleteData.attachment_url) mergeUpdate.attachment_url = deleteData.attachment_url;
            if (!keepData.invoice_id && deleteData.invoice_id) mergeUpdate.invoice_id = deleteData.invoice_id;
            if (deleteData.coding_status === 'coded' && keepData.coding_status !== 'coded') mergeUpdate.coding_status = 'coded';
          }
          
          // Update the kept transaction
          await supabase
            .from("credit_card_transactions")
            .update(mergeUpdate)
            .eq("id", keepId);
          
          // Delete the redundant transaction
          await supabase
            .from("credit_card_transactions")
            .delete()
            .eq("id", deleteId);
        }
        
        toast({
          title: "Transactions Merged",
          description: "Payment and charge transactions have been merged into one.",
        });
        
        // If we deleted the current transaction, close modal and refresh parent
        if (deleteId === transactionId) {
          onComplete();
          onOpenChange(false);
          return;
        }
        
        // Otherwise refresh current transaction
        setShowMatches(false);
        await fetchData();
        return;
      }
      
      // Standard match linking (for bills, receipts)
      const updateData: any = {
        match_confirmed: true,
        vendor_id: match.vendorId,
        merchant_name: match.vendor,
        job_id: match.jobId,
        cost_code_id: match.costCodeId,
        attachment_url: match.attachmentUrl,
        coding_status: 'coded' // Mark as coded when linked
      };
      
      if (match.type === "bill") {
        // Fetch most recent bill document and attach it
        const { data: doc } = await supabase
          .from('invoice_documents')
          .select('file_url')
          .eq('invoice_id', match.id)
          .order('uploaded_at', { ascending: false })
          .maybeSingle();
        if (doc?.file_url) {
          updateData.attachment_url = doc.file_url;
        }
        updateData.matched_bill_id = match.id;
        updateData.invoice_id = match.id;
      } else if (match.type === "uncoded_receipt" || match.type === "coded_receipt") {
        updateData.matched_receipt_id = match.id;
        updateData.receipt_id = match.id;
      }
      
      await supabase
        .from("credit_card_transactions")
        .update(updateData)
        .eq("id", transactionId);

      // If we linked to a bill, check for a duplicate CC transaction for this bill and merge
      if (match.type === 'bill') {
        const { data: dup } = await supabase
          .from('credit_card_transactions')
          .select('*')
          .eq('credit_card_id', transaction.credit_card_id)
          .eq('invoice_id', match.id)
          .neq('id', transactionId)
          .maybeSingle();
        if (dup) {
          const currentIsCharge = transaction.transaction_type === 'charge';
          const dupIsCharge = dup.transaction_type === 'charge';
          const keepId = currentIsCharge || !dupIsCharge ? transactionId : dup.id;
          const deleteId = keepId === transactionId ? dup.id : transactionId;

          const { data: keepData } = await supabase
            .from('credit_card_transactions')
            .select('*')
            .eq('id', keepId)
            .maybeSingle();
          const { data: deleteData2 } = await supabase
            .from('credit_card_transactions')
            .select('*')
            .eq('id', deleteId)
            .maybeSingle();

          if (keepData && deleteData2) {
            const mergeUpdate: any = { match_confirmed: true, coding_status: 'coded' };
            if (!keepData.vendor_id && deleteData2.vendor_id) mergeUpdate.vendor_id = deleteData2.vendor_id;
            if (!keepData.merchant_name && deleteData2.merchant_name) mergeUpdate.merchant_name = deleteData2.merchant_name;
            if (!keepData.job_id && deleteData2.job_id) mergeUpdate.job_id = deleteData2.job_id;
            if (!keepData.cost_code_id && deleteData2.cost_code_id) mergeUpdate.cost_code_id = deleteData2.cost_code_id;
            if (!keepData.attachment_url && deleteData2.attachment_url) mergeUpdate.attachment_url = deleteData2.attachment_url;
            if (!keepData.invoice_id && deleteData2.invoice_id) mergeUpdate.invoice_id = deleteData2.invoice_id;

            await supabase.from('credit_card_transactions').update(mergeUpdate).eq('id', keepId);
            await supabase.from('credit_card_transactions').delete().eq('id', deleteId);

            toast({ title: 'Transactions Merged', description: 'The duplicate payment/charge was merged.' });

            if (deleteId === transactionId) {
              onComplete();
              onOpenChange(false);
              return;
            }
          }
        }
      }
      
      toast({
        title: "Confirmed",
        description: `Transaction linked to ${match.display}. Job, vendor, cost code, and attachment have been populated.`,
      });
      
      setShowMatches(false);
      // Refresh transaction data to reflect all changes
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const dismissMatches = async () => {
    try {
      await supabase
        .from("credit_card_transactions")
        .update({ match_confirmed: true })
        .eq("id", transactionId);
      
      setShowMatches(false);
      setTransaction((prev: any) => ({ ...prev, match_confirmed: true }));
      
      toast({
        title: "Matches Dismissed",
        description: "You can proceed with coding this transaction",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateCodingStatus = async () => {
    if (!transaction) return;

    // Payment transactions don't need to be coded
    if (transaction.transaction_type === 'payment') {
      const newStatus = 'coded'; // Payments are automatically considered coded
      await supabase
        .from("credit_card_transactions")
        .update({ 
          coding_status: newStatus,
          bypass_attachment_requirement: bypassAttachmentRequirement
        })
        .eq("id", transactionId);
      setTransaction((prev: any) => ({ ...prev, coding_status: newStatus }));
      return;
    }

    // For charge transactions, check all requirements
    const hasVendor = !!selectedVendorId;
    const hasJobOrAccount = !!selectedJobOrAccount;
    const hasCostCode = isJobSelected ? !!transaction.cost_code_id : true; // Cost code only required for jobs
    const hasAttachment = !!transaction.attachment_url;

    // Attachment required unless explicitly bypassed for this transaction
    const attachmentRequired = !bypassAttachmentRequirement;
    const attachmentSatisfied = attachmentRequired ? hasAttachment : true;

    // All fields including vendor are required for coded status
    const isCoded = hasVendor && hasJobOrAccount && hasCostCode && attachmentSatisfied;
    const newStatus = isCoded ? 'coded' : 'uncoded';

    await supabase
      .from("credit_card_transactions")
      .update({ 
        coding_status: newStatus,
        bypass_attachment_requirement: bypassAttachmentRequirement
      })
      .eq("id", transactionId);

    setTransaction((prev: any) => ({ ...prev, coding_status: newStatus }));
  };

  const handleJobOrAccountChange = async (value: string | null) => {
    if (!value || value === "none") {
      setSelectedJobOrAccount(null);
      setIsJobSelected(false);
      setJobCostCodes([]);
      setOpenPickers({ ...openPickers, jobControl: false });
      await supabase
        .from("credit_card_transactions")
        .update({
          job_id: null,
          chart_account_id: null,
          cost_code_id: null,
        })
        .eq("id", transactionId);
      setTransaction({ ...transaction, job_id: null, chart_account_id: null, cost_code_id: null });
      await updateCodingStatus();
      return;
    }

    const [type, id] = value.split("_");
    setSelectedJobOrAccount(value);
    setOpenPickers({ ...openPickers, jobControl: false });

    if (type === "job") {
      setIsJobSelected(true);
      
      // Fetch cost codes directly by job_id
      const { data: jobCostCodesData } = await supabase
        .from("cost_codes")
        .select("*")
        .eq("job_id", id)
        .eq("company_id", currentCompany?.id)
        .eq("is_active", true)
        .eq("is_dynamic_group", false)
        .order("code", { ascending: true });
      
       setJobCostCodes(jobCostCodesData || []);
      
      await supabase
        .from("credit_card_transactions")
        .update({
          job_id: id,
          chart_account_id: null,
          cost_code_id: null,
        })
        .eq("id", transactionId);
      setTransaction((prev: any) => ({ ...prev, job_id: id, chart_account_id: null, cost_code_id: null }));
    } else if (type === "account") {
      setIsJobSelected(false);
      setJobCostCodes([]);
      await supabase
        .from("credit_card_transactions")
        .update({
          job_id: null,
          chart_account_id: id,
          cost_code_id: null,
        })
        .eq("id", transactionId);
      setTransaction((prev: any) => ({ ...prev, job_id: null, chart_account_id: id, cost_code_id: null }));
    }

    await updateCodingStatus();
  };

  const handleCostCodeChange = async (costCodeId: string | null) => {
    // Optimistic UI update so the selection sticks immediately
    setTransaction((prev: any) => ({ ...prev, cost_code_id: costCodeId }));
    setOpenPickers(prev => ({ ...prev, costCode: false }));

    try {
      await supabase
        .from("credit_card_transactions")
        .update({ cost_code_id: costCodeId })
        .eq("id", transactionId);
      await updateCodingStatus();
    } catch (e) {
      // revert on failure
      setTransaction((prev: any) => ({ ...prev, cost_code_id: null }));
    }
  };

  const handleVendorChange = async (vendorId: string | null) => {
    setSelectedVendorId(vendorId);
    
    await supabase
      .from("credit_card_transactions")
      .update({ 
        vendor_id: vendorId,
        merchant_name: vendorId ? vendors.find(v => v.id === vendorId)?.name : null
      })
      .eq("id", transactionId);

    setTransaction((prev: any) => ({ 
      ...prev, 
      vendor_id: vendorId,
      merchant_name: vendorId ? vendors.find(v => v.id === vendorId)?.name : null
    }));
    await updateCodingStatus();
  };

  const handleQuickAddVendor = async (vendorId: string) => {
    // Refetch vendors list to include the newly added vendor
    const { data: vendorsData } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("company_id", currentCompany?.id)
      .eq("is_active", true)
      .order("name");
    
    setVendors(vendorsData || []);
    
    // Now set the vendor on the transaction
    await handleVendorChange(vendorId);
  };

  const handleAttachmentUpload = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany?.id}/${transactionId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("credit-card-attachments")
        .upload(fileName, file, { upsert: true, contentType: file.type || undefined });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("credit-card-attachments")
        .getPublicUrl(fileName);

      // Optimistically show the preview immediately using the public URL
      setAttachmentPreview(publicUrl);

      await supabase
        .from("credit_card_transactions")
        .update({ attachment_url: publicUrl })
        .eq("id", transactionId);

      setTransaction((prev: any) => ({ ...prev, attachment_url: publicUrl }));
      await updateCodingStatus();

      toast({
        title: "Success",
        description: "Attachment uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      // Insert the message
      const { error } = await supabase
        .from("credit_card_transaction_communications")
        .insert({
          transaction_id: transactionId,
          company_id: currentCompany?.id,
          user_id: user?.id,
          message: newMessage.trim(),
        });

      if (error) throw error;

      // Refresh communications list (without FK join), then hydrate with profile names
      const { data: commsRaw } = await supabase
        .from("credit_card_transaction_communications")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      let comms = commsRaw || [];
      const userIds = Array.from(new Set((comms as any[]).map(c => c.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
        comms = (comms as any[]).map(c => ({ ...c, user: profileMap.get(c.user_id) || null }));
      }

      setCommunications(comms as any[]);
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

  const handleMarkComplete = async () => {
    try {
      await supabase
        .from("credit_card_coding_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("transaction_id", transactionId);

      toast({
        title: "Success",
        description: "Coding request completed",
      });

      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRequestCoding = async () => {
    if (selectedCoders.length === 0) {
      toast({
        title: "No coders selected",
        description: "Please select at least one person to request coding assistance",
        variant: "destructive",
      });
      return;
    }

    try {
      // Delete existing requests
      await supabase
        .from("credit_card_coding_requests")
        .delete()
        .eq("transaction_id", transactionId);

      // Create new requests
      const requests = selectedCoders.map(coderId => ({
        transaction_id: transactionId,
        company_id: currentCompany?.id,
        requested_by: user?.id,
        requested_coder_id: coderId,
        status: "pending",
      }));

      const { error } = await supabase
        .from("credit_card_coding_requests")
        .insert(requests);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Coding assistance requested",
      });

      fetchData();
      setCodingRequestDropdownOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleCoderSelection = (userId: string) => {
    setSelectedCoders(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleAllCoders = () => {
    if (selectedCoders.length === users.length) {
      setSelectedCoders([]);
    } else {
      setSelectedCoders(users.map(u => u.user_id));
    }
  };

  const filteredCostCodes = () => {
    if (!isJobSelected) return [];
    
    // Deduplicate cost codes by code+description, prioritizing job-specific and non-"other" types
    const seen = new Map();
    
    jobCostCodes
      .filter(Boolean)
      .forEach((cc: any) => {
        const key = `${cc.code}-${cc.description}`;
        const existing = seen.get(key);
        
        if (!existing) {
          seen.set(key, cc);
        } else {
          // Prefer job-specific cost codes over company-wide
          const hasJobId = cc.job_id != null;
          const existingHasJobId = existing.job_id != null;
          
          if (hasJobId && !existingHasJobId) {
            seen.set(key, cc);
          } else if (hasJobId === existingHasJobId) {
            // If both or neither have job_id, prefer non-"other" type
            if (cc.type !== 'other' && existing.type === 'other') {
              seen.set(key, cc);
            }
          }
        }
      });
    
    return Array.from(seen.values())
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  };
  const getCostCodeCategoryBadge = (type: string) => {
    const labels: Record<string, string> = {
      labor: "Labor",
      material: "Material",
      equipment: "Equipment",
      subcontractor: "Sub",
      other: "Other",
    };
    return labels[type] || labels.other;
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!transaction) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Code Transaction</DialogTitle>
          <DialogDescription>
            Set vendor, select a Job or a Chart of Accounts (expense). If a Job is selected, a Cost Code is required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Transaction Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <Label className="text-sm text-muted-foreground">Date</Label>
              <p className="font-medium">
                {new Date(transaction.transaction_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Amount</Label>
              <p className={cn(
                "text-lg font-semibold",
                transaction.transaction_type === "payment" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                ${Number(transaction.amount).toLocaleString()}
              </p>
            </div>
            <div className="col-span-2">
              <Label className="text-sm text-muted-foreground">Description</Label>
              <p className="font-medium">{transaction.description}</p>
            </div>
            {requestedUsers.length > 0 && (
              <div className="col-span-2">
                <Label className="text-sm text-muted-foreground">Requested Coders</Label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {requestedUsers.map((u: any) => (
                    <Badge key={u.user_id} variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                      {u.first_name} {u.last_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Suggested Matches */}
          {showMatches && (
            <div className="bg-amber-50 dark:bg-amber-950 border-2 border-amber-400 dark:border-amber-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    ⚠️ Potential Matches
                  </Label>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    {suggestedMatches.length > 0
                      ? `${suggestedMatches.length} potential ${suggestedMatches.length === 1 ? 'match' : 'matches'} found. Select a match to auto-populate job, vendor, cost code, and attachment.`
                      : 'No potential matches found for this transaction. You can refresh to try again.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => fetchSuggestedMatches(transaction)}>
                    Refresh
                  </Button>
                  <Button variant="ghost" size="sm" onClick={dismissMatches}>
                    <X className="h-4 w-4 mr-1" />
                    Dismiss
                  </Button>
                </div>
              </div>

              {suggestedMatches.length > 0 && (
                <>
                  <div className="space-y-3 mb-3">
                    {suggestedMatches.slice(0, 5).map((match) => (
                      <div
                        key={`${match.type}-${match.id}`}
                        className="bg-white dark:bg-gray-900 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary transition-colors"
                      >
                        <div className="flex gap-4">
                          {/* Attachment Preview */}
                          {match.attachmentUrl && (
                            <div className="flex-shrink-0">
                              <div className="w-20 h-20 border rounded overflow-hidden bg-muted">
                                {match.attachmentUrl.toLowerCase().endsWith('.pdf') ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <FileText className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                ) : (
                                  <img 
                                    src={match.attachmentUrl} 
                                    alt="Attachment preview"
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Match Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-sm">{match.display}</span>
                              <Badge variant={
                                match.type === "bill" ? "default" :
                                match.type === "uncoded_receipt" ? "secondary" :
                                match.type === "transaction" ? "default" :
                                "outline"
                              }>
                                {match.type === "bill" ? "Bill" :
                                 match.type === "uncoded_receipt" ? "Uncoded Receipt" :
                                 match.type === "transaction" ? "Credit Card Charge" :
                                 "Coded Receipt"}
                              </Badge>
                              {match.paidByThisCard && (
                                <Badge variant="default" className="bg-green-600 dark:bg-green-700">
                                  Paid by this card
                                </Badge>
                              )}
                              <Badge 
                                variant={
                                  match.matchScore >= 95 ? "default" : 
                                  match.matchScore >= 75 ? "secondary" : 
                                  "outline"
                                }
                                className={
                                  match.matchScore >= 95 ? "bg-green-600 dark:bg-green-700" :
                                  match.matchScore >= 75 ? "bg-blue-600 dark:bg-blue-700" :
                                  "bg-gray-500 dark:bg-gray-600"
                                }
                              >
                                {Math.round(match.matchScore)}% match
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                              <div><span className="font-medium">Amount:</span> ${Number(match.amount).toLocaleString()}</div>
                              <div><span className="font-medium">Date:</span> {new Date(match.date).toLocaleDateString()}</div>
                              {match.vendor && <div><span className="font-medium">Vendor:</span> {match.vendor}</div>}
                              {match.jobName && <div><span className="font-medium">Job:</span> {match.jobName}</div>}
                              {match.costCode && <div className="col-span-2"><span className="font-medium">Cost Code:</span> {match.costCode}</div>}
                            </div>
                            
                            {match.attachmentUrl && (
                              <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                <span>Attachment available</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Action Button */}
                          <div className="flex-shrink-0 flex items-center">
                            <Button
                              size="sm"
                              onClick={() => linkToMatch(match)}
                              className="whitespace-nowrap"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Select Match
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={dismissMatches}
                    >
                      <X className="h-4 w-4 mr-1" />
                      No Match - Dismiss All
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          {/* Vendor Selection - Not required for payments */}
          {transaction.transaction_type !== 'payment' && (
          <div>
            <Label>Vendor *</Label>
            <div className="flex gap-2">
              <Select
                key={`vendor-${transactionId}`}
                value={selectedVendorId || undefined}
                onValueChange={(value) => handleVendorChange(value === "clear-vendor" ? null : (value || null))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="clear-vendor" className="text-muted-foreground italic">
                    Clear selection
                  </SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <QuickAddVendor 
                onVendorAdded={handleQuickAddVendor}
                variant="outline"
              />
            </div>
          </div>
          )}

          {/* Job/Control Selection - Not required for payments */}
          {transaction.transaction_type !== 'payment' && (
          <div>
            <Label>Job/Control *</Label>
            <Popover key={`jobacct-${transactionId}`}
              open={openPickers.jobControl} 
              onOpenChange={(open) => setOpenPickers({ ...openPickers, jobControl: open })}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedJobOrAccount 
                    ? (() => {
                        const [type, id] = selectedJobOrAccount.split("_");
                        if (type === "job") {
                          const job = jobs.find(j => j.id === id);
                          return job?.name || 'Select job or expense account';
                        } else {
                          const account = expenseAccounts.find(a => a.id === id);
                          return account ? `${account.account_number} - ${account.account_name}` : 'Select job or expense account';
                        }
                      })()
                    : 'Select job or expense account'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0 z-50 bg-background">
                <Command>
                  <CommandInput placeholder="Search jobs or accounts..." />
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="reset-job-account"
                        onSelect={() => handleJobOrAccountChange(null)}
                        className="text-muted-foreground italic"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Clear selection
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                    {jobs.length > 0 && (
                      <CommandGroup heading="Jobs">
                        {jobs.map((job) => (
                          <CommandItem
                            key={`job_${job.id}`}
                            value={job.name}
                            onSelect={() => handleJobOrAccountChange(`job_${job.id}`)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedJobOrAccount === `job_${job.id}` ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {job.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {jobs.length > 0 && expenseAccounts.length > 0 && <CommandSeparator />}
                    {expenseAccounts.length > 0 && (
                      <CommandGroup heading="Expense Accounts">
                        {expenseAccounts.map((account) => (
                          <CommandItem
                            key={`account_${account.id}`}
                            value={`${account.account_number} ${account.account_name}`}
                            onSelect={() => handleJobOrAccountChange(`account_${account.id}`)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedJobOrAccount === `account_${account.id}` ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {account.account_number} - {account.account_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          )}

          {/* Cost Code Selection */}
          {transaction.transaction_type !== 'payment' && isJobSelected && (
            <div>
              <Label>Cost Code *</Label>
              <Popover 
                open={openPickers.costCode} 
                onOpenChange={(open) => setOpenPickers({ ...openPickers, costCode: open })}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {transaction.cost_code_id 
                      ? (() => {
                          const ccSel = jobCostCodes.find((c:any) => c.id === transaction.cost_code_id) 
                            || costCodes.find((c:any) => c.id === transaction.cost_code_id);
                          return ccSel ? `${ccSel.code} - ${ccSel.description}` : 'Select cost code';
                        })()
                      : 'Select cost code'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                 <PopoverContent className="w-[400px] p-0 z-50 bg-background">
                  <Command>
                    <CommandInput placeholder="Search cost codes..." />
                    <CommandList>
                      <CommandEmpty>No cost codes found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="reset-cost-code"
                          onSelect={() => handleCostCodeChange(null)}
                          className="text-muted-foreground italic"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Clear selection
                        </CommandItem>
                      </CommandGroup>
                      <CommandSeparator />
                      <CommandGroup>
                        {filteredCostCodes().map((cc) => (
                          <CommandItem
                            key={cc.id}
                            value={`${cc.id}-${cc.code} ${cc.description}`}
                            onSelect={() => handleCostCodeChange(cc.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                transaction.cost_code_id === cc.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex-1">{cc.code} - {cc.description}</span>
                            <Badge variant="secondary" className="ml-2">{getCostCodeCategoryBadge(cc.type)}</Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Request Coding Assistance */}
          <div>
            <Label>Request Coding Assistance</Label>
            <Select
              open={codingRequestDropdownOpen}
              onOpenChange={setCodingRequestDropdownOpen}
            >
              <SelectTrigger>
                <SelectValue>
                  {selectedCoders.length === 0
                    ? "Select users to request assistance"
                    : `${selectedCoders.length} user${selectedCoders.length > 1 ? 's' : ''} selected`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <div className="p-2 space-y-2">
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox
                      checked={selectedCoders.length === users.length && users.length > 0}
                      onCheckedChange={toggleAllCoders}
                      id="select-all"
                    />
                    <label htmlFor="select-all" className="text-sm font-semibold cursor-pointer">
                      Select All
                    </label>
                  </div>
                  {users.map((user) => (
                    <div key={user.user_id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedCoders.includes(user.user_id)}
                        onCheckedChange={() => toggleCoderSelection(user.user_id)}
                        id={`coder-${user.user_id}`}
                      />
                      <label
                        htmlFor={`coder-${user.user_id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {user.first_name} {user.last_name}
                        <span className="text-xs text-muted-foreground ml-2">({user.role})</span>
                      </label>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No users available
                    </p>
                  )}
                </div>
                <div className="border-t p-2">
                  <Button
                    onClick={handleRequestCoding}
                    size="sm"
                    className="w-full"
                    disabled={selectedCoders.length === 0}
                  >
                    Send Request
                  </Button>
                </div>
              </SelectContent>
            </Select>
          </div>

          {/* Attachment */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Attachment {!bypassAttachmentRequirement && '*'}</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bypass-attachment"
                  checked={bypassAttachmentRequirement}
                  onCheckedChange={(checked) => {
                    setBypassAttachmentRequirement(!!checked);
                    supabase
                      .from("credit_card_transactions")
                      .update({ bypass_attachment_requirement: !!checked })
                      .eq("id", transactionId)
                      .then(() => {
                        updateCodingStatus();
                      });
                  }}
                />
                <label htmlFor="bypass-attachment" className="text-sm cursor-pointer">
                  Don't require attachment
                </label>
              </div>
            </div>
            {(transaction?.attachment_url || attachmentPreview) ? (
              <div className="space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFullScreenOpen(true)}
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
                        .eq("id", transactionId)
                        .then(() => {
                          setTransaction((prev: any) => ({ ...prev, attachment_url: null }));
                          setAttachmentPreview(null);
                          updateCodingStatus();
                        });
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>

                { (attachmentPreview || transaction.attachment_url) && (
                  <div key={(attachmentPreview || transaction.attachment_url) as string} className="border rounded-lg overflow-hidden bg-muted">
                    {String(attachmentPreview || transaction.attachment_url).toLowerCase().includes('.pdf') ? (
                      <UrlPdfInlinePreview 
                        url={(attachmentPreview || transaction.attachment_url) as string} 
                        className="w-full max-h-96 overflow-y-auto"
                      />
                    ) : (
                      <img
                        src={(attachmentPreview || transaction.attachment_url) as string}
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
                    if (file) handleAttachmentUpload(file);
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

          <Dialog open={fullScreenOpen} onOpenChange={setFullScreenOpen}>
            <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0">
              {(attachmentPreview || transaction?.attachment_url) && (
                String(attachmentPreview || transaction?.attachment_url).toLowerCase().includes('.pdf') ? (
                  <UrlPdfInlinePreview url={(attachmentPreview || transaction?.attachment_url) as string} className="w-full h-full overflow-auto" />
                ) : (
                  <img src={(attachmentPreview || transaction?.attachment_url) as string} alt="Attachment full size" className="w-full h-full object-contain" />
                )
              )}
              <div className="absolute top-2 right-2">
                <a
                  href={(attachmentPreview || transaction?.attachment_url) as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-sm"
                >
                  Open in new tab
                </a>
              </div>
            </DialogContent>
          </Dialog>

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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleMarkComplete}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
