import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Search, FileText, Building, Users, Receipt, Megaphone, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'receipt' | 'job' | 'vendor' | 'employee' | 'announcement' | 'page';
  path: string;
  icon: React.ComponentType<any>;
}

// Mock search results - in a real app this would come from your backend
const mockResults: SearchResult[] = [
  { id: '1', title: 'Office Renovation', description: 'Active construction project', type: 'job', path: '/jobs/1', icon: Building },
  { id: '2', title: 'Home Depot Receipt', description: 'Building materials - $234.56', type: 'receipt', path: '/receipts/1', icon: Receipt },
  { id: '3', title: 'John Smith', description: 'Project Manager', type: 'employee', path: '/employees/1', icon: Users },
  { id: '4', title: 'ABC Construction', description: 'General contractor vendor', type: 'vendor', path: '/vendors/1', icon: Building },
  { id: '5', title: 'Safety Update', description: 'New safety protocols announcement', type: 'announcement', path: '/announcements/1', icon: Megaphone },
  { id: '6', title: 'Upload Receipts', description: 'Upload and manage receipt documents', type: 'page', path: '/upload', icon: FileText },
  { id: '7', title: 'Time Tracking', description: 'Employee time tracking system', type: 'page', path: '/time-tracking', icon: Briefcase },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = mockResults.filter(result =>
        result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredResults(filtered);
    } else {
      setFilteredResults([]);
    }
  }, [searchQuery]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    setOpen(false);
    setSearchQuery('');
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'receipt': return 'text-green-600';
      case 'job': return 'text-blue-600';
      case 'vendor': return 'text-purple-600';
      case 'employee': return 'text-orange-600';
      case 'announcement': return 'text-red-600';
      case 'page': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-64 justify-start text-muted-foreground">
          <Search className="h-4 w-4 mr-2" />
          Search anything...
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder="Search receipts, jobs, people..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="border-none focus:ring-0"
          />
          <CommandList>
            {!searchQuery.trim() ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Start typing to search across your workspace
              </div>
            ) : filteredResults.length === 0 ? (
              <CommandEmpty>No results found for "{searchQuery}"</CommandEmpty>
            ) : (
              <CommandGroup heading="Results">
                {filteredResults.slice(0, 5).map((result) => {
                  const IconComponent = result.icon;
                  return (
                    <CommandItem
                      key={result.id}
                      onSelect={() => handleSelect(result)}
                      className="cursor-pointer p-3"
                    >
                      <div className="flex items-start space-x-3 w-full">
                        <IconComponent className={`h-5 w-5 mt-0.5 ${getTypeColor(result.type)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{result.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{result.description}</div>
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${getTypeColor(result.type)} bg-opacity-10`}>
                            {result.type}
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
                {filteredResults.length > 5 && (
                  <div className="p-2 text-center text-xs text-muted-foreground border-t">
                    {filteredResults.length - 5} more results...
                  </div>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}