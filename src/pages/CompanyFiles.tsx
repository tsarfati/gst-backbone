import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FolderClosed, FolderOpen, Upload, Plus, FileText, Download, Trash2, Loader2, Share2, Mail, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import FileShareModal from "@/components/FileShareModal";

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
  description?: string | null;
}

interface JobEntry {
  id: string;
  name: string;
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
const LEGACY_SYSTEM_FOLDER_NAMES = ["contracts", "permits", "insurance", "general"];

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
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<CompanyFolder[]>([]);
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [uploadingFolderId, setUploadingFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [shareFiles, setShareFiles] = useState<Array<{ id: string; file_name: string; file_url: string; file_size: number | null }>>([]);
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [jobFileCountByJobId, setJobFileCountByJobId] = useState<Record<string, number>>({});
  const [jobUploadTargetId, setJobUploadTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputFolderRef = useRef<string | null>(null);
  const jobFileInputRef = useRef<HTMLInputElement | null>(null);

  const companyId = currentCompany?.id || null;
  const userId = user?.id || null;
  const displayName = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "User";
  const dropboxFolderName = `Dropbox - ${displayName}`;

  const filesByFolderId = useMemo(() => {
    const grouped: Record<string, CompanyFile[]> = {};
    for (const file of files) {
      const key = file.folder_id || "__unassigned__";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(file);
    }
    return grouped;
  }, [files]);

  const getShareableFile = (file: CompanyFile) => ({
    id: file.id,
    file_name: file.file_name,
    file_url: parseStoragePathFromPublicUrl(file.file_url) || file.file_url,
    file_size: file.file_size ?? null,
  });

  const selectedFiles = useMemo(
    () => files.filter((file) => selectedFileIds.has(file.id)).map(getShareableFile),
    [files, selectedFileIds],
  );

  const syncSystemFolders = useCallback(
    async (existing: CompanyFolder[]): Promise<CompanyFolder[]> => {
      if (!companyId || !userId) return existing;

      let folders = [...existing];
      let jobsFolder = folders.find((folder) => folder.is_system_folder && folder.name.trim().toLowerCase() === "jobs");
      let myDropbox = folders.find((folder) => folder.is_system_folder && folder.name.trim().toLowerCase() === dropboxFolderName.trim().toLowerCase());

      if (!jobsFolder) {
        const { data, error } = await supabase
          .from("company_file_folders" as never)
          .insert({
            company_id: companyId,
            name: "Jobs",
            sort_order: 0,
            is_system_folder: true,
            created_by: userId,
          } as never)
          .select("id, name, sort_order, is_system_folder")
          .single();
        if (!error && data) {
          jobsFolder = data as CompanyFolder;
          folders.push(jobsFolder);
        }
      }

      if (!myDropbox) {
        const { data, error } = await supabase
          .from("company_file_folders" as never)
          .insert({
            company_id: companyId,
            name: dropboxFolderName,
            sort_order: 1,
            is_system_folder: true,
            created_by: userId,
          } as never)
          .select("id, name, sort_order, is_system_folder")
          .single();
        if (!error && data) {
          myDropbox = data as CompanyFolder;
          folders.push(myDropbox);
        }
      }

      if (jobsFolder && myDropbox) {
        const legacyFolders = folders.filter(
          (folder) =>
            folder.is_system_folder &&
            LEGACY_SYSTEM_FOLDER_NAMES.includes(folder.name.trim().toLowerCase()),
        );

        for (const legacyFolder of legacyFolders) {
          await supabase
            .from("company_files" as never)
            .update({ folder_id: myDropbox.id } as never)
            .eq("folder_id", legacyFolder.id);

          await supabase.from("company_file_folders" as never).delete().eq("id", legacyFolder.id);
        }
      }

      const { data: refreshed } = await supabase
        .from("company_file_folders" as never)
        .select("id, name, sort_order, is_system_folder")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true });

      return (refreshed as CompanyFolder[]) || folders;
    },
    [companyId, dropboxFolderName, userId],
  );

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

    return await syncSystemFolders((data as CompanyFolder[]) || []);
  }, [companyId, userId, toast, syncSystemFolders]);

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

  const loadJobs = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("jobs")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) {
      console.error("Error loading jobs for company files:", error);
      setJobs([]);
      return;
    }
    setJobs((data as JobEntry[]) || []);
  }, [companyId]);

  const loadJobFileCounts = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("job_files")
      .select("job_id")
      .eq("company_id", companyId);
    if (error) {
      console.error("Error loading job file counts:", error);
      setJobFileCountByJobId({});
      return;
    }
    const counts: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      const jobId = String(row.job_id || "");
      if (!jobId) return;
      counts[jobId] = (counts[jobId] || 0) + 1;
    });
    setJobFileCountByJobId(counts);
  }, [companyId]);

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
        if (folder.name.trim().toLowerCase() === "jobs") continue;
        const category = categoryForFolderName(folder.name);
        if (!folderByCategory.has(category)) folderByCategory.set(category, folder.id);
      }

      const dropboxFolderId =
        folderRows.find((folder) => folder.name.trim().toLowerCase() === dropboxFolderName.trim().toLowerCase())?.id || null;

      await Promise.all(
        (unassigned as unknown as UnassignedCompanyFile[]).map((file, idx: number) => {
          const targetFolderId =
            folderByCategory.get(String(file.category || "").toLowerCase()) ||
            folderByCategory.get("other") ||
            dropboxFolderId ||
            folderRows.find((folder) => folder.name.trim().toLowerCase() !== "jobs")?.id ||
            folderRows[0]?.id;
          if (!targetFolderId) return Promise.resolve();
          return supabase
            .from("company_files" as never)
            .update({ folder_id: targetFolderId, sort_order: idx } as never)
            .eq("id", file.id);
        }),
      );
    },
    [companyId, dropboxFolderName],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const folderRows = await loadFolders();
      setFolders(folderRows);
      setExpandedFolderIds((prev) => (prev.size > 0 ? prev : new Set(folderRows.map((f) => f.id))));
      await ensureFolderAssignments(folderRows);
      await Promise.all([loadFiles(), loadJobs(), loadJobFileCounts()]);
    } finally {
      setLoading(false);
    }
  }, [loadFolders, ensureFolderAssignments, loadFiles, loadJobs, loadJobFileCounts]);

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

  const ensureJobRootFolderId = async (jobId: string): Promise<string | null> => {
    if (!companyId || !userId) return null;
    const { data: existing, error: existingError } = await supabase
      .from("job_folders")
      .select("id")
      .eq("job_id", jobId)
      .is("parent_folder_id", null)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingError) return null;
    if (existing?.id) return existing.id;

    const { data: created, error: createError } = await supabase
      .from("job_folders")
      .insert({
        job_id: jobId,
        company_id: companyId,
        name: "General",
        is_system_folder: true,
        sort_order: 0,
        parent_folder_id: null,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (createError) return null;
    return (created as any)?.id || null;
  };

  const uploadFilesToJob = async (selectedFiles: File[], jobId: string) => {
    if (!companyId || !userId || selectedFiles.length === 0) return;
    setJobUploadTargetId(jobId);
    try {
      const folderId = await ensureJobRootFolderId(jobId);
      if (!folderId) throw new Error("Could not resolve job folder.");

      for (const file of selectedFiles) {
        const ext = file.name.split(".").pop();
        const path = `${companyId}/${jobId}/${folderId}/${crypto.randomUUID()}.${ext || "file"}`;
        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from("job_files").insert({
          job_id: jobId,
          company_id: companyId,
          folder_id: folderId,
          file_name: file.name,
          original_file_name: file.name,
          file_url: path,
          file_size: file.size,
          file_type: file.type || null,
          uploaded_by: userId,
        } as never);
        if (insertError) throw insertError;
      }

      toast({ title: "Uploaded", description: `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} uploaded to job filing cabinet.` });
      await loadJobFileCounts();
    } catch (error: unknown) {
      toast({ title: "Upload failed", description: getErrorMessage(error, "Failed to upload files to job"), variant: "destructive" });
    } finally {
      setJobUploadTargetId(null);
    }
  };

  const handleJobUploadInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    const targetJobId = jobUploadTargetId;
    if (!targetJobId || selected.length === 0) return;
    await uploadFilesToJob(selected, targetJobId);
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
    setNewFolderOpen(false);
    await load();
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const clearSelection = () => setSelectedFileIds(new Set());

  const downloadFolder = async (folder: CompanyFolder) => {
    const folderFiles = filesByFolderId[folder.id] || [];
    if (folderFiles.length === 0) {
      toast({ title: "No files", description: "This folder has no files to download." });
      return;
    }
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const file of folderFiles) {
        const response = await fetch(file.file_url);
        if (!response.ok) continue;
        const blob = await response.blob();
        zip.file(file.file_name, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${folder.name.replace(/[^a-zA-Z0-9-_ ]/g, "_") || "folder"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to download folder"), variant: "destructive" });
    }
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

  const currentView: "all" | "jobs" | "dropbox" =
    location.pathname.endsWith("/jobs") ? "jobs" : location.pathname.endsWith("/dropbox") ? "dropbox" : "all";
  const jobsFolder = folders.find((folder) => folder.is_system_folder && folder.name.trim().toLowerCase() === "jobs");
  const myDropboxFolder = folders.find(
    (folder) => folder.is_system_folder && folder.name.trim().toLowerCase() === dropboxFolderName.trim().toLowerCase(),
  );
  const visibleFolders = folders.filter((folder) => {
    if (folder.is_system_folder) {
      if (jobsFolder && folder.id === jobsFolder.id) return currentView === "all" || currentView === "jobs";
      if (myDropboxFolder && folder.id === myDropboxFolder.id) return currentView === "all" || currentView === "dropbox";
      return false;
    }
    return currentView === "all";
  });

  return (
    <div className="p-6 space-y-4">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleHiddenFileInputChange} />
      <input ref={jobFileInputRef} type="file" multiple className="hidden" onChange={handleJobUploadInputChange} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Company Files</h1>
          <p className="text-sm text-muted-foreground">All Documents</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setNewFolderOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button variant="outline" onClick={() => handleOpenFilePicker(null)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Library</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedFiles.length > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5">
              <Badge variant="secondary">{selectedFiles.length} selected</Badge>
              <Button size="sm" variant="outline" onClick={() => setShareFiles(selectedFiles)}>
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
            {visibleFolders.map((folder) => {
              const folderFiles = filesByFolderId[folder.id] || [];
              const isExpanded = expandedFolderIds.has(folder.id);
              const isJobsSystemFolder = folder.name.trim().toLowerCase() === "jobs";
              return (
                <div key={folder.id} className="rounded-md border">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-0.5 cursor-pointer group",
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
                    <div className="opacity-0 group-hover:opacity-100 flex items-center">
                      {!isJobsSystemFolder && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFilePicker(folder.id);
                          }}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          void downloadFolder(folder);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          const folderShareFiles = (filesByFolderId[folder.id] || []).map(getShareableFile);
                          if (folderShareFiles.length === 0) {
                            toast({ title: "No files", description: "This folder has no files to share." });
                            return;
                          }
                          setShareFiles(folderShareFiles);
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pl-8 pr-2 pb-1 space-y-0">
                      {isJobsSystemFolder ? (
                        jobs.length === 0 ? (
                          <div className="py-0.5 text-xs text-muted-foreground">No active jobs</div>
                        ) : (
                          jobs.map((job) => (
                            <div key={job.id} className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-muted/40 group">
                              <Link to={`/jobs/${job.id}`} className="flex-1 truncate hover:underline text-sm">
                                {job.name}
                              </Link>
                              <Badge variant="outline">{jobFileCountByJobId[job.id] || 0}</Badge>
                              {jobUploadTargetId === job.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setJobUploadTargetId(job.id);
                                  jobFileInputRef.current?.click();
                                }}
                                title="Upload to Job Filing Cabinet"
                              >
                                <Upload className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))
                        )
                      ) : folderFiles.length === 0 ? (
                        <div className="py-0" />
                      ) : (
                        folderFiles.map((file) => (
                          <div
                            key={file.id}
                            className={cn(
                              "flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-muted/40 group",
                              selectedFileIds.has(file.id) && "bg-primary/5 ring-1 ring-primary/20",
                            )}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData(
                                INTERNAL_DND_MIME,
                                JSON.stringify({ type: "file", id: file.id, sourceFolderId: file.folder_id } satisfies DragItemPayload),
                              );
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => window.open(file.file_url, "_blank")}
                          >
                            <Checkbox
                              checked={selectedFileIds.has(file.id)}
                              onCheckedChange={() => toggleFileSelection(file.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            {editingFileId === file.id ? (
                              <Input
                                autoFocus
                                value={editingFileName}
                                className="h-6 text-sm"
                                onClick={(e) => e.stopPropagation()}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingFileId(file.id);
                                  setEditingFileName(file.file_name);
                                }}
                              >
                                {file.file_name}
                              </button>
                            )}
                            <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(file.file_url, "_blank");
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShareFiles([getShareableFile(file)]);
                                }}
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteFile(file);
                                }}
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

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Enter a name for the new folder.</DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateFolder();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreateFolder()} disabled={creatingFolder || !newFolderName.trim()}>
              {creatingFolder ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shareFiles.length > 0 && (
        <FileShareModal
          open={shareFiles.length > 0}
          onOpenChange={(open) => {
            if (!open) setShareFiles([]);
          }}
          files={shareFiles}
          jobId="company-files"
        />
      )}
    </div>
  );
}
