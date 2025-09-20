import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Database, Clock } from 'lucide-react';
import { useSearchIndex } from '@/hooks/useSearchIndex';

export default function SearchIndexManager() {
  const { isIndexing, indexedItems, buildSearchIndex } = useSearchIndex();

  const getItemTypeCount = (type: string) => {
    return indexedItems.filter(item => item.type === type).length;
  };

  const lastIndexed = indexedItems.length > 0 
    ? new Date(Math.max(...indexedItems.map(item => new Date(item.updatedAt).getTime())))
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Search Index
        </CardTitle>
        <CardDescription>
          Build and manage the search index for global search functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium">Search Index Status</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" />
              {indexedItems.length} items indexed
            </div>
            {lastIndexed && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last updated: {lastIndexed.toLocaleDateString()} at {lastIndexed.toLocaleTimeString()}
              </div>
            )}
          </div>
          <Button 
            onClick={buildSearchIndex} 
            disabled={isIndexing}
            variant="outline"
          >
            {isIndexing ? 'Building Index...' : 'Rebuild Index'}
          </Button>
        </div>

        {indexedItems.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Indexed Content</div>
            <div className="flex flex-wrap gap-2">
              {[
                { type: 'vendor', label: 'Vendors' },
                { type: 'job', label: 'Jobs' },
                { type: 'employee', label: 'Employees' },
                { type: 'page', label: 'Pages' },
              ].map(({ type, label }) => {
                const count = getItemTypeCount(type);
                return count > 0 ? (
                  <Badge key={type} variant="secondary">
                    {label}: {count}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
          <strong>Note:</strong> The search index includes vendors, jobs, employees, and static pages. 
          Rebuild the index after making significant changes to ensure search results are up to date.
        </div>
      </CardContent>
    </Card>
  );
}