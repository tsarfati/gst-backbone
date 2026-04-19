import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
  import { 
  ArrowLeft, 
  Download, 
  Mail,
  Edit, 
  DollarSign, 
  Calendar, 
  Building, 
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  MessageSquare,
  XCircle,
  History
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { useCompany } from "@/contexts/CompanyContext";
import { canAccessJobIds } from "@/utils/jobAccess";
import { resolveStorageUrl } from "@/utils/storageUtils";
import VendorAvatar from "@/components/VendorAvatar";
import BillCommunications from "@/components/BillCommunications";
import BillAuditTrail from "@/components/BillAuditTrail";
import BillReceiptSuggestions from "@/components/BillReceiptSuggestions";
import CommitmentInfo from "@/components/CommitmentInfo";
import ZoomableDocumentPreview from "@/components/ZoomableDocumentPreview";
import BillInternalNotes from "@/components/BillInternalNotes";
import FileShareModal from "@/components/FileShareModal";
import BillVendorThread from "@/components/BillVendorThread";
import { evaluateInvoiceCoding } from "@/utils/invoiceCoding";
import { getEffectivePaidByInvoice } from "@/utils/paymentAllocations";

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return 'default';
      case 'pending_approval':
        return 'secondary'; // Orange-like variant
      case 'revision_requested':
        return 'secondary';
      case 'pending':
        return 'outline';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

const getStatusIcon = (status: string) => {
  switch (status) {
    case "approved":
    case "paid":
      return CheckCircle;
    case "pending_approval":
    case "revision_requested":
      return AlertTriangle;
    case "pending":
      return Clock;
    case "rejected":
      return Clock;
    default:
      return FileText;
  }
};

const getVendorPortalSubmissionMetadata = (internalNotes: any): {
  paymentMethod: string | null;
  lineItems: Array<{ description?: string; amount?: number }>;
} | null => {
  if (!internalNotes || typeof internalNotes !== "object" || Array.isArray(internalNotes)) {
    return null;
  }
  if (internalNotes.generated_by_vendor_portal !== true) {
    return null;
  }
  return {
    paymentMethod: typeof internalNotes.payment_method === "string" ? internalNotes.payment_method : null,
    lineItems: Array.isArray(internalNotes.line_items) ? internalNotes.line_items : [],
  };
};

const getBillVendorThreadSubject = (invoiceId: string, invoiceNumber?: string | null) =>
  `Bill ${invoiceNumber || invoiceId.slice(0, 8)} Conversation`;

const formatBillTimelineLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function BillDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyParam = searchParams.get("company");
  const { toast } = useToast();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  const { currentCompany, switchCompany } = useCompany();
  
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [approvingBill, setApprovingBill] = useState(false);
  const [sendingRevisionRequest, setSendingRevisionRequest] = useState(false);
  const [vendorHasWarnings, setVendorHasWarnings] = useState(false);
  const [commitmentTotals, setCommitmentTotals] = useState<any>(null);
  const [payNumber, setPayNumber] = useState<number>(0);
  const [documents, setDocuments] = useState<any[]>([]);
  const [auditTrailOpen, setAuditTrailOpen] = useState(false);
  const [paymentsReceived, setPaymentsReceived] = useState<any[]>([]);
  const [totalPaid, setTotalPaid] = useState<number>(0);
  const [balanceDue, setBalanceDue] = useState<number>(0);
  const [distributions, setDistributions] = useState<any[]>([]);
  const [requireBillDistributionBeforeApproval, setRequireBillDistributionBeforeApproval] = useState(true);
  const [selectedPreviewKey, setSelectedPreviewKey] = useState<string | null>(null);
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(null);
  const [shareFiles, setShareFiles] = useState<Array<{ id: string; file_name: string; file_url: string; file_size: number | null }>>([]);
  const [linkedVendorPortalUser, setLinkedVendorPortalUser] = useState<{ user_id: string; name: string } | null>(null);
  const [latestVendorConversationReply, setLatestVendorConversationReply] = useState<{
    content: string;
    created_at: string;
    attachment_url?: string | null;
  } | null>(null);
  const vendorPortalSubmission = getVendorPortalSubmissionMetadata(bill?.internal_notes);
  
  const calculateDaysOverdue = (dueDate: string): number => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const isOverdue = (): boolean => {
    if (!bill) return false;
    const dueDate = new Date(bill.due_date);
    const today = new Date();
    return (bill.status === 'pending' || bill.status === 'pending_approval' || bill.status === 'approved' || bill.status === 'pending_payment') && dueDate < today;
  };

  useEffect(() => {
    if (id && !websiteJobAccessLoading && currentCompany?.id) {
      fetchBillDetails();
    }
  }, [id, websiteJobAccessLoading, currentCompany?.id, companyParam, isPrivileged, allowedJobIds.join(",")]);

  useEffect(() => {
    if (selectedPreviewKey === 'bill' && bill?.file_url) return;
    if (selectedPreviewKey && selectedPreviewKey !== 'bill') {
      const exists = documents.some((doc) => doc.id === selectedPreviewKey);
      if (exists) return;
    }

    if (documents.length > 0) {
      setSelectedPreviewKey(documents[0].id);
      return;
    }
    if (bill?.file_url) {
      setSelectedPreviewKey('bill');
      return;
    }
    setSelectedPreviewKey(null);
  }, [documents, bill?.file_url, selectedPreviewKey]);

  const fetchBillDetails = async () => {
    if (websiteJobAccessLoading) return;
    const companyId = currentCompany?.id;
    if (!companyId) return;
    const targetCompanyId = companyParam;
    if (targetCompanyId && targetCompanyId !== companyId) {
      await switchCompany(targetCompanyId);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          vendors!inner (name, logo_url, company_id),
          jobs (
            id,
            name
          ),
          cost_codes (
            id,
            code,
            description,
            job_id
          ),
          subcontracts (
            id,
            name,
            contract_amount
          ),
          purchase_orders (
            id,
            po_number
          )
        `)
        .eq('id', id)
        .eq('vendors.company_id', companyId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching bill:', error);
        setBill(null);
      } else if (!data) {
        setBill(null);
        setDistributions([]);
        toast({
          title: "Bill not available in this company",
          description: "This bill does not belong to the currently selected company.",
          variant: "destructive",
        });
        navigate("/invoices");
      } else {
        const directJobId = data?.job_id || data?.jobs?.id || null;
        let distributionJobIds: string[] = [];
        let requiresDistributionBeforeApproval = true;

        if (companyId) {
          const { data: payablesSettings } = await supabase
            .from('payables_settings')
            .select('require_bill_distribution_before_approval')
            .eq('company_id', companyId)
            .maybeSingle();

          requiresDistributionBeforeApproval =
            (payablesSettings as any)?.require_bill_distribution_before_approval ?? true;
          setRequireBillDistributionBeforeApproval(requiresDistributionBeforeApproval);
        } else {
          setRequireBillDistributionBeforeApproval(true);
        }

        if (data?.id) {
          const { data: precheckDistData } = await supabase
            .from('invoice_cost_distributions')
            .select(`
              cost_codes (
                job_id
              )
            `)
            .eq('invoice_id', data.id);

          distributionJobIds = (precheckDistData || [])
            .map((row: any) => row.cost_codes?.job_id)
            .filter((jobId: any): jobId is string => !!jobId);
        }

        const canAccessBill = canAccessJobIds([directJobId, ...distributionJobIds], isPrivileged, allowedJobIds);
        if (!canAccessBill) {
          setBill(null);
          setDistributions([]);
          toast({
            title: "Access denied",
            description: "You do not have access to this job.",
            variant: "destructive",
          });
          navigate("/bills");
          return;
        }

        setBill(data || null);
        
        // Load documents
        if (data?.id) {
          const { data: documentsData } = await supabase
            .from('invoice_documents')
            .select('*')
            .eq('invoice_id', data.id)
            .order('uploaded_at', { ascending: false });
          
          if (documentsData) {
            setDocuments(documentsData);
          }
          
          // Fetch payments made on this bill
          const { data: paymentLines } = await supabase
            .from('payment_invoice_lines')
            .select(`
              id,
              amount_paid,
              created_at,
              payments:payment_id (
                id,
                payment_number,
                payment_date,
                payment_method,
                status,
                amount
              )
            `)
            .eq('invoice_id', data.id);
          
          if (paymentLines && paymentLines.length > 0) {
             setPaymentsReceived(paymentLines);
             const paid = getEffectivePaidByInvoice(paymentLines as any[]).get(data.id) || 0;
             setTotalPaid(paid);
             const remaining = Number(data.amount || 0) - paid;
             setBalanceDue(remaining);
             
             // Auto-correct status: if fully paid but status isn't 'paid', update it
             if (remaining <= 0.01 && data.status !== 'paid') {
               await supabase
                 .from('invoices')
                 .update({ status: 'paid' })
                 .eq('id', data.id);
               setBill(prev => prev ? { ...prev, status: 'paid' } : null);
             } else if (paid > 0 && remaining > 0.01 && data.status === 'paid') {
               await supabase
                 .from('invoices')
                 .update({ status: 'pending_payment' })
                 .eq('id', data.id);
               setBill(prev => prev ? { ...prev, status: 'pending_payment' } : null);
             }
           } else {
             setPaymentsReceived([]);
             setTotalPaid(0);
             setBalanceDue(Number(data.amount || 0));
           }
          
          // Load cost distributions
           // NOTE: invoice_cost_distributions does not have a direct jobs relationship;
           // we derive the job via cost_codes.job_id.
           const { data: distData } = await supabase
             .from('invoice_cost_distributions')
             .select(`
               id,
               cost_code_id,
               amount,
               percentage,
               cost_codes (
                 id,
                 code,
                 description,
                 type,
                 job_id,
                 jobs (id, name)
               )
             `)
             .eq('invoice_id', data.id);
           
           if (distData && distData.length > 0) {
             setDistributions(distData);
             
             // Auto-transition pending_coding bills to pending_approval when cost distributions are found
             // only when distribution gating is not enforced.
             if (data.status === 'pending_coding' && !requiresDistributionBeforeApproval) {
               await supabase
                 .from('invoices')
                 .update({ status: 'pending_approval', pending_coding: false })
                 .eq('id', data.id);
               
               // Update local state to reflect the change
               setBill(prev => prev ? { ...prev, status: 'pending_approval', pending_coding: false } : null);
             }
           } else if (data.job_id || data.cost_code_id) {
             // Create a single distribution from the main job/cost code
             setDistributions([{
               id: 'main',
               job_id: data.job_id,
               cost_code_id: data.cost_code_id,
               amount: data.amount,
               percentage: 100,
               jobs: data.jobs,
               cost_codes: data.cost_codes
             }]);
             
             // Auto-transition pending_coding bills to pending_approval when cost code is assigned
             // only when distribution gating is not enforced.
             if (data.status === 'pending_coding' && !requiresDistributionBeforeApproval) {
               await supabase
                 .from('invoices')
                 .update({ status: 'pending_approval', pending_coding: false })
                 .eq('id', data.id);
               
               // Update local state to reflect the change
               setBill(prev => prev ? { ...prev, status: 'pending_approval', pending_coding: false } : null);
             }
           } else {
             setDistributions([]);
           }
        }
        
        // If this is a subcontract invoice, fetch commitment totals
        if (data?.subcontract_id) {
          await fetchCommitmentTotals(data.subcontract_id, data.id);
        }

        if (data?.vendor_id) {
          const { data: vendorProfileRows, error: vendorProfileError } = await supabase
            .from('profiles')
            .select('user_id, display_name, first_name, last_name, role')
            .eq('vendor_id', data.vendor_id)
            .eq('role', 'vendor')
            .limit(1);

          if (!vendorProfileError && vendorProfileRows && vendorProfileRows.length > 0) {
            const vendorProfile = vendorProfileRows[0] as any;
            setLinkedVendorPortalUser({
              user_id: String(vendorProfile.user_id),
              name: String(
                vendorProfile.display_name ||
                `${vendorProfile.first_name || ''} ${vendorProfile.last_name || ''}`.trim() ||
                'Vendor User'
              ),
            });
          } else {
            setLinkedVendorPortalUser(null);
          }

          const { data: vendorReplyRows, error: vendorReplyError } = await supabase
            .from('messages')
            .select('content, created_at, attachment_url, from_user_id')
            .eq('thread_id', data.id)
            .eq('attachment_type', 'bill_vendor_thread')
            .order('created_at', { ascending: false })
            .limit(10);

          if (!vendorReplyError && vendorReplyRows) {
            const vendorUserIds = new Set(
              (vendorProfileRows || []).map((row: any) => String(row.user_id || '')).filter(Boolean),
            );
            const latestVendorReply = (vendorReplyRows as any[]).find((row) => vendorUserIds.has(String(row.from_user_id || '')));
            setLatestVendorConversationReply(
              latestVendorReply
                ? {
                    content: String(latestVendorReply.content || ''),
                    created_at: String(latestVendorReply.created_at),
                    attachment_url: latestVendorReply.attachment_url || null,
                  }
                : null,
            );
          } else {
            setLatestVendorConversationReply(null);
          }
        } else {
          setLinkedVendorPortalUser(null);
          setLatestVendorConversationReply(null);
        }
        
        // Check vendor compliance warnings if vendor exists
        if (data?.vendor_id) {
          await checkVendorCompliance(data.vendor_id);
        }
      }
    } catch (error) {
      console.error('Error fetching bill details:', error);
      toast({
        title: "Error",
        description: "Failed to load bill details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCommitmentTotals = async (subcontractId: string, currentBillId: string) => {
    try {
      const { data: subcontractData } = await supabase
        .from('subcontracts')
        .select('contract_amount')
        .eq('id', subcontractId)
        .single();

      const { data: previousInvoices } = await supabase
        .from('invoices')
        .select('amount, status, id, created_at')
        .eq('subcontract_id', subcontractId)
        .neq('status', 'rejected')
        .order('created_at');

      const totalCommit = subcontractData?.contract_amount || 0;
      
      // Filter out current bill for totals
      const otherInvoices = previousInvoices?.filter(inv => inv.id !== currentBillId) || [];
      const prevGross = otherInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const prevRetention = 0;
      const prevPayments = otherInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const contractBalance = totalCommit - prevGross;

      setCommitmentTotals({
        totalCommit,
        prevGross,
        prevRetention,
        prevPayments,
        contractBalance
      });

      // Calculate pay number
      if (previousInvoices) {
        const currentInvoiceIndex = previousInvoices.findIndex(inv => inv.id === currentBillId);
        setPayNumber(currentInvoiceIndex + 1);
      }
    } catch (error) {
      console.error('Error fetching commitment totals:', error);
    }
  };

  const checkVendorCompliance = async (vendorId: string) => {
    try {
      const { data: complianceData, error } = await supabase
        .from('vendor_compliance_documents')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_required', true);

      if (error) {
        console.error('Error checking vendor compliance:', error);
        return;
      }

      const hasWarnings = complianceData?.some(doc => {
        const isExpired = doc.expiration_date && new Date(doc.expiration_date) < new Date();
        const isMissing = !doc.is_uploaded;
        return isExpired || isMissing;
      }) || false;

      setVendorHasWarnings(hasWarnings);
    } catch (error) {
      console.error('Error checking vendor compliance:', error);
    }
  };

  const handleApproveBill = async () => {
    if (!id) return;
    const codingValidation = evaluateInvoiceCoding({
      amount: bill?.amount,
      job_id: bill?.job_id,
      cost_code_id: bill?.cost_code_id,
      cost_codes: bill?.cost_codes || null,
      distributions: distributions as any[],
    });
    if (requireBillDistributionBeforeApproval && !codingValidation.isComplete) {
      toast({
        title: "Bill is not fully coded",
        description: codingValidation.issues[0] || "Complete job/cost coding and 100% distribution before approval.",
        variant: "destructive",
      });
      return;
    }
    
    setApprovingBill(true);
    try {
      const priorStatus = bill?.status || 'pending';
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      // Create audit trail entry
      await supabase
        .from('invoice_audit_trail')
        .insert({
          invoice_id: id,
          change_type: 'status_change',
          field_name: 'status',
          old_value: priorStatus,
          new_value: 'approved',
          reason:
            approvalNotes ||
            (latestVendorConversationReply && priorStatus === 'pending_approval'
              ? 'Bill approved after vendor resubmission'
              : 'Bill approved'),
          changed_by: (await supabase.auth.getUser()).data.user?.id || ''
        });

      toast({
        title: latestVendorConversationReply && priorStatus === 'pending_approval' ? "Resubmission approved" : "Bill approved",
        description:
          latestVendorConversationReply && priorStatus === 'pending_approval'
            ? "The vendor resubmission has been approved successfully."
            : "Bill has been approved successfully",
      });

      setApprovalDialogOpen(false);
      setApprovalNotes("");
      fetchBillDetails();
    } catch (error) {
      console.error('Error approving bill:', error);
      toast({
        title: "Error",
        description: "Failed to approve bill",
        variant: "destructive",
      });
    } finally {
      setApprovingBill(false);
    }
  };

  const handleRejectBill = async () => {
    if (!id) return;
    
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Bill has been rejected",
      });

      fetchBillDetails();
    } catch (error) {
      console.error('Error rejecting bill:', error);
      toast({
        title: "Error",
        description: "Failed to reject bill",
        variant: "destructive",
      });
    }
  };

  const handleRequestRevision = async () => {
    if (!id || !linkedVendorPortalUser?.user_id || !revisionNotes.trim()) return;

    setSendingRevisionRequest(true);
    try {
      const authUser = await supabase.auth.getUser();
      const currentUserId = authUser.data.user?.id;
      if (!currentUserId) throw new Error("Not authenticated");

      const invoiceLabel = bill?.invoice_number || `INV-${String(id).slice(0, 8)}`;
      const vendorName = bill?.vendors?.name || "vendor";
      const messageBody = [
        `A revision was requested for bill ${invoiceLabel}${bill?.job_id && bill?.jobs?.name ? ` on ${bill.jobs.name}` : ""}.`,
        "",
        revisionNotes.trim(),
      ].join("\n");

      const { error: messageError } = await supabase.rpc('send_message', {
        p_from_user_id: currentUserId,
        p_to_user_id: linkedVendorPortalUser.user_id,
        p_company_id: currentCompany?.id || '',
        p_subject: getBillVendorThreadSubject(id, bill?.invoice_number),
        p_content: messageBody,
        p_thread_id: id,
        p_attachment_type: 'bill_vendor_thread',
      });

      if (messageError) throw messageError;

      await supabase
        .from('invoices')
        .update({ status: 'revision_requested' })
        .eq('id', id);

      await supabase.from('invoice_audit_trail').insert({
        invoice_id: id,
        change_type: 'comment',
        field_name: 'vendor_revision_request',
        old_value: null,
        new_value: revisionNotes.trim(),
        reason: `Revision requested from ${vendorName} via vendor portal message`,
        changed_by: currentUserId,
      });

      toast({
        title: "Revision request sent",
        description: `The request was sent to ${linkedVendorPortalUser.name} in the vendor portal inbox.`,
      });

      setRevisionDialogOpen(false);
      setRevisionNotes("");
      await fetchBillDetails();
    } catch (error: any) {
      console.error('Error requesting vendor revision:', error);
      toast({
        title: "Could not send revision request",
        description: error?.message || "The vendor revision request could not be sent.",
        variant: "destructive",
      });
    } finally {
      setSendingRevisionRequest(false);
    }
  };

  const selectedDocument = selectedPreviewKey && selectedPreviewKey !== 'bill'
    ? documents.find((doc) => doc.id === selectedPreviewKey)
    : null;
  const activePreviewUrl = selectedDocument?.file_url || (selectedPreviewKey === 'bill' ? bill?.file_url : null) || null;
  const activePreviewName = selectedDocument?.file_name || 'Bill Document';

  const parseStoragePathFromPublicUrl = (url: string, bucket: string): string | null => {
    try {
      const parsed = new URL(url);
      const marker = `/storage/v1/object/public/${bucket}/`;
      const idx = parsed.pathname.indexOf(marker);
      if (idx === -1) return null;
      return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
    } catch {
      return null;
    }
  };

  const normalizeReceiptsPath = (urlOrPath?: string | null): string | null => {
    if (!urlOrPath) return null;
    if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
      return parseStoragePathFromPublicUrl(urlOrPath, "receipts");
    }
    return urlOrPath;
  };

  const toShareableFile = (source: { id: string; file_name: string; file_url: string; file_size?: number | null } | null) => {
    if (!source?.file_url) return null;
    const normalizedPath = normalizeReceiptsPath(source.file_url);
    if (!normalizedPath) return null;
    return {
      id: source.id,
      file_name: source.file_name,
      file_url: normalizedPath,
      file_size: source.file_size ?? null,
    };
  };

  const downloadDocument = async (urlOrPath: string, fileName: string) => {
    try {
      const resolvedUrl = await resolveStorageUrl("receipts", urlOrPath);
      if (!resolvedUrl) throw new Error("Could not resolve file URL");
      const response = await fetch(resolvedUrl);
      if (!response.ok) throw new Error("Failed to download file");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName || "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Download failed",
        description: "Could not download this document.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    const resolvePreview = async () => {
      if (!activePreviewUrl) {
        if (!cancelled) setResolvedPreviewUrl(null);
        return;
      }
      const resolved = await resolveStorageUrl('receipts', activePreviewUrl);
      if (!cancelled) setResolvedPreviewUrl(resolved || activePreviewUrl);
    };
    resolvePreview();
    return () => {
      cancelled = true;
    };
  }, [activePreviewUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bill Not Found</h1>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">No Bill Available</h2>
            <p className="text-muted-foreground mb-4">
              This bill doesn&apos;t exist or you don&apos;t have permission to view it.
            </p>
            <Button onClick={() => navigate("/invoices")}>
              Return to Bills
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(bill?.status || "pending");
  const billIsOverdue = isOverdue();
  const daysOverdue = billIsOverdue ? calculateDaysOverdue(bill.due_date) : 0;
  const codingValidation = evaluateInvoiceCoding({
    amount: bill?.amount,
    job_id: bill?.job_id,
    cost_code_id: bill?.cost_code_id,
    cost_codes: bill?.cost_codes || null,
    distributions: distributions as any[],
  });
  const approvalBlockedByCoding = requireBillDistributionBeforeApproval && !codingValidation.isComplete;
  const billTimeline = [
    { key: "submitted", label: "Submitted", active: true, variant: "outline" as const },
    {
      key: "revision_requested",
      label: "Revision Requested",
      active: bill?.status === "revision_requested" || !!latestVendorConversationReply,
      variant: bill?.status === "revision_requested" ? "secondary" as const : "outline" as const,
    },
    {
      key: "vendor_replied",
      label: latestVendorConversationReply
        ? bill?.status === "pending_approval"
          ? "Vendor Replied"
          : "Vendor Updated"
        : "Vendor Response",
      active: !!latestVendorConversationReply,
      variant: latestVendorConversationReply ? "secondary" as const : "outline" as const,
    },
    {
      key: "current_status",
      label: formatBillTimelineLabel(
        bill?.status === "pending_approval" ? "back_in_review" : String(bill?.status || "pending"),
      ),
      active: true,
      variant: getStatusVariant(bill?.status || "pending"),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      {/* Overdue Banner */}
      {billIsOverdue && (
        <div 
          className="mb-6 border-2 border-destructive rounded-lg p-6"
          style={{ animation: 'pulse-red 2s ease-in-out infinite' }}
        >
          <div className="flex items-center gap-4">
            <AlertTriangle className="h-12 w-12 text-destructive flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-bold text-destructive mb-1">
                Bill Overdue
              </h2>
              <p className="text-lg font-semibold text-destructive/90">
                This bill is overdue by {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Due date was {new Date(bill.due_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bill Details</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {billTimeline.map((item) => (
                <Badge
                  key={item.key}
                  variant={item.variant}
                  className={item.active ? "" : "opacity-60"}
                >
                  {item.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={auditTrailOpen} onOpenChange={setAuditTrailOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <History className="h-4 w-4 mr-2" />
                Audit Trail
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bill Audit Trail</DialogTitle>
                <DialogDescription>
                  Complete history of all changes made to this bill
                </DialogDescription>
              </DialogHeader>
              <BillAuditTrail billId={bill?.id || ''} />
            </DialogContent>
          </Dialog>

          <Button onClick={() => navigate(`/bills/${id}/edit`)} variant="secondary">
            <Edit className="h-4 w-4 mr-2" />
            Edit Bill
          </Button>
          
          {(bill?.status === 'approved' || bill?.status === 'pending_payment') && (
            <Button onClick={() => navigate('/payables/make-payment', { state: { billId: id } })}>
              <DollarSign className="h-4 w-4 mr-2" />
              Make Payment
            </Button>
          )}
          
          {(bill?.status === 'pending_approval' || bill?.status === 'pending' || bill?.status === 'revision_requested') && (
            <>
              {vendorPortalSubmission && linkedVendorPortalUser ? (
                <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Request Revision
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Vendor Revision</DialogTitle>
                      <DialogDescription>
                        Send a revision request to {linkedVendorPortalUser.name} in the vendor portal for this bill.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="revision-request-notes">Revision Request</Label>
                        <Textarea
                          id="revision-request-notes"
                          placeholder="Describe what needs to be corrected, clarified, or re-submitted."
                          value={revisionNotes}
                          onChange={(e) => setRevisionNotes(e.target.value)}
                          className="mt-2 min-h-[140px]"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setRevisionDialogOpen(false)}
                        disabled={sendingRevisionRequest}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleRequestRevision}
                        disabled={sendingRevisionRequest || !revisionNotes.trim()}
                      >
                        {sendingRevisionRequest ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Send Request
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null}
              {approvalBlockedByCoding ? (
                <Button variant="default" onClick={() => navigate(`/bills/${id}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Code Bill
                </Button>
              ) : (
                <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Bill
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Approve Bill</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to approve this bill for ${bill?.amount?.toLocaleString()} from {bill?.vendors?.name}?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="approval-notes">Approval Notes (Optional)</Label>
                        <Textarea
                          id="approval-notes"
                          placeholder="Add any notes about this approval..."
                          value={approvalNotes}
                          onChange={(e) => setApprovalNotes(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setApprovalDialogOpen(false)}
                        disabled={approvingBill}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleApproveBill}
                        disabled={approvingBill || (requireBillDistributionBeforeApproval && !codingValidation.isComplete)}
                      >
                        {approvingBill ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve Bill
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              <Button 
                variant="destructive"
                onClick={handleRejectBill}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Bill
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* File Preview Section */}
        <div className="xl:col-span-3">
          <Card className="mb-6 xl:sticky xl:top-20">
            <CardContent className="space-y-4">
              <div className="h-[calc(100vh-12rem)] min-h-[680px] rounded-lg overflow-hidden bg-muted/20">
                <ZoomableDocumentPreview
                  url={resolvedPreviewUrl}
                  fileName={activePreviewName}
                  className="h-full"
                  emptyMessage="No documents available"
                  emptySubMessage="Attach a bill document to preview it here"
                />
              </div>

              {(documents.length > 0 || bill?.file_url) && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Select Document</div>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md cursor-pointer border ${selectedPreviewKey === doc.id ? 'bg-primary/10 ring-1 ring-primary/50 border-primary/50' : 'bg-muted/40 hover:bg-muted/70 border-transparent'}`}
                      onClick={() => setSelectedPreviewKey(doc.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="text-sm truncate">{doc.file_name}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Download"
                          onClick={(e) => {
                            e.stopPropagation();
                            void downloadDocument(doc.file_url, doc.file_name || "Document");
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Email"
                          onClick={(e) => {
                            e.stopPropagation();
                            const shareable = toShareableFile({
                              id: String(doc.id),
                              file_name: doc.file_name || "Document",
                              file_url: doc.file_url,
                              file_size: doc.file_size ?? null,
                            });
                            if (!shareable) {
                              toast({
                                title: "Cannot email file",
                                description: "This file is missing a valid storage path.",
                                variant: "destructive",
                              });
                              return;
                            }
                            setShareFiles([shareable]);
                          }}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {bill?.file_url && (
                    <div
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md cursor-pointer border ${selectedPreviewKey === 'bill' ? 'bg-primary/10 ring-1 ring-primary/50 border-primary/50' : 'bg-muted/40 hover:bg-muted/70 border-transparent'}`}
                      onClick={() => setSelectedPreviewKey('bill')}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="text-sm truncate">Bill Document</span>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Download"
                          onClick={(e) => {
                            e.stopPropagation();
                            void downloadDocument(bill.file_url, "Bill Document");
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Email"
                          onClick={(e) => {
                            e.stopPropagation();
                            const shareable = toShareableFile({
                              id: "bill-main-document",
                              file_name: "Bill Document",
                              file_url: bill.file_url,
                              file_size: null,
                            });
                            if (!shareable) {
                              toast({
                                title: "Cannot email file",
                                description: "This file is missing a valid storage path.",
                                variant: "destructive",
                              });
                              return;
                            }
                            setShareFiles([shareable]);
                          }}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-6">
            <BillCommunications
              billId={bill?.id || ''}
              vendorId={bill?.vendor_id || ''}
              jobId={bill?.job_id || null}
            />
          </div>

          {vendorPortalSubmission ? (
            <div className="mt-6">
              <BillVendorThread
                billId={bill.id}
                subject={getBillVendorThreadSubject(bill.id, bill.invoice_number)}
                defaultRecipientId={linkedVendorPortalUser?.user_id || null}
                title="Vendor Portal Conversation"
                emptyMessage="No builder-to-vendor conversation has started on this bill yet."
              />
            </div>
          ) : null}
        </div>

        <div className="xl:col-span-1 space-y-6">
      {/* Bill Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {bill?.subcontract_id || bill?.purchase_order_id ? "Commitment Bill Information" : "Bill Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Vendor Section */}
            <div>
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">Vendor</h4>
              <div className="flex items-start gap-3 min-w-0">
                <VendorAvatar 
                  name={bill?.vendors?.name || 'Unknown Vendor'}
                  logoUrl={bill?.vendors?.logo_url}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Button
                      variant="link"
                      className="min-w-0 max-w-full p-0 h-auto font-medium text-left"
                      onClick={() => navigate(`/vendors/${bill?.vendor_id}`)}
                    >
                      <span className="truncate">{bill?.vendors?.name}</span>
                      <ExternalLink className="h-3 w-3 ml-1 shrink-0" />
                    </Button>
                    {vendorHasWarnings && (
                      <Badge variant="destructive" className="max-w-full shrink-0 gap-1 px-2 py-0.5 text-[10px] leading-tight">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span className="whitespace-nowrap">Compliance Warning</span>
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Invoice Details */}
            <div>
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">Invoice Details</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Bill Amount</p>
                  <p className="font-medium text-2xl">${bill?.amount?.toLocaleString()}</p>
                </div>
                {/* Retainage Section - show for commitment bills with retainage */}
                {(bill?.retainage_percentage > 0 || bill?.retainage_amount > 0) && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Retainage ({bill?.retainage_percentage}%)</p>
                      <p className="font-medium text-xl text-orange-600">
                        -${Number(bill?.retainage_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Payable</p>
                      <p className="font-medium text-2xl text-green-600">
                        ${(Number(bill?.amount || 0) - Number(bill?.retainage_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </>
                )}
                {totalPaid > 0 && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Amount Paid</p>
                      <p className="font-medium text-2xl text-green-600">${totalPaid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Balance Due</p>
                      <p className={`font-medium text-2xl ${balanceDue > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        ${balanceDue.toLocaleString()}
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    <StatusIcon className="h-4 w-4" />
                    <Badge 
                      variant={getStatusVariant(bill?.status)} 
                      className={`w-fit ${bill?.status === 'pending_approval' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-300 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' : ''}`}
                    >
                      {bill?.status === 'pending_approval' ? 'Pending Approval' : 
                       bill?.status?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Number</p>
                  <p className="font-medium">{bill?.invoice_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Issue Date</p>
                  <p className="font-medium">
                    {bill?.issue_date ? new Date(bill.issue_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {bill?.due_date ? new Date(bill.due_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Terms</p>
                  <p className="font-medium">{bill?.payment_terms ? `${bill.payment_terms} days` : 'N/A'}</p>
                </div>
                {/* Pay Number or Reimbursement - conditionally displayed */}
                {bill?.subcontract_id && payNumber > 0 ? (
                  <div>
                    <p className="text-sm text-muted-foreground">Pay Number</p>
                    <p className="font-medium">Pay #{payNumber}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">Reimbursement Payment</p>
                    <p className="font-medium">
                      {bill?.is_reimbursement ? 'Yes' : 'No'}
                    </p>
                  </div>
                )}
                {/* Commitment Type - Subcontract or Purchase Order */}
                {bill?.subcontract_id && bill?.subcontracts && (
                  <div>
                    <p className="text-sm text-muted-foreground">Commitment</p>
                    <button
                      className="font-medium text-left hover:underline hover:text-primary flex items-center gap-1"
                      onClick={() => navigate(`/subcontracts/${bill.subcontract_id}`)}
                    >
                      Subcontract: {bill.subcontracts.name}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {bill?.purchase_order_id && bill?.purchase_orders && (
                  <div>
                    <p className="text-sm text-muted-foreground">Commitment</p>
                    <button
                      className="font-medium text-left hover:underline hover:text-primary flex items-center gap-1"
                      onClick={() => navigate(`/purchase-orders/${bill.purchase_order_id}`)}
                    >
                      Purchase Order: {bill.purchase_orders.po_number}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Created Date</p>
                  <p className="font-medium">
                    {bill?.created_at ? new Date(bill.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">
                    {bill?.updated_at ? new Date(bill.updated_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                {vendorPortalSubmission ? (
                  <div>
                    <p className="text-sm text-muted-foreground">Submission Source</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Vendor Portal</Badge>
                      {vendorPortalSubmission.paymentMethod ? (
                        <Badge variant="outline">Pay by {vendorPortalSubmission.paymentMethod.toUpperCase()}</Badge>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              
            </div>

            {/* Commitment Information */}
            {commitmentTotals && (
              <>
                <Separator />
                <div>
                  <CommitmentInfo
                    totalCommit={commitmentTotals.totalCommit}
                    prevGross={commitmentTotals.prevGross}
                    prevRetention={commitmentTotals.prevRetention}
                    prevPayments={commitmentTotals.prevPayments}
                    contractBalance={commitmentTotals.contractBalance}
                  />
                </div>
              </>
            )}

            {vendorPortalSubmission ? (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground">Vendor Submission</h4>
                  <div className="space-y-3">
                    <div className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Submitted From Vendor Portal</Badge>
                        {vendorPortalSubmission.paymentMethod ? (
                          <Badge variant="outline">Requested payment: {vendorPortalSubmission.paymentMethod.toUpperCase()}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        This bill was submitted directly by the vendor and should be reviewed with the attached backup and line items below.
                      </p>
                    </div>
                    {vendorPortalSubmission.lineItems.length > 0 ? (
                      <div className="space-y-2">
                        {vendorPortalSubmission.lineItems.map((item, index) => (
                          <div key={`${item.description || "line"}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{item.description || `Line ${index + 1}`}</p>
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                              ${Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {latestVendorConversationReply ? (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground">Latest Vendor Response</h4>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Vendor Replied</Badge>
                      {bill?.status === 'pending_approval' ? <Badge variant="secondary">Resubmitted For Review</Badge> : null}
                      <p className="text-xs text-muted-foreground">{new Date(latestVendorConversationReply.created_at).toLocaleString()}</p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {latestVendorConversationReply.content || "Vendor sent an update in the bill conversation."}
                    </p>
                    {latestVendorConversationReply.attachment_url ? (
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void downloadDocument(latestVendorConversationReply.attachment_url || '', 'Vendor Attachment')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Open Attached Revision
                        </Button>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {approvalBlockedByCoding ? (
                        <Button variant="default" size="sm" onClick={() => navigate(`/bills/${id}/edit`)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Code Before Approval
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setApprovalDialogOpen(true)}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve Resubmission
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setRevisionDialogOpen(true)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Still Needs Changes
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {/* Payment History */}
            {paymentsReceived.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground">Payment History</h4>
                  <div className="space-y-2">
                    {paymentsReceived.map((pl) => (
                      <div 
                        key={pl.id} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-md cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => navigate(`/payables/payments/${pl.payments?.payment_number}`)}
                      >
                        <div className="flex items-center gap-3">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="font-medium">{pl.payments?.payment_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {pl.payments?.payment_date ? new Date(pl.payments.payment_date).toLocaleDateString() : 'N/A'}
                              {' • '}
                              {pl.payments?.payment_method?.replace(/_/g, ' ')?.replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">${Number(pl.amount_paid).toLocaleString()}</p>
                          <Badge variant="outline" className="text-xs">
                            {pl.payments?.status?.replace(/_/g, ' ')?.replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
      </div>
              </>
            )}
          </CardContent>
        </Card>

      {/* Cost Distribution Section */}
      {!bill?.subcontract_id && !bill?.purchase_order_id && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distributions.length > 0 ? (
              <div className="space-y-3">
                {distributions.map((dist, index) => (
                  <div key={dist.id || index} className="p-3 border rounded-lg bg-muted/30 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {(dist.jobs?.name || dist.cost_codes?.jobs?.name) && (
                        <Badge variant="outline">{dist.jobs?.name || dist.cost_codes?.jobs?.name}</Badge>
                      )}
                      {dist.cost_codes?.type && (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {dist.cost_codes.type}
                        </Badge>
                      )}
                    </div>
                    {dist.cost_codes && (
                      <div className="text-sm font-medium break-words">
                        {dist.cost_codes.code} - {dist.cost_codes.description}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="font-medium">
                        ${Number(dist.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-muted-foreground">
                        {Number(dist.percentage || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
                {distributions.length > 1 && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-medium">Total</span>
                    <span className="font-medium">
                      ${distributions.reduce((sum, d) => sum + Number(d.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No cost distribution set</p>
            )}
            {requireBillDistributionBeforeApproval && !codingValidation.isComplete && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {codingValidation.issues[0] || "Bill must be fully coded before approval."}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Receipt Suggestions */}
      {!bill?.file_url && (
        <BillReceiptSuggestions
          billVendorId={bill?.vendor_id}
          billVendorName={bill?.vendors?.name}
          billAmount={bill?.amount}
          onReceiptAttached={fetchBillDetails}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Description & Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Description</Label>
            <div className="text-sm bg-muted/50 p-3 rounded-md min-h-[72px]">
              {bill?.description || "No description provided"}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <div className="text-sm bg-muted/50 p-3 rounded-md min-h-[72px] whitespace-pre-wrap">
              {typeof bill?.internal_notes === "string"
                ? bill.internal_notes
                : vendorPortalSubmission
                  ? "Vendor portal submission metadata is shown above."
                  : "No internal notes"}
            </div>
          </div>
        </CardContent>
      </Card>

      </div>
      </div>

      {shareFiles.length > 0 && (
        <FileShareModal
          open={shareFiles.length > 0}
          onOpenChange={(open) => {
            if (!open) setShareFiles([]);
          }}
          files={shareFiles}
          jobId={bill?.job_id || "bill-details"}
          storageBucket="receipts"
        />
      )}

    </div>
  );
}
