import React, { useState, useEffect, useCallback } from "react";
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
  ChevronRight, ChevronDown, Pencil, Trash2, Share2, Download, Loader2, Mail, X, ArrowUpDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import FileShareModal from "./FileShareModal";
import FileCabinetPreviewModal from "./FileCabinetPreviewModal";
import { syncFileToGoogleDrive } from '@/utils/googleDriveSync';
import { useMenuPermissions } from "@/hooks/useMenuPermissions";

interface Folder {
  id: string;
  name: string;
  is_system_folder: boolean;
  sort_order: number;
  parent_folder_id: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface JobFile {
  id: string;
  file_name: string;
  original_file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  folder_id: string;
  uploaded_by?: string | null;
  created_at: string;
}

interface OwnerProfile {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface JobFilingCabinetProps {
  jobId: string;
}

const SYSTEM_FOLDERS = ["Plans", "Delivery Tickets", "Permits"];
type DragItemPayload =
  | { type: "file"; id: string; sourceFolderId: string }
  | { type: "folder"; id: string };
const INTERNAL_DND_MIME = "application/x-job-filing-cabinet-item";
type SortKey = "name" | "created" | "modified" | "size";
type SortDir = "asc" | "desc";
type FileColumnKey = "created" | "modified" | "size" | "count";
type FileColumnVisibility = Record<FileColumnKey, boolean>;

const compareStrings = (a: string, b: string, dir: SortDir) =>
  dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
const compareNumbers = (a: number, b: number, dir: SortDir) =>
  dir === "asc" ? a - b : b - a;
const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString();
};

export default function JobFilingCabinet({ jobId }: JobFilingCabinetProps) {
  const { currentCompany } = useCompany();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { hasAccess, loading: permissionsLoading } = useMenuPermissions();

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
  const [inlineEditFolderId, setInlineEditFolderId] = useState<string | null>(null);
  const [inlineEditFolderName, setInlineEditFolderName] = useState("");
  const [inlineEditFileId, setInlineEditFileId] = useState<string | null>(null);
  const [inlineEditName, setInlineEditName] = useState("");
  const [uploadDestinationOpen, setUploadDestinationOpen] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [pendingUploadTargetFolderId, setPendingUploadTargetFolderId] = useState<string>("");
  const [vendorCabinetAccess, setVendorCabinetAccess] = useState<{
    loading: boolean;
    allowed: boolean;
    accessLevel: "view_only" | "read_write";
    canDownload: boolean;
    allowedFolderIds: string[] | null;
    allowedFileIds: string[] | null;
  }>({
    loading: false,
    allowed: true,
    accessLevel: "read_write",
    canDownload: true,
    allowedFolderIds: null,
    allowedFileIds: null,
  });

  // Multi-select state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<FileColumnVisibility>({
    created: true,
    modified: true,
    size: true,
    count: true,
  });
  const [ownerProfilesById, setOwnerProfilesById] = useState<Record<string, OwnerProfile>>({});

  const companyId = currentCompany?.id;
  const hasExpandedFolders = expandedFolders.size > 0;
  const isVendorPortalUser = profile?.role === "vendor" || profile?.role === "design_professional";
  const roleCanViewCabinet = hasAccess("jobs-view-filing-cabinet");
  const roleCanUploadCabinet = hasAccess("jobs-upload-files");
  const roleCanDeleteCabinet = hasAccess("jobs-delete-files");
  const roleCanDownloadCabinet = hasAccess("jobs-download-files");
  const roleCanShareCabinet = hasAccess("jobs-share-files");
  const vendorCanAccessCabinet = (!isVendorPortalUser || vendorCabinetAccess.allowed) && roleCanViewCabinet;
  const vendorCanWriteCabinet = (!isVendorPortalUser || (vendorCabinetAccess.allowed && vendorCabinetAccess.accessLevel === "read_write")) && roleCanUploadCabinet;
  const vendorCanDownloadCabinet = (!isVendorPortalUser || (vendorCabinetAccess.allowed && vendorCabinetAccess.canDownload)) && roleCanDownloadCabinet;

  useEffect(() => {
    const key = `job-filing-columns:${companyId || "default"}:${user?.id || "anon"}`;
    const saved = window.localStorage.getItem(key);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Partial<FileColumnVisibility>;
      setVisibleColumns((prev) => ({
        created: typeof parsed.created === "boolean" ? parsed.created : prev.created,
        modified: typeof parsed.modified === "boolean" ? parsed.modified : prev.modified,
        size: typeof parsed.size === "boolean" ? parsed.size : prev.size,
        count: typeof parsed.count === "boolean" ? parsed.count : prev.count,
      }));
    } catch {
      // ignore malformed settings
    }
  }, [companyId, user?.id]);

  useEffect(() => {
    const key = `job-filing-columns:${companyId || "default"}:${user?.id || "anon"}`;
    window.localStorage.setItem(key, JSON.stringify(visibleColumns));
  }, [visibleColumns, companyId, user?.id]);

  const loadVendorCabinetAccess = useCallback(async () => {
    if (!isVendorPortalUser) {
      setVendorCabinetAccess({
        loading: false,
        allowed: true,
        accessLevel: "read_write",
        canDownload: true,
        allowedFolderIds: null,
        allowedFileIds: null,
      });
      return {
        allowed: true,
        accessLevel: "read_write" as const,
        canDownload: true,
        allowedFolderIds: null as string[] | null,
        allowedFileIds: null as string[] | null,
      };
    }

    if (!profile?.vendor_id) {
      const denied = {
        allowed: false,
        accessLevel: "view_only" as const,
        canDownload: false,
        allowedFolderIds: null as string[] | null,
        allowedFileIds: null as string[] | null,
      };
      setVendorCabinetAccess({ loading: false, ...denied });
      return denied;
    }

    setVendorCabinetAccess((prev) => ({ ...prev, loading: true }));
    const { data, error } = await supabase
      .from('vendor_job_access' as any)
      .select(`
        can_access_filing_cabinet,
        filing_cabinet_access_level,
        can_download_filing_cabinet_files,
        allowed_filing_cabinet_folder_ids,
        allowed_filing_cabinet_file_ids
      `)
      .eq('vendor_id', profile.vendor_id)
      .eq('job_id', jobId)
      .maybeSingle();

    if (error || !data) {
      const denied = {
        allowed: false,
        accessLevel: "view_only" as const,
        canDownload: false,
        allowedFolderIds: null as string[] | null,
        allowedFileIds: null as string[] | null,
      };
      setVendorCabinetAccess({ loading: false, ...denied });
      return denied;
    }

    const resolved = {
      allowed: !!data.can_access_filing_cabinet,
      accessLevel: (data.filing_cabinet_access_level || "view_only") as "view_only" | "read_write",
      canDownload: !!data.can_download_filing_cabinet_files,
      allowedFolderIds: (data.allowed_filing_cabinet_folder_ids as string[] | null) || null,
      allowedFileIds: (data.allowed_filing_cabinet_file_ids as string[] | null) || null,
    };
    setVendorCabinetAccess({ loading: false, ...resolved });
    return resolved;
  }, [isVendorPortalUser, profile?.vendor_id, jobId]);

  const loadFolders = useCallback(async (access?: { allowedFolderIds: string[] | null; allowed: boolean }) => {
    if (!companyId) return;
    let query = supabase
      .from('job_folders')
      .select('*')
      .eq('job_id', jobId)
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true });
    if (isVendorPortalUser) {
      if (!access?.allowed) {
        setFolders([]);
        return;
      }
      if (access.allowedFolderIds && access.allowedFolderIds.length > 0) {
        query = query.in('id', access.allowedFolderIds);
      }
    }
    const { data, error } = await query;

    if (error) {
      console.error('Error loading folders:', error);
      return;
    }

    if ((!data || data.length === 0) && !isVendorPortalUser) {
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
      if (!isVendorPortalUser) {
        const existingFolderNames = new Set((data || []).map((folder) => folder.name.trim().toLowerCase()));
        const missingSystemFolders = SYSTEM_FOLDERS.filter((name) => !existingFolderNames.has(name.toLowerCase()));

        if (missingSystemFolders.length > 0) {
          const maxSortOrder = Math.max(...(data || []).map((folder) => folder.sort_order ?? 0), 0);
          const foldersToCreate = missingSystemFolders.map((name, index) => ({
            job_id: jobId,
            company_id: companyId,
            name,
            is_system_folder: true,
            sort_order: maxSortOrder + index + 1,
            created_by: user?.id || "",
          }));

          const { data: createdMissing, error: createMissingError } = await supabase
            .from("job_folders")
            .insert(foldersToCreate)
            .select();

          if (createMissingError) {
            console.error("Error creating missing system folders:", createMissingError);
            setFolders(data || []);
          } else {
            setFolders(([...(data || []), ...(createdMissing || [])] as Folder[]).sort(
              (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
            ));
          }
          return;
        }
      }
      setFolders(data);
    }
  }, [jobId, companyId, user?.id, isVendorPortalUser]);

  const loadFiles = useCallback(async (access?: { allowed: boolean; allowedFolderIds: string[] | null; allowedFileIds: string[] | null }) => {
    if (!companyId) return;
    let query = supabase
      .from('job_files')
      .select('*')
      .eq('job_id', jobId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (isVendorPortalUser) {
      if (!access?.allowed) {
        setFiles({});
        return;
      }
      if (access.allowedFolderIds && access.allowedFolderIds.length > 0) {
        query = query.in('folder_id', access.allowedFolderIds);
      }
      if (access.allowedFileIds && access.allowedFileIds.length > 0) {
        query = query.in('id', access.allowedFileIds);
      }
    }
    const { data, error } = await query;

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
  }, [jobId, companyId, isVendorPortalUser]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const access = await loadVendorCabinetAccess();
      if (isVendorPortalUser && !access.allowed) {
        setFolders([]);
        setFiles({});
        setLoading(false);
        return;
      }
      await loadFolders({ allowed: access.allowed, allowedFolderIds: access.allowedFolderIds });
      await loadFiles({
        allowed: access.allowed,
        allowedFolderIds: access.allowedFolderIds,
        allowedFileIds: access.allowedFileIds,
      });
      setLoading(false);
    };
    load();
  }, [loadFolders, loadFiles, loadVendorCabinetAccess, isVendorPortalUser]);

  const allFiles = Object.values(files).flat();

  useEffect(() => {
    const ownerIds = new Set<string>();
    folders.forEach((folder) => {
      if (folder.created_by) ownerIds.add(folder.created_by);
    });
    allFiles.forEach((file) => {
      if (file.uploaded_by) ownerIds.add(file.uploaded_by);
    });

    const ids = Array.from(ownerIds);
    if (ids.length === 0) {
      setOwnerProfilesById({});
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, display_name, avatar_url")
        .in("user_id", ids);
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
  }, [folders, allFiles]);

  const renderOwnerCell = (ownerUserId?: string | null) => {
    if (!ownerUserId) return <span className="w-36 text-xs text-muted-foreground">-</span>;
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
      <span className="w-36 inline-flex items-center gap-2 text-xs text-muted-foreground truncate">
        {owner?.avatar_url ? (
          <img src={owner.avatar_url} alt={label} className="h-5 w-5 rounded-full object-cover border" />
        ) : (
          <span className="h-5 w-5 rounded-full border bg-muted inline-flex items-center justify-center text-[10px]">
            {initials}
          </span>
        )}
        <span className="truncate">{label}</span>
      </span>
    );
  };
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
  const getFolderTreeSize = useCallback((folderId: string): number => {
    const ownFiles = files[folderId] || [];
    const ownSize = ownFiles.reduce((sum, file) => sum + Number(file.file_size || 0), 0);
    const children = childFoldersByParent[folderId] || [];
    return ownSize + children.reduce((sum, child) => sum + getFolderTreeSize(child.id), 0);
  }, [files, childFoldersByParent]);
  const compareBySort = useCallback((
    aName: string,
    bName: string,
    aCreated?: string | null,
    bCreated?: string | null,
    aModified?: string | null,
    bModified?: string | null,
    aSize?: number | null,
    bSize?: number | null,
  ) => {
    if (sortKey === "name") return compareStrings(aName.toLowerCase(), bName.toLowerCase(), sortDir);
    if (sortKey === "created") return compareNumbers(new Date(aCreated || 0).getTime(), new Date(bCreated || 0).getTime(), sortDir);
    if (sortKey === "modified") return compareNumbers(new Date(aModified || 0).getTime(), new Date(bModified || 0).getTime(), sortDir);
    return compareNumbers(Number(aSize || 0), Number(bSize || 0), sortDir);
  }, [sortKey, sortDir]);
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
  const getDescendantFolderIds = useCallback((folderId: string): string[] => {
    const collected: string[] = [];
    const queue: string[] = [folderId];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      collected.push(current);
      const children = childFoldersByParent[current] || [];
      children.forEach((child) => queue.push(child.id));
    }
    return collected;
  }, [childFoldersByParent]);

  const getFolderTreeFileIds = useCallback((folderId: string): string[] => {
    const folderIds = getDescendantFolderIds(folderId);
    return folderIds.flatMap((id) => (files[id] || []).map((file) => file.id));
  }, [files, getDescendantFolderIds]);

  const getFolderSelectionState = useCallback((folderId: string): boolean | "indeterminate" => {
    const fileIds = getFolderTreeFileIds(folderId);
    if (fileIds.length === 0) return false;
    const selectedCount = fileIds.filter((id) => selectedFileIds.has(id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === fileIds.length) return true;
    return "indeterminate";
  }, [getFolderTreeFileIds, selectedFileIds]);

  const toggleFolderSelection = useCallback((folderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const fileIds = getFolderTreeFileIds(folderId);
    if (fileIds.length === 0) return;
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      const allSelected = fileIds.every((id) => next.has(id));
      if (allSelected) fileIds.forEach((id) => next.delete(id));
      else fileIds.forEach((id) => next.add(id));
      return next;
    });
  }, [getFolderTreeFileIds]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (!vendorCanWriteCabinet) {
      toast({ title: "No access", description: "You do not have write access for this filing cabinet.", variant: "destructive" });
      return;
    }
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
    if (!vendorCanWriteCabinet) {
      toast({ title: "No access", description: "You do not have write access for this filing cabinet.", variant: "destructive" });
      return;
    }
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

  const saveInlineFolderRename = async (folderId: string) => {
    if (!vendorCanWriteCabinet) return;
    if (!inlineEditFolderName.trim()) {
      setInlineEditFolderId(null);
      return;
    }
    const { error } = await supabase
      .from("job_folders")
      .update({ name: inlineEditFolderName.trim() })
      .eq("id", folderId);
    if (error) {
      toast({ title: "Error", description: "Failed to rename", variant: "destructive" });
    } else {
      toast({ title: "Folder renamed" });
      loadFolders();
    }
    setInlineEditFolderId(null);
  };

  const handleDelete = async () => {
    if (!roleCanDeleteCabinet) {
      toast({ title: "No access", description: "You do not have permission to delete files/folders in this filing cabinet.", variant: "destructive" });
      return;
    }
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
    if (!vendorCanWriteCabinet) {
      toast({ title: "No access", description: "You do not have write access for this filing cabinet.", variant: "destructive" });
      return;
    }
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
    if (!vendorCanWriteCabinet) {
      toast({ title: "No access", description: "You do not have write access for this filing cabinet.", variant: "destructive" });
      return;
    }
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
    if (!vendorCanWriteCabinet) {
      toast({ title: "No access", description: "You do not have write access for this filing cabinet.", variant: "destructive" });
      return;
    }
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
      if (!vendorCanWriteCabinet) return;
      if (internalPayload.type === "file") {
        void moveFileToFolder(internalPayload.id, folderId);
      } else if (internalPayload.type === "folder") {
        void moveFolderToParent(internalPayload.id, folderId);
      }
      return;
    }
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      if (!vendorCanWriteCabinet) return;
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
        if (!vendorCanWriteCabinet) return;
        setPendingUploadFiles(droppedFiles);
        setPendingUploadTargetFolderId((childFoldersByParent["root"] || [])[0]?.id || "");
        setUploadDestinationOpen(true);
      }
      return;
    }
    if (internalPayload.type === "folder") {
      if (!vendorCanWriteCabinet) return;
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
    if (!vendorCanWriteCabinet) return;
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
    if (!vendorCanWriteCabinet) return;
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
    if (!vendorCanWriteCabinet) return;
    if (!pendingUploadTargetFolderId || pendingUploadFiles.length === 0) return;
    const filesToUpload = [...pendingUploadFiles];
    setUploadDestinationOpen(false);
    setPendingUploadFiles([]);
    for (const f of filesToUpload) {
      await uploadFile(f, pendingUploadTargetFolderId);
    }
  };

  const downloadFile = async (file: JobFile) => {
    if (!vendorCanDownloadCabinet) {
      toast({ title: "Downloads disabled", description: "Download access is restricted for your account.", variant: "destructive" });
      return;
    }
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

  const downloadSelectedFiles = async () => {
    const filesToDownload = getSelectedFiles();
    if (filesToDownload.length === 0) return;
    for (const file of filesToDownload) {
      // Sequential downloads reduce browser popup blocking risk.
      await downloadFile(file);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '0 MB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (vendorCabinetAccess.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vendorCanAccessCabinet) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            You do not have access to this job's filing cabinet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filing Cabinet</h3>
        <div className="flex items-center gap-2">
          {selectedFileIds.size > 0 && (
            <>
              <Badge variant="secondary" className="text-xs">
                {selectedFileIds.size} selected
              </Badge>
              {roleCanShareCabinet && (
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
              )}
              {vendorCanDownloadCabinet && (
                <Button size="sm" variant="outline" onClick={() => void downloadSelectedFiles()}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download Selected
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => setNewFolderOpen(true)} disabled={!vendorCanWriteCabinet}>
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!hasExpandedFolders}
            onClick={() => setExpandedFolders(new Set())}
          >
            Collapse All
          </Button>
          <Button size="sm" variant="outline" onClick={() => setColumnModalOpen(true)}>
            Customize Columns
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "relative min-h-[420px] space-y-0 rounded-md",
          dragOverRoot && "ring-1 ring-primary/40 bg-primary/5"
        )}
        onDrop={handleRootDrop}
        onDragOver={handleRootDragOver}
        onDragLeave={() => setDragOverRoot(false)}
      >
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div className="text-sm font-medium text-muted-foreground/20">
            Drop files here
            <span className="mx-2 text-border/40">|</span>
            Drag folders here to move them to top level
          </div>
        </div>
        <div className="relative z-10">
        <div className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-muted-foreground border-b">
          <span className="flex-1">
            <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort("name")}>
              Name
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
          </span>
          {visibleColumns.created && <span className="w-44">
            <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort("created")}>
              Created
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
          </span>}
          {visibleColumns.modified && <span className="w-44">
            <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort("modified")}>
              Modified
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
          </span>}
          <span className="w-36">Owner</span>
          {visibleColumns.size && <span className="w-28 text-right">
            <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort("size")}>
              Size
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
          </span>}
          {visibleColumns.count && <span className="w-14 text-right">Count</span>}
          <span className="w-16 text-right">Actions</span>
          <span className="w-24 text-right">Type</span>
        </div>
        {[...(childFoldersByParent["root"] || [])]
          .sort((a, b) => {
            if (a.is_system_folder !== b.is_system_folder) return a.is_system_folder ? -1 : 1;
            return compareBySort(
              a.name,
              b.name,
              a.created_at,
              b.created_at,
              a.updated_at || a.created_at,
              b.updated_at || b.created_at,
              getFolderTreeSize(a.id),
              getFolderTreeSize(b.id),
            );
          })
          .map(folder => {
          const isExpanded = expandedFolders.has(folder.id);
          const folderFiles = files[folder.id] || [];
          const isDragOver = dragOverFolder === folder.id;
          const isUploading = uploading === folder.id;

          const renderFolderNode = (node: Folder, depth = 0): React.ReactNode => {
            const nodeExpanded = expandedFolders.has(node.id);
            const nodeFiles = files[node.id] || [];
            const nodeIsDragOver = dragOverFolder === node.id;
            const nodeIsUploading = uploading === node.id;
            const childFolders = [...(childFoldersByParent[node.id] || [])].sort((a, b) => {
              if (a.is_system_folder !== b.is_system_folder) return a.is_system_folder ? -1 : 1;
              return compareBySort(
                a.name,
                b.name,
                a.created_at,
                b.created_at,
                a.updated_at || a.created_at,
                b.updated_at || b.created_at,
                getFolderTreeSize(a.id),
                getFolderTreeSize(b.id),
              );
            });
            const sortedNodeFiles = [...nodeFiles].sort((a, b) =>
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
            );
            const folderTreeSize = getFolderTreeSize(node.id);

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
                <div className="flex items-center gap-2 flex-1 min-w-0" style={{ paddingLeft: `${depth * 14}px` }}>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={getFolderSelectionState(node.id)}
                      onCheckedChange={() => toggleFolderSelection(node.id)}
                      className="shrink-0"
                    />
                  </div>
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
                  <div className="flex-1 min-w-0">
                    {inlineEditFolderId === node.id ? (
                      <Input
                        autoFocus
                        value={inlineEditFolderName}
                        onChange={(e) => setInlineEditFolderName(e.target.value)}
                        onBlur={() => void saveInlineFolderRename(node.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveInlineFolderRename(node.id);
                          if (e.key === "Escape") setInlineEditFolderId(null);
                        }}
                        className="h-6 text-sm py-0 px-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        type="button"
                        className="inline-block max-w-full truncate text-left text-sm font-medium hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!vendorCanWriteCabinet) return;
                          setInlineEditFolderId(node.id);
                          setInlineEditFolderName(node.name);
                        }}
                      >
                        {node.name}
                      </button>
                    )}
                  </div>
                </div>
                {visibleColumns.created && <span className="w-44 text-xs text-muted-foreground tabular-nums">{formatDateTime(node.created_at)}</span>}
                {visibleColumns.modified && <span className="w-44 text-xs text-muted-foreground tabular-nums">{formatDateTime(node.updated_at || node.created_at)}</span>}
                {renderOwnerCell(node.created_by)}
                {visibleColumns.size && <span className="w-28 text-xs text-muted-foreground text-right tabular-nums">{formatFileSize(folderTreeSize)}</span>}
                {visibleColumns.count && <span className="w-14 text-xs text-muted-foreground text-right tabular-nums">{nodeFiles.length}</span>}

                {nodeIsUploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}

                <div className="w-16 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleFileInput(node.id)} disabled={!vendorCanWriteCabinet}>
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={!vendorCanWriteCabinet} onClick={() => setRenamingItem({ type: 'folder', id: node.id, name: node.name })}>
                        <Pencil className="h-4 w-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      {!node.is_system_folder && (
                        <DropdownMenuItem
                          disabled={!roleCanDeleteCabinet}
                          className="text-destructive"
                          onClick={() => setDeleteItem({ type: 'folder', id: node.id, name: node.name })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <span className="w-24 flex justify-end">
                  {node.is_system_folder && (
                    <Badge variant="secondary" className="text-xs">System</Badge>
                  )}
                </span>
              </div>

              {/* Files inside folder */}
              {nodeExpanded && (
                <div
                  className={cn(
                    "border-l border-border pl-2 py-0 space-y-0",
                    nodeIsDragOver && "border-primary"
                  )}
                  onDrop={(e) => handleDrop(e, node.id)}
                  onDragOver={(e) => handleDragOver(e, node.id)}
                  onDragLeave={handleDragLeave}
                >
                  {childFolders.map((child) => renderFolderNode(child, depth + 1))}
                  {nodeFiles.length === 0 && childFolders.length === 0 ? (
                    <div className="py-0.5 text-center text-[11px] text-muted-foreground/80">Empty folder</div>
                  ) : (
                    sortedNodeFiles.map(file => {
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
                          <div className="flex items-center gap-2 flex-1 min-w-0" style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
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
                              <div className="flex-1 min-w-0">
                                <button
                                  type="button"
                                  className="inline-block max-w-full truncate hover:underline cursor-text text-left"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!vendorCanWriteCabinet) return;
                                    setInlineEditFileId(file.id);
                                    setInlineEditName(file.file_name);
                                  }}
                                >
                                  {file.file_name}
                                </button>
                              </div>
                            )}
                          </div>
                          {visibleColumns.created && <span className="w-44 text-xs text-muted-foreground tabular-nums">{formatDateTime(file.created_at)}</span>}
                          {visibleColumns.modified && <span className="w-44 text-xs text-muted-foreground tabular-nums">{formatDateTime(file.updated_at || file.created_at)}</span>}
                          {renderOwnerCell(file.uploaded_by)}
                          {visibleColumns.size && <span className="w-28 text-xs text-muted-foreground text-right tabular-nums">{formatFileSize(file.file_size)}</span>}
                          {visibleColumns.count && <span className="w-14 text-xs text-muted-foreground text-right tabular-nums">1</span>}
                          <div className="w-16 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!vendorCanDownloadCabinet} onClick={() => downloadFile(file)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            {roleCanShareCabinet && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShareFiles([file])}>
                                <Share2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem disabled={!vendorCanWriteCabinet} onClick={() => setRenamingItem({ type: 'file', id: file.id, name: file.file_name })}>
                                  <Pencil className="h-4 w-4 mr-2" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!roleCanDeleteCabinet}
                                  className="text-destructive"
                                  onClick={() => setDeleteItem({ type: 'file', id: file.id, name: file.file_name })}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <span className="w-24" />
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

      <Dialog open={columnModalOpen} onOpenChange={setColumnModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Customize Columns</DialogTitle>
            <DialogDescription>Name is always shown.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Name</span>
              <Badge variant="secondary">Required</Badge>
            </div>
            {(["created", "modified", "size", "count"] as FileColumnKey[]).map((columnKey) => (
              <label key={columnKey} className="flex items-center justify-between text-sm">
                <span>{columnKey === "count" ? "Badge / Count" : columnKey[0].toUpperCase() + columnKey.slice(1)}</span>
                <Checkbox
                  checked={visibleColumns[columnKey]}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, [columnKey]: checked === true }))
                  }
                />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColumnModalOpen(false)}>
              Done
            </Button>
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
