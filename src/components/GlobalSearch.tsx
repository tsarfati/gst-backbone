import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Search, FileText, Building, Users, Receipt, Megaphone, Briefcase, Zap, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { useSearchIndex, SearchIndexItem } from '@/hooks/useSearchIndex';
import { Separator } from '@/components/ui/separator';

const getIconForType = (type: string) => {
  switch (type) {
    case 'receipt': return Receipt;
    case 'job': return Building;
    case 'vendor': return Building;
    case 'employee': return Users;
    case 'announcement': return Megaphone;
    case 'action': return Zap;
    case 'report': return BarChart3;
    case 'page': return FileText;
    default: return FileText;
  }
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState<SearchIndexItem[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { searchItems, buildSearchIndex, isIndexing } = useSearchIndex();

  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchItems(searchQuery);
      setFilteredResults(results);
    } else {
      setFilteredResults([]);
    }
  }, [searchQuery, searchItems]);

  const handleSelect = (result: SearchIndexItem) => {
    navigate(result.path);
    setOpen(false);
    setSearchQuery('');
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'receipt': return 'Receipts';
      case 'job': return 'Jobs';
      case 'vendor': return 'Vendors';
      case 'employee': return 'Employees';
      case 'announcement': return 'Announcements';
      case 'action': return 'Tasks';
      case 'report': return 'Reports';
      case 'page': return 'Pages';
      default: return 'Other';
    }
  };

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchIndexItem[]> = {};
    filteredResults.forEach((result) => {
      const typeLabel = getTypeLabel(result.type);
      if (!groups[typeLabel]) {
        groups[typeLabel] = [];
      }
      groups[typeLabel].push(result);
    });
    return groups;
  }, [filteredResults]);

  // Keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) buildSearchIndex(); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-80 justify-start text-muted-foreground">
          <Search className="h-4 w-4 mr-2" />
          Search anything...
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              placeholder="Search anything: data, actions, reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-11 w-full rounded-md bg-transparent py-3 px-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList className="max-h-[400px]">
            {!searchQuery.trim() ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Start typing to search across your workspace
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No results found for "{searchQuery}"
              </div>
            ) : (
              <div className="p-2">
                <div className="text-sm text-muted-foreground mb-3 px-2">
                  {filteredResults.length} {filteredResults.length === 1 ? 'Result' : 'Results'}
                </div>
                {Object.entries(groupedResults).map(([groupLabel, items]) => (
                  <div key={groupLabel} className="mb-3">
                    <div className="bg-primary text-primary-foreground px-3 py-2 font-semibold text-sm rounded-md mb-1">
                      {groupLabel}
                    </div>
                    {items.map((result) => {
                      const IconComponent = getIconForType(result.type);
                      return (
                        <div
                          key={result.id}
                          onClick={() => handleSelect(result)}
                          className="cursor-pointer p-3 hover:bg-accent rounded-md transition-colors"
                        >
                          <div className="flex items-start space-x-3">
                            <IconComponent className="h-5 w-5 mt-0.5 text-primary" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{result.title}</div>
                              {result.description && (
                                <div className="text-xs text-muted-foreground mt-1">{result.description}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}