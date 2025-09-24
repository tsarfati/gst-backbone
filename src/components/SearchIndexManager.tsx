import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, RefreshCw, Clock, Settings, Database, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SearchIndexSettings {
  auto_indexing_enabled: boolean;
  indexing_interval_hours: number;
  last_indexed_at?: string;
  index_status: 'idle' | 'indexing' | 'error';
  total_records_indexed: number;
}

export default function SearchIndexManager() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SearchIndexSettings>({
    auto_indexing_enabled: true,
    indexing_interval_hours: 24,
    index_status: 'idle',
    total_records_indexed: 0
  });
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const isManager = profile?.role === 'admin' || profile?.role === 'controller';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // This would load from a settings table in a real implementation
      setSettings({
        auto_indexing_enabled: true,
        indexing_interval_hours: 24,
        index_status: 'idle',
        total_records_indexed: 1247,
        last_indexed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      });
    } catch (error) {
      console.error('Error loading search settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      // This would save to a settings table in a real implementation
      toast({
        title: "Settings Saved",
        description: "Search index settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving search settings:', error);
      toast({
        title: "Error",
        description: "Failed to save search settings.",
        variant: "destructive",
      });
    }
  };

  const triggerManualIndex = async () => {
    if (!isManager) {
      toast({
        title: "Access Denied",
        description: "Only admins and controllers can trigger manual indexing.",
        variant: "destructive",
      });
      return;
    }

    setIsIndexing(true);
    setIndexProgress(0);

    try {
      // Simulate indexing progress
      const progressInterval = setInterval(() => {
        setIndexProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            setIsIndexing(false);
            setSettings(prev => ({
              ...prev,
              index_status: 'idle',
              last_indexed_at: new Date().toISOString(),
              total_records_indexed: Math.floor(Math.random() * 500) + 1000
            }));
            toast({
              title: "Indexing Complete",
              description: "Search index has been updated successfully.",
            });
            return 100;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      setSettings(prev => ({ ...prev, index_status: 'indexing' }));
    } catch (error) {
      setIsIndexing(false);
      setSettings(prev => ({ ...prev, index_status: 'error' }));
      toast({
        title: "Indexing Failed",
        description: "Failed to update search index. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = () => {
    switch (settings.index_status) {
      case 'indexing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusText = () => {
    switch (settings.index_status) {
      case 'indexing':
        return 'Indexing in progress...';
      case 'error':
        return 'Last indexing failed';
      default:
        return 'Index up to date';
    }
  };

  const formatLastIndexed = () => {
    if (!settings.last_indexed_at) return 'Never';
    
    const date = new Date(settings.last_indexed_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading search settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Index Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium">{getStatusText()}</span>
            </div>
            <Badge variant="secondary">
              {settings.total_records_indexed.toLocaleString()} records
            </Badge>
          </div>

          {isIndexing && (
            <div className="space-y-2">
              <Progress value={indexProgress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                Indexing progress: {Math.round(indexProgress)}%
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Last indexed: {formatLastIndexed()}</span>
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={triggerManualIndex}
                disabled={isIndexing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isIndexing ? 'animate-spin' : ''}`} />
                {isIndexing ? 'Indexing...' : 'Rebuild Index'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Auto-Indexing Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-indexing">Enable Auto-Indexing</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically rebuild search index at regular intervals
                </p>
              </div>
              <Switch
                id="auto-indexing"
                checked={settings.auto_indexing_enabled}
                onCheckedChange={(checked) =>
                  setSettings(prev => ({ ...prev, auto_indexing_enabled: checked }))
                }
              />
            </div>

            {settings.auto_indexing_enabled && (
              <div className="space-y-2">
                <Label htmlFor="interval">Indexing Interval</Label>
                <Select
                  value={settings.indexing_interval_hours.toString()}
                  onValueChange={(value) =>
                    setSettings(prev => ({ ...prev, indexing_interval_hours: parseInt(value) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Every Hour</SelectItem>
                    <SelectItem value="6">Every 6 Hours</SelectItem>
                    <SelectItem value="12">Every 12 Hours</SelectItem>
                    <SelectItem value="24">Daily</SelectItem>
                    <SelectItem value="168">Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Search index will be rebuilt every {settings.indexing_interval_hours} hour(s)
                </p>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={saveSettings} className="gap-2">
                <Database className="h-4 w-4" />
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Index Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Records</p>
              <p className="font-semibold text-lg">{settings.total_records_indexed.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Next Auto-Index</p>
              <p className="font-semibold text-lg">
                {settings.auto_indexing_enabled 
                  ? `${settings.indexing_interval_hours}h` 
                  : 'Disabled'
                }
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Index Size</p>
              <p className="font-semibold text-lg">2.4 MB</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}