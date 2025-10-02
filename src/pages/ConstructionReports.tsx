import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, DollarSign, Users, Package, Clock, BarChart3, FileBarChart } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Report {
  title: string;
  description: string;
  icon: any;
  route: string;
}

export default function ConstructionReports() {
  const navigate = useNavigate();

  const reports: Report[] = [
    {
      title: "Project Balance",
      description: "View current balance and financial status of all projects",
      icon: DollarSign,
      route: "/construction/reports/project-balance",
    },
    {
      title: "Project Profitability",
      description: "Analyze profit margins and profitability by project",
      icon: TrendingUp,
      route: "/construction/reports/profitability",
    },
    {
      title: "Projects",
      description: "Comprehensive list and overview of all projects",
      icon: BarChart3,
      route: "/jobs",
    },
    {
      title: "Project Progress Report",
      description: "Track completion status and milestones",
      icon: Clock,
      route: "/construction/reports/progress",
    },
    {
      title: "Project Tasks",
      description: "View all tasks across projects",
      icon: FileText,
      route: "/tasks/projects",
    },
    {
      title: "Employee Hours",
      description: "Employee time tracking and hours report",
      icon: Users,
      route: "/timecards/reports",
    },
    {
      title: "Project Billing",
      description: "Billing status and invoices by project",
      icon: FileBarChart,
      route: "/construction/reports/billing",
    },
    {
      title: "Project Transactions",
      description: "All financial transactions by project",
      icon: DollarSign,
      route: "/construction/reports/transactions",
    },
    {
      title: "Project Cost Transaction History",
      description: "Detailed cost transaction history",
      icon: FileText,
      route: "/construction/reports/cost-history",
    },
    {
      title: "Subcontract Summary",
      description: "Overview of all subcontract agreements",
      icon: Users,
      route: "/construction/reports/subcontract-summary",
    },
    {
      title: "Subcontract Details by Vendor",
      description: "Subcontract information organized by vendor",
      icon: Package,
      route: "/construction/reports/subcontract-details",
    },
    {
      title: "Project Profit Analysis",
      description: "Detailed profit and loss analysis",
      icon: TrendingUp,
      route: "/construction/reports/profit-analysis",
    },
    {
      title: "Project Performance",
      description: "Performance metrics and KPIs",
      icon: BarChart3,
      route: "/construction/reports/performance",
    },
    {
      title: "Project Cost Budget Status",
      description: "Budget vs actual costs comparison",
      icon: DollarSign,
      route: "/construction/reports/budget-status",
    },
    {
      title: "Subcontract Audit",
      description: "Audit trail for subcontract changes",
      icon: FileText,
      route: "/construction/reports/subcontract-audit",
    },
    {
      title: "Pro Forma Invoice with Quantity",
      description: "Generate pro forma invoices with quantities",
      icon: FileBarChart,
      route: "/construction/reports/proforma",
    },
    {
      title: "AR Open Documents by Customer",
      description: "Accounts receivable open documents",
      icon: FileText,
      route: "/construction/reports/ar-open",
    },
    {
      title: "AR Docs by Project With Paid Amt",
      description: "AR documents with payment information",
      icon: DollarSign,
      route: "/construction/reports/ar-paid",
    },
    {
      title: "AP Open Documents by Vendor",
      description: "Accounts payable open documents",
      icon: FileText,
      route: "/construction/reports/ap-open",
    },
    {
      title: "AP Docs by Project With Paid Amt",
      description: "AP documents with payment information",
      icon: DollarSign,
      route: "/construction/reports/ap-paid",
    },
    {
      title: "Project WIP",
      description: "Work in progress report",
      icon: Clock,
      route: "/construction/reports/wip",
    },
    {
      title: "Project WIP Detail",
      description: "Detailed work in progress breakdown",
      icon: FileText,
      route: "/construction/reports/wip-detail",
    },
    {
      title: "Subcontract Payment",
      description: "Subcontractor payment status",
      icon: DollarSign,
      route: "/construction/reports/subcontract-payment",
    },
    {
      title: "Substantiated Billing",
      description: "Detailed billing substantiation",
      icon: FileBarChart,
      route: "/construction/reports/substantiated-billing",
    },
    {
      title: "Construction Bonding Report",
      description: "Bonding requirements and status",
      icon: FileText,
      route: "/construction/reports/bonding",
    },
    {
      title: "Substantiated Billing - Consolidated",
      description: "Consolidated substantiated billing report",
      icon: FileBarChart,
      route: "/construction/reports/substantiated-consolidated",
    },
    {
      title: "Project Profit & Loss by Month",
      description: "Monthly P&L analysis by project",
      icon: TrendingUp,
      route: "/construction/reports/pl-by-month",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Construction Reports</h1>
        <p className="text-muted-foreground mt-1">Access detailed reports and analytics for your construction projects</p>
      </div>

      <div className="rounded-md border">
        <ul className="divide-y">
          {reports.map((report) => (
            <li key={report.title}>
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-primary/5 transition-colors"
                onClick={() => navigate(report.route)}
                aria-label={`Open ${report.title}`}
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="p-1.5 bg-primary/10 rounded">
                    <report.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{report.title}</p>
                    <p className="text-xs text-muted-foreground">{report.description}</p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
