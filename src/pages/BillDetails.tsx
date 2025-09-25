import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const getStatusVariant = (status: string) => {
  switch (status) {
    case "paid":
      return "success";
    case "pending": 
      return "warning";
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
          vendors (
            id,
            name,
            company_name,
            email,
            phone,
            address
          ),
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
        .single();

      if (error) {
        console.error('Error fetching bill:', error);
        setBill(null);
      } else {
        setBill(data);
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
          {bill?.file_url && (
            <Button variant="outline" onClick={() => window.open(bill.file_url, '_blank')}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Bill Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Vendor Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Vendor Name</p>
              <p className="font-medium">{bill?.vendors?.name}</p>
            </div>
            {bill?.vendors?.company_name && (
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium">{bill.vendors.company_name}</p>
              </div>
            )}
            {bill?.vendors?.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{bill.vendors.email}</p>
              </div>
            )}
            {bill?.vendors?.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{bill.vendors.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bill Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="font-medium text-2xl">${bill?.amount?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={getStatusVariant(bill?.status)}>
                {bill?.status}
              </Badge>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Project Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>
      </div>

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
      <Card>
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
    </div>
  );
}