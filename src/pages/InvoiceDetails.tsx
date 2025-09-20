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

const mockInvoices = [
  {
    id: "INV-001",
    vendor: "ABC Materials",
    vendorAddress: "123 Industrial Way, City, ST 12345",
    vendorPhone: "(555) 123-4567",
    vendorEmail: "billing@abcmaterials.com",
    amount: "$2,450.00",
    subtotal: "$2,200.00",
    tax: "$250.00",
    dueDate: "2024-02-15",
    issueDate: "2024-01-15",
    status: "paid",
    job: "Office Renovation",
    jobCode: "JOB-2024-001",
    description: "Construction materials for office renovation project",
    items: [
      { description: "Drywall sheets (50 units)", quantity: 50, unitPrice: 25.00, total: 1250.00 },
      { description: "Insulation materials", quantity: 10, unitPrice: 45.00, total: 450.00 },
      { description: "Paint supplies", quantity: 1, unitPrice: 500.00, total: 500.00 }
    ],
    paymentHistory: [
      { date: "2024-01-20", amount: "$2,450.00", method: "ACH Transfer", reference: "TXN123456789" }
    ],
    notes: "Payment received on time. Quality materials delivered as specified."
  },
  {
    id: "INV-002",
    vendor: "Elite Electrical",
    vendorAddress: "789 Service St, City, ST 12345",
    vendorPhone: "(555) 456-7890",
    vendorEmail: "invoices@eliteelectrical.com",
    amount: "$5,200.00",
    subtotal: "$4,800.00",
    tax: "$400.00",
    dueDate: "2024-02-20",
    issueDate: "2024-01-20",
    status: "pending",
    job: "Warehouse Project",
    jobCode: "JOB-2024-002",
    description: "Electrical work for warehouse renovation",
    items: [
      { description: "Electrical wiring installation", quantity: 1, unitPrice: 3000.00, total: 3000.00 },
      { description: "Circuit breaker panel", quantity: 2, unitPrice: 600.00, total: 1200.00 },
      { description: "Electrical outlets and switches", quantity: 25, unitPrice: 24.00, total: 600.00 }
    ],
    paymentHistory: [],
    notes: "Approved for payment. Processing scheduled for next business day."
  },
  {
    id: "INV-003",
    vendor: "Home Depot",
    vendorAddress: "456 Retail Blvd, City, ST 12345", 
    vendorPhone: "(555) 987-6543",
    vendorEmail: "support@homedepot.com",
    amount: "$890.50",
    subtotal: "$820.00",
    tax: "$70.50",
    dueDate: "2024-02-10",
    issueDate: "2024-01-10",
    status: "overdue",
    job: "Retail Buildout",
    jobCode: "JOB-2024-003",
    description: "Hardware and tools for retail space buildout",
    items: [
      { description: "Power tools rental", quantity: 3, unitPrice: 150.00, total: 450.00 },
      { description: "Hardware supplies", quantity: 1, unitPrice: 270.00, total: 270.00 },
      { description: "Safety equipment", quantity: 5, unitPrice: 20.00, total: 100.00 }
    ],
    paymentHistory: [],
    notes: "OVERDUE: Payment required immediately. Late fees may apply."
  }
];

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

export default function InvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const invoice = mockInvoices.find(inv => inv.id === id);

  if (!invoice) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Invoice Not Found</h1>
          <Button onClick={() => navigate("/invoices")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(invoice.status);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Invoice {invoice.id}</h1>
            <p className="text-muted-foreground">View and manage invoice details</p>
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
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <Card className={`mb-6 ${invoice.status === 'overdue' ? 'border-destructive bg-destructive/5' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon className={`h-6 w-6 ${
                invoice.status === 'paid' ? 'text-success' :
                invoice.status === 'overdue' ? 'text-destructive' : 'text-warning'
              }`} />
              <div>
                <p className="font-semibold">Invoice Status: {invoice.status.toUpperCase()}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.status === 'paid' ? `Paid on ${invoice.paymentHistory[0]?.date}` :
                   invoice.status === 'overdue' ? `Overdue since ${invoice.dueDate}` :
                   `Due on ${invoice.dueDate}`}
                </p>
              </div>
            </div>
            <Badge variant={getStatusVariant(invoice.status)} className="text-sm">
              {invoice.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice ID</p>
                  <p className="font-semibold">{invoice.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Job Reference</p>
                  <p className="font-semibold">{invoice.jobCode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Issue Date</p>
                  <p className="font-semibold">{invoice.issueDate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-semibold">{invoice.dueDate}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{invoice.description}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Project</p>
                <p className="font-medium">{invoice.job}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invoice.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × ${item.unitPrice.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-semibold">${item.total.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">{invoice.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-medium">{invoice.tax}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold">{invoice.amount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {invoice.paymentHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoice.paymentHistory.map((payment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{payment.amount}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.method} • {payment.reference}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{payment.date}</p>
                        <Badge variant="success">Completed</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{invoice.vendor}</span>
              </div>
              <div className="text-sm space-y-1">
                <p>{invoice.vendorAddress}</p>
                <p>{invoice.vendorPhone}</p>
                <p>{invoice.vendorEmail}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Amount Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{invoice.amount}</p>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{invoice.dueDate}</p>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {invoice.status !== "paid" && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Mark as Paid
                </Button>
                <Button variant="outline" className="w-full">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Invoice
                </Button>
                <Button variant="outline" className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Send Reminder
                </Button>
              </CardContent>
            </Card>
          )}

          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}