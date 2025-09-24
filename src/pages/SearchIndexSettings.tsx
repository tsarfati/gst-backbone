import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SearchIndexManager from '@/components/SearchIndexManager';

export default function SearchIndexSettings() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/settings')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Search Index Settings</h1>
          <p className="text-muted-foreground">
            Manage search indexing and performance settings
          </p>
        </div>
      </div>

      <SearchIndexManager />
    </div>
  );
}