import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, TrendingUp, DollarSign, Users, Package, Clock, BarChart3, FileBarChart, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useReportFavorites } from "@/hooks/useReportFavorites";
import { ReportFavoriteButton } from "@/components/ReportFavoriteButton";
import { ComingSoonBadge } from "@/components/ComingSoonBadge";
import { cn } from "@/lib/utils";

interface Report {
  title: string;
  description: string;
  icon: any;
  route: string;
  key: string;
  isBuilt?: boolean;
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
      isBuilt: false,
    },
    {
      key: "profitability",
      title: "Project Profitability",
      description: "Analyze profit margins and profitability by project",
      icon: TrendingUp,
      route: "/construction/reports/profitability",
      isBuilt: false,
    },
    {
      key: "projects",
      title: "Projects",
      description: "Comprehensive list and overview of all projects",
      icon: BarChart3,
      route: "/jobs",
      isBuilt: true,
    },
    {
      key: "progress",
      title: "Project Progress Report",
      description: "Track completion status and milestones",
      icon: Clock,
      route: "/construction/reports/progress",
      isBuilt: false,
    },
    {
      key: "project-tasks",
      title: "Project Tasks",
      description: "View all tasks across projects",
      icon: FileText,
      route: "/tasks/projects",
      isBuilt: true,
    },
    {
      key: "employee-hours",
      title: "Employee Hours",
      description: "Employee time tracking and hours report",
      icon: Users,
      route: "/timecards/reports",
      isBuilt: true,
    },
    {
      key: "billing",
      title: "Project Billing",
      description: "Billing status and invoices by project",
      icon: FileBarChart,
      route: "/construction/reports/billing",
      isBuilt: false,
    },
    {
      key: "transactions",
      title: "Project Transactions",
      description: "All financial transactions by project",
      icon: DollarSign,
      route: "/construction/reports/transactions",
      isBuilt: true,
    },
    {
      key: "cost-history",
      title: "Project Cost Transaction History",
      description: "Detailed cost transaction history",
      icon: FileText,
      route: "/construction/reports/cost-history",
      isBuilt: true,
    },
    {
      key: "subcontract-summary",
      title: "Subcontract Summary",
      description: "Overview of all subcontract agreements",
      icon: Users,
      route: "/construction/reports/subcontract-summary",
      isBuilt: true,
    },
    {
      key: "subcontract-details",
      title: "Subcontract Details by Vendor",
      description: "Subcontract information organized by vendor",
      icon: Package,
      route: "/construction/reports/subcontract-details",
      isBuilt: true,
    },
    {
      key: "profit-analysis",
      title: "Project Profit Analysis",
      description: "Detailed profit and loss analysis",
      icon: TrendingUp,
      route: "/construction/reports/profit-analysis",
      isBuilt: false,
    },
    {
      key: "performance",
      title: "Project Performance",
      description: "Performance metrics and KPIs",
      icon: BarChart3,
      route: "/construction/reports/performance",
      isBuilt: false,
    },
    {
      key: "budget-status",
      title: "Project Cost Budget Status",
      description: "Budget vs actual costs comparison",
      icon: DollarSign,
      route: "/construction/reports/budget-status",
      isBuilt: true,
    },
    {
      key: "subcontract-audit",
      title: "Subcontract Audit",
      description: "Audit trail for subcontract changes",
      icon: FileText,
      route: "/construction/reports/subcontract-audit",
      isBuilt: false,
    },
    {
      key: "proforma",
      title: "Pro Forma Invoice with Quantity",
      description: "Generate pro forma invoices with quantities",
      icon: FileBarChart,
      route: "/construction/reports/proforma",
      isBuilt: false,
    },
    {
      key: "ar-open",
      title: "AR Open Documents by Customer",
      description: "Accounts receivable open documents",
      icon: FileText,
      route: "/construction/reports/ar-open",
      isBuilt: false,
    },
    {
      key: "ar-paid",
      title: "AR Docs by Project With Paid Amt",
      description: "AR documents with payment information",
      icon: DollarSign,
      route: "/construction/reports/ar-paid",
      isBuilt: false,
    },
    {
      key: "ap-open",
      title: "AP Open Documents by Vendor",
      description: "Accounts payable open documents",
      icon: FileText,
      route: "/construction/reports/ap-open",
      isBuilt: false,
    },
    {
      key: "ap-paid",
      title: "AP Docs by Project With Paid Amt",
      description: "AP documents with payment information",
      icon: DollarSign,
      route: "/construction/reports/ap-paid",
      isBuilt: false,
    },
    {
      key: "wip",
      title: "Project WIP",
      description: "Work in progress report",
      icon: Clock,
      route: "/construction/reports/wip",
      isBuilt: false,
    },
    {
      key: "wip-detail",
      title: "Project WIP Detail",
      description: "Detailed work in progress breakdown",
      icon: FileText,
      route: "/construction/reports/wip-detail",
      isBuilt: false,
    },
    {
      key: "subcontract-payment",
      title: "Subcontract Payment",
      description: "Subcontractor payment status",
      icon: DollarSign,
      route: "/construction/reports/subcontract-payment",
      isBuilt: false,
    },
    {
      key: "substantiated-billing",
      title: "Substantiated Billing",
      description: "Detailed billing substantiation",
      icon: FileBarChart,
      route: "/construction/reports/substantiated-billing",
      isBuilt: false,
    },
    {
      key: "bonding",
      title: "Construction Bonding Report",
      description: "Bonding requirements and status",
      icon: FileText,
      route: "/construction/reports/bonding",
      isBuilt: false,
    },
    {
      key: "substantiated-consolidated",
      title: "Substantiated Billing - Consolidated",
      description: "Consolidated substantiated billing report",
      icon: FileBarChart,
      route: "/construction/reports/substantiated-consolidated",
      isBuilt: false,
    },
    {
      key: "pl-by-month",
      title: "Project Profit & Loss by Month",
      description: "Monthly P&L analysis by project",
      icon: TrendingUp,
      route: "/construction/reports/pl-by-month",
      isBuilt: false,
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

  const handleReportClick = (report: Report) => {
    if (report.isBuilt !== false) {
      navigate(report.route);
    }
  };

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
              "transition-colors group relative overflow-hidden",
              report.isBuilt !== false && "cursor-pointer hover:border-primary/50",
              isFavorite(report.key) && "border-yellow-500/30"
            )}
            onClick={() => handleReportClick(report)}
          >
            {report.isBuilt === false && <ComingSoonBadge />}
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
