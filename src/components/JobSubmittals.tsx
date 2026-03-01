import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import type { Enums, Tables, TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Plus, Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { PostgrestError } from "@supabase/supabase-js";

interface JobSubmittalsProps {
  jobId: string;
}

type SubmittalStatus = Enums<"submittal_status">;
type Submittal = Tables<"submittals">;

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
}

const STATUS_OPTIONS: SubmittalStatus[] = ["draft", "submitted", "in_review", "approved", "rejected", "closed"];

const getErrorMessage = (error: unknown): string => {
  if (!error) return "Unknown error";
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Unknown error";
};

const isMissingTableError = (error: PostgrestError) => error.code === "42P01";

type UserCompanyAccessProfileRow = {
  user_id: string;
  profiles: {
    user_id: string;
    first_name: string;
    last_name: string;
  } | null;
};

export default function JobSubmittals({ jobId }: JobSubmittalsProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [submittals, setSubmittals] = useState<Submittal[]>([]);
  const [companyUsers, setCompanyUsers] = useState<Profile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSubmittal, setSelectedSubmittal] = useState<Submittal | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    submittal_number: "",
    title: "",
    description: "",
    spec_section: "",
    assigned_to: "",
    due_date: "",
    attachment_url: "",
  });

  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    spec_section: "",
    assigned_to: "",
    due_date: "",
    attachment_url: "",
    review_notes: "",
    status: "draft" as SubmittalStatus,
  });

  const fetchSubmittals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("submittals")
        .select("*")
        .eq("job_id", jobId)
        .eq("company_id", currentCompany?.id ?? "")
        .order("created_at", { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          setTableMissing(true);
          return;
        }
        throw error;
      }

      setTableMissing(false);
      setSubmittals(data || []);
    } catch (error) {
      console.error("Error fetching submittals:", error);
      toast.error("Failed to load submittals");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, jobId]);

  const fetchCompanyUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("user_company_access")
        .select("user_id, profiles(user_id, first_name, last_name)")
        .eq("company_id", currentCompany?.id ?? "")
        .eq("is_active", true);

      if (error) throw error;
      const rows = (data || []) as unknown as UserCompanyAccessProfileRow[];
      const users = rows
        .map((row) => row.profiles)
        .filter((profile): profile is Profile => Boolean(profile));
      setCompanyUsers(users);
    } catch (error) {
      console.error("Error loading company users:", error);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    void fetchSubmittals();
    void fetchCompanyUsers();
  }, [currentCompany?.id, fetchCompanyUsers, fetchSubmittals]);

  const userNameById = useMemo(() => {
    const map: Record<string, string> = {};
    companyUsers.forEach((u) => {
      map[u.user_id] = `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Unknown User";
    });
    return map;
  }, [companyUsers]);

  const getStatusBadge = (status: SubmittalStatus) => {
    const classes: Record<SubmittalStatus, string> = {
      draft: "bg-muted text-muted-foreground",
      submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      in_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      closed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    };
    return <Badge className={classes[status]}>{status.replace("_", " ")}</Badge>;
  };

  const handleCreateSubmittal = async () => {
    if (!createForm.submittal_number.trim() || !createForm.title.trim()) {
      toast.error("Submittal number and title are required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("submittals")
        .insert({
          company_id: currentCompany?.id,
          job_id: jobId,
          submittal_number: createForm.submittal_number.trim(),
          title: createForm.title.trim(),
          description: createForm.description.trim() || null,
          spec_section: createForm.spec_section.trim() || null,
          assigned_to: createForm.assigned_to || null,
          due_date: createForm.due_date || null,
          attachment_url: createForm.attachment_url.trim() || null,
          submitted_by: user?.id,
          status: "draft",
        });

      if (error) throw error;

      toast.success("Submittal created");
      setDialogOpen(false);
      setCreateForm({
        submittal_number: "",
        title: "",
        description: "",
        spec_section: "",
        assigned_to: "",
        due_date: "",
        attachment_url: "",
      });
      await fetchSubmittals();
    } catch (error) {
      console.error("Error creating submittal:", error);
      toast.error(getErrorMessage(error) || "Failed to create submittal");
    } finally {
      setSaving(false);
    }
  };

  const openSubmittal = (submittal: Submittal) => {
    setSelectedSubmittal(submittal);
    setEditForm({
      title: submittal.title || "",
      description: submittal.description || "",
      spec_section: submittal.spec_section || "",
      assigned_to: submittal.assigned_to || "",
      due_date: submittal.due_date || "",
      attachment_url: submittal.attachment_url || "",
      review_notes: submittal.review_notes || "",
      status: submittal.status,
    });
  };

  const handleSaveSubmittal = async () => {
    if (!selectedSubmittal) return;
    if (!editForm.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    try {
      const previous = selectedSubmittal.status;
      const next = editForm.status;
      const updatePayload: TablesUpdate<"submittals"> = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        spec_section: editForm.spec_section.trim() || null,
        assigned_to: editForm.assigned_to || null,
        due_date: editForm.due_date || null,
        attachment_url: editForm.attachment_url.trim() || null,
        review_notes: editForm.review_notes.trim() || null,
        status: next,
      };

      if (previous !== "submitted" && next === "submitted") {
        updatePayload.submitted_at = new Date().toISOString();
      }

      if (["approved", "rejected"].includes(next) && !selectedSubmittal.reviewed_at) {
        updatePayload.reviewed_at = new Date().toISOString();
        updatePayload.reviewed_by = user?.id || null;
      }

      const { error } = await supabase
        .from("submittals")
        .update(updatePayload)
        .eq("id", selectedSubmittal.id);

      if (error) throw error;

      toast.success("Submittal updated");
      await fetchSubmittals();
      setSelectedSubmittal(null);
    } catch (error) {
      console.error("Error updating submittal:", error);
      toast.error(getErrorMessage(error) || "Failed to update submittal");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitSubmittal = async (submittal: Submittal) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("submittals")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", submittal.id);

      if (error) throw error;
      toast.success("Submittal submitted");
      await fetchSubmittals();
    } catch (error) {
      console.error("Error submitting submittal:", error);
      toast.error("Failed to submit submittal");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading submittals...</div>;
  }

  if (tableMissing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submittals</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Submittals database table is not deployed yet. Apply the latest Supabase migration, then reload this page.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Submittals</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Submittal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Submittal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="submittal-number">Submittal Number *</Label>
                  <Input
                    id="submittal-number"
                    value={createForm.submittal_number}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, submittal_number: e.target.value }))}
                    placeholder="SUB-001"
                  />
                </div>
                <div>
                  <Label htmlFor="submittal-due-date">Due Date</Label>
                  <Input
                    id="submittal-due-date"
                    type="date"
                    value={createForm.due_date}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="submittal-title">Title *</Label>
                <Input
                  id="submittal-title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Door hardware package"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="submittal-spec-section">Spec Section</Label>
                  <Input
                    id="submittal-spec-section"
                    value={createForm.spec_section}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, spec_section: e.target.value }))}
                    placeholder="08 71 00"
                  />
                </div>
                <div>
                  <Label htmlFor="submittal-assigned-to">Assigned Reviewer</Label>
                  <Select
                    value={createForm.assigned_to}
                    onValueChange={(value) => setCreateForm((prev) => ({ ...prev, assigned_to: value }))}
                  >
                    <SelectTrigger id="submittal-assigned-to">
                      <SelectValue placeholder="Select reviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      {companyUsers.map((profile) => (
                        <SelectItem key={profile.user_id} value={profile.user_id}>
                          {profile.first_name} {profile.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="submittal-description">Description</Label>
                <Textarea
                  id="submittal-description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Details about this submittal package"
                />
              </div>
              <div>
                <Label htmlFor="submittal-attachment-url">Attachment URL</Label>
                <Input
                  id="submittal-attachment-url"
                  value={createForm.attachment_url}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, attachment_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSubmittal} disabled={saving}>
                  {saving ? "Creating..." : "Create Submittal"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {submittals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No submittals yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {submittals.map((submittal) => (
            <Card key={submittal.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {submittal.submittal_number} - {submittal.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {submittal.spec_section && <span>Spec: {submittal.spec_section}</span>}
                      {submittal.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due {format(new Date(submittal.due_date), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(submittal.status)}
                    <Button size="sm" variant="outline" onClick={() => openSubmittal(submittal)}>
                      Open
                    </Button>
                    {submittal.status === "draft" && (
                      <Button size="sm" onClick={() => void handleSubmitSubmittal(submittal)} disabled={saving}>
                        Submit
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                {submittal.description && <p>{submittal.description}</p>}
                <div className="flex flex-wrap gap-4">
                  <span>Assigned: {submittal.assigned_to ? userNameById[submittal.assigned_to] || "Unknown User" : "Unassigned"}</span>
                  <span>Created: {format(new Date(submittal.created_at), "MMM d, yyyy")}</span>
                  {submittal.submitted_at && <span>Submitted: {format(new Date(submittal.submitted_at), "MMM d, yyyy")}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedSubmittal} onOpenChange={(open) => !open && setSelectedSubmittal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedSubmittal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedSubmittal.submittal_number}
                  {getStatusBadge(editForm.status)}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-title">Title</Label>
                    <Input
                      id="edit-title"
                      value={editForm.title}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value as SubmittalStatus }))}
                    >
                      <SelectTrigger id="edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-spec">Spec Section</Label>
                    <Input
                      id="edit-spec"
                      value={editForm.spec_section}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, spec_section: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-due-date">Due Date</Label>
                    <Input
                      id="edit-due-date"
                      type="date"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, due_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-assigned">Assigned Reviewer</Label>
                  <Select
                    value={editForm.assigned_to}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, assigned_to: value }))}
                  >
                    <SelectTrigger id="edit-assigned">
                      <SelectValue placeholder="Select reviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      {companyUsers.map((profile) => (
                        <SelectItem key={profile.user_id} value={profile.user_id}>
                          {profile.first_name} {profile.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-review-notes">Review Notes</Label>
                  <Textarea
                    id="edit-review-notes"
                    value={editForm.review_notes}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, review_notes: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-attachment-url">Attachment URL</Label>
                  <Input
                    id="edit-attachment-url"
                    value={editForm.attachment_url}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, attachment_url: e.target.value }))}
                    placeholder="https://..."
                  />
                  {editForm.attachment_url && (
                    <Button
                      variant="link"
                      className="px-0"
                      onClick={() => window.open(editForm.attachment_url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open attachment
                    </Button>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedSubmittal(null)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleSaveSubmittal()} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
