import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Folder,
  FolderPlus,
  ChevronRight,
  ArrowLeft,
  Check,
  Loader2,
  Home,
} from 'lucide-react';

interface DriveFolder {
  id: string;
  name: string;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface GoogleDriveFolderPickerProps {
  companyId: string;
  selectedFolderId: string;
  selectedFolderName: string;
  onSelect: (folderId: string, folderName: string) => void;
}

export default function GoogleDriveFolderPicker({
  companyId,
  selectedFolderId,
  selectedFolderName,
  onSelect,
}: GoogleDriveFolderPickerProps) {
  const { toast } = useToast();
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'My Drive' },
  ]);

  const currentFolderId = breadcrumb[breadcrumb.length - 1].id;

  useEffect(() => {
    loadFolders(currentFolderId === 'root' ? undefined : currentFolderId);
  }, [currentFolderId]);

  const loadFolders = async (parentId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-folders', {
        body: { company_id: companyId, parent_folder_id: parentId },
      });
      if (error) throw error;
      setFolders(data.folders || []);
    } catch (err: any) {
      toast({ title: 'Error loading folders', description: err.message, variant: 'destructive' });
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const navigateInto = (folder: DriveFolder) => {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateTo = (index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-folders', {
        body: {
          company_id: companyId,
          action: 'create',
          folder_name: newFolderName.trim(),
          parent_folder_id: currentFolderId === 'root' ? undefined : currentFolderId,
        },
      });
      if (error) throw error;
      toast({ title: 'Folder created', description: `"${data.folder.name}" created successfully.` });
      setNewFolderName('');
      setShowCreate(false);
      // Reload and auto-select
      await loadFolders(currentFolderId === 'root' ? undefined : currentFolderId);
      onSelect(data.folder.id, data.folder.name);
    } catch (err: any) {
      toast({ title: 'Error creating folder', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const selectThisFolder = () => {
    const current = breadcrumb[breadcrumb.length - 1];
    onSelect(current.id === 'root' ? '' : current.id, current.name);
  };

  return (
    <div className="border rounded-lg bg-card">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 p-3 border-b overflow-x-auto text-sm">
        {breadcrumb.map((item, i) => (
          <span key={item.id} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <button
              onClick={() => navigateTo(i)}
              className={`hover:underline ${
                i === breadcrumb.length - 1
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {i === 0 ? (
                <span className="flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" />
                  My Drive
                </span>
              ) : (
                item.name
              )}
            </button>
          </span>
        ))}
      </div>

      {/* Selected indicator */}
      {selectedFolderId && (
        <div className="px-3 py-2 bg-primary/10 border-b flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-primary" />
          <span>
            Syncing to: <strong>{selectedFolderName || selectedFolderId}</strong>
          </span>
        </div>
      )}

      {/* Folder list */}
      <ScrollArea className="h-[240px]">
        {loading ? (
          <div className="flex items-center justify-center h-full py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground text-sm">
            <Folder className="h-8 w-8 mb-2 opacity-40" />
            No subfolders here
          </div>
        ) : (
          <div className="p-1">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center justify-between group rounded-md hover:bg-accent px-3 py-2 cursor-pointer"
                onClick={() => navigateInto(folder)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate text-sm">{folder.name}</span>
                  {folder.id === selectedFolderId && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* Actions */}
      <div className="p-3 space-y-3">
        {showCreate ? (
          <div className="flex items-center gap-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
            />
            <Button size="sm" onClick={handleCreateFolder} disabled={creating || !newFolderName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewFolderName(''); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
              <FolderPlus className="h-4 w-4 mr-1" />
              New Folder
            </Button>
            <Button size="sm" onClick={selectThisFolder}>
              <Check className="h-4 w-4 mr-1" />
              Use "{breadcrumb[breadcrumb.length - 1].name}"
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
