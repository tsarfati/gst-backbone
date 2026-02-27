import { BarChart3, Clock, DollarSign, FileText, TrendingUp, Users } from "lucide-react";
import ReportCatalogPage, { type ReportCatalogItem } from "@/components/ReportCatalogPage";

export default function ReceivablesReports() {
  const reports: ReportCatalogItem[] = [
    { key: "aging", title: "Aging Report", description: "View outstanding invoices by aging buckets (30/60/90 days)", icon: Clock, to: "/receivables/reports/aging", isBuilt: false },
    { key: "statements", title: "Customer Statement", description: "Generate statements for customers showing their account activity", icon: FileText, to: "/receivables/reports/statements", isBuilt: false },
    { key: "invoice-summary", title: "Invoice Summary", description: "Summary of all invoices by status and customer", icon: BarChart3, to: "/receivables/reports/invoice-summary", isBuilt: false },
    { key: "payment-history", title: "Payment History", description: "Complete payment history by customer or date range", icon: DollarSign, to: "/receivables/reports/payment-history", isBuilt: false },
    { key: "revenue-by-customer", title: "Revenue by Customer", description: "Revenue breakdown by customer over time", icon: TrendingUp, to: "/receivables/reports/revenue-by-customer", isBuilt: false },
    { key: "revenue-by-project", title: "Revenue by Project", description: "Revenue breakdown by project/job", icon: BarChart3, to: "/receivables/reports/revenue-by-project", isBuilt: false },
    { key: "top-customers", title: "Top Customers", description: "Top customers by revenue and payment history", icon: Users, to: "/receivables/reports/top-customers", isBuilt: false },
    { key: "collections", title: "Collections Report", description: "Track overdue invoices and collection status", icon: Clock, to: "/receivables/reports/collections", isBuilt: false },
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
