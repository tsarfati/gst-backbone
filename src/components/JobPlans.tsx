import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Upload, Pencil, Stamp, ArrowUp, ArrowDown, ArrowUpDown, Zap, Droplets, Wind, Flame, Building2, HardHat, Wrench, Info, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import DragDropUpload from "@/components/DragDropUpload";
import UnifiedViewSelector from "@/components/ui/unified-view-selector";
import { useUnifiedViewPreference, type UnifiedViewType } from "@/hooks/useUnifiedViewPreference";

interface JobPlansProps {
  jobId: string;
}

interface JobPlan {
  id: string;
  plan_name: string;
  plan_number: string | null;
  revision: string | null;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string;
  uploaded_at: string;
  architect: string | null;
  is_permit_set: boolean;
  revision_date: string | null;
}

type PlanSortKey = "plan_name" | "plan_number" | "revision" | "architect" | "revision_date" | "uploaded_at";
type SortDirection = "asc" | "desc";

function parsePlanMetadataFromFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const normalized = baseName.replace(/[_]+/g, " ").trim();

  // Common plan number patterns like A-101, A101, P1.0, M-201.1
  const planNumberMatch = normalized.match(/\b([A-Z]{1,4}[- ]?\d{1,4}(?:\.\d+)?)\b/i);

  // Common revision patterns: Rev 2, R2, Revision B
  const revisionMatch = normalized.match(/\b(?:rev(?:ision)?)[\s._-]*([A-Z0-9]+)\b/i)
    || normalized.match(/\bR[\s._-]*([A-Z0-9]+)\b/i);

  // Common date patterns in filenames
  const dateMatch = normalized.match(/\b(\d{4}[-_]\d{2}[-_]\d{2}|\d{2}[-_]\d{2}[-_]\d{4})\b/);

  let revisionDate = "";
  if (dateMatch) {
    const raw = dateMatch[1].replace(/_/g, "-");
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      revisionDate = raw;
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
      const [mm, dd, yyyy] = raw.split("-");
      revisionDate = `${yyyy}-${mm}-${dd}`;
    }
  }

  // Best-effort architect extraction if filename contains "by <name>"
  const architectMatch = normalized.match(/\bby[\s-]+([A-Za-z0-9 &.'-]{3,})$/i);

  const cleanedPlanName = normalized
    .replace(planNumberMatch?.[0] ?? "", "")
    .replace(revisionMatch?.[0] ?? "", "")
    .replace(dateMatch?.[0] ?? "", "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-._]+|[\s\-._]+$/g, "");

  return {
    plan_name: cleanedPlanName || normalized,
    plan_number: planNumberMatch?.[1]?.replace(/\s+/g, "-") || "",
    revision: revisionMatch?.[1] || "",
    revision_date: revisionDate,
    architect: architectMatch?.[1]?.trim() || "",
  };
}

function getPlanDisciplineKey(plan: Pick<JobPlan, "plan_name" | "plan_number">) {
  const text = `${plan.plan_name || ""} ${plan.plan_number || ""}`.toLowerCase();
  const planNo = (plan.plan_number || "").toLowerCase();

  if (
    /\b(plumb|plumbing|sanitary|waste|vent|domestic water)\b/.test(text) ||
    /^[p][-\s]?\d/.test(planNo)
  ) return "plumbing";
  if (
    /\b(electrical|power|lighting|low voltage|telecom)\b/.test(text) ||
    /^[e][-\s]?\d/.test(planNo)
  ) return "electrical";
  if (
    /\b(mechanical|hvac|duct|air handling)\b/.test(text) ||
    /^[m][-\s]?\d/.test(planNo)
  ) return "mechanical";
  if (
    /\b(fire protection|sprinkler|fire alarm)\b/.test(text) ||
    /^[fp][-\s]?\d/.test(planNo)
  ) return "fire";
  if (
    /\b(structural|foundation|steel|framing)\b/.test(text) ||
    /^[s][-\s]?\d/.test(planNo)
  ) return "structural";
  if (
    /\b(civil|site|grading|utility plan)\b/.test(text) ||
    /^[c][-\s]?\d/.test(planNo)
  ) return "civil";
  if (
    /\b(architect|architectural|floor plan|elevation|section|detail)\b/.test(text) ||
    /^[a][-\s]?\d/.test(planNo)
  ) return "architectural";

  return "general";
}

function PlanDisciplineIcon({ plan, className = "h-8 w-8" }: { plan: Pick<JobPlan, "plan_name" | "plan_number">; className?: string }) {
  const key = getPlanDisciplineKey(plan);

  switch (key) {
    case "plumbing":
      return <Droplets className={`${className} text-sky-500`} />;
    case "electrical":
      return <Zap className={`${className} text-amber-500`} />;
    case "mechanical":
      return <Wind className={`${className} text-cyan-500`} />;
    case "fire":
      return <Flame className={`${className} text-red-500`} />;
    case "structural":
      return <Building2 className={`${className} text-stone-500`} />;
    case "civil":
      return <HardHat className={`${className} text-yellow-600`} />;
    case "architectural":
      return <Wrench className={`${className} text-indigo-500`} />;
    default:
      return <FileText className={`${className} text-primary`} />;
  }
}

export default function JobPlans({ jobId }: JobPlansProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<JobPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingPlan, setEditingPlan] = useState<JobPlan | null>(null);
  const [infoPlan, setInfoPlan] = useState<JobPlan | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [infoEditMode, setInfoEditMode] = useState(false);
  const [infoSaving, setInfoSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [sortKey, setSortKey] = useState<PlanSortKey>("uploaded_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { currentView, setCurrentView, setDefaultView, isDefault } = useUnifiedViewPreference("job-plans-view", "icons");

  const [formData, setFormData] = useState({
    plan_name: "",
    plan_number: "",
    revision: "",
    description: "",
    architect: "",
    is_permit_set: false,
    revision_date: "",
  });
  const [infoFormData, setInfoFormData] = useState({
    plan_name: "",
    plan_number: "",
    revision: "",
    description: "",
    architect: "",
    is_permit_set: false,
    revision_date: "",
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchPlans();
    }
  }, [jobId, currentCompany?.id]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("job_plans")
        .select("*")
        .eq("job_id", jobId)
        .eq("company_id", currentCompany?.id)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!formData.plan_name) {
      toast.error("Please provide a plan name");
      return;
    }
    if (!editingPlan && !selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setUploading(true);
    try {
      let fileUrl = editingPlan?.file_url || "";
      let fileName = editingPlan?.file_name || "";
      let fileSize = editingPlan?.file_size || null;

      if (selectedFile) {
        fileName = selectedFile.name;
        fileSize = selectedFile.size;

        // If editing and new file selected, delete old file first
        if (editingPlan) {
          const oldFilePath = editingPlan.file_url.split("/company-files/")[1];
          if (oldFilePath) {
            await supabase.storage.from("company-files").remove([oldFilePath]);
          }
        }

        // Upload new file
        const fileExt = selectedFile.name.split(".").pop();
        const newFileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${currentCompany?.id}/plans/${jobId}/${newFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("company-files")
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("company-files")
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
      }

      if (editingPlan) {
        // Update existing plan
        const { error: updateError } = await supabase
          .from("job_plans")
          .update({
            plan_name: formData.plan_name,
            plan_number: formData.plan_number || null,
            revision: formData.revision || null,
            description: formData.description || null,
            architect: formData.architect || null,
            is_permit_set: formData.is_permit_set,
            revision_date: formData.revision_date || null,
            file_url: fileUrl,
            file_name: fileName,
            file_size: fileSize,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingPlan.id);

        if (updateError) throw updateError;
        toast.success("Plan updated successfully");
      } else {
        // Create new plan
        const { error: insertError } = await supabase
          .from("job_plans")
          .insert({
            job_id: jobId,
            company_id: currentCompany?.id,
            uploaded_by: user?.id,
            plan_name: formData.plan_name,
            plan_number: formData.plan_number || null,
            revision: formData.revision || null,
            description: formData.description || null,
            architect: formData.architect || null,
            is_permit_set: formData.is_permit_set,
            revision_date: formData.revision_date || null,
            file_url: fileUrl,
            file_name: fileName,
            file_size: fileSize,
          });

        if (insertError) throw insertError;
        toast.success("Plan uploaded successfully");
      }

      setDialogOpen(false);
      setFormData({ plan_name: "", plan_number: "", revision: "", description: "", architect: "", is_permit_set: false, revision_date: "" });
      setSelectedFile(null);
      setEditingPlan(null);
      fetchPlans();
    } catch (error: any) {
      console.error("Error uploading plan:", error);
      toast.error(error.message || "Failed to upload plan");
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (plan: JobPlan) => {
    setEditingPlan(plan);
    setFormData({
      plan_name: plan.plan_name,
      plan_number: plan.plan_number || "",
      revision: plan.revision || "",
      description: plan.description || "",
      architect: plan.architect || "",
      is_permit_set: plan.is_permit_set || false,
      revision_date: plan.revision_date || "",
    });
    setDialogOpen(true);
  };

  const openInfoModal = (plan: JobPlan) => {
    setInfoPlan(plan);
    setInfoFormData({
      plan_name: plan.plan_name,
      plan_number: plan.plan_number || "",
      revision: plan.revision || "",
      description: plan.description || "",
      architect: plan.architect || "",
      is_permit_set: plan.is_permit_set || false,
      revision_date: plan.revision_date || "",
    });
    setInfoEditMode(false);
    setDeleteConfirmText("");
    setInfoDialogOpen(true);
  };

  const handleSaveInfoModal = async () => {
    if (!infoPlan) return;
    if (!infoFormData.plan_name.trim()) {
      toast.error("Plan name is required");
      return;
    }

    setInfoSaving(true);
    try {
      const updates = {
        plan_name: infoFormData.plan_name.trim(),
        plan_number: infoFormData.plan_number || null,
        revision: infoFormData.revision || null,
        description: infoFormData.description || null,
        architect: infoFormData.architect || null,
        is_permit_set: infoFormData.is_permit_set,
        revision_date: infoFormData.revision_date || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("job_plans")
        .update(updates)
        .eq("id", infoPlan.id);

      if (error) throw error;

      setPlans((prev) => prev.map((p) => (p.id === infoPlan.id ? { ...p, ...updates } : p)));
      setInfoPlan((prev) => (prev ? ({ ...prev, ...updates } as JobPlan) : prev));
      setInfoEditMode(false);
      toast.success("Plan information updated");
    } catch (error: any) {
      console.error("Error updating plan info:", error);
      toast.error(error.message || "Failed to update plan information");
    } finally {
      setInfoSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!infoPlan) return;
    setDeletingPlan(true);
    try {
      const oldFilePath = infoPlan.file_url.split("/company-files/")[1];
      if (oldFilePath) {
        await supabase.storage.from("company-files").remove([oldFilePath]);
      }

      const { error } = await supabase
        .from("job_plans")
        .delete()
        .eq("id", infoPlan.id);

      if (error) throw error;

      setPlans((prev) => prev.filter((p) => p.id !== infoPlan.id));
      setDeleteConfirmOpen(false);
      setInfoDialogOpen(false);
      setInfoPlan(null);
      setDeleteConfirmText("");
      toast.success("Plan deleted");
    } catch (error: any) {
      console.error("Error deleting plan:", error);
      toast.error(error.message || "Failed to delete plan");
    } finally {
      setDeletingPlan(false);
    }
  };

  const applyFileAutoFill = (file: File | null) => {
    setSelectedFile(file);
    if (!file) return;

    const parsed = parsePlanMetadataFromFileName(file.name);
    setFormData((prev) => ({
      ...prev,
      plan_name: editingPlan ? prev.plan_name : (prev.plan_name || parsed.plan_name),
      plan_number: prev.plan_number || parsed.plan_number,
      revision: prev.revision || parsed.revision,
      revision_date: prev.revision_date || parsed.revision_date,
      architect: prev.architect || parsed.architect,
    }));
  };

  const handlePreview = (plan: JobPlan) => {
    navigate(`/plans/${plan.id}`);
  };

  const handleSort = (key: PlanSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDirection("asc");
      return key;
    });
  };

  const sortedPlans = [...plans].sort((a, b) => {
    const getValue = (plan: JobPlan) => {
      switch (sortKey) {
        case "uploaded_at":
          return new Date(plan.uploaded_at).getTime();
        case "revision_date":
          return plan.revision_date ? new Date(plan.revision_date).getTime() : 0;
        case "plan_name":
        case "plan_number":
        case "revision":
        case "architect":
          return (plan[sortKey] || "").toString().toLowerCase();
        default:
          return "";
      }
    };

    const av = getValue(a);
    const bv = getValue(b);

    let result = 0;
    if (typeof av === "number" && typeof bv === "number") {
      result = av - bv;
    } else {
      result = String(av).localeCompare(String(bv));
    }
    return sortDirection === "asc" ? result : -result;
  });

  const SortIcon = ({ column }: { column: PlanSortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-60" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const SortableHead = ({ column, label, className }: { column: PlanSortKey; label: string; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center font-medium hover:text-foreground"
        onClick={() => handleSort(column)}
      >
        {label}
        <SortIcon column={column} />
      </button>
    </TableHead>
  );

  const renderListRows = (compact = false) => (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead column="plan_name" label="Plan Set Name" />
            {!compact && <SortableHead column="plan_number" label="Plan Set #" />}
            {!compact && <SortableHead column="revision" label="Revision" />}
            <SortableHead column="architect" label="Architect" />
            {!compact && <SortableHead column="revision_date" label="Revision Date" />}
            <SortableHead column="uploaded_at" label="Uploaded" />
            <TableHead className="w-[90px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPlans.map((plan) => (
            <TableRow
              key={plan.id}
              className={`cursor-pointer ${compact ? "[&_td]:py-2 [&_td]:px-2.5" : ""}`}
              onClick={() => handlePreview(plan)}
            >
              <TableCell className={compact ? "align-top" : undefined}>
                <div className={`flex gap-2 ${compact ? "items-center" : "items-start"}`}>
                  <PlanDisciplineIcon
                    plan={plan}
                    className={compact ? "h-5 w-5 flex-shrink-0" : "h-4 w-4 mt-0.5 flex-shrink-0"}
                  />
                  <div className="min-w-0">
                    <div className={`font-medium truncate ${compact ? "text-sm leading-tight" : ""}`}>{plan.plan_name}</div>
                    {compact ? (
                      <div className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                        {[
                          plan.plan_number ? `#${plan.plan_number}` : null,
                          plan.revision ? `Rev ${plan.revision}` : null,
                          plan.architect || null,
                        ].filter(Boolean).join(" • ") || "—"}
                      </div>
                    ) : plan.description ? (
                      <div className="text-xs text-muted-foreground truncate max-w-[420px]">
                        {plan.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              {!compact && <TableCell>{plan.plan_number || "—"}</TableCell>}
              {!compact && <TableCell>{plan.revision || "—"}</TableCell>}
              <TableCell className={`${compact ? "max-w-[180px] align-top" : "max-w-[220px]"} truncate`}>{plan.architect || "—"}</TableCell>
              {!compact && (
                <TableCell>
                  {plan.revision_date ? format(new Date(plan.revision_date), "MMM d, yyyy") : "—"}
                </TableCell>
              )}
              <TableCell className={compact ? "align-top whitespace-nowrap" : undefined}>
                {format(new Date(plan.uploaded_at), compact ? "M/d/yy" : "MMM d, yyyy")}
              </TableCell>
              <TableCell className={`text-right ${compact ? "align-top" : ""}`}>
                <Button
                  size="sm"
                  variant="ghost"
                  className={compact ? "h-7 w-7 p-0" : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    openInfoModal(plan);
                  }}
                  title="Plan Information"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) {
    return <div className="p-6">Loading plans...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold">Construction Plan Sets</h2>
        <div className="flex flex-wrap items-center gap-2">
          <UnifiedViewSelector
            currentView={currentView}
            onViewChange={(view) => setCurrentView(view as UnifiedViewType)}
            onSetDefault={() => {
              setDefaultView();
              toast.success("Default plans view updated");
            }}
            isDefault={isDefault}
          />
          <Button onClick={() => setDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Plan Set
          </Button>
        </div>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No plan sets uploaded yet. Click "Upload Plan Set" to get started.
            </p>
          </CardContent>
        </Card>
      ) : currentView === "list" ? (
        renderListRows(false)
      ) : currentView === "compact" || currentView === "super-compact" ? (
        renderListRows(true)
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPlans.map((plan) => (
            <Card
              key={plan.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePreview(plan)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <PlanDisciplineIcon plan={plan} className="h-8 w-8 flex-shrink-0" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      openInfoModal(plan);
                    }}
                    title="Plan Set Information"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
                <h3 className="font-semibold text-sm mb-1">{plan.plan_name}</h3>
                {plan.plan_number && (
                  <p className="text-xs text-muted-foreground">Plan Set #: {plan.plan_number}</p>
                )}
                {plan.revision && (
                  <p className="text-xs text-muted-foreground">Rev: {plan.revision}</p>
                )}
                {plan.architect && (
                  <p className="text-xs text-muted-foreground">Architect: {plan.architect}</p>
                )}
                {plan.is_permit_set && (
                  <div className="flex items-center gap-1 mt-1">
                    <Stamp className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-primary">Stamped Permit Set</span>
                  </div>
                )}
                {plan.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {plan.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Uploaded: {format(new Date(plan.uploaded_at), "MMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
          setEditingPlan(null);
            setFormData({ plan_name: "", plan_number: "", revision: "", description: "", architect: "", is_permit_set: false, revision_date: "" });
            setSelectedFile(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan Set" : "Upload New Plan Set"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="plan_name">Plan Set Name *</Label>
              <Input
                id="plan_name"
                value={formData.plan_name}
                onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                placeholder="e.g., Site Plan"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan_number">Plan Set Number</Label>
                <Input
                  id="plan_number"
                  value={formData.plan_number}
                  onChange={(e) => setFormData({ ...formData, plan_number: e.target.value })}
                  placeholder="A-101"
                />
              </div>
              <div>
                <Label htmlFor="revision">Revision</Label>
                <Input
                  id="revision"
                  value={formData.revision}
                  onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
                  placeholder="Rev 2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="architect">Architect / Design Engineer</Label>
              <Input
                id="architect"
                value={formData.architect}
                onChange={(e) => setFormData({ ...formData, architect: e.target.value })}
                placeholder="e.g., Smith & Associates"
              />
            </div>
            <div>
              <Label htmlFor="revision_date">Revision Date</Label>
              <Input
                id="revision_date"
                type="date"
                value={formData.revision_date}
                onChange={(e) => setFormData({ ...formData, revision_date: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_permit_set"
                checked={formData.is_permit_set}
                onCheckedChange={(checked) => setFormData({ ...formData, is_permit_set: checked === true })}
              />
              <Label htmlFor="is_permit_set" className="cursor-pointer">Stamped Permit Set</Label>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about this plan"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="file">
                {editingPlan ? "Upload New File (optional)" : "Select File *"}
              </Label>
              <div className="space-y-2">
                <DragDropUpload
                  onFileSelect={applyFileAutoFill}
                  accept=".pdf,.dwg,.dxf"
                  maxSize={25}
                  disabled={uploading}
                  title={editingPlan ? "Drag replacement plan file here" : "Drag plan file here"}
                  dropTitle="Drop plan file here"
                  helperText="PDF, DWG, or DXF up to 25MB"
                />
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.dwg,.dxf"
                  onChange={(e) => {
                    applyFileAutoFill(e.target.files?.[0] || null);
                    e.target.value = "";
                  }}
                  className="sr-only"
                />
              </div>
              {!editingPlan && (
                <p className="text-xs text-muted-foreground mt-1">
                  Accepted formats: PDF, DWG, DXF
                </p>
              )}
              {editingPlan && !selectedFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to keep existing file
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading..." : editingPlan ? "Update" : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={infoDialogOpen}
        onOpenChange={(open) => {
          setInfoDialogOpen(open);
          if (!open) {
            setInfoEditMode(false);
            setDeleteConfirmOpen(false);
            setDeleteConfirmText("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Plan Set Information</DialogTitle>
          </DialogHeader>
          {infoPlan && (
            <div className="space-y-4">
              {infoEditMode ? (
                <>
                  <div>
                    <Label htmlFor="info_plan_name">Plan Set Name *</Label>
                    <Input
                      id="info_plan_name"
                      value={infoFormData.plan_name}
                      onChange={(e) => setInfoFormData((prev) => ({ ...prev, plan_name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="info_plan_number">Plan Set Number</Label>
                      <Input
                        id="info_plan_number"
                        value={infoFormData.plan_number}
                        onChange={(e) => setInfoFormData((prev) => ({ ...prev, plan_number: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="info_revision">Revision</Label>
                      <Input
                        id="info_revision"
                        value={infoFormData.revision}
                        onChange={(e) => setInfoFormData((prev) => ({ ...prev, revision: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="info_architect">Architect / Design Engineer</Label>
                    <Input
                      id="info_architect"
                      value={infoFormData.architect}
                      onChange={(e) => setInfoFormData((prev) => ({ ...prev, architect: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <Label htmlFor="info_revision_date">Revision Date</Label>
                      <Input
                        id="info_revision_date"
                        type="date"
                        value={infoFormData.revision_date}
                        onChange={(e) => setInfoFormData((prev) => ({ ...prev, revision_date: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center space-x-2 pb-2">
                      <Checkbox
                        id="info_is_permit_set"
                        checked={infoFormData.is_permit_set}
                        onCheckedChange={(checked) => setInfoFormData((prev) => ({ ...prev, is_permit_set: checked === true }))}
                      />
                      <Label htmlFor="info_is_permit_set" className="cursor-pointer">Stamped Permit Set</Label>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="info_description">Description</Label>
                    <Textarea
                      id="info_description"
                      rows={3}
                      value={infoFormData.description}
                      onChange={(e) => setInfoFormData((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <div className="font-semibold">{infoPlan.plan_name}</div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
                      <div>Plan Set #: <span className="text-foreground">{infoPlan.plan_number || "—"}</span></div>
                      <div>Revision: <span className="text-foreground">{infoPlan.revision || "—"}</span></div>
                      <div>Architect: <span className="text-foreground">{infoPlan.architect || "—"}</span></div>
                      <div>Revision Date: <span className="text-foreground">{infoPlan.revision_date ? format(new Date(infoPlan.revision_date), "MMM d, yyyy") : "—"}</span></div>
                      <div>Permit Set: <span className="text-foreground">{infoPlan.is_permit_set ? "Yes" : "No"}</span></div>
                      <div>Uploaded: <span className="text-foreground">{format(new Date(infoPlan.uploaded_at), "MMM d, yyyy")}</span></div>
                    </div>
                    <div className="mt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                      <p className="mt-1 text-foreground">{infoPlan.description || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                {infoEditMode ? (
                  <Button
                    variant="destructive"
                    type="button"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Plan Set
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  {infoEditMode ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!infoPlan) return;
                          openInfoModal(infoPlan);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleSaveInfoModal} disabled={infoSaving}>
                        {infoSaving ? "Saving..." : "Save Changes"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={() => setInfoDialogOpen(false)}>
                        Close
                      </Button>
                      <Button type="button" onClick={() => setInfoEditMode(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan set permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the plan set record and file. This action cannot be undone.
              {infoPlan ? ` Type DELETE and enter "${infoPlan.plan_name}" below to confirm.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete_plan_confirm">Confirmation</Label>
            <Input
              id="delete_plan_confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={infoPlan ? `DELETE | ${infoPlan.plan_name}` : "DELETE"}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPlan}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                const planNameOk = infoPlan ? deleteConfirmText.includes(infoPlan.plan_name) : true;
                const deleteKeywordOk = deleteConfirmText.includes("DELETE");
                if (!deleteKeywordOk || !planNameOk) {
                  e.preventDefault();
                  toast.error("Type DELETE and the exact plan name to confirm deletion");
                  return;
                }
                void handleDeletePlan();
              }}
              disabled={deletingPlan}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingPlan ? "Deleting..." : "Delete Plan Set"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
