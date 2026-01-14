import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { FileText, TrendingUp, DollarSign, Users, BarChart3, Clock, Search, Filter } from "lucide-react";
import { useReportFavorites } from "@/hooks/useReportFavorites";
import { ReportFavoriteButton } from "@/components/ReportFavoriteButton";
import { cn } from "@/lib/utils";

interface Report {
  key: string;
  title: string;
  description: string;
  icon: any;
  route: string;
}

export default function ReceivablesReports() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  const { isFavorite, toggleFavorite, favoritesCount } = useReportFavorites("receivables");

  const reports: Report[] = [
    {
      key: "aging",
      title: "Aging Report",
      description: "View outstanding invoices by aging buckets (30/60/90 days)",
      icon: Clock,
      route: "/receivables/reports/aging",
    },
    {
      key: "statements",
      title: "Customer Statement",
      description: "Generate statements for customers showing their account activity",
      icon: FileText,
      route: "/receivables/reports/statements",
    },
    {
      key: "invoice-summary",
      title: "Invoice Summary",
      description: "Summary of all invoices by status and customer",
      icon: BarChart3,
      route: "/receivables/reports/invoice-summary",
    },
    {
      key: "payment-history",
      title: "Payment History",
      description: "Complete payment history by customer or date range",
      icon: DollarSign,
      route: "/receivables/reports/payment-history",
    },
    {
      key: "revenue-by-customer",
      title: "Revenue by Customer",
      description: "Revenue breakdown by customer over time",
      icon: TrendingUp,
      route: "/receivables/reports/revenue-by-customer",
    },
    {
      key: "revenue-by-project",
      title: "Revenue by Project",
      description: "Revenue breakdown by project/job",
      icon: BarChart3,
      route: "/receivables/reports/revenue-by-project",
    },
    {
      key: "top-customers",
      title: "Top Customers",
      description: "Top customers by revenue and payment history",
      icon: Users,
      route: "/receivables/reports/top-customers",
    },
    {
      key: "collections",
      title: "Collections Report",
      description: "Track overdue invoices and collection status",
      icon: Clock,
      route: "/receivables/reports/collections",
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
        <h1 className="text-3xl font-bold">Receivables Reports</h1>
        <p className="text-muted-foreground mt-1">
          Access detailed reports and analytics for accounts receivable
        </p>
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
