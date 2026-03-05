import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FolderClosed, FolderOpen, Upload, Plus, FileText, Download, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CompanyFolder {
  id: string;
  name: string;
  sort_order: number;
  is_system_folder: boolean;
}

interface CompanyFile {
  id: string;
  folder_id: string | null;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  category: string;
  created_at: string;
}

interface UnassignedCompanyFile {
  id: string;
  category: string | null;
}

type DragItemPayload =
  | { type: "folder"; id: string }
  | { type: "file"; id: string; sourceFolderId: string | null };

const INTERNAL_DND_MIME = "application/x-company-library-item";
const STORAGE_BUCKET = "job-filing-cabinet";
const DEFAULT_FOLDER_NAMES = ["Contracts", "Permits", "Insurance", "General"];

const categoryForFolderName = (name: string): string => {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("contract")) return "contract";
  if (normalized.includes("permit")) return "permit";
  if (normalized.includes("insurance")) return "insurance";
  return "other";
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const parseStoragePathFromPublicUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export default function CompanyFiles() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<CompanyFolder[]>([]);
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [uploadingFolderId, setUploadingFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputFolderRef = useRef<string | null>(null);

  const companyId = currentCompany?.id || null;
  const userId = user?.id || null;

  const filesByFolderId = useMemo(() => {
    const grouped: Record<string, CompanyFile[]> = {};
    for (const file of files) {
      const key = file.folder_id || "__unassigned__";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(file);
    }
    return grouped;
  }, [files]);

  const loadFolders = useCallback(async (): Promise<CompanyFolder[]> => {
    if (!companyId || !userId) return [];

    const { data, error } = await supabase
      .from("company_file_folders" as never)
      .select("id, name, sort_order, is_system_folder")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error loading company folders:", error);
      toast({ title: "Error", description: "Failed to load folders", variant: "destructive" });
      return [];
    }

    if (data && data.length > 0) return data as CompanyFolder[];

    const seedRows = DEFAULT_FOLDER_NAMES.map((name, idx) => ({
      company_id: companyId,
      name,
      sort_order: idx,
      is_system_folder: true,
      created_by: userId,
    }));
    const { data: created, error: createError } = await supabase
      .from("company_file_folders" as never)
      .insert(seedRows)
      .select("id, name, sort_order, is_system_folder");
    if (createError) {
      console.error("Error creating default folders:", createError);
      toast({ title: "Error", description: "Failed to initialize default folders", variant: "destructive" });
      return [];
    }
    return (created as CompanyFolder[]) || [];
  }, [companyId, userId, toast]);

  const loadFiles = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("company_files" as never)
      .select("id, folder_id, file_name, file_url, file_size, file_type, category, created_at")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error loading company files:", error);
      toast({ title: "Error", description: "Failed to load files", variant: "destructive" });
      return;
    }
    setFiles((data as CompanyFile[]) || []);
  }, [companyId, toast]);

  const ensureFolderAssignments = useCallback(
    async (folderRows: CompanyFolder[]) => {
      if (!companyId) return;
      const { data: unassigned, error } = await supabase
        .from("company_files" as never)
        .select("id, category")
        .eq("company_id", companyId)
        .is("folder_id", null);
      if (error || !unassigned || unassigned.length === 0) return;

      const folderByCategory = new Map<string, string>();
      for (const folder of folderRows) {
        const category = categoryForFolderName(folder.name);
        if (!folderByCategory.has(category)) folderByCategory.set(category, folder.id);
      }

      await Promise.all(
        (unassigned as unknown as UnassignedCompanyFile[]).map((file, idx: number) => {
          const targetFolderId =
            folderByCategory.get(String(file.category || "").toLowerCase()) ||
            folderByCategory.get("other") ||
            folderRows[0]?.id;
          if (!targetFolderId) return Promise.resolve();
          return supabase
            .from("company_files" as never)
            .update({ folder_id: targetFolderId, sort_order: idx } as never)
            .eq("id", file.id);
        }),
      );
    },
    [companyId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const folderRows = await loadFolders();
      setFolders(folderRows);
      setExpandedFolderIds((prev) => (prev.size > 0 ? prev : new Set(folderRows.map((f) => f.id))));
      await ensureFolderAssignments(folderRows);
      await loadFiles();
    } finally {
      setLoading(false);
    }
  }, [loadFolders, ensureFolderAssignments, loadFiles]);

  useEffect(() => {
    if (!companyId || !userId) return;
    load();
  }, [companyId, userId, load]);

  const setFolderOrder = async (orderedFolderIds: string[]) => {
    await Promise.all(
      orderedFolderIds.map((folderId, index) =>
        supabase.from("company_file_folders" as never).update({ sort_order: index } as never).eq("id", folderId),
      ),
    );
  };

  const reorderFolders = async (draggedFolderId: string, targetFolderId: string) => {
    if (draggedFolderId === targetFolderId) return;
    const ordered = [...folders].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const draggedIndex = ordered.findIndex((folder) => folder.id === draggedFolderId);
    const targetIndex = ordered.findIndex((folder) => folder.id === targetFolderId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const [dragged] = ordered.splice(draggedIndex, 1);
    ordered.splice(targetIndex, 0, dragged);
    const nextIds = ordered.map((folder) => folder.id);
    setFolders(ordered.map((folder, idx) => ({ ...folder, sort_order: idx })));
    await setFolderOrder(nextIds);
  };

  const moveFileToFolder = async (fileId: string, targetFolderId: string) => {
    const targetFiles = filesByFolderId[targetFolderId] || [];
    const sortOrder = targetFiles.length;
    const { error } = await supabase
      .from("company_files" as never)
      .update({ folder_id: targetFolderId, sort_order: sortOrder } as never)
      .eq("id", fileId);
    if (error) {
      toast({ title: "Error", description: "Failed to move file", variant: "destructive" });
      return;
    }
    await loadFiles();
    setExpandedFolderIds((prev) => new Set(prev).add(targetFolderId));
  };

  const uploadFilesToFolder = async (selectedFiles: File[], targetFolderId: string) => {
    if (!companyId || !userId || selectedFiles.length === 0) return;
    setUploadingFolderId(targetFolderId);
    const targetFolder = folders.find((folder) => folder.id === targetFolderId);
    const category = categoryForFolderName(targetFolder?.name || "General");
    const currentCount = (filesByFolderId[targetFolderId] || []).length;

    try {
      for (let idx = 0; idx < selectedFiles.length; idx += 1) {
        const file = selectedFiles[idx];
        const path = `${companyId}/company-files/${targetFolderId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        const { error: insertError } = await supabase.from("company_files" as never).insert({
          company_id: companyId,
          category,
          name: file.name,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          file_type: file.type || null,
          status: "current",
          folder_id: targetFolderId,
          sort_order: currentCount + idx,
          uploaded_by: userId,
        } as never);
        if (insertError) throw insertError;
      }
      toast({ title: "Uploaded", description: `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} uploaded` });
      await loadFiles();
    } catch (error: unknown) {
      toast({ title: "Upload failed", description: getErrorMessage(error, "Failed to upload files"), variant: "destructive" });
    } finally {
      setUploadingFolderId(null);
    }
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

  const onDropFolder = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    setDragOverRoot(false);
    const internal = parseInternalDropPayload(e);
    if (internal) {
      if (internal.type === "folder") await reorderFolders(internal.id, folderId);
      if (internal.type === "file") await moveFileToFolder(internal.id, folderId);
      return;
    }
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) await uploadFilesToFolder(droppedFiles, folderId);
  };

  const onRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRoot(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length === 0) return;
    const target = folders[0]?.id;
    if (!target) {
      toast({ title: "No folders", description: "Create a folder first", variant: "destructive" });
      return;
    }
    await uploadFilesToFolder(droppedFiles, target);
  };

  const handleOpenFilePicker = (folderId: string | null) => {
    fileInputFolderRef.current = folderId || folders[0]?.id || null;
    fileInputRef.current?.click();
  };

  const handleHiddenFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    const targetFolderId = fileInputFolderRef.current;
    if (!targetFolderId || selected.length === 0) return;
    await uploadFilesToFolder(selected, targetFolderId);
  };

  const handleCreateFolder = async () => {
    if (!companyId || !userId || !newFolderName.trim()) return;
    setCreatingFolder(true);
    const nextSortOrder = folders.length;
    const { error } = await supabase.from("company_file_folders" as never).insert({
      company_id: companyId,
      name: newFolderName.trim(),
      sort_order: nextSortOrder,
      is_system_folder: false,
      created_by: userId,
    } as never);
    setCreatingFolder(false);
    if (error) {
      toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
      return;
    }
    setNewFolderName("");
    await load();
  };

  const saveFolderRename = async (folderId: string) => {
    const nextName = editingFolderName.trim();
    setEditingFolderId(null);
    if (!nextName) return;
    const { error } = await supabase.from("company_file_folders" as never).update({ name: nextName } as never).eq("id", folderId);
    if (error) {
      toast({ title: "Error", description: "Failed to rename folder", variant: "destructive" });
      return;
    }
    setFolders((prev) => prev.map((folder) => (folder.id === folderId ? { ...folder, name: nextName } : folder)));
  };

  const saveFileRename = async (fileId: string) => {
    const nextName = editingFileName.trim();
    setEditingFileId(null);
    if (!nextName) return;
    const { error } = await supabase
      .from("company_files" as never)
      .update({ file_name: nextName, name: nextName } as never)
      .eq("id", fileId);
    if (error) {
      toast({ title: "Error", description: "Failed to rename file", variant: "destructive" });
      return;
    }
    setFiles((prev) => prev.map((file) => (file.id === fileId ? { ...file, file_name: nextName } : file)));
  };

  const handleDeleteFile = async (file: CompanyFile) => {
    const storagePath = parseStoragePathFromPublicUrl(file.file_url);
    if (storagePath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    }
    const { error } = await supabase.from("company_files" as never).delete().eq("id", file.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete file", variant: "destructive" });
      return;
    }
    setFiles((prev) => prev.filter((item) => item.id !== file.id));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleHiddenFileInputChange} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Company Files</h1>
          <p className="text-sm text-muted-foreground">All Documents</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleOpenFilePicker(null)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Document Library</CardTitle>
          <div className="flex gap-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateFolder();
              }}
            />
            <Button onClick={() => void handleCreateFolder()} disabled={creatingFolder || !newFolderName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              {creatingFolder ? "Creating..." : "New Folder"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "rounded-md border border-dashed p-3 text-sm text-muted-foreground mb-3",
              dragOverRoot && "bg-primary/5 border-primary",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverRoot(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOverRoot(false);
            }}
            onDrop={(e) => void onRootDrop(e)}
          >
            Drag and drop files here or directly onto a folder
          </div>

          <div className="space-y-1">
            {folders.map((folder) => {
              const folderFiles = filesByFolderId[folder.id] || [];
              const isExpanded = expandedFolderIds.has(folder.id);
              return (
                <div key={folder.id} className="rounded-md border">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 cursor-pointer group",
                      dragOverFolderId === folder.id && "bg-primary/5 border border-primary border-dashed rounded-md",
                    )}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(INTERNAL_DND_MIME, JSON.stringify({ type: "folder", id: folder.id } satisfies DragItemPayload));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverFolderId(folder.id);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      if (dragOverFolderId === folder.id) setDragOverFolderId(null);
                    }}
                    onDrop={(e) => void onDropFolder(e, folder.id)}
                    onClick={() =>
                      setExpandedFolderIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(folder.id)) next.delete(folder.id);
                        else next.add(folder.id);
                        return next;
                      })
                    }
                  >
                    {isExpanded ? <FolderOpen className="h-4 w-4 text-primary" /> : <FolderClosed className="h-4 w-4 text-primary" />}
                    {editingFolderId === folder.id ? (
                      <Input
                        autoFocus
                        value={editingFolderName}
                        className="h-7 text-sm"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onBlur={() => void saveFolderRename(folder.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveFolderRename(folder.id);
                          if (e.key === "Escape") setEditingFolderId(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="flex-1 text-left truncate cursor-text hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFolderId(folder.id);
                          setEditingFolderName(folder.name);
                        }}
                      >
                        {folder.name}
                      </button>
                    )}
                    <Badge variant="outline">{folderFiles.length}</Badge>
                    {uploadingFolderId === folder.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenFilePicker(folder.id);
                      }}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="pl-8 pr-2 pb-2 space-y-0.5">
                      {folderFiles.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-1">Empty folder</div>
                      ) : (
                        folderFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/40 group"
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData(
                                INTERNAL_DND_MIME,
                                JSON.stringify({ type: "file", id: file.id, sourceFolderId: file.folder_id } satisfies DragItemPayload),
                              );
                              e.dataTransfer.effectAllowed = "move";
                            }}
                          >
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            {editingFileId === file.id ? (
                              <Input
                                autoFocus
                                value={editingFileName}
                                className="h-6 text-sm"
                                onChange={(e) => setEditingFileName(e.target.value)}
                                onBlur={() => void saveFileRename(file.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void saveFileRename(file.id);
                                  if (e.key === "Escape") setEditingFileId(null);
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                className="flex-1 text-left truncate cursor-text hover:underline"
                                onClick={() => {
                                  setEditingFileId(file.id);
                                  setEditingFileName(file.file_name);
                                }}
                              >
                                {file.file_name}
                              </button>
                            )}
                            <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(file.file_url, "_blank")}>
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => void handleDeleteFile(file)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
