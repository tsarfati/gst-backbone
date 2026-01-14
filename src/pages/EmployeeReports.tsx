import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Users, QrCode, UserCircle, ArrowRight, Search, Filter, FileText } from "lucide-react";
import { useReportFavorites } from "@/hooks/useReportFavorites";
import { ReportFavoriteButton } from "@/components/ReportFavoriteButton";
import { cn } from "@/lib/utils";

const reports = [
  {
    key: "pin-list",
    title: "PIN Employee Master List",
    description: "Complete list of all PIN employees with their credentials",
    icon: Users,
    path: "/employees/reports/pin-list",
  },
  {
    key: "qr-cards",
    title: "Employee QR Punch Cards",
    description: "Generate customized QR code cards for employees to access punch clock",
    icon: QrCode,
    path: "/employees/reports/qr-cards",
  },
  {
    key: "all-pins",
    title: "All Employees with PIN Access",
    description: "Both regular employees and PIN employees with punch clock access",
    icon: UserCircle,
    path: "/employees/reports/all-pins",
  },
];

export default function EmployeeReports() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  const { isFavorite, toggleFavorite, favoritesCount } = useReportFavorites("employee");

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
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employee Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate reports and documents for employees
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card 
              key={report.key} 
              className={cn(
                "hover:shadow-md transition-shadow cursor-pointer",
                isFavorite(report.key) && "border-yellow-500/30"
              )}
              onClick={() => navigate(report.path)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <ReportFavoriteButton
                      isFavorite={isFavorite(report.key)}
                      onToggle={() => toggleFavorite(report.key)}
                    />
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {report.description}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
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
