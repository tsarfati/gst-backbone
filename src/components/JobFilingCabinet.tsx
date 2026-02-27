import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen, FolderClosed, Plus, Upload, FileText, MoreVertical,
  ChevronRight, ChevronDown, Pencil, Trash2, Share2, Download, Loader2, Mail, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import FileShareModal from "./FileShareModal";
import FileCabinetPreviewModal from "./FileCabinetPreviewModal";
import { syncFileToGoogleDrive } from '@/utils/googleDriveSync';

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
type DragItemPayload =
  | { type: "file"; id: string; sourceFolderId: string }
  | { type: "folder"; id: string };
const INTERNAL_DND_MIME = "application/x-job-filing-cabinet-item";

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
  const [dragOverRoot, setDragOverRoot] = useState(false);

  // Dialog states
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingItem, setRenamingItem] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);
  const [shareFiles, setShareFiles] = useState<JobFile[]>([]);
  const [previewFile, setPreviewFile] = useState<JobFile | null>(null);
  const [inlineEditFileId, setInlineEditFileId] = useState<string | null>(null);
  const [inlineEditName, setInlineEditName] = useState("");
  const [uploadDestinationOpen, setUploadDestinationOpen] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [pendingUploadTargetFolderId, setPendingUploadTargetFolderId] = useState<string>("");

  // Multi-select state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

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

  const allFiles = Object.values(files).flat();
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const childFoldersByParent = folders.reduce<Record<string, Folder[]>>((acc, folder) => {
    const key = folder.parent_folder_id || "root";
    if (!acc[key]) acc[key] = [];
    acc[key].push(folder);
    return acc;
  }, {});
  Object.values(childFoldersByParent).forEach((list) =>
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
  );

  const isDescendantFolder = (candidateFolderId: string, ancestorFolderId: string): boolean => {
    let current = folderById.get(candidateFolderId) || null;
    let guard = 0;
    while (current && guard < 200) {
      if (current.parent_folder_id === ancestorFolderId) return true;
      current = current.parent_folder_id ? folderById.get(current.parent_folder_id) || null : null;
      guard += 1;
    }
    return false;
  };

  const getSelectedFiles = (): JobFile[] => {
    return allFiles.filter(f => selectedFileIds.has(f.id));
  };

  const toggleFileSelection = (fileId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const clearSelection = () => setSelectedFileIds(new Set());

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
      const file = allFiles.find(f => f.id === deleteItem.id);
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
      selectedFileIds.delete(deleteItem.id);
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

      // Sync to Google Drive
      if (companyId) {
        const { data: urlData } = await supabase.storage.from('job-filing-cabinet').createSignedUrl(path, 3600);
        if (urlData?.signedUrl) {
          syncFileToGoogleDrive({
            companyId,
            jobId,
            category: 'filing_cabinet',
            fileUrl: urlData.signedUrl,
            fileName: file.name,
            subfolder: `Filing Cabinet`,
          });
        }
      }

      toast({ title: "File uploaded", description: file.name });
      loadFiles();
      setExpandedFolders(prev => new Set(prev).add(folderId));
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const moveFileToFolder = async (fileId: string, targetFolderId: string) => {
    const file = allFiles.find((f) => f.id === fileId);
    if (!file || file.folder_id === targetFolderId) return;
    const { error } = await supabase.from("job_files").update({ folder_id: targetFolderId }).eq("id", fileId);
    if (error) {
      toast({ title: "Error", description: "Failed to move file", variant: "destructive" });
      return;
    }
    toast({ title: "File moved" });
    loadFiles();
    setExpandedFolders((prev) => new Set(prev).add(targetFolderId));
  };

  const moveFolderToParent = async (folderId: string, targetParentFolderId: string | null) => {
    const folder = folderById.get(folderId);
    if (!folder) return;
    if (folder.id === targetParentFolderId) return;
    if (folder.parent_folder_id === targetParentFolderId) return;
    if (targetParentFolderId && isDescendantFolder(targetParentFolderId, folderId)) {
      toast({ title: "Invalid move", description: "Cannot move a folder into its own subfolder", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("job_folders")
      .update({ parent_folder_id: targetParentFolderId })
      .eq("id", folderId);
    if (error) {
      toast({ title: "Error", description: "Failed to move folder", variant: "destructive" });
      return;
    }
    toast({ title: "Folder moved" });
    loadFolders();
    if (targetParentFolderId) setExpandedFolders((prev) => new Set(prev).add(targetParentFolderId));
  };

  const parseInternalDropPayload = (e: React.DragEvent): DragItemPayload | null => {
    try {
      const raw = e.dataTransfer.getData(INTERNAL_DND_MIME);
      if (!raw) return null;
      return JSON.parse(raw) as DragItemPayload;
    } catch {
      return null;
    }
  };

  const handleDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    setDragOverRoot(false);
    const internalPayload = parseInternalDropPayload(e);
    if (internalPayload) {
      if (internalPayload.type === "file") {
        void moveFileToFolder(internalPayload.id, folderId);
      } else if (internalPayload.type === "folder") {
        void moveFolderToParent(internalPayload.id, folderId);
      }
      return;
    }
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
    setDragOverRoot(false);
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRoot(false);
    const internalPayload = parseInternalDropPayload(e);
    if (!internalPayload) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        setPendingUploadFiles(droppedFiles);
        setPendingUploadTargetFolderId((childFoldersByParent["root"] || [])[0]?.id || "");
        setUploadDestinationOpen(true);
      }
      return;
    }
    if (internalPayload.type === "folder") {
      void moveFolderToParent(internalPayload.id, null);
    } else {
      toast({ title: "Move not allowed", description: "Files must stay inside a folder", variant: "destructive" });
    }
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const internalPayload = parseInternalDropPayload(e);
    setDragOverRoot(Boolean(internalPayload?.type === "folder") || e.dataTransfer.files.length > 0);
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

  const handleGlobalFileInput = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const picked = target.files ? Array.from(target.files) : [];
      if (picked.length === 0) return;
      setPendingUploadFiles(picked);
      setPendingUploadTargetFolderId((childFoldersByParent["root"] || [])[0]?.id || "");
      setUploadDestinationOpen(true);
    };
    input.click();
  };

  const handleUploadToSelectedDestination = async () => {
    if (!pendingUploadTargetFolderId || pendingUploadFiles.length === 0) return;
    const filesToUpload = [...pendingUploadFiles];
    setUploadDestinationOpen(false);
    setPendingUploadFiles([]);
    for (const f of filesToUpload) {
      await uploadFile(f, pendingUploadTargetFolderId);
    }
  };

  const downloadFile = async (file: JobFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('job-filing-cabinet')
        .createSignedUrl(file.file_url, 60);

      if (error || !data) throw new Error('Failed to get URL');

      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download file", variant: "destructive" });
    }
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

      {/* Multi-select toolbar */}
      {selectedFileIds.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
          <Badge variant="secondary" className="text-xs">
            {selectedFileIds.size} selected
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShareFiles(getSelectedFiles());
            }}
          >
            <Mail className="h-4 w-4 mr-1.5" />
            Email Selected
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}

      <div
        className={cn(
          "space-y-0 rounded-md",
          dragOverRoot && "ring-1 ring-primary/40 bg-primary/5"
        )}
        onDrop={handleRootDrop}
        onDragOver={handleRootDragOver}
        onDragLeave={() => setDragOverRoot(false)}
      >
        <div className="px-2 py-1.5 mb-1 rounded-md border border-dashed border-border/70 bg-muted/20 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Drop files here
            <span className="mx-2 text-border">|</span>
            Drag folders here to move them to top level
          </div>
          <Button size="sm" variant="outline" className="h-7" onClick={handleGlobalFileInput}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload Files
          </Button>
        </div>
        {(childFoldersByParent["root"] || []).map(folder => {
          const isExpanded = expandedFolders.has(folder.id);
          const folderFiles = files[folder.id] || [];
          const isDragOver = dragOverFolder === folder.id;
          const isUploading = uploading === folder.id;

          const renderFolderNode = (node: Folder, depth = 0): React.ReactNode => {
            const nodeExpanded = expandedFolders.has(node.id);
            const nodeFiles = files[node.id] || [];
            const nodeIsDragOver = dragOverFolder === node.id;
            const nodeIsUploading = uploading === node.id;
            const childFolders = childFoldersByParent[node.id] || [];

            return (
              <div key={node.id}>
              {/* Folder Row */}
              <div
                className={cn(
                  "flex items-center gap-2 px-2.5 py-0.5 rounded-md cursor-pointer transition-colors group",
                  "hover:bg-muted/50",
                  nodeIsDragOver && "bg-primary/10 border border-dashed border-primary",
                  nodeIsUploading && "opacity-70"
                )}
                style={{ marginLeft: depth * 14 }}
                draggable={!node.is_system_folder}
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData(INTERNAL_DND_MIME, JSON.stringify({ type: "folder", id: node.id } satisfies DragItemPayload));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => toggleFolder(node.id)}
                onDrop={(e) => handleDrop(e, node.id)}
                onDragOver={(e) => handleDragOver(e, node.id)}
                onDragLeave={handleDragLeave}
              >
                {nodeExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                {nodeExpanded ? (
                  <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <FolderClosed className="h-5 w-5 text-primary shrink-0" />
                )}
                <span className="flex-1 text-sm font-medium">{node.name}</span>
                {node.is_system_folder && (
                  <Badge variant="secondary" className="text-xs">System</Badge>
                )}
                <Badge variant="outline" className="text-xs">{nodeFiles.length}</Badge>

                {nodeIsUploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}

                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleFileInput(node.id)}>
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setRenamingItem({ type: 'folder', id: node.id, name: node.name })}>
                        <Pencil className="h-4 w-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      {!node.is_system_folder && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteItem({ type: 'folder', id: node.id, name: node.name })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Files inside folder */}
              {nodeExpanded && (
                <div
                  className={cn(
                    "ml-6 border-l border-border pl-2 py-0 space-y-0",
                    nodeIsDragOver && "border-primary"
                  )}
                  style={{ marginLeft: 24 + depth * 14 }}
                  onDrop={(e) => handleDrop(e, node.id)}
                  onDragOver={(e) => handleDragOver(e, node.id)}
                  onDragLeave={handleDragLeave}
                >
                  {childFolders.map((child) => renderFolderNode(child, depth + 1))}
                  {nodeFiles.length === 0 && childFolders.length === 0 ? (
                    <div className="py-0.5 text-center text-[11px] text-muted-foreground/80">Empty folder</div>
                  ) : (
                    nodeFiles.map(file => {
                      const isSelected = selectedFileIds.has(file.id);
                      return (
                        <div
                          key={file.id}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-0 rounded-md hover:bg-muted/50 group text-sm cursor-pointer",
                            isSelected && "bg-primary/5 ring-1 ring-primary/20"
                          )}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData(
                              INTERNAL_DND_MIME,
                              JSON.stringify({ type: "file", id: file.id, sourceFolderId: node.id } satisfies DragItemPayload)
                            );
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={() => setPreviewFile(file)}
                        >
                          <div onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleFileSelection(file.id)}
                              className="shrink-0"
                            />
                          </div>
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          {inlineEditFileId === file.id ? (
                            <form
                              className="flex-1 min-w-0"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (!inlineEditName.trim()) return;
                                const { error } = await supabase
                                  .from('job_files')
                                  .update({ file_name: inlineEditName.trim() })
                                  .eq('id', file.id);
                                if (error) {
                                  toast({ title: "Error", description: "Failed to rename", variant: "destructive" });
                                } else {
                                  toast({ title: "File renamed" });
                                  loadFiles();
                                }
                                setInlineEditFileId(null);
                              }}
                            >
                              <Input
                                autoFocus
                                value={inlineEditName}
                                onChange={(e) => setInlineEditName(e.target.value)}
                                onBlur={() => setInlineEditFileId(null)}
                                onKeyDown={(e) => { if (e.key === 'Escape') setInlineEditFileId(null); }}
                              className="h-6 text-sm py-0 px-1"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </form>
                          ) : (
                            <span
                              className="flex-1 truncate hover:underline cursor-text"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInlineEditFileId(file.id);
                                setInlineEditName(file.file_name);
                              }}
                            >
                              {file.file_name}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadFile(file)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShareFiles([file])}>
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
                      );
                    })
                  )}
                </div>
              )}
              </div>
            );
          };

          return renderFolderNode(folder, 0);
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

      <Dialog open={uploadDestinationOpen} onOpenChange={setUploadDestinationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Upload Destination</DialogTitle>
            <DialogDescription>
              Select the folder where {pendingUploadFiles.length} file{pendingUploadFiles.length === 1 ? "" : "s"} should be uploaded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Destination Folder</Label>
            <Select value={pendingUploadTargetFolderId} onValueChange={setPendingUploadTargetFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDestinationOpen(false);
                setPendingUploadFiles([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadToSelectedDestination}
              disabled={!pendingUploadTargetFolderId || pendingUploadFiles.length === 0}
            >
              Upload
            </Button>
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

      {/* Share Modal (supports multi-file) */}
      {shareFiles.length > 0 && (
        <FileShareModal
          open={shareFiles.length > 0}
          onOpenChange={(open) => { if (!open) { setShareFiles([]); clearSelection(); } }}
          files={shareFiles}
          jobId={jobId}
        />
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FileCabinetPreviewModal
          open={!!previewFile}
          onOpenChange={(open) => { if (!open) setPreviewFile(null); }}
          file={previewFile}
          onShare={() => setShareFiles([previewFile])}
        />
      )}
    </div>
  );
}
