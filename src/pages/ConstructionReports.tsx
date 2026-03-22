import {
  BarChart3,
  Clock,
  DollarSign,
  FileBarChart,
  FileText,
  Package,
  TrendingUp,
  Users,
} from "lucide-react";
import ReportCatalogPage, { type ReportCatalogItem } from "@/components/ReportCatalogPage";

export default function ConstructionReports() {
  const reports: ReportCatalogItem[] = [
    { key: "project-balance", title: "Project Balance", description: "View current balance and financial status of all projects", icon: DollarSign, to: "/construction/reports/project-balance", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "profitability", title: "Project Profitability", description: "Analyze profit margins and profitability by project", icon: TrendingUp, to: "/construction/reports/profitability", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "projects", title: "Projects", description: "Comprehensive list and overview of all projects", icon: BarChart3, to: "/jobs", isBuilt: true, requiredPermissions: ["construction-reports-view"] },
    { key: "progress", title: "Project Progress Report", description: "Track completion status and milestones", icon: Clock, to: "/construction/reports/progress", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "project-tasks", title: "Tasks", description: "View all tasks across projects", icon: FileText, to: "/tasks", isBuilt: true, requiredPermissions: ["construction-reports-view"] },
    { key: "employee-hours", title: "Employee Hours", description: "Employee time tracking and hours report", icon: Users, to: "/timecards/reports", isBuilt: true, requiredPermissions: ["construction-reports-view"] },
    { key: "billing", title: "Project Billing", description: "Billing status and invoices by project", icon: FileBarChart, to: "/construction/reports/billing", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "transactions", title: "Project Transactions", description: "All financial transactions by project", icon: DollarSign, to: "/construction/reports/transactions", isBuilt: true, requiredPermissions: ["construction-reports-view"] },
    { key: "cost-history", title: "Project Cost Transaction History", description: "Detailed cost transaction history", icon: FileText, to: "/construction/reports/cost-history", isBuilt: true, requiredPermissions: ["construction-reports-view"] },
    { key: "subcontract-summary", title: "Subcontract Summary", description: "Overview of all subcontract agreements", icon: Users, to: "/construction/reports/subcontract-summary", isBuilt: true, requiredPermissions: ["construction-reports-view"] },
    { key: "subcontract-details", title: "Subcontract Details by Vendor", description: "Subcontract information organized by vendor", icon: Package, to: "/construction/reports/subcontract-details", isBuilt: true, requiredPermissions: ["construction-reports-view"] },
    { key: "profit-analysis", title: "Project Profit Analysis", description: "Detailed profit and loss analysis", icon: TrendingUp, to: "/construction/reports/profit-analysis", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "performance", title: "Project Performance", description: "Performance metrics and KPIs", icon: BarChart3, to: "/construction/reports/performance", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "budget-status", title: "Project Cost Budget Status", description: "Budget vs actual costs comparison", icon: DollarSign, to: "/construction/reports/budget-status", isBuilt: true, requiredPermissions: ["construction-reports-view"] },
    { key: "subcontract-audit", title: "Subcontract Audit", description: "Audit trail for subcontract changes", icon: FileText, to: "/construction/reports/subcontract-audit", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "proforma", title: "Pro Forma Invoice with Quantity", description: "Generate pro forma invoices with quantities", icon: FileBarChart, to: "/construction/reports/proforma", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "ar-open", title: "AR Open Documents by Customer", description: "Accounts receivable open documents", icon: FileText, to: "/construction/reports/ar-open", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "ar-paid", title: "AR Docs by Project With Paid Amt", description: "AR documents with payment information", icon: DollarSign, to: "/construction/reports/ar-paid", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "ap-open", title: "AP Open Documents by Vendor", description: "Accounts payable open documents", icon: FileText, to: "/construction/reports/ap-open", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "ap-paid", title: "AP Docs by Project With Paid Amt", description: "AP documents with payment information", icon: DollarSign, to: "/construction/reports/ap-paid", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "wip", title: "Project WIP", description: "Work in progress report", icon: Clock, to: "/construction/reports/wip", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "wip-detail", title: "Project WIP Detail", description: "Detailed work in progress breakdown", icon: FileText, to: "/construction/reports/wip-detail", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "subcontract-payment", title: "Subcontract Payment", description: "Subcontractor payment status", icon: DollarSign, to: "/construction/reports/subcontract-payment", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "substantiated-billing", title: "Substantiated Billing", description: "Detailed billing substantiation", icon: FileBarChart, to: "/construction/reports/substantiated-billing", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "bonding", title: "Construction Bonding Report", description: "Bonding requirements and status", icon: FileText, to: "/construction/reports/bonding", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "substantiated-consolidated", title: "Substantiated Billing - Consolidated", description: "Consolidated substantiated billing report", icon: FileBarChart, to: "/construction/reports/substantiated-consolidated", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
    { key: "pl-by-month", title: "Project Profit & Loss by Month", description: "Monthly P&L analysis by project", icon: TrendingUp, to: "/construction/reports/pl-by-month", isBuilt: false, requiredPermissions: ["construction-reports-view"] },
  ];

  return (
    <ReportCatalogPage
      title="Construction Reports"
      reports={reports}
      favoriteScope="construction"
      viewPreferenceKey="construction-reports-view"
      containerClassName="p-4 md:p-6 space-y-6"
    />
  );
}
