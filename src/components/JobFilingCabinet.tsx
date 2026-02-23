import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen, FolderClosed, Plus, Upload, FileText, MoreVertical,
  ChevronRight, ChevronDown, Pencil, Trash2, Share2, Download, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import FileShareModal from "./FileShareModal";

interface Folder {
  id: string;
  name: string;
  is_system_folder: boolean;
  sort_order: number;
  parent_folder_id: string | null;
}

interface JobFile {
  id: string;
  file_name: string;
  original_file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  folder_id: string;
  created_at: string;
}

interface JobFilingCabinetProps {
  jobId: string;
}

const SYSTEM_FOLDERS = ["Delivery Tickets", "Permits"];

export default function JobFilingCabinet({ jobId }: JobFilingCabinetProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<Record<string, JobFile[]>>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Dialog states
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingItem, setRenamingItem] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);
  const [shareFile, setShareFile] = useState<JobFile | null>(null);

  const companyId = currentCompany?.id;

  const loadFolders = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('job_folders')
      .select('*')
      .eq('job_id', jobId)
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading folders:', error);
      return;
    }

    // Create system folders if they don't exist
    if (!data || data.length === 0) {
      const foldersToCreate = SYSTEM_FOLDERS.map((name, i) => ({
        job_id: jobId,
        company_id: companyId,
        name,
        is_system_folder: true,
        sort_order: i,
        created_by: user?.id || '',
      }));

      const { data: created, error: createError } = await supabase
        .from('job_folders')
        .insert(foldersToCreate)
        .select();

      if (createError) {
        console.error('Error creating system folders:', createError);
      } else {
        setFolders(created || []);
      }
    } else {
      setFolders(data);
    }
  }, [jobId, companyId, user?.id]);

  const loadFiles = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('job_files')
      .select('*')
      .eq('job_id', jobId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading files:', error);
      return;
    }

    const grouped: Record<string, JobFile[]> = {};
    (data || []).forEach(file => {
      if (!grouped[file.folder_id]) grouped[file.folder_id] = [];
      grouped[file.folder_id].push(file);
    });
    setFiles(grouped);
  }, [jobId, companyId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadFolders();
      await loadFiles();
      setLoading(false);
    };
    load();
  }, [loadFolders, loadFiles]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !companyId || !user) return;
    const { error } = await supabase.from('job_folders').insert({
      job_id: jobId,
      company_id: companyId,
      name: newFolderName.trim(),
      is_system_folder: false,
      sort_order: folders.length,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
    } else {
      toast({ title: "Folder created" });
      setNewFolderName("");
      setNewFolderOpen(false);
      loadFolders();
    }
  };

  const handleRename = async () => {
    if (!renamingItem || !renamingItem.name.trim()) return;
    const table = renamingItem.type === 'folder' ? 'job_folders' : 'job_files';
    const field = renamingItem.type === 'folder' ? 'name' : 'file_name';

    const { error } = await supabase
      .from(table)
      .update({ [field]: renamingItem.name.trim() })
      .eq('id', renamingItem.id);

    if (error) {
      toast({ title: "Error", description: "Failed to rename", variant: "destructive" });
    } else {
      toast({ title: "Renamed successfully" });
      setRenamingItem(null);
      if (renamingItem.type === 'folder') loadFolders();
      else loadFiles();
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const table = deleteItem.type === 'folder' ? 'job_folders' : 'job_files';

    if (deleteItem.type === 'file') {
      // Delete from storage first
      const file = Object.values(files).flat().find(f => f.id === deleteItem.id);
      if (file) {
        await supabase.storage.from('job-filing-cabinet').remove([file.file_url]);
      }
    }

    const { error } = await supabase.from(table).delete().eq('id', deleteItem.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    } else {
      toast({ title: "Deleted successfully" });
      setDeleteItem(null);
      loadFolders();
      loadFiles();
    }
  };

  const uploadFile = async (file: File, folderId: string) => {
    if (!companyId || !user) return;
    setUploading(folderId);

    try {
      const ext = file.name.split('.').pop();
      const path = `${companyId}/${jobId}/${folderId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('job-filing-cabinet')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('job_files').insert({
        job_id: jobId,
        company_id: companyId,
        folder_id: folderId,
        file_name: file.name,
        original_file_name: file.name,
        file_url: path,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.id,
      });

      if (dbError) throw dbError;

      toast({ title: "File uploaded", description: file.name });
      loadFiles();
      // Auto-expand the folder
      setExpandedFolders(prev => new Set(prev).add(folderId));
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      droppedFiles.forEach(f => uploadFile(f, folderId));
    }
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolder(null);
  };

  const handleFileInput = (folderId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        Array.from(target.files).forEach(f => uploadFile(f, folderId));
      }
    };
    input.click();
  };

  const downloadFile = async (file: JobFile) => {
    const { data, error } = await supabase.storage
      .from('job-filing-cabinet')
      .createSignedUrl(file.file_url, 60);

    if (error || !data) {
      toast({ title: "Error", description: "Failed to download file", variant: "destructive" });
      return;
    }

    window.open(data.signedUrl, '_blank');
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filing Cabinet</h3>
        <Button size="sm" onClick={() => setNewFolderOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Folder
        </Button>
      </div>

      <div className="space-y-1">
        {folders.map(folder => {
          const isExpanded = expandedFolders.has(folder.id);
          const folderFiles = files[folder.id] || [];
          const isDragOver = dragOverFolder === folder.id;
          const isUploading = uploading === folder.id;

          return (
            <div key={folder.id}>
              {/* Folder Row */}
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors group",
                  "hover:bg-muted/50",
                  isDragOver && "bg-primary/10 border border-dashed border-primary",
                  isUploading && "opacity-70"
                )}
                onClick={() => toggleFolder(folder.id)}
                onDrop={(e) => handleDrop(e, folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <FolderClosed className="h-5 w-5 text-primary shrink-0" />
                )}
                <span className="flex-1 text-sm font-medium">{folder.name}</span>
                {folder.is_system_folder && (
                  <Badge variant="secondary" className="text-xs">System</Badge>
                )}
                <Badge variant="outline" className="text-xs">{folderFiles.length}</Badge>

                {isUploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}

                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleFileInput(folder.id)}>
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setRenamingItem({ type: 'folder', id: folder.id, name: folder.name })}>
                        <Pencil className="h-4 w-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      {!folder.is_system_folder && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteItem({ type: 'folder', id: folder.id, name: folder.name })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Files inside folder */}
              {isExpanded && (
                <div
                  className={cn(
                    "ml-6 border-l border-border pl-4 py-1 space-y-0.5",
                    isDragOver && "border-primary"
                  )}
                  onDrop={(e) => handleDrop(e, folder.id)}
                  onDragOver={(e) => handleDragOver(e, folder.id)}
                  onDragLeave={handleDragLeave}
                >
                  {folderFiles.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      <Upload className="h-4 w-4 mx-auto mb-1 opacity-50" />
                      Drop files here or click upload
                    </div>
                  ) : (
                    folderFiles.map(file => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/50 group text-sm"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{file.file_name}</span>
                        <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadFile(file)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShareFile(file)}>
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setRenamingItem({ type: 'file', id: file.id, name: file.file_name })}>
                                <Pencil className="h-4 w-4 mr-2" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteItem({ type: 'file', id: file.id, name: file.file_name })}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Enter a name for the new folder.</DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renamingItem} onOpenChange={() => setRenamingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renamingItem?.type}</DialogTitle>
            <DialogDescription>Enter a new name.</DialogDescription>
          </DialogHeader>
          <Input
            value={renamingItem?.name || ''}
            onChange={e => setRenamingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingItem(null)}>Cancel</Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteItem?.type}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action cannot be undone.
              {deleteItem?.type === 'folder' && ' All files inside will also be deleted.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      {shareFile && (
        <FileShareModal
          open={!!shareFile}
          onOpenChange={() => setShareFile(null)}
          file={shareFile}
          jobId={jobId}
        />
      )}
    </div>
  );
}
