import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Building, CreditCard, FileText, DollarSign, Calendar, Filter, Trash2, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, MessageSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import PayablesViewSelector from "@/components/PayablesViewSelector";
import VendorAvatar from "@/components/VendorAvatar";
import { usePayablesViewPreference } from "@/hooks/usePayablesViewPreference";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActionPermissions } from "@/hooks/useActionPermissions";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { canAccessAssignedJobOnly } from "@/utils/jobAccess";
import { evaluateInvoiceCoding } from "@/utils/invoiceCoding";
import { getEffectivePaidByInvoice } from "@/utils/paymentAllocations";

type SortColumn = 'vendor_name' | 'job_name' | 'amount' | 'issue_date' | 'due_date' | 'status';
type SortDirection = 'asc' | 'desc';

interface Bill {
  id: string;
  invoice_number: string | null;
  vendor_id?: string | null;
  vendor_name: string;
  vendor_logo_url: string | null;
  amount: number;
  amount_paid?: number;
  balance_due?: number;
  status: string;
  issue_date: string;
  due_date: string;
  job_name: string;
  cost_code_description: string;
  description: string;
  payment_terms: string | null;
  submitted_from_vendor_portal?: boolean;
  latest_vendor_response_at?: string | null;
  latest_vendor_response_preview?: string | null;
}

const wasSubmittedFromVendorPortal = (internalNotes: any): boolean => {
  if (!internalNotes || typeof internalNotes !== "object" || Array.isArray(internalNotes)) {
    return false;
  }
  return internalNotes.generated_by_vendor_portal === true;
};

const calculateDaysOverdue = (dueDate: string): number => {
  const due = new Date(dueDate);
  const today = new Date();
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const isOverdue = (bill: Bill): boolean => {
  const dueDate = new Date(bill.due_date);
  const today = new Date();
  return (bill.status === 'pending' || bill.status === 'pending_approval' || bill.status === 'revision_requested' || bill.status === 'approved' || bill.status === 'pending_payment') && dueDate < today;
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
    case "pending_approval":
      return "warning";
    case "revision_requested":
      return "secondary";
    case "pending_coding":
      return "secondary";
    case "approved":
    case "pending_payment":
      return "info"; // Blue for awaiting payment
    case "overdue":
      return "destructive";
    case "draft":
      return "outline";
    default:
      return "default";
  }
};

const getStatusDisplayName = (status: string) => {
  switch (status) {
    case "pending":
      return "Pending Approval";
    case "pending_approval":
      return "Pending Approval";
    case "revision_requested":
      return "Revision Requested";
    case "pending_coding":
      return "Pending Coding";
    case "approved":
      return "Awaiting Payment";
    case "pending_payment":
      return "Awaiting Payment";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "draft":
      return "Draft";
    default:
      return status;
  }
};

const formatResponsePreview = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > 88 ? `${normalized.slice(0, 88).trimEnd()}...` : normalized;
};

const formatTimelineLabel = (status: string, hasVendorResponse: boolean) => {
  if (status === "pending_approval" && hasVendorResponse) return "Back In Review";
  if (status === "revision_requested") return "Revision Requested";
  if (status === "pending") return "Pending Approval";
  if (status === "pending_payment") return "Awaiting Payment";
  return getStatusDisplayName(status);
};

const getJobColor = (jobName: string) => {
  if (jobName.startsWith('Control -')) {
    return 'bg-slate-500';
  }

  // Generate consistent color based on job name
  let hash = 0;
  for (let i = 0; i < jobName.length; i++) {
    hash = jobName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
    'bg-violet-500',
    'bg-fuchsia-500',
    'bg-rose-500',
    'bg-amber-500'
  ];
  
  return colors[Math.abs(hash) % colors.length];
};

export default function Bills() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { canCreate, canDelete, canEdit, canViewJoblessFinancials } = useActionPermissions();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  const allowJoblessFinancials = canViewJoblessFinancials();
  
  // Initialize filters from navigation state if provided
  const initialVendorFilter = (location.state as any)?.vendorFilter || "all";
  const initialShowPaid = (location.state as any)?.vendorFilter ? true : false;
  
  const [jobFilter, setJobFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState(initialVendorFilter);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showPaidBills, setShowPaidBills] = useState(initialShowPaid);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [requireBillDistributionBeforeApproval, setRequireBillDistributionBeforeApproval] = useState(true);
  const { currentView, setCurrentView, setAsDefault, isDefault } = usePayablesViewPreference('bills');
  const [sortColumn, setSortColumn] = useState<SortColumn>('due_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    const requestedStatus = searchParams.get("status");
    if (!requestedStatus) return;

    if (requestedStatus === "pending") {
      setStatusFilter("pending_approval");
      return;
    }
    if (requestedStatus === "outstanding") {
      setStatusFilter("all");
      setShowPaidBills(false);
      return;
    }
    if (requestedStatus === "overdue") {
      setStatusFilter("overdue");
      return;
    }
    if (requestedStatus === "revision_requested") {
      setStatusFilter("revision_requested");
      return;
    }
    if (requestedStatus === "back_in_review") {
      setStatusFilter("back_in_review");
      return;
    }
  }, [searchParams]);

  useEffect(() => {
    if (currentCompany && !websiteJobAccessLoading) {
      loadBills();
    }
  }, [currentCompany, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(','), allowJoblessFinancials]);

  const loadBills = async () => {
    if (!currentCompany) return;
    
    try {
      setLoading(true);

      const { data: payablesSettings } = await supabase
        .from('payables_settings')
        .select('require_bill_distribution_before_approval')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      setRequireBillDistributionBeforeApproval(
        (payablesSettings as any)?.require_bill_distribution_before_approval ?? true,
      );
      
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          status,
          vendor_id,
          job_id,
          issue_date,
          due_date,
          description,
          internal_notes,
          payment_terms,
          vendors!inner(name, logo_url, company_id),
          jobs(id, name),
          cost_codes(description, job_id, code, chart_account_number, chart_account_id)
        `)
        .eq('vendors.company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get all invoice IDs to fetch distributions for bills without direct job assignment
      const invoiceIds = data?.map(b => b.id) || [];
      const vendorIds = Array.from(new Set((data || []).map((bill: any) => bill.vendor_id).filter(Boolean)));
      
      // Fetch distributions with job info for bills that might not have direct job_id
      const { data: distributions } = await supabase
        .from('invoice_cost_distributions')
        .select(`
          invoice_id,
          cost_codes(job_id, code, chart_account_number, chart_account_id, jobs(id, name))
        `)
        .in('invoice_id', invoiceIds);

      const formatControlLabel = (costCode: any) => {
        const controlNumber = costCode?.chart_account_number || costCode?.code;
        return controlNumber ? `Control - ${controlNumber}` : 'Control';
      };

      // Build maps of invoice_id -> job/control labels from distributions
      const distributionJobMap = new Map<string, { id: string; name: string }[]>();
      const distributionControlMap = new Map<string, string[]>();
      distributions?.forEach((dist: any) => {
        const invoiceId = dist.invoice_id;
        const costCode = dist.cost_codes;
        const job = dist.cost_codes?.jobs;
        if (job?.id && job?.name) {
          if (!distributionJobMap.has(invoiceId)) {
            distributionJobMap.set(invoiceId, []);
          }
          const existing = distributionJobMap.get(invoiceId)!;
          if (!existing.find((j) => j.id === job.id)) {
            existing.push({ id: job.id, name: job.name });
          }
        } else if (costCode) {
          const label = formatControlLabel(costCode);
          const existing = distributionControlMap.get(invoiceId) || [];
          if (!existing.includes(label)) {
            existing.push(label);
            distributionControlMap.set(invoiceId, existing);
          }
        }
      });

      const vendorUserIdsByVendorId = new Map<string, Set<string>>();
      if (vendorIds.length > 0) {
        const { data: vendorProfiles } = await supabase
          .from('profiles')
          .select('vendor_id, user_id')
          .in('vendor_id', vendorIds)
          .eq('role', 'vendor');

        (vendorProfiles || []).forEach((profile: any) => {
          const vendorId = String(profile.vendor_id || '');
          const userId = String(profile.user_id || '');
          if (!vendorId || !userId) return;
          const existing = vendorUserIdsByVendorId.get(vendorId) || new Set<string>();
          existing.add(userId);
          vendorUserIdsByVendorId.set(vendorId, existing);
        });
      }

      const latestVendorResponseByInvoiceId = new Map<string, { created_at: string; content: string | null }>();
      if (invoiceIds.length > 0) {
        const { data: messageRows } = await supabase
          .from('messages')
          .select('thread_id, from_user_id, content, created_at')
          .in('thread_id', invoiceIds)
          .eq('attachment_type', 'bill_vendor_thread')
          .order('created_at', { ascending: false });

        (messageRows || []).forEach((message: any) => {
          const invoiceId = String(message.thread_id || '');
          if (!invoiceId || latestVendorResponseByInvoiceId.has(invoiceId)) return;
          const parentBill = (data || []).find((bill: any) => bill.id === invoiceId);
          const vendorId = String(parentBill?.vendor_id || '');
          const vendorUserIds = vendorUserIdsByVendorId.get(vendorId);
          if (!vendorUserIds?.has(String(message.from_user_id || ''))) return;
          latestVendorResponseByInvoiceId.set(invoiceId, {
            created_at: String(message.created_at),
            content: typeof message.content === 'string' ? message.content : null,
          });
        });
      }

      const formattedBills: Bill[] = (data || [])
      .filter((bill: any) => {
        const directJobId = bill.jobs?.id || bill.job_id || null;
        const distJobIds = (distributionJobMap.get(bill.id) || []).map((j) => j.id);
        const billJobIds = [directJobId, ...distJobIds].filter((id): id is string => !!id);
        if (billJobIds.length === 0) {
          return allowJoblessFinancials;
        }
        return canAccessAssignedJobOnly(billJobIds, isPrivileged, allowedJobIds);
      })
      .map((bill: any) => {
        // Use direct job name if available, otherwise get from distributions
        let jobName = (bill.jobs as any)?.name;
        if (!jobName) {
          const distJobs = distributionJobMap.get(bill.id);
          if (distJobs && distJobs.length > 0) {
            jobName = distJobs.length === 1 ? distJobs[0].name : `${distJobs[0].name} (+${distJobs.length - 1})`;
          } else if ((bill.cost_codes as any)?.job_id === null && bill.cost_codes) {
            jobName = formatControlLabel(bill.cost_codes);
          } else if (distributionControlMap.get(bill.id)?.length) {
            const controls = distributionControlMap.get(bill.id)!;
            jobName = controls.length === 1 ? controls[0] : `${controls[0]} (+${controls.length - 1})`;
          } else {
            jobName = 'No Job';
          }
        }
        
        return {
          id: bill.id,
          invoice_number: bill.invoice_number,
          vendor_id: bill.vendor_id || null,
          vendor_name: (bill.vendors as any)?.name || 'Unknown Vendor',
          vendor_logo_url: (bill.vendors as any)?.logo_url || null,
          amount: bill.amount,
          amount_paid: 0,
          balance_due: bill.amount,
          status: bill.status,
          issue_date: bill.issue_date,
          due_date: bill.due_date,
          job_name: jobName,
          cost_code_description: (bill.cost_codes as any)?.description || 'No Cost Code',
          description: bill.description || '',
          payment_terms: bill.payment_terms,
          submitted_from_vendor_portal: wasSubmittedFromVendorPortal(bill.internal_notes),
          latest_vendor_response_at: latestVendorResponseByInvoiceId.get(bill.id)?.created_at || null,
          latest_vendor_response_preview: latestVendorResponseByInvoiceId.get(bill.id)?.content || null,
        };
      });

      // Reconcile invoice statuses from actual payment allocations so partially paid
      // bills remain visible and only fully paid bills are marked paid.
      let finalBills = formattedBills;
      try {
        if (invoiceIds.length > 0) {
          const { data: paymentLines, error: paymentLinesError } = await supabase
            .from('payment_invoice_lines')
            .select('invoice_id, payment_id, amount_paid, payments(amount)')
            .in('invoice_id', invoiceIds);

          if (paymentLinesError) throw paymentLinesError;

          const totalPaidByInvoiceId = getEffectivePaidByInvoice((paymentLines || []) as any[]);

          const idsFullyPaid: string[] = [];
          const idsPartiallyPaid: string[] = [];

          finalBills = formattedBills.map((bill) => {
            const totalPaid = totalPaidByInvoiceId.get(bill.id) || 0;
            const remainingBalance = Number(bill.amount || 0) - totalPaid;

            if (totalPaid > 0 && remainingBalance <= 0.01) {
              idsFullyPaid.push(bill.id);
              return { ...bill, amount_paid: totalPaid, balance_due: 0, status: 'paid' };
            }

            if (totalPaid > 0) {
              idsPartiallyPaid.push(bill.id);
              return {
                ...bill,
                amount_paid: totalPaid,
                balance_due: Math.max(0, remainingBalance),
                status: 'pending_payment',
              };
            }

            return bill;
          });

          if (idsFullyPaid.length > 0) {
            await supabase.from('invoices').update({ status: 'paid' }).in('id', idsFullyPaid);
          }

          if (idsPartiallyPaid.length > 0) {
            await supabase.from('invoices').update({ status: 'pending_payment' }).in('id', idsPartiallyPaid);
          }
        }
      } catch (e) {
        console.warn('Invoice payment-status reconciliation skipped', e);
      }

      setBills(finalBills);
    } catch (error) {
      console.error('Error loading bills:', error);
      toast({
        title: "Error",
        description: "Failed to load bills",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const pendingCodingBills = bills.filter(bill => bill.status === 'pending_coding');
  const revisionRequestedBills = bills.filter(bill => bill.status === 'revision_requested');
  const backInReviewBills = bills.filter(
    (bill) => bill.status === 'pending_approval' && Boolean(bill.latest_vendor_response_at),
  );
  const pendingApprovalBills = bills.filter(bill => bill.status === 'pending' || bill.status === 'pending_approval');
  const awaitingPaymentBills = bills.filter(bill => bill.status === 'approved' || bill.status === 'pending_payment');
  const overdueBills = bills.filter(bill => {
    const dueDate = new Date(bill.due_date);
    const today = new Date();
    return (bill.status === 'pending' || bill.status === 'pending_approval' || bill.status === 'revision_requested' || bill.status === 'approved' || bill.status === 'pending_payment' || bill.status === 'pending_coding') && dueDate < today;
  });

  // Apply status filter
  let statusFilteredBills = bills;
  if (statusFilter === "pending_coding") {
    statusFilteredBills = pendingCodingBills;
  } else if (statusFilter === "back_in_review") {
    statusFilteredBills = backInReviewBills;
  } else if (statusFilter === "pending_approval") {
    statusFilteredBills = pendingApprovalBills;
  } else if (statusFilter === "revision_requested") {
    statusFilteredBills = revisionRequestedBills;
  } else if (statusFilter === "awaiting_payment") {
    statusFilteredBills = awaitingPaymentBills;
  } else if (statusFilter === "overdue") {
    statusFilteredBills = overdueBills;
  }

  // Apply paid bills filter
  if (!showPaidBills) {
    statusFilteredBills = statusFilteredBills.filter(bill => bill.status !== 'paid');
  }

  // Apply job filter
  let jobFilteredBills = jobFilter === "all" 
    ? statusFilteredBills 
    : statusFilteredBills.filter(bill => bill.job_name === jobFilter);

  // Apply vendor filter
  let vendorFilteredBills = vendorFilter === "all"
    ? jobFilteredBills
    : jobFilteredBills.filter(bill => bill.vendor_name === vendorFilter);

  // Apply date filter
  let filteredBills = vendorFilteredBills;
  if (startDate) {
    filteredBills = filteredBills.filter(bill => new Date(bill.issue_date) >= new Date(startDate));
  }
  if (endDate) {
    filteredBills = filteredBills.filter(bill => new Date(bill.issue_date) <= new Date(endDate));
  }

  // Sort bills
  const sortedBills = useMemo(() => {
    return [...filteredBills].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case 'vendor_name':
          comparison = a.vendor_name.localeCompare(b.vendor_name);
          break;
        case 'job_name':
          comparison = a.job_name.localeCompare(b.job_name);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'issue_date':
          comparison = new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime();
          break;
        case 'due_date':
          comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredBills, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const uniqueJobs = [...new Set(bills.map(bill => bill.job_name))];
  const uniqueVendors = [...new Set(bills.map(bill => bill.vendor_name))];

  const totalPendingCoding = pendingCodingBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalPendingApproval = pendingApprovalBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalRevisionRequested = revisionRequestedBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalBackInReview = backInReviewBills.reduce((sum, bill) => sum + bill.amount, 0);
  const getOpenBillAmount = (bill: Bill) => bill.status === 'pending_payment'
    ? Number(bill.balance_due ?? bill.amount)
    : Number(bill.amount || 0);
  const formatBillDisplayAmount = (bill: Bill) => getOpenBillAmount(bill).toLocaleString();
  const totalAwaitingPayment = awaitingPaymentBills.reduce((sum, bill) => sum + getOpenBillAmount(bill), 0);
  const totalOverdue = overdueBills.reduce((sum, bill) => sum + getOpenBillAmount(bill), 0);

  const handleSelectAll = () => {
    if (selectedBills.length === sortedBills.length) {
      setSelectedBills([]);
    } else {
      setSelectedBills(sortedBills.map(b => b.id));
    }
  };

  const handleSelectBill = (billId: string) => {
    setSelectedBills(prev => 
      prev.includes(billId) 
        ? prev.filter(id => id !== billId)
        : [...prev, billId]
    );
  };

  const handleBulkApprove = async () => {
    try {
      if (requireBillDistributionBeforeApproval) {
        const { data: invoiceRows, error: invoiceError } = await supabase
          .from('invoices')
          .select('id, invoice_number, amount, job_id, cost_code_id')
          .in('id', selectedBills);
        if (invoiceError) throw invoiceError;

        const { data: distributionRows, error: distError } = await supabase
          .from('invoice_cost_distributions')
          .select(`
            invoice_id,
            amount,
            cost_code_id,
            cost_codes (job_id, jobs(id))
          `)
          .in('invoice_id', selectedBills);
        if (distError) throw distError;

        const distributionMap = new Map<string, any[]>();
        (distributionRows || []).forEach((dist: any) => {
          const rows = distributionMap.get(dist.invoice_id) || [];
          rows.push(dist);
          distributionMap.set(dist.invoice_id, rows);
        });

        const invalidInvoices = (invoiceRows || []).filter((invoice: any) => {
          const validation = evaluateInvoiceCoding({
            amount: invoice.amount,
            job_id: invoice.job_id,
            cost_code_id: invoice.cost_code_id,
            distributions: distributionMap.get(invoice.id) || [],
          });
          return !validation.isComplete;
        });

        if (invalidInvoices.length > 0) {
          const sample = invalidInvoices
            .slice(0, 3)
            .map((inv: any) => inv.invoice_number || inv.id.slice(0, 8))
            .join(', ');
          toast({
            title: "Approval blocked",
            description: `Complete coding first. Incomplete bill(s): ${sample}${invalidInvoices.length > 3 ? ', ...' : ''}.`,
            variant: "destructive",
          });
          return;
        }
      }

      const approvedBillIds = [...selectedBills];
      const billsBeingApproved = bills.filter((bill) => selectedBills.includes(bill.id));
      const currentUser = await supabase.auth.getUser();
      const changedBy = currentUser.data.user?.id || '';
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'pending_payment' })
        .in('id', selectedBills);

      if (error) throw error;

      if (changedBy && billsBeingApproved.length > 0) {
        await supabase.from('invoice_audit_trail').insert(
          billsBeingApproved.map((bill) => ({
            invoice_id: bill.id,
            change_type: 'status_change',
            field_name: 'status',
            old_value: bill.status,
            new_value: 'pending_payment',
            reason:
              bill.latest_vendor_response_at && bill.status === 'pending_approval'
                ? 'Bill approved after vendor resubmission'
                : 'Bill approved from bills list',
            changed_by: changedBy,
          })),
        );
      }

      toast({
        title: "Bills approved",
        description: `${selectedBills.length} bill(s) have been approved`,
      });

      setSelectedBills([]);
      if (approvedBillIds.length === 1) {
        navigate(`/invoices/${approvedBillIds[0]}`);
        return;
      }
      loadBills();
    } catch (error) {
      console.error('Error approving bills:', error);
      toast({
        title: "Error",
        description: "Failed to approve bills",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .in('id', selectedBills);

      if (error) throw error;

      toast({
        title: "Bills deleted",
        description: `${selectedBills.length} bill(s) have been deleted`,
      });

      setSelectedBills([]);
      loadBills();
    } catch (error) {
      console.error('Error deleting bills:', error);
      toast({
        title: "Error",
        description: "Failed to delete bills",
        variant: "destructive",
      });
    }
  };

  if (loading || !currentCompany) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground"><span className="loading-dots">Loading bills</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bills</h1>
          </div>
          <div className="flex items-center gap-4">
            <PayablesViewSelector
              currentView={currentView}
              onViewChange={setCurrentView}
              onSetDefault={setAsDefault}
              isDefault={isDefault}
            />
            {canCreate('bills') && (
              <Button onClick={() => navigate("/invoices/add")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Bill
              </Button>
            )}
          </div>
        </div>

        {/* Status Filter Counters */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">All Bills</p>
                  <p className="text-2xl font-bold">{bills.length}</p>
                </div>
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'pending_coding' ? 'ring-2 ring-secondary' : ''}`}
            onClick={() => setStatusFilter('pending_coding')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Coding</p>
                  <p className="text-2xl font-bold">{pendingCodingBills.length}</p>
                  <p className="text-xs text-muted-foreground">${totalPendingCoding.toLocaleString()}</p>
                </div>
                <FileText className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'pending_approval' ? 'ring-2 ring-warning' : ''}`}
            onClick={() => setStatusFilter('pending_approval')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                  <p className="text-2xl font-bold">{pendingApprovalBills.length}</p>
                  <p className="text-xs text-muted-foreground">${totalPendingApproval.toLocaleString()}</p>
                </div>
                <FileText className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'back_in_review' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('back_in_review')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Back In Review</p>
                  <p className="text-2xl font-bold">{backInReviewBills.length}</p>
                  <p className="text-xs text-muted-foreground">${totalBackInReview.toLocaleString()}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'revision_requested' ? 'ring-2 ring-amber-500' : ''}`}
            onClick={() => setStatusFilter('revision_requested')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Revision Requested</p>
                  <p className="text-2xl font-bold">{revisionRequestedBills.length}</p>
                  <p className="text-xs text-muted-foreground">${totalRevisionRequested.toLocaleString()}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'awaiting_payment' ? 'ring-2 ring-secondary' : ''}`}
            onClick={() => setStatusFilter('awaiting_payment')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Awaiting Payment</p>
                  <p className="text-2xl font-bold">{awaitingPaymentBills.length}</p>
                  <p className="text-xs text-muted-foreground">${totalAwaitingPayment.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'overdue' ? 'ring-2 ring-destructive' : ''}`}
            onClick={() => setStatusFilter('overdue')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold">{overdueBills.length}</p>
                  <p className="text-xs text-muted-foreground">${totalOverdue.toLocaleString()}</p>
                </div>
                <Calendar className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions */}
        {selectedBills.length > 0 && (canEdit('bills') || canDelete('bills')) && (() => {
          const selectedBillsData = bills.filter(b => selectedBills.includes(b.id));
          const hasUnapprovedBills = selectedBillsData.some(b => b.status === 'pending' || b.status === 'pending_approval' || b.status === 'revision_requested');
          
          return (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all-bills"
                checked={selectedBills.length === sortedBills.length && sortedBills.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all-bills">
                Select All ({selectedBills.length} of {sortedBills.length})
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              {hasUnapprovedBills && canEdit('bills') && (
                <Button 
                  variant="outline" 
                  onClick={handleBulkApprove}
                  disabled={selectedBills.length === 0}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Selected ({selectedBills.length})
                </Button>
              )}
              {canDelete('bills') && (
                <Button 
                  variant="destructive" 
                  onClick={handleBulkDelete}
                  disabled={selectedBills.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedBills.length})
                </Button>
              )}
            </div>
          </div>
          );
        })()}

      <Card>
        <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle>All Bills</CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="show-paid" className="text-sm">Show Paid Bills</Label>
                  <Switch
                    id="show-paid"
                    checked={showPaidBills}
                    onCheckedChange={setShowPaidBills}
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                
                {uniqueJobs.length > 0 && (
                  <Select value={jobFilter} onValueChange={setJobFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by job" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jobs</SelectItem>
                      {uniqueJobs.map(job => (
                        <SelectItem key={job} value={job}>{job}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {uniqueVendors.length > 0 && (
                  <Select value={vendorFilter} onValueChange={setVendorFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vendors</SelectItem>
                      {uniqueVendors.map(vendor => (
                        <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="Start Date"
                    className="w-40"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="End Date"
                    className="w-40"
                  />
                </div>

                {(jobFilter !== "all" || vendorFilter !== "all" || startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setJobFilter("all");
                      setVendorFilter("all");
                      setStartDate("");
                      setEndDate("");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentView === 'list' ? (
            // List View (Table)
            <Table className="border-separate border-spacing-0 [&_th]:h-6 [&_th]:py-0 [&_th]:text-sm [&_td]:h-7 [&_td]:py-0 [&_td]:text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedBills.length === sortedBills.length && sortedBills.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('vendor_name')}
                  >
                    <div className="flex items-center">
                      Vendor
                      <SortIcon column="vendor_name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('job_name')}
                  >
                    <div className="flex items-center">
                      Job
                      <SortIcon column="job_name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center">
                      Amount
                      <SortIcon column="amount" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('issue_date')}
                  >
                    <div className="flex items-center">
                      Issue Date
                      <SortIcon column="issue_date" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('due_date')}
                  >
                    <div className="flex items-center">
                      Due Date
                      <SortIcon column="due_date" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Status
                      <SortIcon column="status" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No bills found</p>
                        <p className="text-sm">Upload your first bill to get started</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedBills.map((bill) => {
                    const billIsOverdue = isOverdue(bill);
                    const daysOverdue = billIsOverdue ? calculateDaysOverdue(bill.due_date) : 0;
                    const hasVendorResponse = Boolean(bill.latest_vendor_response_at);
                    const responsePreview = formatResponsePreview(bill.latest_vendor_response_preview);
                    
                    return (
                    <TableRow 
                      key={bill.id} 
                      className="cursor-pointer hover:bg-primary/5 transition-colors border border-transparent hover:border-primary rounded-lg"
                      style={billIsOverdue ? { animation: 'pulse-red 2s ease-in-out infinite' } : undefined}
                     >
                      <TableCell className="py-0" onClick={(e) => e.stopPropagation()}>
                         <Checkbox
                           checked={selectedBills.includes(bill.id)}
                           onCheckedChange={() => handleSelectBill(bill.id)}
                         />
                       </TableCell>
                      <TableCell onClick={() => navigate(`/bills/${bill.id}`)} className="py-0 border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                          <div className="flex items-center gap-2">
                            <VendorAvatar 
                              name={bill.vendor_name}
                              logoUrl={bill.vendor_logo_url}
                              size="sm"
                            />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium group-hover:text-primary transition-colors">{bill.vendor_name}</span>
                            {bill.submitted_from_vendor_portal ? (
                              <Badge variant="secondary" className="text-[10px]">Vendor Portal</Badge>
                            ) : null}
                            {hasVendorResponse ? (
                              <Badge variant="outline" className="text-[10px]">Vendor Replied</Badge>
                            ) : null}
                          </div>
                          {bill.invoice_number ? (
                            <p className="truncate text-xs text-muted-foreground">{bill.invoice_number}</p>
                          ) : null}
                          {responsePreview ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {responsePreview}
                            </p>
                          ) : null}
                        </div>
                        </div>
                       </TableCell>
                       <TableCell onClick={() => navigate(`/bills/${bill.id}`)} className="py-0 border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                         <Badge className={`${getJobColor(bill.job_name)} text-white text-xs`}>
                           {bill.job_name}
                         </Badge>
                       </TableCell>
                         <TableCell onClick={() => navigate(`/bills/${bill.id}`)} className="py-0 font-semibold border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">${formatBillDisplayAmount(bill)}</TableCell>
                          <TableCell onClick={() => navigate(`/bills/${bill.id}`)} className="py-0 border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{new Date(bill.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell onClick={() => navigate(`/bills/${bill.id}`)} className="py-0 border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{new Date(bill.due_date).toLocaleDateString()}</TableCell>
                          <TableCell onClick={() => navigate(`/bills/${bill.id}`)} className="py-0 border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                          <div className="flex items-center gap-1.5">
                             <Badge variant={getStatusVariant(bill.status)}>
                               {formatTimelineLabel(bill.status, hasVendorResponse)}
                            </Badge>
                            {hasVendorResponse ? (
                              <Badge variant="outline">
                                <MessageSquare className="mr-1 h-3 w-3" />
                                {new Date(bill.latest_vendor_response_at || "").toLocaleDateString()}
                              </Badge>
                            ) : null}
                            {billIsOverdue && (
                              <Badge variant="destructive" className="animate-pulse">
                                {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                    </TableRow>
                  );
                  })
                )}
              </TableBody>
            </Table>
          ) : currentView === 'compact' ? (
            // Compact View
            <div className="space-y-1.5">
              {sortedBills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No bills found</p>
                  <p className="text-sm">Upload your first bill to get started</p>
                </div>
              ) : (
                sortedBills.map((bill) => {
                  const billIsOverdue = isOverdue(bill);
                  const daysOverdue = billIsOverdue ? calculateDaysOverdue(bill.due_date) : 0;
                  const hasVendorResponse = Boolean(bill.latest_vendor_response_at);
                  const responsePreview = formatResponsePreview(bill.latest_vendor_response_preview);
                  
                  return (
                  <div 
                    key={bill.id} 
                     className={`flex items-center justify-between px-3 py-0.5 border rounded-lg hover:bg-primary/5 hover:border-primary hover:shadow-md cursor-pointer transition-all duration-200 group ${
                       billIsOverdue ? 'bg-destructive/10' : ''
                     }`}
                     style={billIsOverdue ? { animation: 'pulse-red 2s infinite' } : undefined}
                     onClick={() => navigate(`/bills/${bill.id}`)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedBills.includes(bill.id)}
                          onCheckedChange={() => handleSelectBill(bill.id)}
                        />
                      </div>
                      <Receipt className="h-6 w-6 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{bill.invoice_number || 'No Invoice #'}</p>
                          {bill.submitted_from_vendor_portal ? (
                            <Badge variant="secondary" className="text-[10px]">Vendor Portal</Badge>
                          ) : null}
                          {hasVendorResponse ? (
                            <Badge variant="outline" className="text-[10px]">Vendor Replied</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{bill.vendor_name}</p>
                        {responsePreview ? (
                          <p className="text-xs text-muted-foreground">{responsePreview}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-0.5">
                      <p className="font-semibold text-foreground">${formatBillDisplayAmount(bill)}</p>
                      <Badge className={`${getJobColor(bill.job_name)} text-white text-xs`}>
                        {bill.job_name}
                      </Badge>
                      <Badge variant={getStatusVariant(bill.status)}>
                        {formatTimelineLabel(bill.status, hasVendorResponse)}
                      </Badge>
                      {billIsOverdue && (
                        <Badge variant="destructive" className="animate-pulse">
                          {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          ) : (
            // Super Compact View
            <div className="space-y-0.5">
              {sortedBills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No bills found</p>
                  <p className="text-sm">Upload your first bill to get started</p>
                </div>
              ) : (
                sortedBills.map((bill) => {
                  const billIsOverdue = isOverdue(bill);
                  const daysOverdue = billIsOverdue ? calculateDaysOverdue(bill.due_date) : 0;
                  const hasVendorResponse = Boolean(bill.latest_vendor_response_at);
                  
                  return (
                  <div 
                     key={bill.id} 
                     className="flex items-center justify-between px-2.5 py-0.5 border rounded hover:bg-primary/5 hover:border-primary hover:shadow-md cursor-pointer transition-all duration-200 group"
                     style={billIsOverdue ? { animation: 'pulse-red 2s ease-in-out infinite' } : undefined}
                     onClick={() => navigate(`/bills/${bill.id}`)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedBills.includes(bill.id)}
                          onCheckedChange={() => handleSelectBill(bill.id)}
                        />
                      </div>
                      <Badge className={`${getJobColor(bill.job_name)} text-white flex-shrink-0 text-xs`}>
                        {bill.job_name}
                      </Badge>
                      <span className="font-medium text-foreground truncate">{bill.invoice_number || 'No Invoice #'}</span>
                      <span className="text-sm text-muted-foreground truncate">{bill.vendor_name}</span>
                      {bill.submitted_from_vendor_portal ? (
                        <Badge variant="secondary" className="text-[10px]">Portal</Badge>
                      ) : null}
                      {hasVendorResponse ? (
                        <Badge variant="outline" className="text-[10px]">Replied</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-semibold text-foreground whitespace-nowrap">
                        ${formatBillDisplayAmount(bill)}
                      </span>
                      <Badge variant={getStatusVariant(bill.status)} className="text-[10px]">
                        {formatTimelineLabel(bill.status, hasVendorResponse)}
                      </Badge>
                      {billIsOverdue && (
                        <Badge variant="destructive" className="animate-pulse text-xs">
                          {daysOverdue}d overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
