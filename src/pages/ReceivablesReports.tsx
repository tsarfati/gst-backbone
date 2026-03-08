import { BarChart3, Clock, DollarSign, FileText, TrendingUp, Users } from "lucide-react";
import ReportCatalogPage, { type ReportCatalogItem } from "@/components/ReportCatalogPage";

export default function ReceivablesReports() {
  const reports: ReportCatalogItem[] = [
    { key: "aging", title: "Aging Report", description: "Open AR invoices and filter by overdue aging buckets", icon: Clock, to: "/receivables/invoices", isBuilt: true, requiredPermissions: ["receivables-reports-view"] },
    { key: "statements", title: "Customer Statement", description: "Open customers and statements workflow", icon: FileText, to: "/receivables/customers", isBuilt: true, requiredPermissions: ["receivables-reports-view"] },
    { key: "invoice-summary", title: "Invoice Summary", description: "Open invoice summary and status tracking", icon: BarChart3, to: "/receivables/invoices", isBuilt: true, requiredPermissions: ["receivables-reports-view"] },
    { key: "payment-history", title: "Payment History", description: "Open receivables payment history", icon: DollarSign, to: "/receivables/payments", isBuilt: true, requiredPermissions: ["receivables-reports-view"] },
    { key: "revenue-by-customer", title: "Revenue by Customer", description: "Open receivables dashboard customer revenue metrics", icon: TrendingUp, to: "/receivables/dashboard", isBuilt: true, requiredPermissions: ["receivables-reports-view"] },
    { key: "revenue-by-project", title: "Revenue by Project", description: "Open receivables dashboard project revenue view", icon: BarChart3, to: "/receivables/dashboard", isBuilt: true, requiredPermissions: ["receivables-reports-view"] },
    { key: "top-customers", title: "Top Customers", description: "Open customer list with top-customer indicators", icon: Users, to: "/receivables/customers", isBuilt: true, requiredPermissions: ["receivables-reports-view"] },
    { key: "collections", title: "Collections Report", description: "Open overdue invoices for collections follow-up", icon: Clock, to: "/receivables/invoices", isBuilt: true, requiredPermissions: ["receivables-reports-view"] },
  ];

  return (
    <ReportCatalogPage
      title="Receivables Reports"
      description="Access detailed reports and analytics for accounts receivable"
      reports={reports}
      favoriteScope="receivables"
      viewPreferenceKey="receivables-reports-view"
      containerClassName="p-6 max-w-7xl mx-auto space-y-6"
    />
  );
}
