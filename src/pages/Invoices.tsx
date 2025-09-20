import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, DollarSign, Calendar, Building } from "lucide-react";

const mockInvoices = [
  {
    id: "INV-001",
    vendor: "ABC Materials",
    amount: "$2,450.00",
    dueDate: "2024-02-15",
    issueDate: "2024-01-15",
    status: "paid",
    job: "Office Renovation"
  },
  {
    id: "INV-002",
    vendor: "Elite Electrical",
    amount: "$5,200.00",
    dueDate: "2024-02-20",
    issueDate: "2024-01-20",
    status: "pending",
    job: "Warehouse Project"
  },
  {
    id: "INV-003",
    vendor: "Home Depot",
    amount: "$890.50",
    dueDate: "2024-02-10",
    issueDate: "2024-01-10",
    status: "overdue",
    job: "Retail Buildout"
  },
  {
    id: "INV-004",
    vendor: "Office Supply Co",
    amount: "$125.99",
    dueDate: "2024-02-25",
    issueDate: "2024-01-25",
    status: "paid",
    job: "Office Renovation"
  },
  {
    id: "INV-005",
    vendor: "ABC Materials",
    amount: "$3,750.00",
    dueDate: "2024-03-01",
    issueDate: "2024-02-01",
    status: "pending",
    job: "Warehouse Project"
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

export default function Invoices() {
  const totalPending = mockInvoices
    .filter(inv => inv.status === "pending")
    .reduce((sum, inv) => sum + parseFloat(inv.amount.replace(/[$,]/g, '')), 0);

  const totalOverdue = mockInvoices
    .filter(inv => inv.status === "overdue")
    .reduce((sum, inv) => sum + parseFloat(inv.amount.replace(/[$,]/g, '')), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">
            Track invoice payments and manage vendor billing
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Invoices
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPending.toLocaleString()}</div>
            <Badge variant="warning" className="mt-2">
              {mockInvoices.filter(inv => inv.status === "pending").length} invoices
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overdue Invoices
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalOverdue.toLocaleString()}</div>
            <Badge variant="destructive" className="mt-2">
              {mockInvoices.filter(inv => inv.status === "overdue").length} invoices
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Paid This Month
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2,576</div>
            <Badge variant="success" className="mt-2">
              2 invoices
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                      {invoice.vendor}
                    </div>
                  </TableCell>
                  <TableCell>{invoice.job}</TableCell>
                  <TableCell className="font-semibold">{invoice.amount}</TableCell>
                  <TableCell>{invoice.issueDate}</TableCell>
                  <TableCell>{invoice.dueDate}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                      {invoice.status !== "paid" && (
                        <Button variant="default" size="sm">
                          Mark Paid
                        </Button>
                      )}
                    </div>
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