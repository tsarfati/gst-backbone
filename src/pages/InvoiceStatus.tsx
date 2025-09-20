import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Clock, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  Eye,
  TrendingUp,
  DollarSign
} from "lucide-react";

// Extended mock data with more detailed statuses
const invoiceStatuses = {
  waitingApproval: [
    { id: "INV-006", vendor: "New Contractor LLC", amount: "$4,200.00", submittedDate: "2024-01-28" },
    { id: "INV-007", vendor: "Supply Depot", amount: "$1,850.00", submittedDate: "2024-01-29" },
    { id: "INV-008", vendor: "Professional Services", amount: "$2,900.00", submittedDate: "2024-01-30" },
  ],
  waitingToBePaid: [
    { id: "INV-002", vendor: "Elite Electrical", amount: "$5,200.00", approvedDate: "2024-01-22" },
    { id: "INV-005", vendor: "ABC Materials", amount: "$3,750.00", approvedDate: "2024-01-25" },
    { id: "INV-009", vendor: "Equipment Rental", amount: "$1,200.00", approvedDate: "2024-01-26" },
    { id: "INV-010", vendor: "Safety Supplies", amount: "$650.00", approvedDate: "2024-01-27" },
  ],
  overdue: [
    { id: "INV-003", vendor: "Home Depot", amount: "$890.50", dueDate: "2024-02-10" },
  ],
  paid: [
    { id: "INV-001", vendor: "ABC Materials", amount: "$2,450.00", paidDate: "2024-01-20" },
    { id: "INV-004", vendor: "Office Supply Co", amount: "$125.99", paidDate: "2024-01-22" },
  ]
};

const calculateTotal = (invoices: any[]) => {
  return invoices.reduce((sum, inv) => sum + parseFloat(inv.amount.replace(/[$,]/g, '')), 0);
};

export default function InvoiceStatus() {
  const totals = {
    waitingApproval: calculateTotal(invoiceStatuses.waitingApproval),
    waitingToBePaid: calculateTotal(invoiceStatuses.waitingToBePaid),
    overdue: calculateTotal(invoiceStatuses.overdue),
    paid: calculateTotal(invoiceStatuses.paid)
  };

  const statusCards = [
    {
      title: "Waiting for Approval",
      count: invoiceStatuses.waitingApproval.length,
      total: totals.waitingApproval,
      icon: Clock,
      variant: "warning" as const,
      description: "Invoices pending management approval"
    },
    {
      title: "Waiting to be Paid",
      count: invoiceStatuses.waitingToBePaid.length,
      total: totals.waitingToBePaid,
      icon: CreditCard,
      variant: "default" as const,
      description: "Approved invoices ready for payment"
    },
    {
      title: "Overdue",
      count: invoiceStatuses.overdue.length,
      total: totals.overdue,
      icon: AlertTriangle,
      variant: "destructive" as const,
      description: "Invoices past due date"
    },
    {
      title: "Paid",
      count: invoiceStatuses.paid.length,
      total: totals.paid,
      icon: CheckCircle,
      variant: "success" as const,
      description: "Successfully processed invoices"
    }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoice Status Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor invoice workflow and payment status
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            View All
          </Button>
          <Button>
            <TrendingUp className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Status Counter Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statusCards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{card.count}</div>
              <div className="flex items-center justify-between">
                <Badge variant={card.variant}>
                  ${card.total.toLocaleString()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-primary" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-accent rounded-lg">
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-xl font-bold">
                  ${(totals.waitingApproval + totals.waitingToBePaid + totals.overdue).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-accent rounded-lg">
                <p className="text-sm text-muted-foreground">Paid This Month</p>
                <p className="text-xl font-bold text-success">
                  ${totals.paid.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Payment Progress</span>
                <span>
                  {Math.round((totals.paid / (totals.paid + totals.waitingApproval + totals.waitingToBePaid + totals.overdue)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-accent rounded-full h-2">
                <div 
                  className="bg-success h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.round((totals.paid / (totals.paid + totals.waitingApproval + totals.waitingToBePaid + totals.overdue)) * 100)}%`
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-primary" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border border-warning/20">
              <div>
                <p className="font-medium">Approval Needed</p>
                <p className="text-sm text-muted-foreground">
                  {invoiceStatuses.waitingApproval.length} invoices waiting
                </p>
              </div>
              <Button size="sm" variant="warning">
                Review
              </Button>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <div>
                <p className="font-medium">Overdue Payment</p>
                <p className="text-sm text-muted-foreground">
                  {invoiceStatuses.overdue.length} invoice overdue
                </p>
              </div>
              <Button size="sm" variant="destructive">
                Pay Now
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div>
                <p className="font-medium">Ready for Payment</p>
                <p className="text-sm text-muted-foreground">
                  {invoiceStatuses.waitingToBePaid.length} invoices approved
                </p>
              </div>
              <Button size="sm">
                Process
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoice Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: "Invoice approved", invoice: "INV-005", vendor: "ABC Materials", time: "2 hours ago", type: "approved" },
              { action: "Payment processed", invoice: "INV-004", vendor: "Office Supply Co", time: "1 day ago", type: "paid" },
              { action: "Invoice submitted", invoice: "INV-008", vendor: "Professional Services", time: "1 day ago", type: "submitted" },
              { action: "Payment overdue", invoice: "INV-003", vendor: "Home Depot", time: "2 days ago", type: "overdue" },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'paid' ? 'bg-success' :
                    activity.type === 'approved' ? 'bg-primary' :
                    activity.type === 'overdue' ? 'bg-destructive' : 'bg-warning'
                  }`} />
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.invoice} • {activity.vendor}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}