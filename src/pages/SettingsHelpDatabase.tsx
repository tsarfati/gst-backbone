import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { settingsHelpDatabase, type HelpCategory, type SettingsHelpEntry } from "@/data/settingsHelpDatabase";

type SectionGroup = {
  section: string;
  tabs: Record<string, SettingsHelpEntry[]>;
};

const categoryOrder: string[] = [
  "Construction",
  "Payables",
  "Receivables",
  "Banking",
  "Credit Cards",
  "Employees",
  "Messaging",
  "File Cabinet",
  "Company Settings",
  "Company Management",
  "User Management",
  "Punch Clock",
  "PM Lynk",
  "Notifications & Email",
  "Data & Security",
  "Subscription",
  "Billing",
];

const SettingsHelpDatabase = () => {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | "All">("All");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return settingsHelpDatabase.filter((entry) => {
      const categoryMatch = selectedCategory === "All" || entry.category === selectedCategory;
      if (!categoryMatch) return false;
      if (!q) return true;
      return (
        entry.setting.toLowerCase().includes(q) ||
        entry.tab.toLowerCase().includes(q) ||
        entry.section.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        (entry.behavior || "").toLowerCase().includes(q) ||
        entry.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [query, selectedCategory]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, SectionGroup[]>();
    const byCategorySectionTab = new Map<string, Map<string, Map<string, SettingsHelpEntry[]>>>();

    for (const entry of filtered) {
      if (!byCategorySectionTab.has(entry.category)) {
        byCategorySectionTab.set(entry.category, new Map());
      }
      const sectionMap = byCategorySectionTab.get(entry.category)!;
      if (!sectionMap.has(entry.section)) {
        sectionMap.set(entry.section, new Map());
      }
      const tabMap = sectionMap.get(entry.section)!;
      if (!tabMap.has(entry.tab)) {
        tabMap.set(entry.tab, []);
      }
      tabMap.get(entry.tab)!.push(entry);
    }

    for (const [category, sectionMap] of byCategorySectionTab.entries()) {
      const sections: SectionGroup[] = Array.from(sectionMap.entries()).map(([section, tabMap]) => ({
        section,
        tabs: Object.fromEntries(
          Array.from(tabMap.entries()).sort(([a], [b]) => a.localeCompare(b))
        ),
      }));
      sections.sort((a, b) => a.section.localeCompare(b.section));
      map.set(category, sections);
    }

    return map;
  }, [filtered]);

  const visibleCategories = useMemo(() => {
    const keys = Array.from(groupedByCategory.keys());
    return categoryOrder
      .filter((c) => keys.includes(c))
      .concat(keys.filter((k) => !categoryOrder.includes(k)).sort());
  }, [groupedByCategory]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleSection = (category: string, section: string) => {
    const key = `${category}::${section}`;
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Settings Help Database</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              placeholder="Search by setting, tab, section, keyword..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === "All" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("All")}
            >
              All
            </Button>
            {categoryOrder.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category as HelpCategory)}
              >
                {category}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Table of Contents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleCategories.length === 0 && (
            <p className="text-sm text-muted-foreground">No help entries match your search.</p>
          )}

          {visibleCategories.map((category) => {
            const categorySections = groupedByCategory.get(category) || [];
            const categoryExpanded = expandedCategories.has(category);
            return (
              <div key={category} className="rounded-md border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center gap-2">
                    {categoryExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">{category}</span>
                  </div>
                  <Badge variant="secondary">{categorySections.reduce((acc, s) => acc + Object.values(s.tabs).flat().length, 0)}</Badge>
                </button>

                {categoryExpanded && (
                  <div className="space-y-2 border-t px-3 py-3">
                    {categorySections.map((sectionGroup) => {
                      const sectionKey = `${category}::${sectionGroup.section}`;
                      const sectionExpanded = expandedSections.has(sectionKey);
                      const tabEntries = Object.entries(sectionGroup.tabs);
                      return (
                        <div key={sectionKey} className="rounded border">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left"
                            onClick={() => toggleSection(category, sectionGroup.section)}
                          >
                            <div className="flex items-center gap-2">
                              {sectionExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span className="text-sm font-medium">{sectionGroup.section}</span>
                            </div>
                            <Badge variant="outline">{tabEntries.length} tabs</Badge>
                          </button>

                          {sectionExpanded && (
                            <div className="space-y-4 border-t px-3 py-3">
                              {tabEntries.map(([tabName, entries]) => (
                                <div key={tabName} className="space-y-2">
                                  <p className="text-sm font-semibold text-muted-foreground">{tabName}</p>
                                  <div className="space-y-2">
                                    {entries.map((entry) => (
                                      <div key={entry.id} className="rounded border bg-background p-3 space-y-1">
                                        <p className="font-medium">{entry.setting}</p>
                                        <p className="text-sm text-muted-foreground">{entry.description}</p>
                                        {entry.behavior && (
                                          <p className="text-xs text-muted-foreground">
                                            Example use: {entry.behavior}
                                          </p>
                                        )}
                                        <div className="flex flex-wrap gap-1 pt-1">
                                          {entry.keywords.slice(0, 6).map((k) => (
                                            <Badge key={`${entry.id}-${k}`} variant="secondary" className="text-[10px]">
                                              {k}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsHelpDatabase;
