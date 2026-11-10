import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Search, FileText, Building, Users, Receipt, Megaphone, Briefcase, Zap, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearchIndex, SearchIndexItem } from '@/hooks/useSearchIndex';

const getIconForType = (type: string) => {
  switch (type) {
    case 'receipt': return Receipt;
    case 'file': return FileText;
    case 'job': return Building;
    case 'vendor': return Building;
    case 'customer': return Users;
    case 'employee': return Users;
    case 'bill': return FileText;
    case 'ar_invoice': return FileText;
    case 'payment': return FileText;
    case 'credit_card_transaction': return Receipt;
    case 'subcontract': return Briefcase;
    case 'purchase_order': return FileText;
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
      case 'file': return 'Files';
      case 'job': return 'Jobs';
      case 'vendor': return 'Vendors';
      case 'customer': return 'Customers';
      case 'employee': return 'Employees';
      case 'bill': return 'Bills';
      case 'ar_invoice': return 'AR Invoices';
      case 'payment': return 'Payments';
      case 'credit_card_transaction': return 'Credit Card Transactions';
      case 'subcontract': return 'Subcontracts';
      case 'purchase_order': return 'Purchase Orders';
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
          <CommandInput
            ref={inputRef}
            placeholder="Search anything: data, actions, reports..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
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
                  <CommandGroup key={groupLabel} heading={groupLabel} className="mb-3">
                    {items.map((result) => {
                      const IconComponent = getIconForType(result.type);
                      return (
                        <CommandItem
                          key={result.id}
                          value={`${result.title} ${result.description || ''} ${result.id}`}
                          onSelect={() => handleSelect(result)}
                          className="cursor-pointer p-3"
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
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
