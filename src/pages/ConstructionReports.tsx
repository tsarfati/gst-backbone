import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, TrendingUp, DollarSign, Users, Package, Clock, BarChart3, FileBarChart, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useReportFavorites } from "@/hooks/useReportFavorites";
import { ReportFavoriteButton } from "@/components/ReportFavoriteButton";
import { cn } from "@/lib/utils";

interface Report {
  title: string;
  description: string;
  icon: any;
  route: string;
  key: string;
}

export default function ConstructionReports() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  const { isFavorite, toggleFavorite, favoritesCount } = useReportFavorites("construction");

  const reports: Report[] = [
    {
      key: "project-balance",
      title: "Project Balance",
      description: "View current balance and financial status of all projects",
      icon: DollarSign,
      route: "/construction/reports/project-balance",
    },
    {
      key: "profitability",
      title: "Project Profitability",
      description: "Analyze profit margins and profitability by project",
      icon: TrendingUp,
      route: "/construction/reports/profitability",
    },
    {
      key: "projects",
      title: "Projects",
      description: "Comprehensive list and overview of all projects",
      icon: BarChart3,
      route: "/jobs",
    },
    {
      key: "progress",
      title: "Project Progress Report",
      description: "Track completion status and milestones",
      icon: Clock,
      route: "/construction/reports/progress",
    },
    {
      key: "project-tasks",
      title: "Project Tasks",
      description: "View all tasks across projects",
      icon: FileText,
      route: "/tasks/projects",
    },
    {
      key: "employee-hours",
      title: "Employee Hours",
      description: "Employee time tracking and hours report",
      icon: Users,
      route: "/timecards/reports",
    },
    {
      key: "billing",
      title: "Project Billing",
      description: "Billing status and invoices by project",
      icon: FileBarChart,
      route: "/construction/reports/billing",
    },
    {
      key: "transactions",
      title: "Project Transactions",
      description: "All financial transactions by project",
      icon: DollarSign,
      route: "/construction/reports/transactions",
    },
    {
      key: "cost-history",
      title: "Project Cost Transaction History",
      description: "Detailed cost transaction history",
      icon: FileText,
      route: "/construction/reports/cost-history",
    },
    {
      key: "subcontract-summary",
      title: "Subcontract Summary",
      description: "Overview of all subcontract agreements",
      icon: Users,
      route: "/construction/reports/subcontract-summary",
    },
    {
      key: "subcontract-details",
      title: "Subcontract Details by Vendor",
      description: "Subcontract information organized by vendor",
      icon: Package,
      route: "/construction/reports/subcontract-details",
    },
    {
      key: "profit-analysis",
      title: "Project Profit Analysis",
      description: "Detailed profit and loss analysis",
      icon: TrendingUp,
      route: "/construction/reports/profit-analysis",
    },
    {
      key: "performance",
      title: "Project Performance",
      description: "Performance metrics and KPIs",
      icon: BarChart3,
      route: "/construction/reports/performance",
    },
    {
      key: "budget-status",
      title: "Project Cost Budget Status",
      description: "Budget vs actual costs comparison",
      icon: DollarSign,
      route: "/construction/reports/budget-status",
    },
    {
      key: "subcontract-audit",
      title: "Subcontract Audit",
      description: "Audit trail for subcontract changes",
      icon: FileText,
      route: "/construction/reports/subcontract-audit",
    },
    {
      key: "proforma",
      title: "Pro Forma Invoice with Quantity",
      description: "Generate pro forma invoices with quantities",
      icon: FileBarChart,
      route: "/construction/reports/proforma",
    },
    {
      key: "ar-open",
      title: "AR Open Documents by Customer",
      description: "Accounts receivable open documents",
      icon: FileText,
      route: "/construction/reports/ar-open",
    },
    {
      key: "ar-paid",
      title: "AR Docs by Project With Paid Amt",
      description: "AR documents with payment information",
      icon: DollarSign,
      route: "/construction/reports/ar-paid",
    },
    {
      key: "ap-open",
      title: "AP Open Documents by Vendor",
      description: "Accounts payable open documents",
      icon: FileText,
      route: "/construction/reports/ap-open",
    },
    {
      key: "ap-paid",
      title: "AP Docs by Project With Paid Amt",
      description: "AP documents with payment information",
      icon: DollarSign,
      route: "/construction/reports/ap-paid",
    },
    {
      key: "wip",
      title: "Project WIP",
      description: "Work in progress report",
      icon: Clock,
      route: "/construction/reports/wip",
    },
    {
      key: "wip-detail",
      title: "Project WIP Detail",
      description: "Detailed work in progress breakdown",
      icon: FileText,
      route: "/construction/reports/wip-detail",
    },
    {
      key: "subcontract-payment",
      title: "Subcontract Payment",
      description: "Subcontractor payment status",
      icon: DollarSign,
      route: "/construction/reports/subcontract-payment",
    },
    {
      key: "substantiated-billing",
      title: "Substantiated Billing",
      description: "Detailed billing substantiation",
      icon: FileBarChart,
      route: "/construction/reports/substantiated-billing",
    },
    {
      key: "bonding",
      title: "Construction Bonding Report",
      description: "Bonding requirements and status",
      icon: FileText,
      route: "/construction/reports/bonding",
    },
    {
      key: "substantiated-consolidated",
      title: "Substantiated Billing - Consolidated",
      description: "Consolidated substantiated billing report",
      icon: FileBarChart,
      route: "/construction/reports/substantiated-consolidated",
    },
    {
      key: "pl-by-month",
      title: "Project Profit & Loss by Month",
      description: "Monthly P&L analysis by project",
      icon: TrendingUp,
      route: "/construction/reports/pl-by-month",
    },
  ];

  // Filter reports based on search and favorites
  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      searchTerm === "" ||
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFavorites = !showFavoritesOnly || isFavorite(report.key);
    
    return matchesSearch && matchesFavorites;
  });

  // Sort favorites first
  const sortedReports = [...filteredReports].sort((a, b) => {
    const aFav = isFavorite(a.key);
    const bFav = isFavorite(b.key);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Construction Reports</h1>
        <p className="text-muted-foreground mt-1">Access detailed reports and analytics for your construction projects</p>
      </div>

      {/* Search and filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Favorites {favoritesCount > 0 && `(${favoritesCount})`}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedReports.map((report) => (
          <Card 
            key={report.key}
            className={cn(
              "cursor-pointer hover:border-primary/50 transition-colors group relative",
              isFavorite(report.key) && "border-yellow-500/30"
            )}
            onClick={() => navigate(report.route)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <report.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base group-hover:text-primary transition-colors flex-1">
                  {report.title}
                </CardTitle>
                <ReportFavoriteButton
                  isFavorite={isFavorite(report.key)}
                  onToggle={() => toggleFavorite(report.key)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{report.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {sortedReports.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No reports found</h3>
          <p className="text-muted-foreground">
            {showFavoritesOnly
              ? "You haven't favorited any reports yet. Click the star icon on a report to add it to your favorites."
              : "Try adjusting your search term."}
          </p>
        </div>
      )}
    </div>
  );
}
