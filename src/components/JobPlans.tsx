import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Upload, Pencil, Stamp } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

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

  const [formData, setFormData] = useState({
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
    if (!selectedFile || !formData.plan_name) {
      toast.error("Please provide a plan name and select a file");
      return;
    }

    setUploading(true);
    try {
      let fileUrl = "";
      let fileName = selectedFile.name;

      // If editing and new file selected, delete old file first
      if (editingPlan && selectedFile) {
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
            file_size: selectedFile.size,
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
            file_size: selectedFile.size,
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

  const handlePreview = (plan: JobPlan) => {
    navigate(`/plans/${plan.id}`);
  };

  if (loading) {
    return <div className="p-6">Loading plans...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Construction Plans</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No plans uploaded yet. Click "Upload Plan" to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePreview(plan)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(plan);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <h3 className="font-semibold text-sm mb-1">{plan.plan_name}</h3>
                {plan.plan_number && (
                  <p className="text-xs text-muted-foreground">Plan #: {plan.plan_number}</p>
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
            <DialogTitle>{editingPlan ? "Edit Plan" : "Upload New Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="plan_name">Plan Name *</Label>
              <Input
                id="plan_name"
                value={formData.plan_name}
                onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                placeholder="e.g., Site Plan"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan_number">Plan Number</Label>
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
              <Input
                id="file"
                type="file"
                accept=".pdf,.dwg,.dxf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
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

    </div>
  );
}
