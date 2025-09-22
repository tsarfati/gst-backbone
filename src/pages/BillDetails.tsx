import { useParams, useNavigate } from "react-router-dom";
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
  AlertTriangle
} from "lucide-react";

const mockBills: any[] = [];

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

  const bill = mockBills.find(bill => bill.id === id);

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

  const StatusIcon = getStatusIcon("pending");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bill Details</h1>
            <p className="text-muted-foreground">View bill information and file</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={() => navigate('/banking/make-payment')}>
            <DollarSign className="h-4 w-4 mr-2" />
            Create Payment
          </Button>
        </div>
      </div>

      {/* No Invoice Content */}
      <Card className="mb-6">
        <CardContent className="p-8 text-center">
          <StatusIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-2xl font-bold mb-2">No Bill Data Available</h2>
          <p className="text-muted-foreground mb-6">
            Bill data will appear here once you upload and create bills through the system.
          </p>
          <Button onClick={() => navigate("/invoices/add")}>
            <FileText className="h-4 w-4 mr-2" />
            Add First Bill
          </Button>
        </CardContent>
      </Card>

      {/* File Preview Section - This will show the uploaded invoice file */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bill Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Document Available</h3>
            <p className="text-muted-foreground">
              The bill document will be displayed here once uploaded
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}