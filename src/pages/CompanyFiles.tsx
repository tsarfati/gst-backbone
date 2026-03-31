import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FolderClosed, FolderOpen, Upload, Plus, FileText, Download, Loader2, Mail, Share2, ChevronDown, ChevronRight, Lock, ArrowUpDown, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveStorageUrl, uploadFileWithProgress } from "@/utils/storageUtils";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import FileShareModal from "@/components/FileShareModal";
import ZoomableDocumentPreview from "@/components/ZoomableDocumentPreview";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";

interface CompanyFolder {
  id: string;
  name: string;
  sort_order: number;
  is_system_folder: boolean;
  created_by?: string | null;
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
  updated_at?: string | null;
  description?: string | null;
  uploaded_by?: string | null;
}

interface JobEntry {
  id: string;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
}

interface JobCabinetFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
  sort_order: number;
  is_system_folder?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
}

interface JobCabinetFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at?: string | null;
  uploaded_by?: string | null;
}

interface OwnerProfile {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface JobFileStats {
  count: number;
  totalSize: number;
  createdAt: string | null;
  modifiedAt: string | null;
}

interface PreviewState {
  open: boolean;
  title: string;
  url: string | null;
}

interface JobCabinetState {
  loading: boolean;
  folders: JobCabinetFolder[];
  filesByFolderId: Record<string, JobCabinetFile[]>;
}

interface UnassignedCompanyFile {
  id: string;
  category: string | null;
}

type MovableColumnKey = "created" | "modified" | "owner" | "size" | "count" | "actions";
type FileColumnVisibility = Record<MovableColumnKey, boolean>;

type DragItemPayload =
  | { type: "folder"; id: string }
  | { type: "file"; id: string; sourceFolderId: string | null };
type JobDragItemPayload =
  | { type: "job-file"; jobId: string; fileId: string; sourceFolderId: string | null }
  | { type: "job-folder"; jobId: string; folderId: string; sourceParentFolderId: string | null };

const INTERNAL_DND_MIME = "application/x-company-library-item";
const JOB_INTERNAL_DND_MIME = "application/x-company-job-cabinet-item";
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
  if (!bytes) return "0 MB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type SortKey = "name" | "created" | "modified" | "size";
type SortDir = "asc" | "desc";

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString();
};

const compareStrings = (a: string, b: string, dir: SortDir) =>
  dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);

const compareNumbers = (a: number, b: number, dir: SortDir) =>
  dir === "asc" ? a - b : b - a;

const safeText = (value: unknown): string => String(value ?? "");
const normalizedName = (value: unknown): string => safeText(value).trim().toLowerCase();

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
  const { hasAccess, loading: permissionsLoading } = useMenuPermissions();

  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<CompanyFolder[]>([]);
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [uploadingFolderId, setUploadingFolderId] = useState<string | null>(null);
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);
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
  const [selectedCompanyFolderIds, setSelectedCompanyFolderIds] = useState<Set<string>>(new Set());
  const [selectedJobFileKeys, setSelectedJobFileKeys] = useState<Set<string>>(new Set());
  const [selectedJobFolderKeys, setSelectedJobFolderKeys] = useState<Set<string>>(new Set());
  const [shareFiles, setShareFiles] = useState<Array<{ id: string; file_name: string; file_url: string; file_size: number | null }>>([]);
  const [previewState, setPreviewState] = useState<PreviewState>({ open: false, title: "", url: null });
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [jobFileStatsByJobId, setJobFileStatsByJobId] = useState<Record<string, JobFileStats>>({});
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [jobUploadTargetId, setJobUploadTargetId] = useState<string | null>(null);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const [expandedJobFolderKeys, setExpandedJobFolderKeys] = useState<Set<string>>(new Set());
  const [jobCabinetByJobId, setJobCabinetByJobId] = useState<Record<string, JobCabinetState>>({});
  const [editingJobFolderKey, setEditingJobFolderKey] = useState<string | null>(null);
  const [editingJobFolderName, setEditingJobFolderName] = useState("");
  const [editingJobFileKey, setEditingJobFileKey] = useState<string | null>(null);
  const [editingJobFileName, setEditingJobFileName] = useState("");
  const [customizingColumns, setCustomizingColumns] = useState(false);
  const [draggingColumn, setDraggingColumn] = useState<MovableColumnKey | null>(null);
  const [columnOrder, setColumnOrder] = useState<MovableColumnKey[]>([
    "created",
    "modified",
    "owner",
    "size",
    "count",
    "actions",
  ]);
  const [visibleColumns, setVisibleColumns] = useState<FileColumnVisibility>({
    created: true,
    modified: true,
    owner: true,
    size: true,
    count: true,
    actions: true,
  });
  const [ownerProfilesById, setOwnerProfilesById] = useState<Record<string, OwnerProfile>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputFolderRef = useRef<string | null>(null);
  const jobFileInputRef = useRef<HTMLInputElement | null>(null);

  const companyId = currentCompany?.id || null;
  const userId = user?.id || null;
  const displayName = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "User";
  const dropboxFolderName = `Dropbox - ${displayName}`;
  const hasExpandedSections = expandedFolderIds.size > 0 || expandedJobIds.size > 0 || expandedJobFolderKeys.size > 0;
  const canViewCompanyFiles = hasAccess("company-files-view");
  const canUploadCompanyFiles = hasAccess("company-files-upload");
  const canDownloadCompanyFiles = hasAccess("company-files-download");
  const canShareCompanyFiles = hasAccess("company-files-share");
  const canDeleteCompanyFiles = hasAccess("company-files-delete");
  const canViewJobCabinet = hasAccess("jobs-view-filing-cabinet");
  const canUploadJobCabinet = hasAccess("jobs-upload-files");
  const canDownloadJobCabinet = hasAccess("jobs-download-files");
  const canShareJobCabinet = hasAccess("jobs-share-files");
  const canDeleteJobCabinet = hasAccess("jobs-delete-files");

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

  const selectedFiles = useMemo(() => {
    const map = new Map<string, { id: string; file_name: string; file_url: string; file_size: number | null }>();
    files
      .filter((file) => selectedFileIds.has(file.id))
      .map(getShareableFile)
      .forEach((f) => map.set(f.id, f));

    selectedCompanyFolderIds.forEach((folderId) => {
      (filesByFolderId[folderId] || []).map(getShareableFile).forEach((f) => map.set(f.id, f));
    });

    selectedJobFileKeys.forEach((key) => {
      const [jobId, fileId] = key.split("::");
      const cabinet = jobCabinetByJobId[jobId];
      if (!cabinet) return;
      const found = Object.values(cabinet.filesByFolderId).flat().find((f) => f.id === fileId);
      if (!found) return;
      map.set(`job-${jobId}-${found.id}`, {
        id: `job-${jobId}-${found.id}`,
        file_name: found.file_name,
        file_url: found.file_url,
        file_size: found.file_size ?? null,
      });
    });

    selectedJobFolderKeys.forEach((key) => {
      const [jobId, folderId] = key.split("::");
      const cabinet = jobCabinetByJobId[jobId];
      if (!cabinet) return;
      (cabinet.filesByFolderId[folderId] || []).forEach((f) => {
        map.set(`job-${jobId}-${f.id}`, {
          id: `job-${jobId}-${f.id}`,
          file_name: f.file_name,
          file_url: f.file_url,
          file_size: f.file_size ?? null,
        });
      });
    });

    return Array.from(map.values());
  }, [files, selectedFileIds, selectedCompanyFolderIds, filesByFolderId, selectedJobFileKeys, selectedJobFolderKeys, jobCabinetByJobId]);
  const hasAnySelection =
    selectedFileIds.size > 0 ||
    selectedCompanyFolderIds.size > 0 ||
    selectedJobFileKeys.size > 0 ||
    selectedJobFolderKeys.size > 0;

  const ownerIds = useMemo(() => {
    const ids = new Set<string>();
    folders.forEach((folder) => {
      if (folder.created_by) ids.add(folder.created_by);
    });
    files.forEach((file) => {
      if (file.uploaded_by) ids.add(file.uploaded_by);
    });
    Object.values(jobCabinetByJobId).forEach((cabinet) => {
      cabinet.folders.forEach((folder) => {
        if (folder.created_by) ids.add(folder.created_by);
      });
      Object.values(cabinet.filesByFolderId).forEach((jobFiles) => {
        jobFiles.forEach((file) => {
          if (file.uploaded_by) ids.add(file.uploaded_by);
        });
      });
    });
    return Array.from(ids);
  }, [folders, files, jobCabinetByJobId]);

  const syncSystemFolders = useCallback(
    async (existing: CompanyFolder[]): Promise<CompanyFolder[]> => {
      if (!companyId || !userId) return existing;

      let folders = [...existing];
      let jobsFolder = folders.find((folder) => folder.is_system_folder && normalizedName(folder.name) === "jobs");
      let myDropbox = folders.find((folder) => folder.is_system_folder && normalizedName(folder.name) === normalizedName(dropboxFolderName));

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
          .select("id, name, sort_order, is_system_folder, created_by")
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
          .select("id, name, sort_order, is_system_folder, created_by")
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
            LEGACY_SYSTEM_FOLDER_NAMES.includes(normalizedName(folder.name)),
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
        .select("id, name, sort_order, is_system_folder, created_by")
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
      .select("id, name, sort_order, is_system_folder, created_by")
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
      .select("id, folder_id, file_name, file_url, file_size, file_type, category, created_at, updated_at, uploaded_by")
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
      .select("id, name, created_at, updated_at")
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
      .select("job_id, file_size, created_at, updated_at")
      .eq("company_id", companyId);
    if (error) {
      console.error("Error loading job file counts:", error);
      setJobFileStatsByJobId({});
      return;
    }
    const stats: Record<string, JobFileStats> = {};
    (data || []).forEach((row: any) => {
      const jobId = String(row.job_id || "");
      if (!jobId) return;
      if (!stats[jobId]) {
        stats[jobId] = { count: 0, totalSize: 0, createdAt: null, modifiedAt: null };
      }
      const current = stats[jobId];
      current.count += 1;
      current.totalSize += Number(row.file_size || 0);
      const createdAt = row.created_at ? String(row.created_at) : null;
      const modifiedAt = row.updated_at ? String(row.updated_at) : createdAt;
      if (createdAt && (!current.createdAt || createdAt < current.createdAt)) current.createdAt = createdAt;
      if (modifiedAt && (!current.modifiedAt || modifiedAt > current.modifiedAt)) current.modifiedAt = modifiedAt;
    });
    setJobFileStatsByJobId(stats);
  }, [companyId]);

  const loadJobCabinet = useCallback(
    async (jobId: string) => {
      if (!companyId) return;
      setJobCabinetByJobId((prev) => ({
        ...prev,
        [jobId]: {
          loading: true,
          folders: prev[jobId]?.folders || [],
          filesByFolderId: prev[jobId]?.filesByFolderId || {},
        },
      }));

      const [foldersRes, filesRes] = await Promise.all([
        supabase
          .from("job_folders")
          .select("id, name, parent_folder_id, sort_order, is_system_folder, created_at, updated_at, created_by")
          .eq("job_id", jobId)
          .eq("company_id", companyId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("job_files")
          .select("id, file_name, file_url, file_size, file_type, folder_id, created_at, updated_at, uploaded_by")
          .eq("job_id", jobId)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
      ]);

      if (foldersRes.error || filesRes.error) {
        console.error("Error loading job filing cabinet:", foldersRes.error || filesRes.error);
        setJobCabinetByJobId((prev) => ({
          ...prev,
          [jobId]: {
            loading: false,
            folders: prev[jobId]?.folders || [],
            filesByFolderId: prev[jobId]?.filesByFolderId || {},
          },
        }));
        return;
      }

      const grouped: Record<string, JobCabinetFile[]> = {};
      ((filesRes.data as JobCabinetFile[]) || []).forEach((file) => {
        const key = file.folder_id || "__unassigned__";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(file);
      });

      setJobCabinetByJobId((prev) => ({
        ...prev,
        [jobId]: {
          loading: false,
          folders: ((foldersRes.data as JobCabinetFolder[]) || []).sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
          ),
          filesByFolderId: grouped,
        },
      }));
    },
    [companyId],
  );

  const openJobCabinetFile = useCallback(
    async (storagePath: string) => {
      if (!storagePath) return;
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 120);
      if (error || !data?.signedUrl) {
        toast({ title: "Error", description: "Failed to open file", variant: "destructive" });
        return;
      }
      setPreviewState({ open: true, title: "File Preview", url: data.signedUrl });
    },
    [toast],
  );

  const openCompanyFilePreview = useCallback(
    async (file: CompanyFile) => {
      const resolved = await resolveStorageUrl(STORAGE_BUCKET, file.file_url);
      if (!resolved) {
        toast({ title: "Error", description: "Failed to load preview", variant: "destructive" });
        return;
      }
      setPreviewState({ open: true, title: file.file_name, url: resolved });
    },
    [toast],
  );

  const downloadCompanyFile = useCallback(
    async (file: CompanyFile) => {
      if (!canDownloadCompanyFiles) {
        toast({ title: "No access", description: "You do not have permission to download company files.", variant: "destructive" });
        return;
      }
      try {
        const resolved = await resolveStorageUrl(STORAGE_BUCKET, file.file_url);
        if (!resolved) throw new Error("Failed to resolve file URL");
        const response = await fetch(resolved);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = file.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } catch (error) {
        toast({ title: "Error", description: getErrorMessage(error, "Failed to download file"), variant: "destructive" });
      }
    },
    [canDownloadCompanyFiles, toast],
  );

  const downloadJobFile = useCallback(
    async (file: JobCabinetFile) => {
      if (!canDownloadJobCabinet) {
        toast({ title: "No access", description: "You do not have permission to download job filing cabinet files.", variant: "destructive" });
        return;
      }
      try {
        const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.file_url, 120);
        if (error || !data?.signedUrl) throw new Error("Failed to resolve file URL");
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = file.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } catch (error) {
        toast({ title: "Error", description: getErrorMessage(error, "Failed to download file"), variant: "destructive" });
      }
    },
    [canDownloadJobCabinet, toast],
  );

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
        folderRows.find((folder) => normalizedName(folder.name) === normalizedName(dropboxFolderName))?.id || null;

      await Promise.all(
        (unassigned as unknown as UnassignedCompanyFile[]).map((file, idx: number) => {
          const targetFolderId =
            folderByCategory.get(String(file.category || "").toLowerCase()) ||
            folderByCategory.get("other") ||
            dropboxFolderId ||
            folderRows.find((folder) => normalizedName(folder.name) !== "jobs")?.id ||
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

  useEffect(() => {
    const key = `company-files-columns:${companyId || "default"}:${userId || "anon"}`;
    const saved = window.localStorage.getItem(key);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        visible?: Partial<FileColumnVisibility>;
        order?: MovableColumnKey[];
      };
      const savedVisible = parsed?.visible ?? (parsed as Partial<FileColumnVisibility>);
      setVisibleColumns((prev) => ({
        created: typeof savedVisible.created === "boolean" ? savedVisible.created : prev.created,
        modified: typeof savedVisible.modified === "boolean" ? savedVisible.modified : prev.modified,
        owner: typeof savedVisible.owner === "boolean" ? savedVisible.owner : prev.owner,
        size: typeof savedVisible.size === "boolean" ? savedVisible.size : prev.size,
        count: typeof savedVisible.count === "boolean" ? savedVisible.count : prev.count,
        actions: typeof savedVisible.actions === "boolean" ? savedVisible.actions : prev.actions,
      }));
      if (Array.isArray(parsed?.order)) {
        const allowed: MovableColumnKey[] = ["created", "modified", "owner", "size", "count", "actions"];
        const normalized = parsed.order.filter((c): c is MovableColumnKey => allowed.includes(c));
        if (normalized.length === allowed.length) {
          setColumnOrder(normalized);
        }
      }
    } catch {
      // ignore malformed settings
    }
  }, [companyId, userId]);

  useEffect(() => {
    const key = `company-files-columns:${companyId || "default"}:${userId || "anon"}`;
    window.localStorage.setItem(
      key,
      JSON.stringify({
        visible: visibleColumns,
        order: columnOrder,
      }),
    );
  }, [visibleColumns, columnOrder, companyId, userId]);

  useEffect(() => {
    if (ownerIds.length === 0) {
      setOwnerProfilesById({});
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, display_name, avatar_url")
        .in("user_id", ownerIds);
      if (cancelled) return;
      if (error) {
        console.error("Error loading owner profiles:", error);
        return;
      }
      const mapped: Record<string, OwnerProfile> = {};
      (data || []).forEach((row: any) => {
        mapped[row.user_id] = row as OwnerProfile;
      });
      setOwnerProfilesById(mapped);
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerIds]);

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
    if (!canUploadCompanyFiles) {
      toast({ title: "No access", description: "You do not have permission to upload company files.", variant: "destructive" });
      return;
    }
    if (!companyId || !userId || selectedFiles.length === 0) return;
    setUploadingFolderId(targetFolderId);
    setUploadProgressPercent(0);
    const targetFolder = folders.find((folder) => folder.id === targetFolderId);
    const category = categoryForFolderName(targetFolder?.name || "General");
    const currentCount = (filesByFolderId[targetFolderId] || []).length;

    try {
      for (let idx = 0; idx < selectedFiles.length; idx += 1) {
        const file = selectedFiles[idx];
        const path = `${companyId}/company-files/${targetFolderId}/${Date.now()}_${file.name}`;
        await uploadFileWithProgress({
          bucketName: STORAGE_BUCKET,
          filePath: path,
          file,
          onProgress: (percent) => {
            const overall = ((idx + percent / 100) / selectedFiles.length) * 100;
            setUploadProgressPercent(Math.round(overall));
          },
        });
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
      setTimeout(() => setUploadProgressPercent(0), 250);
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
    if (!canUploadJobCabinet) {
      toast({ title: "No access", description: "You do not have permission to upload job filing cabinet files.", variant: "destructive" });
      return;
    }
    if (!companyId || !userId || selectedFiles.length === 0) return;
    setJobUploadTargetId(jobId);
    setUploadProgressPercent(0);
    try {
      const folderId = await ensureJobRootFolderId(jobId);
      if (!folderId) throw new Error("Could not resolve job folder.");

      for (let idx = 0; idx < selectedFiles.length; idx += 1) {
        const file = selectedFiles[idx];
        const ext = file.name.split(".").pop();
        const path = `${companyId}/${jobId}/${folderId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext || "file"}`;
        await uploadFileWithProgress({
          bucketName: STORAGE_BUCKET,
          filePath: path,
          file,
          onProgress: (percent) => {
            const overall = ((idx + percent / 100) / selectedFiles.length) * 100;
            setUploadProgressPercent(Math.round(overall));
          },
        });
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
      if (expandedJobIds.has(jobId) || jobCabinetByJobId[jobId]) {
        await loadJobCabinet(jobId);
      }
    } catch (error: unknown) {
      toast({ title: "Upload failed", description: getErrorMessage(error, "Failed to upload files to job"), variant: "destructive" });
    } finally {
      setJobUploadTargetId(null);
      setTimeout(() => setUploadProgressPercent(0), 250);
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

  const toggleCompanyFolderSelection = (folderId: string) => {
    setSelectedCompanyFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const toggleJobFileSelection = (jobId: string, fileId: string) => {
    const key = `${jobId}::${fileId}`;
    setSelectedJobFileKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleJobFolderSelection = (jobId: string, folderId: string) => {
    const key = `${jobId}::${folderId}`;
    setSelectedJobFolderKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const downloadFolder = async (folder: CompanyFolder) => {
    if (!canDownloadCompanyFiles) {
      toast({ title: "No access", description: "You do not have permission to download company folders.", variant: "destructive" });
      return;
    }
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

  const downloadJobFolder = async (jobId: string, folderId: string, folderName: string) => {
    if (!canDownloadJobCabinet) {
      toast({ title: "No access", description: "You do not have permission to download job filing cabinet folders.", variant: "destructive" });
      return;
    }
    const cabinet = jobCabinetByJobId[jobId];
    if (!cabinet) return;
    const folderFiles = cabinet.filesByFolderId[folderId] || [];
    if (folderFiles.length === 0) {
      toast({ title: "No files", description: "This folder has no files to download." });
      return;
    }
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const file of folderFiles) {
        const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.file_url, 120);
        if (!data?.signedUrl) continue;
        const response = await fetch(data.signedUrl);
        if (!response.ok) continue;
        const blob = await response.blob();
        zip.file(file.file_name, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${folderName.replace(/[^a-zA-Z0-9-_ ]/g, "_") || "folder"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to download folder"), variant: "destructive" });
    }
  };

  const downloadSelectedFiles = async () => {
    if (!canDownloadCompanyFiles) {
      toast({ title: "No access", description: "You do not have permission to download selected files.", variant: "destructive" });
      return;
    }
    if (selectedFiles.length === 0) return;
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const file of selectedFiles) {
        const isAbsoluteUrl = /^https?:\/\//i.test(file.file_url);
        let sourceUrl: string | null = null;
        if (isAbsoluteUrl) {
          sourceUrl = file.file_url;
        } else {
          const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.file_url, 120);
          sourceUrl = data?.signedUrl || null;
        }
        if (!sourceUrl) continue;
        const response = await fetch(sourceUrl);
        if (!response.ok) continue;
        const blob = await response.blob();
        zip.file(file.file_name, blob);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "selected-files.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to download selected files"), variant: "destructive" });
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

  const saveJobFolderRename = async (jobId: string, folderId: string) => {
    const nextName = editingJobFolderName.trim();
    setEditingJobFolderKey(null);
    if (!nextName) return;
    const { error } = await supabase.from("job_folders").update({ name: nextName }).eq("id", folderId).eq("job_id", jobId);
    if (error) {
      toast({ title: "Error", description: "Failed to rename folder", variant: "destructive" });
      return;
    }
    await loadJobCabinet(jobId);
  };

  const saveJobFileRename = async (jobId: string, fileId: string) => {
    const nextName = editingJobFileName.trim();
    setEditingJobFileKey(null);
    if (!nextName) return;
    const { error } = await supabase.from("job_files").update({ file_name: nextName }).eq("id", fileId).eq("job_id", jobId);
    if (error) {
      toast({ title: "Error", description: "Failed to rename file", variant: "destructive" });
      return;
    }
    await loadJobCabinet(jobId);
  };

  const moveJobFileToFolder = async (jobId: string, fileId: string, targetFolderId: string | null) => {
    const { error } = await supabase
      .from("job_files")
      .update({ folder_id: targetFolderId })
      .eq("id", fileId)
      .eq("job_id", jobId);
    if (error) {
      toast({ title: "Error", description: "Failed to move file", variant: "destructive" });
      return;
    }
    await loadJobCabinet(jobId);
  };

  const moveJobFolderToParent = async (jobId: string, folderId: string, targetParentFolderId: string | null) => {
    if (folderId === targetParentFolderId) return;
    const { error } = await supabase
      .from("job_folders")
      .update({ parent_folder_id: targetParentFolderId })
      .eq("id", folderId)
      .eq("job_id", jobId);
    if (error) {
      toast({ title: "Error", description: "Failed to move folder", variant: "destructive" });
      return;
    }
    await loadJobCabinet(jobId);
  };

  const parseJobDropPayload = (e: React.DragEvent): JobDragItemPayload | null => {
    try {
      const raw = e.dataTransfer.getData(JOB_INTERNAL_DND_MIME);
      if (!raw) return null;
      return JSON.parse(raw) as JobDragItemPayload;
    } catch {
      return null;
    }
  };

  const handleDeleteFile = async (file: CompanyFile) => {
    if (!canDeleteCompanyFiles) {
      toast({ title: "No access", description: "You do not have permission to delete company files.", variant: "destructive" });
      return;
    }
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

  const currentView: "all" | "jobs" | "dropbox" =
    location.pathname.endsWith("/jobs") ? "jobs" : location.pathname.endsWith("/dropbox") ? "dropbox" : "all";
  const jobsFolder = folders.find((folder) => folder.is_system_folder && normalizedName(folder.name) === "jobs");
  const myDropboxFolder = folders.find(
    (folder) => folder.is_system_folder && normalizedName(folder.name) === normalizedName(dropboxFolderName),
  );
  const visibleFolders = folders.filter((folder) => {
    if (folder.is_system_folder) {
      if (jobsFolder && folder.id === jobsFolder.id) return currentView === "all" || currentView === "jobs";
      if (myDropboxFolder && folder.id === myDropboxFolder.id) return currentView === "all" || currentView === "dropbox";
      return false;
    }
    return currentView === "all";
  });
  const onSort = (key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  };
  const compareBySort = (
    aName: string,
    bName: string,
    aCreated?: string | null,
    bCreated?: string | null,
    aModified?: string | null,
    bModified?: string | null,
    aSize?: number | null,
    bSize?: number | null,
  ) => {
    if (sortKey === "name") return compareStrings(safeText(aName).toLowerCase(), safeText(bName).toLowerCase(), sortDir);
    if (sortKey === "created") return compareNumbers(new Date(aCreated || 0).getTime(), new Date(bCreated || 0).getTime(), sortDir);
    if (sortKey === "modified") return compareNumbers(new Date(aModified || 0).getTime(), new Date(bModified || 0).getTime(), sortDir);
    return compareNumbers(Number(aSize || 0), Number(bSize || 0), sortDir);
  };
  const companyFolderStatsById = useMemo(() => {
    const map: Record<string, { size: number; createdAt: string | null; modifiedAt: string | null }> = {};
    folders.forEach((folder) => {
      const folderFiles = filesByFolderId[folder.id] || [];
      let size = 0;
      let createdAt: string | null = null;
      let modifiedAt: string | null = null;
      folderFiles.forEach((file) => {
        size += Number(file.file_size || 0);
        const created = file.created_at || null;
        const modified = file.updated_at || file.created_at || null;
        if (created && (!createdAt || created < createdAt)) createdAt = created;
        if (modified && (!modifiedAt || modified > modifiedAt)) modifiedAt = modified;
      });
      map[folder.id] = { size, createdAt, modifiedAt };
    });
    return map;
  }, [folders, filesByFolderId]);
  const sortedVisibleFolders = useMemo(() => {
    return [...visibleFolders].sort((a, b) => {
      if (a.is_system_folder !== b.is_system_folder) return a.is_system_folder ? -1 : 1;
      return compareBySort(
        a.name,
        b.name,
        companyFolderStatsById[a.id]?.createdAt,
        companyFolderStatsById[b.id]?.createdAt,
        companyFolderStatsById[a.id]?.modifiedAt,
        companyFolderStatsById[b.id]?.modifiedAt,
        companyFolderStatsById[a.id]?.size,
        companyFolderStatsById[b.id]?.size,
      );
    });
  }, [visibleFolders, companyFolderStatsById, sortKey, sortDir]);
  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      return compareBySort(
        a.name,
        b.name,
        jobFileStatsByJobId[a.id]?.createdAt || a.created_at,
        jobFileStatsByJobId[b.id]?.createdAt || b.created_at,
        jobFileStatsByJobId[a.id]?.modifiedAt || a.updated_at,
        jobFileStatsByJobId[b.id]?.modifiedAt || b.updated_at,
        jobFileStatsByJobId[a.id]?.totalSize,
        jobFileStatsByJobId[b.id]?.totalSize,
      );
    });
  }, [jobs, jobFileStatsByJobId, sortKey, sortDir]);

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      const isOpening = !next.has(jobId);
      if (isOpening) next.add(jobId);
      else next.delete(jobId);
      if (isOpening && !jobCabinetByJobId[jobId]) {
        void loadJobCabinet(jobId);
      }
      return next;
    });
  };

  const toggleJobFolderExpansion = (jobId: string, folderId: string) => {
    const key = `${jobId}:${folderId}`;
    setExpandedJobFolderKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderOwnerCell = (ownerUserId?: string | null) => {
    if (!ownerUserId) {
      return <span className="text-[11px] text-muted-foreground">-</span>;
    }
    const owner = ownerProfilesById[ownerUserId];
    const label =
      owner?.display_name ||
      [owner?.first_name, owner?.last_name].filter(Boolean).join(" ") ||
      ownerUserId.slice(0, 8);
    const initials = label
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";

    return (
      <span className="inline-flex items-center gap-2 truncate text-[11px] text-muted-foreground">
        {owner?.avatar_url ? (
          <img src={owner.avatar_url} alt={label} className="h-5 w-5 rounded-full border object-cover" />
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border bg-muted text-[10px]">
            {initials}
          </span>
        )}
        <span className="truncate">{label}</span>
      </span>
    );
  };

  const columnLabel: Record<MovableColumnKey, string> = {
    created: "Created",
    modified: "Modified",
    owner: "Owner",
    size: "Size",
    count: "Count",
    actions: "Actions",
  };

  const columnWidthClass: Record<MovableColumnKey, string> = {
    created: "w-44",
    modified: "w-44",
    owner: "w-36",
    size: "w-28",
    count: "w-14",
    actions: "w-16",
  };

  const renderRowColumns = (
    data: {
      created?: string | null;
      modified?: string | null;
      ownerId?: string | null;
      sizeText?: string;
      count?: number | string;
      actions?: React.ReactNode;
    },
  ) =>
    columnOrder.map((columnKey) => {
      if (!visibleColumns[columnKey]) return null;
      if (columnKey === "created") {
        return (
          <span key={columnKey} className={`${columnWidthClass[columnKey]} text-xs text-muted-foreground tabular-nums`}>
            {formatDateTime(data.created)}
          </span>
        );
      }
      if (columnKey === "modified") {
        return (
          <span key={columnKey} className={`${columnWidthClass[columnKey]} text-xs text-muted-foreground tabular-nums`}>
            {formatDateTime(data.modified)}
          </span>
        );
      }
      if (columnKey === "owner") {
        return (
          <span key={columnKey} className={`${columnWidthClass[columnKey]} shrink-0`}>
            {renderOwnerCell(data.ownerId)}
          </span>
        );
      }
      if (columnKey === "size") {
        return (
          <span key={columnKey} className={`${columnWidthClass[columnKey]} text-xs text-muted-foreground text-right tabular-nums`}>
            {data.sizeText || "0 MB"}
          </span>
        );
      }
      if (columnKey === "count") {
        return (
          <span key={columnKey} className={`${columnWidthClass[columnKey]} shrink-0 flex justify-end`}>
            <Badge variant="outline" className="min-w-10 justify-center tabular-nums">
              {data.count ?? 0}
            </Badge>
          </span>
        );
      }
      return (
        <span key={columnKey} className={`${columnWidthClass[columnKey]} shrink-0 flex items-center justify-end`}>
          {data.actions ?? null}
        </span>
      );
    });

  const renderJobFiles = (jobId: string, folderId: string | null, depth: number) => {
    const cabinet = jobCabinetByJobId[jobId];
    if (!cabinet) return null;
    const key = folderId || "__unassigned__";
    const folderFiles = [...(cabinet.filesByFolderId[key] || [])].sort((a, b) =>
      compareBySort(a.file_name, b.file_name, a.created_at, b.created_at, a.updated_at || a.created_at, b.updated_at || b.created_at, a.file_size, b.file_size),
    );
    return folderFiles.map((file) => (
      <div
        key={file.id}
        className={cn(
          "flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-muted/40 group cursor-pointer",
          selectedJobFileKeys.has(`${jobId}::${file.id}`) && "bg-primary/5 ring-1 ring-primary/20",
        )}
        onClick={() => void openJobCabinetFile(file.file_url)}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData(
            JOB_INTERNAL_DND_MIME,
            JSON.stringify({
              type: "job-file",
              jobId,
              fileId: file.id,
              sourceFolderId: folderId,
            } satisfies JobDragItemPayload),
          );
          e.dataTransfer.effectAllowed = "move";
        }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0" style={{ paddingLeft: `${depth * 14 + 8}px` }}>
            <Checkbox
              checked={selectedJobFileKeys.has(`${jobId}::${file.id}`)}
              onCheckedChange={() => toggleJobFileSelection(jobId, file.id)}
              onClick={(e) => e.stopPropagation()}
            />
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {editingJobFileKey === `${jobId}::${file.id}` ? (
            <Input
              autoFocus
              value={editingJobFileName}
              className="h-6 text-xs"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setEditingJobFileName(e.target.value)}
              onBlur={() => void saveJobFileRename(jobId, file.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveJobFileRename(jobId, file.id);
                if (e.key === "Escape") setEditingJobFileKey(null);
              }}
            />
          ) : (
            <button
              type="button"
              className="flex-1 truncate text-xs text-left hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setEditingJobFileKey(`${jobId}::${file.id}`);
                setEditingJobFileName(file.file_name);
              }}
            >
                {file.file_name}
              </button>
            )}
          </div>
        {renderRowColumns({
          created: file.created_at,
          modified: file.updated_at || file.created_at,
          ownerId: file.uploaded_by,
          sizeText: formatFileSize(file.file_size),
          count: 1,
          actions: (
            <div className="opacity-0 group-hover:opacity-100 flex items-center">
              {canShareJobCabinet && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShareFiles([{ id: `job-${jobId}-${file.id}`, file_name: file.file_name, file_url: file.file_url, file_size: file.file_size ?? null }]);
                  }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {canDownloadJobCabinet && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    void downloadJobFile(file);
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ),
        })}
        <span className="w-24 shrink-0" />
      </div>
    ));
  };

  const renderJobFolderTree = (jobId: string, parentFolderId: string | null, depth: number): JSX.Element[] => {
    const cabinet = jobCabinetByJobId[jobId];
    if (!cabinet) return [];
    const children = cabinet.folders
      .filter((f) => (f.parent_folder_id || null) === parentFolderId)
      .sort((a, b) => {
        if (Boolean(a.is_system_folder) !== Boolean(b.is_system_folder)) return a.is_system_folder ? -1 : 1;
        return compareBySort(
          a.name,
          b.name,
          a.created_at,
          b.created_at,
          a.updated_at || a.created_at,
          b.updated_at || b.created_at,
          (cabinet.filesByFolderId[a.id] || []).reduce((sum, file) => sum + Number(file.file_size || 0), 0),
          (cabinet.filesByFolderId[b.id] || []).reduce((sum, file) => sum + Number(file.file_size || 0), 0),
        );
      });

    return children.flatMap((folder) => {
      const folderKey = `${jobId}:${folder.id}`;
      const isExpanded = expandedJobFolderKeys.has(folderKey);
      const childCount = cabinet.folders.filter((f) => f.parent_folder_id === folder.id).length;
      const fileCount = (cabinet.filesByFolderId[folder.id] || []).length;
      const folderSize = (cabinet.filesByFolderId[folder.id] || []).reduce((sum, file) => sum + Number(file.file_size || 0), 0);
      return [
        <div
          key={folderKey}
          className={cn(
            "flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-muted/40 cursor-pointer group",
            selectedJobFolderKeys.has(`${jobId}::${folder.id}`) && "bg-primary/5 ring-1 ring-primary/20",
          )}
          onClick={() => toggleJobFolderExpansion(jobId, folder.id)}
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData(
              JOB_INTERNAL_DND_MIME,
              JSON.stringify({
                type: "job-folder",
                jobId,
                folderId: folder.id,
                sourceParentFolderId: parentFolderId,
              } satisfies JobDragItemPayload),
            );
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const payload = parseJobDropPayload(e);
            if (!payload || payload.jobId !== jobId) return;
            if (payload.type === "job-file") {
              void moveJobFileToFolder(jobId, payload.fileId, folder.id);
              return;
            }
            if (payload.type === "job-folder") {
              void moveJobFolderToParent(jobId, payload.folderId, folder.id);
            }
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0" style={{ paddingLeft: `${depth * 14 + 8}px` }}>
            <Checkbox
              checked={selectedJobFolderKeys.has(`${jobId}::${folder.id}`)}
              onCheckedChange={() => toggleJobFolderSelection(jobId, folder.id)}
              onClick={(e) => e.stopPropagation()}
            />
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            {isExpanded ? <FolderOpen className="h-3.5 w-3.5 text-primary" /> : <FolderClosed className="h-3.5 w-3.5 text-primary" />}
            {editingJobFolderKey === `${jobId}::${folder.id}` ? (
              <Input
                autoFocus
                value={editingJobFolderName}
                className="h-6 text-xs"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditingJobFolderName(e.target.value)}
                onBlur={() => void saveJobFolderRename(jobId, folder.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveJobFolderRename(jobId, folder.id);
                  if (e.key === "Escape") setEditingJobFolderKey(null);
                }}
              />
            ) : (
              <span className="flex-1 min-w-0">
                <button
                  type="button"
                  className="inline-block max-w-full truncate text-xs text-left hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingJobFolderKey(`${jobId}::${folder.id}`);
                    setEditingJobFolderName(folder.name);
                  }}
                >
                  {folder.name}
                </button>
              </span>
            )}
          </div>
          {renderRowColumns({
            created: folder.created_at,
            modified: folder.updated_at || folder.created_at,
            ownerId: folder.created_by,
            sizeText: formatFileSize(folderSize),
            count: fileCount + childCount,
            actions: (
              <div className="opacity-0 group-hover:opacity-100 flex items-center">
                {canShareJobCabinet && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      const folderShareFiles = (cabinet.filesByFolderId[folder.id] || []).map((f) => ({
                        id: `job-${jobId}-${f.id}`,
                        file_name: f.file_name,
                        file_url: f.file_url,
                        file_size: f.file_size ?? null,
                      }));
                      setShareFiles(folderShareFiles);
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canDownloadJobCabinet && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      void downloadJobFolder(jobId, folder.id, folder.name);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ),
          })}
          <span className="w-24 shrink-0" />
        </div>,
        ...(isExpanded ? renderJobFiles(jobId, folder.id, depth + 1) : []),
        ...(isExpanded ? renderJobFolderTree(jobId, folder.id, depth + 1) : []),
      ];
    });
  };

  if (loading || permissionsLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canViewCompanyFiles) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You do not have permission to view Company Files.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleHiddenFileInputChange} />
      <input ref={jobFileInputRef} type="file" multiple className="hidden" onChange={handleJobUploadInputChange} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Company Files</h1>
          <p className="text-sm text-muted-foreground">All Documents</p>
        </div>
        <div className="flex items-center gap-2">
          {hasAnySelection && (
            <>
              <Badge variant="secondary">{selectedFiles.length} selected</Badge>
              {canShareCompanyFiles && (
                <Button size="sm" variant="outline" disabled={selectedFiles.length === 0} onClick={() => setShareFiles(selectedFiles)}>
                  <Mail className="h-4 w-4 mr-1.5" />
                  Email Selected
                </Button>
              )}
              {canDownloadCompanyFiles && (
                <Button size="sm" variant="outline" disabled={selectedFiles.length === 0} onClick={() => void downloadSelectedFiles()}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download Selected
                </Button>
              )}
            </>
          )}
          <Button variant="outline" onClick={() => setNewFolderOpen(true)} disabled={!canUploadCompanyFiles}>
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button variant="outline" onClick={() => handleOpenFilePicker(null)} disabled={!canUploadCompanyFiles}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
          <Button
            variant="outline"
            disabled={!hasExpandedSections}
            onClick={() => {
              setExpandedFolderIds(new Set());
              setExpandedJobIds(new Set());
              setExpandedJobFolderKeys(new Set());
            }}
          >
            Collapse All
          </Button>
          <Button variant={customizingColumns ? "default" : "outline"} onClick={() => setCustomizingColumns((prev) => !prev)}>
            Customize Columns
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div
            className={cn("relative min-h-[480px] rounded-md", dragOverRoot && "bg-primary/5")}
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
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-3">
              <span className="text-sm md:text-base font-medium text-muted-foreground/20">
                Drag files here or onto a folder
              </span>
            </div>

            <div className="relative space-y-0.5">
            <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground border-b">
              <span className="flex-1 inline-flex items-center gap-2">
                {customizingColumns && <Checkbox checked disabled />}
                <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort("name")}>
                  Name
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </span>
              {columnOrder.map((columnKey) => {
                const isVisible = visibleColumns[columnKey];
                if (!isVisible && !customizingColumns) return null;
                const widthClass = columnWidthClass[columnKey];
                const allowSort = columnKey === "created" || columnKey === "modified" || columnKey === "size";
                return (
                  <span
                    key={columnKey}
                    className={cn(widthClass, "shrink-0 inline-flex items-center gap-1", !isVisible && customizingColumns && "opacity-50")}
                    draggable={customizingColumns}
                    onDragStart={() => setDraggingColumn(columnKey)}
                    onDragOver={(e) => {
                      if (!customizingColumns) return;
                      e.preventDefault();
                    }}
                    onDrop={() => {
                      if (!customizingColumns || !draggingColumn || draggingColumn === columnKey) return;
                      setColumnOrder((prev) => {
                        const next = [...prev];
                        const from = next.indexOf(draggingColumn);
                        const to = next.indexOf(columnKey);
                        if (from === -1 || to === -1) return prev;
                        next.splice(from, 1);
                        next.splice(to, 0, draggingColumn);
                        return next;
                      });
                      setDraggingColumn(null);
                    }}
                    onDragEnd={() => setDraggingColumn(null)}
                  >
                    {customizingColumns && (
                      <>
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={(checked) =>
                            setVisibleColumns((prev) => ({ ...prev, [columnKey]: checked === true }))
                          }
                        />
                        <GripVertical className="h-3.5 w-3.5 opacity-70" />
                      </>
                    )}
                    {allowSort ? (
                      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(columnKey as "created" | "modified" | "size")}>
                        {columnLabel[columnKey]}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span>{columnLabel[columnKey]}</span>
                    )}
                  </span>
                );
              })}
              <span className="w-24 shrink-0 inline-flex items-center gap-2 justify-end">
                {customizingColumns && <Checkbox checked disabled />}
                <span>Type</span>
              </span>
            </div>
            {sortedVisibleFolders.map((folder) => {
              const folderFiles = filesByFolderId[folder.id] || [];
              const isExpanded = expandedFolderIds.has(folder.id);
              const isJobsSystemFolder = folder.name.trim().toLowerCase() === "jobs";
              const folderBadgeCount = isJobsSystemFolder ? jobs.length : folderFiles.length;
              const folderCreatedAt = companyFolderStatsById[folder.id]?.createdAt || null;
              const folderModifiedAt = companyFolderStatsById[folder.id]?.modifiedAt || null;
              const folderSize = companyFolderStatsById[folder.id]?.size || 0;
              return (
                <div key={folder.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-0.5 rounded-md cursor-pointer group hover:bg-muted/40",
                      dragOverFolderId === folder.id && "bg-primary/5 border border-primary border-dashed",
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
                    <Checkbox
                      checked={selectedCompanyFolderIds.has(folder.id)}
                      onCheckedChange={() => toggleCompanyFolderSelection(folder.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
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
                      <span className="flex-1 min-w-0">
                        <button
                          type="button"
                          className="inline-block max-w-full truncate text-left cursor-text hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFolderId(folder.id);
                            setEditingFolderName(folder.name);
                          }}
                        >
                          {folder.name}
                        </button>
                      </span>
                    )}
                    {renderRowColumns({
                      created: folderCreatedAt,
                      modified: folderModifiedAt,
                      ownerId: folder.created_by,
                      sizeText: formatFileSize(folderSize),
                      count: folderBadgeCount,
                      actions: (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center">
                          {uploadingFolderId === folder.id ? (
                            <div className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>{uploadProgressPercent}%</span>
                            </div>
                          ) : null}
                          {canShareCompanyFiles && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={folderFiles.length === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShareFiles(folderFiles.map(getShareableFile));
                              }}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canDownloadCompanyFiles && (
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
                          )}
                        </div>
                      ),
                    })}
                    <span className="w-24 shrink-0 flex justify-end">
                      {folder.is_system_folder ? (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          System
                        </Badge>
                      ) : null}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="pl-8 pr-2 pb-1 space-y-0">
                      {isJobsSystemFolder ? (
                        !canViewJobCabinet ? (
                          <div className="py-0.5 text-xs text-muted-foreground">No permission to view job filing cabinet</div>
                        ) : (
                        jobs.length === 0 ? (
                          <div className="py-0.5 text-xs text-muted-foreground">No active jobs</div>
                        ) : (
                          sortedJobs.map((job) => (
                            <div key={job.id} className="space-y-0.5">
                              <div
                                className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-muted/40 group cursor-pointer"
                                onClick={() => toggleJobExpansion(job.id)}
                              >
                                {expandedJobIds.has(job.id) ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {expandedJobIds.has(job.id) ? (
                                  <FolderOpen className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <FolderClosed className="h-3.5 w-3.5 text-primary" />
                                )}
                                <span className="flex-1 truncate text-sm">{job.name}</span>
                                {renderRowColumns({
                                  created: jobFileStatsByJobId[job.id]?.createdAt || job.created_at,
                                  modified: jobFileStatsByJobId[job.id]?.modifiedAt || job.updated_at,
                                  ownerId: null,
                                  sizeText: formatFileSize(jobFileStatsByJobId[job.id]?.totalSize || 0),
                                  count: jobFileStatsByJobId[job.id]?.count || 0,
                                  actions: jobUploadTargetId === job.id ? (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      <span>{uploadProgressPercent}%</span>
                                    </div>
                                  ) : null,
                                })}
                                <span className="w-24 shrink-0" />
                              </div>

                              {expandedJobIds.has(job.id) && (
                                <div
                                  className="pl-2 pb-1 space-y-0.5"
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const payload = parseJobDropPayload(e);
                                    if (!payload || payload.jobId !== job.id) return;
                                    if (payload.type === "job-file") {
                                      void moveJobFileToFolder(job.id, payload.fileId, null);
                                      return;
                                    }
                                    if (payload.type === "job-folder") {
                                      void moveJobFolderToParent(job.id, payload.folderId, null);
                                    }
                                  }}
                                >
                                  {jobCabinetByJobId[job.id]?.loading ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-1.5 py-0.5">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Loading job filing cabinet...
                                    </div>
                                  ) : (
                                    <>
                                      {renderJobFiles(job.id, null, 1)}
                                      {renderJobFolderTree(job.id, null, 1)}
                                      {(Object.keys(jobCabinetByJobId[job.id]?.filesByFolderId || {}).length === 0 &&
                                        (jobCabinetByJobId[job.id]?.folders.length || 0) === 0) && (
                                        <div className="text-xs text-muted-foreground px-1.5 py-0.5">
                                          No files in this job filing cabinet
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        )
                        )
                      ) : folderFiles.length === 0 ? (
                        <div className="py-0" />
                      ) : (
                        [...folderFiles]
                          .sort((a, b) =>
                            compareBySort(
                              a.file_name,
                              b.file_name,
                              a.created_at,
                              b.created_at,
                              a.updated_at || a.created_at,
                              b.updated_at || b.created_at,
                              a.file_size,
                              b.file_size,
                            ),
                          )
                          .map((file) => (
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
                            onClick={() => void openCompanyFilePreview(file)}
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
                            {renderRowColumns({
                              created: file.created_at,
                              modified: file.updated_at || file.created_at,
                              ownerId: file.uploaded_by,
                              sizeText: formatFileSize(file.file_size),
                              count: 1,
                              actions: (
                                <div className="opacity-0 group-hover:opacity-100 flex items-center">
                                  {canShareCompanyFiles && (
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
                                  )}
                                  {canDownloadCompanyFiles && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void downloadCompanyFile(file);
                                      }}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ),
                            })}
                            <span className="w-24 shrink-0" />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
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

      <Dialog open={previewState.open} onOpenChange={(open) => setPreviewState((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          <ZoomableDocumentPreview
            url={previewState.url}
            fileName={previewState.title || "File Preview"}
            className="h-full"
            emptyMessage="No preview available"
            emptySubMessage="Select a file to preview it"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
