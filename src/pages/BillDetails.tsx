import { useParams, useNavigate } from "react-router-dom";
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
  Eye, 
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
  XCircle,
  History
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import VendorAvatar from "@/components/VendorAvatar";
import BillCommunications from "@/components/BillCommunications";
import BillAuditTrail from "@/components/BillAuditTrail";
import BillReceiptSuggestions from "@/components/BillReceiptSuggestions";
import CommitmentInfo from "@/components/CommitmentInfo";
import UrlPdfInlinePreview from "@/components/UrlPdfInlinePreview";
import BillInternalNotes from "@/components/BillInternalNotes";

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return 'default';
      case 'pending_approval':
        return 'secondary'; // Orange-like variant
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
      return AlertTriangle;
    case "pending":
      return Clock;
    case "rejected":
      return Clock;
    default:
      return FileText;
  }
};

export default function BillDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approvingBill, setApprovingBill] = useState(false);
  const [vendorHasWarnings, setVendorHasWarnings] = useState(false);
  const [commitmentTotals, setCommitmentTotals] = useState<any>(null);
  const [payNumber, setPayNumber] = useState<number>(0);
  const [documents, setDocuments] = useState<any[]>([]);
  const [auditTrailOpen, setAuditTrailOpen] = useState(false);
  
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
    if (id) {
      fetchBillDetails();
    }
  }, [id]);

  const fetchBillDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          vendors (name, logo_url),
          jobs (
            id,
            name
          ),
          cost_codes (
            id,
            code,
            description
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
        .maybeSingle();

      if (error) {
        console.error('Error fetching bill:', error);
        setBill(null);
      } else {
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
        }
        
        // If this is a subcontract invoice, fetch commitment totals
        if (data?.subcontract_id) {
          await fetchCommitmentTotals(data.subcontract_id, data.id);
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
    
    setApprovingBill(true);
    try {
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
          old_value: bill?.status || 'pending',
          new_value: 'approved',
          reason: approvalNotes || 'Bill approved',
          changed_by: (await supabase.auth.getUser()).data.user?.id || ''
        });

      toast({
        title: "Success",
        description: "Bill has been approved successfully",
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bill Not Found</h1>
            <p className="text-muted-foreground">The requested bill could not be found</p>
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
            <p className="text-muted-foreground">
              {bill?.vendors?.name} - {bill?.invoice_number || 'No Invoice Number'}
            </p>
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
          
          {bill?.status === 'approved' && (
            <Button onClick={() => navigate('/payables/make-payment', { state: { billId: id } })}>
              <DollarSign className="h-4 w-4 mr-2" />
              Make Payment
            </Button>
          )}
          
          {(bill?.status === 'pending_approval' || bill?.status === 'pending') && (
            <>
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
                      disabled={approvingBill}
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

      {/* Bill Information */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-6">
        <Card className="lg:col-span-7">
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
              <div className="flex items-center gap-3">
                <VendorAvatar 
                  name={bill?.vendors?.name || 'Unknown Vendor'}
                  logoUrl={bill?.vendors?.logo_url}
                  size="md"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="link"
                      className="p-0 h-auto font-medium text-left"
                      onClick={() => navigate(`/vendors/${bill?.vendor_id}`)}
                    >
                      {bill?.vendors?.name}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                    {vendorHasWarnings && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Compliance Warning
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium text-2xl">${bill?.amount?.toLocaleString()}</p>
                </div>
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
                <div>
                  <p className="text-sm text-muted-foreground">Job</p>
                  <p className="font-medium">{bill?.jobs?.name || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cost Code</p>
                  <p className="font-medium">
                    {bill?.cost_codes ? `${bill.cost_codes.code} - ${bill.cost_codes.description}` : 'Not set'}
                  </p>
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
              </div>
              
              {bill?.description && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Description</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-md">{bill.description}</p>
                </div>
              )}
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
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          <BillCommunications 
            billId={bill?.id || ''}
            vendorId={bill?.vendor_id || ''}
          />
        </div>
      </div>

      {/* Receipt Suggestions */}
      {!bill?.file_url && (
        <BillReceiptSuggestions
          billVendorId={bill?.vendor_id}
          billVendorName={bill?.vendors?.name}
          billAmount={bill?.amount}
          onReceiptAttached={fetchBillDetails}
        />
      )}

      {/* File Preview Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bill Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <div className="space-y-4 max-h-[800px] overflow-y-auto">
              {documents.map((doc) => (
                <div key={doc.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-muted">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">{doc.file_name}</span>
                    </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (doc.file_url) {
                      window.open(doc.file_url, '_blank', 'noopener,noreferrer');
                    } else {
                      toast({
                        title: "Error",
                        description: "Document URL not available",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Open Document
                </Button>
                  </div>
                  {doc.file_url.endsWith('.pdf') ? (
                    <div className="max-h-[800px] overflow-y-auto bg-muted/20">
                      <UrlPdfInlinePreview url={doc.file_url} />
                    </div>
                  ) : (
                    <img 
                      src={doc.file_url} 
                      alt={doc.file_name}
                      className="w-full h-auto"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : bill?.file_url ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-muted">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">Bill Document</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (bill.file_url) {
                      window.open(bill.file_url, '_blank', 'noopener,noreferrer');
                    } else {
                      toast({
                        title: "Error",
                        description: "Document URL not available",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Open Document
                </Button>
              </div>
              {bill.file_url.endsWith('.pdf') ? (
                <div className="max-h-[800px] overflow-y-auto bg-muted/20">
                  <UrlPdfInlinePreview url={bill.file_url} />
                </div>
              ) : (
                <img 
                  src={bill.file_url} 
                  alt="Bill document"
                  className="w-full h-auto"
                />
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Documents Available</h3>
              <p className="text-muted-foreground">
                No bill documents have been uploaded for this bill
              </p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}