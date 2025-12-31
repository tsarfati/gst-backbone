import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { FileText, TrendingUp, DollarSign, Users, BarChart3, Clock } from "lucide-react";

interface Report {
  title: string;
  description: string;
  icon: any;
  route: string;
}

export default function ReceivablesReports() {
  const navigate = useNavigate();

  const reports: Report[] = [
    {
      title: "Aging Report",
      description: "View outstanding invoices by aging buckets (30/60/90 days)",
      icon: Clock,
      route: "/receivables/reports/aging",
    },
    {
      title: "Customer Statement",
      description: "Generate statements for customers showing their account activity",
      icon: FileText,
      route: "/receivables/reports/statements",
    },
    {
      title: "Invoice Summary",
      description: "Summary of all invoices by status and customer",
      icon: BarChart3,
      route: "/receivables/reports/invoice-summary",
    },
    {
      title: "Payment History",
      description: "Complete payment history by customer or date range",
      icon: DollarSign,
      route: "/receivables/reports/payment-history",
    },
    {
      title: "Revenue by Customer",
      description: "Revenue breakdown by customer over time",
      icon: TrendingUp,
      route: "/receivables/reports/revenue-by-customer",
    },
    {
      title: "Revenue by Project",
      description: "Revenue breakdown by project/job",
      icon: BarChart3,
      route: "/receivables/reports/revenue-by-project",
    },
    {
      title: "Top Customers",
      description: "Top customers by revenue and payment history",
      icon: Users,
      route: "/receivables/reports/top-customers",
    },
    {
      title: "Collections Report",
      description: "Track overdue invoices and collection status",
      icon: Clock,
      route: "/receivables/reports/collections",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Receivables Reports</h1>
        <p className="text-muted-foreground mt-1">
          Access detailed reports and analytics for accounts receivable
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <Card 
            key={report.title}
            className="cursor-pointer hover:border-primary/50 transition-colors group"
            onClick={() => navigate(report.route)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <report.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base group-hover:text-primary transition-colors">
                  {report.title}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{report.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
