import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Plus, Trash2, Save, GripVertical, FileText, Upload } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import AddARInvoice from "@/pages/AddARInvoice";

interface SOVItem {
  id?: string;
  item_number: string;
  description: string;
  scheduled_value: number;
  cost_code_id?: string | null;
  sort_order: number;
  workflow_status?: "draft" | "approved";
  approved_at?: string | null;
  approved_by?: string | null;
  is_new?: boolean;
}

interface JobBillingSetupProps {
  jobId: string;
}

interface JobDraw {
  id: string;
  invoice_number: string;
  application_number: number | null;
  status: string;
  issue_date: string;
  total_amount: number;
}

type ImportMode = "append" | "replace";
type ImportFieldKey = "item_number" | "description" | "scheduled_value";
type ImportColumnMap = Record<ImportFieldKey, string>;
type ImportRow = Record<string, string>;

const IMPORT_NONE = "__none__";

export default function JobBillingSetup({ jobId }: JobBillingSetupProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentCompany, userCompanies } = useCompany();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [items, setItems] = useState<SOVItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawsLoading, setDrawsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [draws, setDraws] = useState<JobDraw[]>([]);
  const [jobCustomerId, setJobCustomerId] = useState<string | null>(null);
  const [activeBillingTab, setActiveBillingTab] = useState<string>("sov");
  const descriptionInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const scheduledValueInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingDescriptionFocusIndexRef = useRef<number | null>(null);
  const pendingScrollToIndexRef = useRef<number | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const sovSectionRef = useRef<HTMLDivElement | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>("append");
  const [importApplying, setImportApplying] = useState(false);
  const [importColumnMap, setImportColumnMap] = useState<ImportColumnMap>({
    item_number: IMPORT_NONE,
    description: IMPORT_NONE,
    scheduled_value: IMPORT_NONE,
  });

  useEffect(() => {
    if (currentCompany?.id && jobId) {
      loadSOV();
      loadDraws();
      loadJobContext();
    }
  }, [currentCompany?.id, jobId]);

  useEffect(() => {
    const requestedDrawId = searchParams.get("drawId");
    if (requestedDrawId) {
      setActiveBillingTab(`draw:${requestedDrawId}`);
      return;
    }

    const localHasDraws = draws.length > 0;
    const localHasSOVItems = items.length > 0;
    const localIsSOVApproved = localHasSOVItems && items.every((item) => (item.workflow_status || "draft") === "approved");
    const localCanCreateDraw = localHasDraws || (localHasSOVItems && localIsSOVApproved && !hasChanges);
    const localHasDraftDraw = draws.some((draw) => (draw.status || "").toLowerCase() === "draft");
    const localShouldShowNextDraftTab = localCanCreateDraw && !localHasDraftDraw;

    setActiveBillingTab((prev) => {
      if (prev !== "sov" && draws.some((d) => `draw:${d.id}` === prev)) return prev;
      if (prev === "draw:draft-next" && localShouldShowNextDraftTab) return prev;
      if (localShouldShowNextDraftTab) return "draw:draft-next";
      return draws.length > 0 ? `draw:${draws[0].id}` : "sov";
    });
  }, [draws, searchParams, items, hasChanges]);

  useEffect(() => {
    const indexToScroll = pendingScrollToIndexRef.current;
    const indexToFocus = pendingDescriptionFocusIndexRef.current;
    if (indexToScroll === null && indexToFocus === null) return;

    pendingScrollToIndexRef.current = null;
    pendingDescriptionFocusIndexRef.current = null;

    requestAnimationFrame(() => {
      const targetIndex = indexToFocus ?? indexToScroll!;
      const input = descriptionInputRefs.current[targetIndex];
      if (!input) return;

      input.scrollIntoView({ behavior: "smooth", block: "nearest" });

      if (indexToFocus !== null) {
        input.focus();
        input.select();
      }
    });
  }, [items.length]);

  const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");

  const inferImportColumnMap = (headers: string[]): ImportColumnMap => {
    const normalized = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));
    const findMatch = (patterns: RegExp[]) =>
      normalized.find((h) => patterns.some((p) => p.test(h.normalized)))?.original ?? IMPORT_NONE;

    return {
      item_number: findMatch([/^item( number)?$/, /^line( item)?$/, /^sov( item)?$/, /^item ?#$/]),
      description: findMatch([/^description/, /^description of work$/, /^scope/, /^work item$/]),
      scheduled_value: findMatch([/^scheduled value$/, /^schedule value$/, /^value$/, /^amount$/, /^contract sum$/]),
    };
  };

  const resetImportState = () => {
    setImportFileName("");
    setImportRows([]);
    setImportHeaders([]);
    setImportColumnMap({
      item_number: IMPORT_NONE,
      description: IMPORT_NONE,
      scheduled_value: IMPORT_NONE,
    });
    setImportMode("append");
    setImportApplying(false);
  };

  const parseCsvFile = async (file: File): Promise<{ headers: string[]; rows: ImportRow[] }> => {
    const parsed = await new Promise<Papa.ParseResult<Record<string, any>>>((resolve, reject) => {
      Papa.parse<Record<string, any>>(file, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
        complete: (results) => resolve(results),
        error: (error) => reject(error),
      });
    });

    const headers = (parsed.meta.fields || []).map((h) => String(h).trim()).filter(Boolean);
    const rows = (parsed.data || []).map((row) => {
      const mapped: ImportRow = {};
      headers.forEach((header) => {
        mapped[header] = String(row?.[header] ?? "").trim();
      });
      return mapped;
    });

    return { headers, rows };
  };

  const parseExcelFile = async (file: File): Promise<{ headers: string[]; rows: ImportRow[] }> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
    if (!sheet) throw new Error("No worksheet found");

    const rowsAoA = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    const [headerRow, ...dataRows] = rowsAoA;
    const headers = (headerRow || [])
      .map((h, idx) => String(h ?? "").trim() || `Column ${idx + 1}`)
      .filter(Boolean);

    const rows = dataRows.map((row) => {
      const mapped: ImportRow = {};
      headers.forEach((header, idx) => {
        mapped[header] = String((row || [])[idx] ?? "").trim();
      });
      return mapped;
    });

    return { headers, rows };
  };

  const handleImportFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const lower = file.name.toLowerCase();
      if (!/\.(csv|xlsx|xls)$/.test(lower)) {
        throw new Error("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
      }

      const parsed = lower.endsWith(".csv") ? await parseCsvFile(file) : await parseExcelFile(file);
      const nonEmptyRows = parsed.rows.filter((row) =>
        Object.values(row).some((value) => String(value ?? "").trim() !== "")
      );

      if (parsed.headers.length === 0 || nonEmptyRows.length === 0) {
        throw new Error("No usable rows found in the selected file");
      }

      setImportFileName(file.name);
      setImportHeaders(parsed.headers);
      setImportRows(nonEmptyRows);
      setImportColumnMap(inferImportColumnMap(parsed.headers));
      setImportMode(items.length > 0 ? "append" : "replace");
      setImportDialogOpen(true);
    } catch (error: any) {
      console.error("SOV import parse error:", error);
      toast({
        title: "Import failed",
        description: error.message || "Could not read file",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const parseScheduledValue = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const negative = trimmed.startsWith("(") && trimmed.endsWith(")");
    const normalized = trimmed.replace(/[$,\s()]/g, "");
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return NaN;
    return negative ? -parsed : parsed;
  };

  const mappedImportPreview = importRows
    .slice(0, 8)
    .map((row, idx) => {
      const description = importColumnMap.description !== IMPORT_NONE ? (row[importColumnMap.description] || "") : "";
      const rawScheduled = importColumnMap.scheduled_value !== IMPORT_NONE ? (row[importColumnMap.scheduled_value] || "") : "";
      const itemNumber = importColumnMap.item_number !== IMPORT_NONE ? (row[importColumnMap.item_number] || "") : "";
      const scheduled = parseScheduledValue(rawScheduled);
      return {
        row: idx + 2,
        itemNumber,
        description,
        rawScheduled,
        scheduledValid: rawScheduled.trim() === "" || Number.isFinite(scheduled),
      };
    });

  const applyImportedRows = async () => {
    if (draws.length > 0) {
      toast({
        title: "Schedule of Values locked",
        description: "SOV cannot be changed after a draw has been created.",
        variant: "destructive",
      });
      return;
    }
    if (importColumnMap.description === IMPORT_NONE || importColumnMap.scheduled_value === IMPORT_NONE) {
      toast({
        title: "Mapping required",
        description: "Map both Description and Scheduled Value before importing.",
        variant: "destructive",
      });
      return;
    }

    setImportApplying(true);
    try {
      const imported: SOVItem[] = [];
      const errors: string[] = [];
      const baseLength = importMode === "replace" ? 0 : items.length;

      importRows.forEach((row, idx) => {
        const rowNumber = idx + 2;
        const description = String(row[importColumnMap.description] || "").trim();
        const rawScheduled = String(row[importColumnMap.scheduled_value] || "").trim();
        const rawItemNumber =
          importColumnMap.item_number !== IMPORT_NONE ? String(row[importColumnMap.item_number] || "").trim() : "";

        // Skip fully blank lines from source.
        if (!description && !rawScheduled && !rawItemNumber) return;

        if (!description) {
          errors.push(`Row ${rowNumber}: missing description`);
          return;
        }

        const scheduledValue = parseScheduledValue(rawScheduled);
        if (!Number.isFinite(scheduledValue)) {
          errors.push(`Row ${rowNumber}: invalid scheduled value "${rawScheduled}"`);
          return;
        }

        const sequentialItemNumber = String(baseLength + imported.length + 1);
        imported.push({
          item_number: rawItemNumber || sequentialItemNumber,
          description,
          scheduled_value: scheduledValue,
          sort_order: baseLength + imported.length,
          cost_code_id: null,
          workflow_status: "draft",
          approved_at: null,
          approved_by: null,
          is_new: true,
        });
      });

      if (errors.length > 0) {
        toast({
          title: "Import validation failed",
          description: errors[0],
          variant: "destructive",
        });
        return;
      }

      if (imported.length === 0) {
        toast({
          title: "No rows imported",
          description: "No valid rows were found after applying your column mapping.",
          variant: "destructive",
        });
        return;
      }

      const nextItems = importMode === "replace" ? imported : [...items, ...imported];
      if (importMode === "replace") {
        nextItems.forEach((item, index) => {
          item.sort_order = index;
          if (!item.item_number) item.item_number = String(index + 1);
        });
      }

      setItems(nextItems);
      setHasChanges(true);
      pendingScrollToIndexRef.current = Math.max(0, nextItems.length - 1);
      setImportDialogOpen(false);
      resetImportState();

      toast({
        title: "Import ready",
        description: `${imported.length} SOV line item${imported.length === 1 ? "" : "s"} imported. Click Save Changes to persist.`,
      });
    } finally {
      setImportApplying(false);
    }
  };

  const loadSOV = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("schedule_of_values")
        .select("*")
        .eq("company_id", currentCompany!.id)
        .eq("job_id", jobId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      
      setItems((data as any[] | null)?.map(item => ({
        id: item.id,
        item_number: item.item_number,
        description: item.description,
        scheduled_value: Number(item.scheduled_value),
        cost_code_id: item.cost_code_id,
        sort_order: item.sort_order,
        workflow_status: item.workflow_status || "draft",
        approved_at: item.approved_at || null,
        approved_by: item.approved_by || null,
      })) || []);
    } catch (error: any) {
      console.error("Error loading SOV:", error);
      toast({
        title: "Error",
        description: "Failed to load schedule of values",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadJobContext = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("customer_id")
        .eq("company_id", currentCompany!.id)
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      setJobCustomerId(data?.customer_id ?? null);
    } catch (error) {
      console.error("Error loading job billing context:", error);
      setJobCustomerId(null);
    }
  };

  const loadDraws = async () => {
    try {
      setDrawsLoading(true);
      const { data, error } = await supabase
        .from("ar_invoices")
        .select("id, invoice_number, application_number, status, issue_date, total_amount")
        .eq("company_id", currentCompany!.id)
        .eq("job_id", jobId)
        .order("application_number", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDraws((data || []) as JobDraw[]);
    } catch (error) {
      console.error("Error loading draws:", error);
      setDraws([]);
    } finally {
      setDrawsLoading(false);
    }
  };

  const drawsAsc = [...draws].sort((a, b) => (a.application_number || 0) - (b.application_number || 0));
  const nextDraftTabValue = "draw:draft-next";
  const activeDraw = activeBillingTab.startsWith("draw:")
    && activeBillingTab !== nextDraftTabValue
    ? draws.find((d) => `draw:${d.id}` === activeBillingTab) || null
    : null;
  const isCreateDrawTab = activeBillingTab === nextDraftTabValue;

  const addItem = () => {
    if (draws.length > 0) return;
    const nextIndex = items.length;
    pendingScrollToIndexRef.current = nextIndex;
    const nextNumber = (items.length + 1).toString();
    setItems([...items, {
      item_number: nextNumber,
      description: "",
      scheduled_value: 0,
      sort_order: items.length,
      workflow_status: "draft",
      approved_at: null,
      approved_by: null,
      is_new: true
    }]);
    setHasChanges(true);
  };

  const focusDescriptionInput = (index: number) => {
    requestAnimationFrame(() => {
      const input = descriptionInputRefs.current[index];
      if (!input) return;
      input.focus();
      input.select();
    });
  };

  const handleScheduledValueEnter = (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;

    e.preventDefault();
    e.stopPropagation();

    if (index < items.length - 1) {
      focusDescriptionInput(index + 1);
      return;
    }

    pendingDescriptionFocusIndexRef.current = items.length;
    addItem();
  };

  const handleDescriptionEnter = (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;

    e.preventDefault();
    e.stopPropagation();

    requestAnimationFrame(() => {
      const input = scheduledValueInputRefs.current[index];
      if (!input) return;
      input.focus();
      input.select();
    });
  };

  const removeItem = (index: number) => {
    if (draws.length > 0) return;
    const newItems = items.filter((_, i) => i !== index);
    // Renumber items
    newItems.forEach((item, i) => {
      item.sort_order = i;
      if (item.is_new) {
        item.item_number = (i + 1).toString();
      }
    });
    setItems(newItems);
    setHasChanges(true);
  };

  const updateItem = (index: number, field: keyof SOVItem, value: string | number) => {
    if (draws.length > 0) return;
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    setHasChanges(true);
  };

  const saveSOV = async () => {
    if (draws.length > 0) {
      toast({
        title: "Schedule of Values locked",
        description: "SOV cannot be changed after a draw has been created.",
        variant: "destructive",
      });
      return;
    }
    if (!currentCompany?.id || !user?.id) return;

    try {
      setSaving(true);

      // Get existing IDs
      const existingIds = items.filter(i => i.id).map(i => i.id);
      
      // Delete removed items (soft delete)
      if (existingIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("schedule_of_values")
          .update({ is_active: false })
          .eq("company_id", currentCompany.id)
          .eq("job_id", jobId)
          .not("id", "in", `(${existingIds.join(",")})`);
        
        if (deleteError) throw deleteError;
      }

      // Upsert all items
      for (const item of items) {
        if (item.id) {
          // Update existing
          const { error } = await supabase
            .from("schedule_of_values")
            .update({
              item_number: item.item_number,
              description: item.description,
              scheduled_value: item.scheduled_value,
              cost_code_id: item.cost_code_id,
              sort_order: item.sort_order,
              workflow_status: item.workflow_status || "draft",
              approved_at: item.approved_at ?? null,
              approved_by: item.approved_by ?? null,
              updated_at: new Date().toISOString()
            })
            .eq("id", item.id);
          
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from("schedule_of_values")
            .insert({
              company_id: currentCompany.id,
              job_id: jobId,
              item_number: item.item_number,
              description: item.description,
              scheduled_value: item.scheduled_value,
              cost_code_id: item.cost_code_id,
              sort_order: item.sort_order,
              workflow_status: item.workflow_status || "draft",
              approved_at: item.approved_at ?? null,
              approved_by: item.approved_by ?? null,
              created_by: user.id
            });
          
          if (error) throw error;
        }
      }

      toast({
        title: "Success",
        description: "Schedule of Values saved successfully",
      });
      
      setHasChanges(false);
      loadSOV(); // Reload to get IDs
    } catch (error: any) {
      console.error("Error saving SOV:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save schedule of values",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const approveSOV = async () => {
    if (!currentCompany?.id || !user?.id) return;
    if (!canApproveSOV) {
      toast({
        title: "Permission required",
        description: "Only admins, company admins, controllers, or super admins can approve the Schedule of Values.",
        variant: "destructive",
      });
      return;
    }
    if (draws.length > 0) {
      toast({
        title: "Cannot approve",
        description: "SOV approval must happen before the first draw is created.",
        variant: "destructive",
      });
      return;
    }
    if (items.length === 0) {
      toast({
        title: "No Schedule of Values",
        description: "Add SOV line items before approving.",
        variant: "destructive",
      });
      return;
    }
    if (hasChanges) {
      toast({
        title: "Unsaved changes",
        description: "Save SOV changes before approving.",
        variant: "destructive",
      });
      return;
    }

    try {
      setApproving(true);
      const { error } = await supabase
        .from("schedule_of_values")
        .update({
          workflow_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        } as any)
        .eq("company_id", currentCompany.id)
        .eq("job_id", jobId)
        .eq("is_active", true);

      if (error) throw error;

      toast({
        title: "SOV approved",
        description: "Schedule of Values is now approved and locked.",
      });
      await Promise.all([loadSOV(), loadDraws()]);
      const next = new URLSearchParams(searchParams);
      next.delete("drawId");
      setSearchParams(next, { replace: true });
      setActiveBillingTab(nextDraftTabValue);
    } catch (error: any) {
      console.error("Error approving SOV:", error);
      toast({
        title: "Approval failed",
        description: error?.message || "Could not approve Schedule of Values",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const totalScheduledValue = items.reduce((sum, item) => sum + (item.scheduled_value || 0), 0);
  const hasDraws = draws.length > 0;
  const hasSOVItems = items.length > 0;
  const isSOVApproved = hasSOVItems && items.every((item) => (item.workflow_status || "draft") === "approved");
  const isSOVLocked = hasDraws || isSOVApproved;
  const canCreateDraw = hasDraws || (hasSOVItems && isSOVApproved && !hasChanges);
  const maxApplicationNumber = draws.reduce((max, draw) => Math.max(max, draw.application_number || 0), 0);
  const nextDrawNumber = maxApplicationNumber + 1;
  const hasExistingDraftDraw = draws.some((draw) => (draw.status || "").toLowerCase() === "draft");
  const shouldShowNextDraftTab = canCreateDraw && !hasExistingDraftDraw;
  const activeCompanyRole =
    userCompanies
      .find((company) => company.company_id === currentCompany?.id)
      ?.role?.trim()
      .toLowerCase() ||
    profile?.role?.trim()?.toLowerCase() ||
    "";
  const canApproveSOV =
    activeCompanyRole === "admin" ||
    activeCompanyRole === "controller" ||
    activeCompanyRole === "company_admin" ||
    activeCompanyRole === "super_admin";
  const sovWorkflowStatus = hasDraws ? "Locked" : isSOVApproved ? "Approved" : "Draft";
  const approvedAt = isSOVApproved ? items.find((item) => item.approved_at)?.approved_at || null : null;

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading billing setup...</div>;
  }

  return (
    <Card>
      <input
        ref={importFileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleImportFileSelect}
      />
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <FileText className="h-5 w-5" />
              Job Billing
            </CardTitle>
            <CardDescription>
              Draw tabs and Schedule of Values for this job.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeBillingTab} onValueChange={(value) => {
          setActiveBillingTab(value);
          const next = new URLSearchParams(searchParams);
          if (value === nextDraftTabValue) {
            next.delete("drawId");
          } else if (value.startsWith("draw:")) {
            next.set("drawId", value.replace("draw:", ""));
          } else {
            next.delete("drawId");
          }
          setSearchParams(next, { replace: true });
        }} className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <TabsList className="h-auto flex-wrap justify-start">
              {drawsAsc.map((draw) => (
                <TabsTrigger key={draw.id} value={`draw:${draw.id}`}>
                  {draw.application_number ? `Draw ${draw.application_number}` : draw.invoice_number}
                </TabsTrigger>
              ))}
              {shouldShowNextDraftTab && (
                <TabsTrigger
                  value={nextDraftTabValue}
                  className="flex items-center gap-1"
                  aria-label={`Draw ${nextDrawNumber} draft`}
                  title={`Draw #${nextDrawNumber} Draft`}
                >
                  Draw {nextDrawNumber}
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">Draft</Badge>
                </TabsTrigger>
              )}
              <TabsTrigger value="sov">Schedule Values</TabsTrigger>
            </TabsList>
          </div>

          <div className="rounded-lg border p-4 bg-muted/20">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-medium">
                  {activeBillingTab === "sov" ? "Schedule of Values" : activeDraw?.application_number ? `Draw #${activeDraw.application_number}` : "Draw"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeBillingTab === "sov"
                    ? "Set up and approve the billing breakdown for AIA G702/G703 invoicing before Draw #1."
                    : isCreateDrawTab
                    ? `Draft for Draw #${nextDrawNumber}. Project and customer are prefilled from this job and cannot be changed.`
                    : "Draws stay tied to this job. Project and customer are prefilled and locked when launched from Job Billing."}
                </p>
                {activeBillingTab === "sov" && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Badge variant={sovWorkflowStatus === "Draft" ? "default" : "secondary"}>
                      {sovWorkflowStatus}
                    </Badge>
                    {approvedAt && (
                      <span className="text-xs text-muted-foreground">
                        Approved {new Date(approvedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {activeDraw && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="capitalize">{activeDraw.status}</Badge>
                  <span className="text-sm font-medium self-center">${formatNumber(activeDraw.total_amount || 0)}</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              {activeBillingTab === "sov" && (
                <>
                  <Button
                    variant="outline"
                    onClick={approveSOV}
                    disabled={!canApproveSOV || isSOVApproved || hasDraws || items.length === 0 || hasChanges || approving}
                  >
                    {isSOVApproved ? "SOV Approved" : approving ? "Approving..." : "Approve SOV"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => importFileInputRef.current?.click()}
                    disabled={isSOVLocked}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV/XLSX
                  </Button>
                  <Button variant="outline" onClick={addItem} disabled={isSOVLocked}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line
                  </Button>
                  {hasChanges && (
                    <Button onClick={saveSOV} disabled={saving || isSOVLocked}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  )}
                </>
              )}
              {(activeDraw || isCreateDrawTab) && (
                <>
                  {activeDraw && (activeDraw.status || "").toLowerCase() !== "draft" && (
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/receivables/invoices/${activeDraw.id}`)}
                    >
                      View in Receivables
                    </Button>
                  )}
                  {!isCreateDrawTab && shouldShowNextDraftTab && (
                    <Button onClick={() => setActiveBillingTab(nextDraftTabValue)} disabled={!canCreateDraw}>
                      <Plus className="h-4 w-4 mr-2" />
                      {hasDraws ? `Create Draw #${nextDrawNumber}` : "Create Draw #1"}
                    </Button>
                  )}
                </>
              )}
            </div>
            {activeBillingTab === "sov" && items.length === 0 && (
              <p className="text-sm text-amber-700 mt-3">
                Create your Schedule of Values before drafting Draw #1.
              </p>
            )}
            {activeBillingTab === "sov" && !hasDraws && hasSOVItems && !isSOVApproved && (
              <p className="text-sm text-amber-700 mt-3">
                Approve the Schedule of Values before creating Draw #1.
              </p>
            )}
            {activeBillingTab === "sov" && !hasDraws && hasChanges && hasSOVItems && (
              <p className="text-sm text-muted-foreground mt-3">
                Save SOV changes before creating Draw #1.
              </p>
            )}
            {activeBillingTab === "sov" && !canApproveSOV && !isSOVApproved && (
              <p className="text-sm text-muted-foreground mt-3">
                Only admins, company admins, controllers, and super admins can approve the Schedule of Values.
              </p>
            )}
            {isSOVApproved && activeBillingTab === "sov" && (
              <p className="text-sm text-muted-foreground mt-3">
                Schedule of Values has been approved, closed, and locked. It cannot be changed after approval or after Draw #1 is created.
              </p>
            )}
            {hasDraws && activeBillingTab === "sov" && (
              <p className="text-sm text-muted-foreground mt-3">
                Schedule of Values is locked because at least one draw has been created.
              </p>
            )}
          </div>
          <TabsContent value="sov" className="mt-0">
            <div ref={sovSectionRef}>
            {items.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/50">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Schedule of Values</h3>
            <p className="text-muted-foreground mb-4">
              Add line items to define the billing breakdown for this project
            </p>
            <Button onClick={addItem} disabled={isSOVLocked}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Line Item
            </Button>
          </div>
            ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-24">Item #</TableHead>
                  <TableHead>Description of Work</TableHead>
                  <TableHead className="w-48 text-right">Scheduled Value</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.id || `new-${index}`}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.item_number}
                        disabled={isSOVLocked}
                        onChange={(e) => updateItem(index, "item_number", e.target.value)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        ref={(el) => {
                          descriptionInputRefs.current[index] = el;
                        }}
                        value={item.description}
                        disabled={isSOVLocked}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        onKeyDown={handleDescriptionEnter(index)}
                        placeholder="Enter description of work"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">$</span>
                        <CurrencyInput
                          ref={(el) => {
                            scheduledValueInputRefs.current[index] = el;
                          }}
                          value={item.scheduled_value}
                          disabled={isSOVLocked}
                          onChange={(val) => updateItem(index, "scheduled_value", parseFloat(val) || 0)}
                          onKeyDown={handleScheduledValueEnter(index)}
                          className="text-right"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        disabled={isSOVLocked}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Total Row */}
            <div className="flex justify-end items-center gap-4 mt-4 pt-4 border-t">
              <span className="font-medium">Total Contract Sum:</span>
              <span className="text-xl font-bold">${formatNumber(totalScheduledValue)}</span>
            </div>
          </>
            )}
            </div>
          </TabsContent>

          {drawsAsc.map((draw) => (
            <TabsContent key={draw.id} value={`draw:${draw.id}`} className="mt-0">
              {(draw.status || "").toLowerCase() === "draft" ? (
                <div className="rounded-lg border p-4">
                  <AddARInvoice
                    embedded
                    existingInvoiceId={draw.id}
                    initialJobId={jobId}
                    initialCustomerId={jobCustomerId || undefined}
                    lockJobContext
                    onSaved={async (invoiceId) => {
                      await loadDraws();
                      const next = new URLSearchParams(searchParams);
                      next.set("drawId", invoiceId);
                      setSearchParams(next, { replace: true });
                      setActiveBillingTab(`draw:${invoiceId}`);
                    }}
                    onStatusChanged={async (invoiceId) => {
                      await loadDraws();
                      const next = new URLSearchParams(searchParams);
                      next.set("drawId", invoiceId);
                      setSearchParams(next, { replace: true });
                      setActiveBillingTab(`draw:${invoiceId}`);
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-lg border">
                  <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="font-medium">
                        {draw.application_number ? `Draw #${draw.application_number}` : draw.invoice_number}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {draw.issue_date ? new Date(draw.issue_date).toLocaleDateString() : "No issue date"} · {draw.invoice_number}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">{draw.status}</Badge>
                      <span className="text-sm font-medium">${formatNumber(draw.total_amount || 0)}</span>
                      <Button variant="outline" onClick={() => navigate(`/receivables/invoices/${draw.id}`)}>
                        View in Receivables
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 text-sm text-muted-foreground">
                    This draw is locked in Job Billing after it leaves draft. Drafts are edited directly in this tab.
                  </div>
                </div>
              )}
            </TabsContent>
          ))}

          <TabsContent value={nextDraftTabValue} className="mt-0">
            <div className="rounded-lg border p-4">
              {canCreateDraw ? (
                <AddARInvoice
                  key={`draw-draft-${nextDrawNumber}`}
                  embedded
                  initialJobId={jobId}
                  initialCustomerId={jobCustomerId || undefined}
                  lockJobContext
                  onSaved={async (invoiceId) => {
                    await loadDraws();
                    const next = new URLSearchParams(searchParams);
                    next.set("drawId", invoiceId);
                    setSearchParams(next, { replace: true });
                    setActiveBillingTab(`draw:${invoiceId}`);
                  }}
                  onCancel={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete("drawId");
                    setSearchParams(next, { replace: true });
                    setActiveBillingTab(drawsAsc[0] ? `draw:${drawsAsc[0].id}` : "sov");
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Complete and approve the Schedule of Values before creating Draw #{nextDrawNumber}.
                </p>
              )}
            </div>
          </TabsContent>

          {draws.length === 0 && !shouldShowNextDraftTab && (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              No draws yet. Approve the Schedule of Values, then create Draw #1 from this page.
            </div>
          )}
        </Tabs>
      </CardContent>

      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) resetImportState();
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Import Schedule of Values</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file, map your columns, preview the rows, then import into this job&apos;s SOV editor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium text-sm">{importFileName || "No file selected"}</p>
                <p className="text-xs text-muted-foreground">
                  {importRows.length > 0 ? `${importRows.length} row(s) detected` : "Choose a CSV/XLSX file to begin"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => importFileInputRef.current?.click()}
              >
                Choose File
              </Button>
            </div>

            {importHeaders.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Item # (optional)</Label>
                    <Select
                      value={importColumnMap.item_number}
                      onValueChange={(value) =>
                        setImportColumnMap((prev) => ({ ...prev, item_number: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IMPORT_NONE}>Auto-number (sequential)</SelectItem>
                        {importHeaders.map((header) => (
                          <SelectItem key={`item-${header}`} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Description of Work</Label>
                    <Select
                      value={importColumnMap.description}
                      onValueChange={(value) =>
                        setImportColumnMap((prev) => ({ ...prev, description: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IMPORT_NONE}>Select description column</SelectItem>
                        {importHeaders.map((header) => (
                          <SelectItem key={`desc-${header}`} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Scheduled Value</Label>
                    <Select
                      value={importColumnMap.scheduled_value}
                      onValueChange={(value) =>
                        setImportColumnMap((prev) => ({ ...prev, scheduled_value: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IMPORT_NONE}>Select value column</SelectItem>
                        {importHeaders.map((header) => (
                          <SelectItem key={`val-${header}`} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Import Mode</Label>
                  <RadioGroup
                    value={importMode}
                    onValueChange={(value) => setImportMode(value as ImportMode)}
                    className="grid grid-cols-1 md:grid-cols-2 gap-3"
                  >
                    <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
                      <RadioGroupItem value="append" id="sov-import-append" className="mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Append</div>
                        <div className="text-xs text-muted-foreground">
                          Add imported rows after the existing Schedule of Values items.
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
                      <RadioGroupItem value="replace" id="sov-import-replace" className="mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Replace</div>
                        <div className="text-xs text-muted-foreground">
                          Replace the current SOV rows in the editor with imported rows.
                        </div>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Preview</Label>
                    <span className="text-xs text-muted-foreground">
                      Showing first {Math.min(mappedImportPreview.length, 8)} row(s)
                    </span>
                  </div>
                  <div className="max-h-72 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead className="w-28">Item #</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-40 text-right">Scheduled Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappedImportPreview.map((row) => (
                          <TableRow key={`preview-${row.row}`}>
                            <TableCell>{row.row}</TableCell>
                            <TableCell>{row.itemNumber || "Auto"}</TableCell>
                            <TableCell className="max-w-[420px] truncate">
                              {row.description || <span className="text-muted-foreground">Missing description</span>}
                            </TableCell>
                            <TableCell className={`text-right ${row.scheduledValid ? "" : "text-destructive"}`}>
                              {row.rawScheduled || "0"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={applyImportedRows}
              disabled={importApplying || importRows.length === 0}
            >
              {importApplying ? "Importing..." : `Import ${importRows.length || ""} Row${importRows.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
