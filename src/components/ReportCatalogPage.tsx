import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FileText, Filter, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import UnifiedViewSelector, { UnifiedViewType } from "@/components/ui/unified-view-selector";
import { useUnifiedViewPreference } from "@/hooks/useUnifiedViewPreference";
import { useReportFavorites } from "@/hooks/useReportFavorites";
import { ReportFavoriteButton } from "@/components/ReportFavoriteButton";
import { ComingSoonBadge } from "@/components/ComingSoonBadge";
import { cn } from "@/lib/utils";

type IconType = any;

export interface ReportCatalogItem {
  key: string;
  title: string;
  description: string;
  icon: IconType;
  to: string;
  isBuilt?: boolean;
}

type SortKey = "title" | "built" | "favorite";
type SortDir = "asc" | "desc";

interface ReportCatalogPageProps {
  title: string;
  description?: string;
  reports: ReportCatalogItem[];
  favoriteScope: "employee" | "construction" | "receivables";
  viewPreferenceKey: string;
  containerClassName?: string;
}

export default function ReportCatalogPage({
  title,
  description,
  reports,
  favoriteScope,
  viewPreferenceKey,
  containerClassName = "p-4 md:p-6 space-y-6",
}: ReportCatalogPageProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("favorite");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { currentView, setCurrentView, setDefaultView, isDefault } = useUnifiedViewPreference(viewPreferenceKey, "icons");
  const { isFavorite, toggleFavorite, favoritesCount } = useReportFavorites(favoriteScope);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        report.title.toLowerCase().includes(q) ||
        report.description.toLowerCase().includes(q);
      const matchesFavorites = !showFavoritesOnly || isFavorite(report.key);
      return matchesSearch && matchesFavorites;
    });
  }, [reports, searchTerm, showFavoritesOnly, isFavorite]);

  const sortedReports = useMemo(() => {
    const list = [...filteredReports];
    list.sort((a, b) => {
      const favA = isFavorite(a.key);
      const favB = isFavorite(b.key);
      let cmp = 0;
      if (sortKey === "favorite") {
        cmp = Number(favB) - Number(favA);
      } else if (sortKey === "built") {
        cmp = Number(a.isBuilt !== false) - Number(b.isBuilt !== false);
      } else {
        cmp = a.title.localeCompare(b.title);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filteredReports, isFavorite, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
  };

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : "";

  const handleReportClick = (report: ReportCatalogItem) => {
    if (report.isBuilt !== false) navigate(report.to);
  };

  const renderIconTile = (report: ReportCatalogItem) => {
    const Icon = report.icon;
    return (
      <Card
        key={report.key}
        className={cn(
          "hover:shadow-md transition-shadow relative overflow-hidden",
          report.isBuilt !== false && "cursor-pointer",
          isFavorite(report.key) && "border-yellow-500/30"
        )}
        onClick={() => handleReportClick(report)}
      >
        {report.isBuilt === false && <ComingSoonBadge />}
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base leading-tight">{report.title}</CardTitle>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ReportFavoriteButton isFavorite={isFavorite(report.key)} onToggle={() => toggleFavorite(report.key)} />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription>{report.description}</CardDescription>
        </CardContent>
      </Card>
    );
  };

  const renderListRow = (report: ReportCatalogItem, superCompact = false) => {
    const Icon = report.icon;
    return (
      <div
        key={report.key}
        className={cn(
          "grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border rounded-lg hover:bg-primary/5 hover:border-primary transition-colors",
          report.isBuilt !== false && "cursor-pointer",
          isFavorite(report.key) && "border-yellow-500/30",
          superCompact ? "px-2 py-0.5" : "px-3 py-1"
        )}
        onClick={() => handleReportClick(report)}
      >
        <div className="min-w-0 flex items-center gap-2">
          <Icon className={cn("text-primary shrink-0", superCompact ? "h-4 w-4" : "h-5 w-5")} />
          <div className="min-w-0">
            <div className={cn("font-medium truncate", superCompact ? "text-xs leading-tight" : "text-sm leading-tight")}>{report.title}</div>
            {!superCompact && <div className="text-xs text-muted-foreground truncate leading-tight">{report.description}</div>}
          </div>
        </div>
        <div className="text-xs text-muted-foreground shrink-0">
          {report.isBuilt === false ? "Coming Soon" : "Available"}
        </div>
        <ReportFavoriteButton
          isFavorite={isFavorite(report.key)}
          onToggle={(e?: any) => {
            e?.stopPropagation?.();
            toggleFavorite(report.key);
          }}
        />
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    );
  };

  const gridClasses = currentView === "icons" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-1";

  return (
    <div className={containerClassName}>
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search reports..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Favorites {favoritesCount > 0 && `(${favoritesCount})`}
        </Button>
        <UnifiedViewSelector
          currentView={currentView}
          onViewChange={setCurrentView}
          onSetDefault={setDefaultView}
          isDefault={isDefault}
        />
      </div>

      {(currentView === "list" || currentView === "super-compact") && (
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-2 text-xs text-muted-foreground">
          <button className="text-left hover:text-foreground" onClick={() => toggleSort("title")}>
            Report {sortIndicator("title")}
          </button>
          <button className="text-left hover:text-foreground" onClick={() => toggleSort("built")}>
            Status {sortIndicator("built")}
          </button>
          <button className="text-left hover:text-foreground" onClick={() => toggleSort("favorite")}>
            Fav {sortIndicator("favorite")}
          </button>
          <span />
        </div>
      )}

      <div className={gridClasses}>
        {sortedReports.map((report) => {
          if (currentView === "icons") return renderIconTile(report);
          if (currentView === "super-compact") return renderListRow(report, true);
          return renderListRow(report, false);
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
