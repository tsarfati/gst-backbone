import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CreditCard, Download, Search, Calendar, DollarSign, FileText } from "lucide-react";

const mockPaymentHistory = [
  {
    id: "PAY-001",
    invoiceId: "INV-001",
    vendor: "ABC Materials",
    amount: "$2,450.00",
    paymentDate: "2024-01-20",
    paymentMethod: "ACH Transfer",
    reference: "TXN123456789",
    status: "completed",
    job: "Office Renovation"
  },
  {
    id: "PAY-002",
    invoiceId: "INV-004",
    vendor: "Office Supply Co",
    amount: "$125.99",
    paymentDate: "2024-01-22",
    paymentMethod: "Check",
    reference: "CHK001234",
    status: "completed",
    job: "Office Renovation"
  },
  {
    id: "PAY-003",
    invoiceId: "INV-011",
    vendor: "Elite Electrical",
    amount: "$1,200.00",
    paymentDate: "2024-01-15",
    paymentMethod: "Wire Transfer",
    reference: "WIRE987654",
    status: "completed",
    job: "Warehouse Project"
  },
  {
    id: "PAY-004",
    invoiceId: "INV-012",
    vendor: "Home Depot",
    amount: "$567.89",
    paymentDate: "2024-01-18",
    paymentMethod: "Credit Card",
    reference: "CC445566",
    status: "completed",
    job: "Retail Buildout"
  },
  {
    id: "PAY-005",
    invoiceId: "INV-005",
    vendor: "ABC Materials",
    amount: "$3,750.00",
    paymentDate: "2024-01-25",
    paymentMethod: "ACH Transfer",
    reference: "TXN987654321",
    status: "processing",
    job: "Warehouse Project"
  }
];

const getStatusVariant = (status: string) => {
  switch (status) {
    case "completed":
      return "success";
    case "processing":
      return "warning";
    case "failed":
      return "destructive";
    default:
      return "default";
  }
};

const getMethodIcon = (method: string) => {
  switch (method) {
    case "ACH Transfer":
      return "🏦";
    case "Wire Transfer":
      return "💱";
    case "Check":
      return "📄";
    case "Credit Card":
      return "💳";
    default:
      return "💰";
  }
};

export default function PaymentHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");

  const filteredPayments = mockPaymentHistory.filter(payment => {
    const matchesSearch = payment.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.invoiceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || payment.status === filterStatus;
    const matchesMethod = filterMethod === "all" || payment.paymentMethod === filterMethod;
    
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const totalPayments = mockPaymentHistory
    .filter(p => p.status === "completed")
    .reduce((sum, payment) => sum + parseFloat(payment.amount.replace(/[$,]/g, '')), 0);

  const processingPayments = mockPaymentHistory
    .filter(p => p.status === "processing")
    .reduce((sum, payment) => sum + parseFloat(payment.amount.replace(/[$,]/g, '')), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
          <p className="text-muted-foreground">
            Track all payment transactions and history
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPayments.toLocaleString()}</div>
            <Badge variant="success" className="mt-2">
              {mockPaymentHistory.filter(p => p.status === "completed").length} completed
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${processingPayments.toLocaleString()}</div>
            <Badge variant="warning" className="mt-2">
              {mockPaymentHistory.filter(p => p.status === "processing").length} pending
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPayments.toLocaleString()}</div>
            <Badge variant="default" className="mt-2">
              {mockPaymentHistory.length} transactions
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="ACH Transfer">ACH Transfer</SelectItem>
                <SelectItem value="Wire Transfer">Wire Transfer</SelectItem>
                <SelectItem value="Check">Check</SelectItem>
                <SelectItem value="Credit Card">Credit Card</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => {
              setSearchTerm("");
              setFilterStatus("all");
              setFilterMethod("all");
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => (
                <TableRow key={payment.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{payment.id}</TableCell>
                  <TableCell>
                    <Button variant="link" className="h-auto p-0 font-medium">
                      {payment.invoiceId}
                    </Button>
                  </TableCell>
                  <TableCell>{payment.vendor}</TableCell>
                  <TableCell>{payment.job}</TableCell>
                  <TableCell className="font-semibold">{payment.amount}</TableCell>
                  <TableCell>{payment.paymentDate}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{getMethodIcon(payment.paymentMethod)}</span>
                      {payment.paymentMethod}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{payment.reference}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(payment.status)}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}