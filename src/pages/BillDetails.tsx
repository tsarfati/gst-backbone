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
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import VendorAvatar from "@/components/VendorAvatar";
import BillApprovalActions from "@/components/BillApprovalActions";
import BillCommunications from "@/components/BillCommunications";
import BillAuditTrail from "@/components/BillAuditTrail";
import BillReceiptSuggestions from "@/components/BillReceiptSuggestions";

const getStatusVariant = (status: string) => {
  switch (status) {
    case "paid":
      return "success";
    case "pending_approval": 
      return "warning";
    case "pending_payment":
      return "default";
    case "overdue":
      return "destructive";
    default:
      return "default";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "paid":
      return CheckCircle;
    case "pending":
      return Clock;
    case "overdue":
      return AlertTriangle;
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
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching bill:', error);
        setBill(null);
      } else {
        setBill(data || null);
        
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
          <Button variant="ghost" onClick={() => navigate("/bills")}>
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
            <Button onClick={() => navigate("/bills")}>
              Return to Bills
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(bill?.status || "pending");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/bills")}>
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
          <Button onClick={() => navigate(`/bills/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Bill
          </Button>
          
          {bill?.status === 'pending_approval' && (
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
          )}

          {bill?.file_url && (
            <Button variant="outline" onClick={() => window.open(bill.file_url, '_blank')}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Bill Information */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-6">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Bill Information
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium text-2xl">${bill?.amount?.toLocaleString()}</p>
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
                  <p className="text-sm text-muted-foreground">Job</p>
                  <p className="font-medium">{bill?.jobs?.name || 'N/A'}</p>
                </div>
                {bill?.cost_codes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Cost Code</p>
                    <p className="font-medium">
                      {bill.cost_codes.code} - {bill.cost_codes.description}
                    </p>
                  </div>
                )}
                {bill?.payment_terms && (
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Terms</p>
                    <p className="font-medium">{bill.payment_terms} days</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Approval Actions */}
            <div>
              <BillApprovalActions
                billId={bill?.id || ''}
                currentStatus={bill?.status || 'pending_approval'}
                onStatusUpdate={fetchBillDetails}
              />
            </div>
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

      {/* Description */}
      {bill?.description && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{bill.description}</p>
          </CardContent>
        </Card>
      )}

      {/* File Preview Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bill Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bill?.file_url ? (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">Bill Document</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(bill.file_url, '_blank')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Full Document
                </Button>
              </div>
              <iframe 
                src={bill.file_url} 
                className="w-full h-96 border rounded"
                title="Bill Document"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Document Available</h3>
              <p className="text-muted-foreground">
                No bill document has been uploaded for this bill
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Trail Section */}
      <div className="mt-6">
        <BillAuditTrail billId={bill?.id || ''} />
      </div>
    </div>
  );
}