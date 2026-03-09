import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, FileText, Send, MessageSquare, Paperclip, Calendar, X } from "lucide-react";
import { format } from "date-fns";
import DragDropUpload from "@/components/DragDropUpload";
import MentionTextarea from "@/components/MentionTextarea";
import { createMentionNotifications } from "@/utils/mentions";
import type { Json } from "@/integrations/supabase/types";

interface JobRFIsProps {
  jobId: string;
}

interface RFI {
  id: string;
  rfi_number: string;
  subject: string;
  description: string;
  metadata?: Json;
  created_by: string;
  assigned_to: string | null;
  status: string;
  ball_in_court: string;
  due_date: string | null;
  response: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface RFIMessage {
  id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  profiles: Profile;
}

interface RFIAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  uploaded_by: string;
  uploaded_at: string;
}

export default function JobRFIs({ jobId }: JobRFIsProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [companyUsers, setCompanyUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRfi, setSelectedRfi] = useState<RFI | null>(null);
  const [rfiMessages, setRfiMessages] = useState<RFIMessage[]>([]);
  const [rfiAttachments, setRfiAttachments] = useState<RFIAttachment[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingRfiDetails, setSavingRfiDetails] = useState(false);
  const [creatingRfi, setCreatingRfi] = useState(false);
  const [createAttachments, setCreateAttachments] = useState<File[]>([]);
  const [rfiEditForm, setRfiEditForm] = useState({
    rfi_number: "",
    subject: "",
    question: "",
    assigned_to: "",
    due_date: "",
    received_from: "",
    distribution_list: "",
    responsible_contractor: "",
    specification: "",
    location: "",
    rfi_stage: "",
    drawing_number: "",
    cost_code: "",
    schedule_impact: "",
    cost_impact: "",
    reference: "",
    is_private: false,
  });
  const userMetadata = (user?.user_metadata || {}) as Record<string, unknown>;
  const actorName =
    (typeof userMetadata.full_name === "string" && userMetadata.full_name) ||
    (typeof userMetadata.name === "string" && userMetadata.name) ||
    user?.email ||
    "A teammate";

  const [formData, setFormData] = useState({
    rfi_number: "",
    subject: "",
    question: "",
    assigned_to: "",
    due_date: "",
    received_from: "",
    distribution_list: "",
    responsible_contractor: "",
    specification: "",
    location: "",
    rfi_stage: "",
    drawing_number: "",
    cost_code: "",
    schedule_impact: "",
    cost_impact: "",
    reference: "",
    is_private: false,
  });

  const fetchRFIs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("rfis")
        .select("*")
        .eq("job_id", jobId)
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRfis(data || []);
    } catch (error) {
      console.error("Error fetching RFIs:", error);
      toast.error("Failed to load RFIs");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, jobId]);

  const fetchCompanyUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("user_company_access")
        .select("user_id, profiles(user_id, first_name, last_name)")
        .eq("company_id", currentCompany?.id)
        .eq("is_active", true);

      if (error) throw error;
      const users = data?.map((item) => (item as any).profiles).filter(Boolean) as Profile[];
      setCompanyUsers(users);
    } catch (error) {
      console.error("Error fetching company users:", error);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (currentCompany?.id) {
      void fetchRFIs();
      void fetchCompanyUsers();
    }
  }, [currentCompany?.id, fetchCompanyUsers, fetchRFIs]);

  const fetchRFIDetails = async (rfi: RFI) => {
    try {
      // Fetch messages
      const { data: messages, error: messagesError } = await supabase
        .from("rfi_messages")
        .select("*")
        .eq("rfi_id", rfi.id)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      // Fetch profiles for messages
      const userIds = messages?.map(m => m.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      const messagesWithProfiles = messages?.map(msg => ({
        ...msg,
        profiles: profiles?.find(p => p.user_id === msg.user_id) || { user_id: msg.user_id, first_name: "Unknown", last_name: "User" }
      })) || [];

      setRfiMessages(messagesWithProfiles);

      // Fetch attachments
      const { data: attachments, error: attachmentsError } = await supabase
        .from("rfi_attachments")
        .select("*")
        .eq("rfi_id", rfi.id)
        .order("uploaded_at", { ascending: false });

      if (attachmentsError) throw attachmentsError;
      setRfiAttachments(attachments || []);
    } catch (error) {
      console.error("Error fetching RFI details:", error);
      toast.error("Failed to load RFI details");
    }
  };

  const queueCreateAttachment = (file: File) => {
    setCreateAttachments((prev) => [...prev, file]);
  };

  const removeCreateAttachment = (index: number) => {
    setCreateAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadCreateAttachments = async (rfiId: string) => {
    if (!createAttachments.length) return;

    for (const file of createAttachments) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${currentCompany?.id}/rfis/${rfiId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("company-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-files")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from("rfi_attachments")
        .insert({
          rfi_id: rfiId,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          uploaded_by: user?.id,
        });

      if (dbError) throw dbError;
    }
  };

  const getMetadataObject = (metadata: Json | undefined) => {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
    return metadata as Record<string, unknown>;
  };

  const toStr = (value: unknown) => (typeof value === "string" ? value : "");

  const hydrateRfiEditForm = (rfi: RFI) => {
    const metadata = getMetadataObject(rfi.metadata);
    setRfiEditForm({
      rfi_number: rfi.rfi_number || "",
      subject: rfi.subject || "",
      question: rfi.description || "",
      assigned_to: rfi.assigned_to || "",
      due_date: rfi.due_date || "",
      received_from: toStr(metadata.received_from),
      distribution_list: toStr(metadata.distribution_list),
      responsible_contractor: toStr(metadata.responsible_contractor),
      specification: toStr(metadata.specification),
      location: toStr(metadata.location),
      rfi_stage: toStr(metadata.rfi_stage),
      drawing_number: toStr(metadata.drawing_number),
      cost_code: toStr(metadata.cost_code),
      schedule_impact: toStr(metadata.schedule_impact),
      cost_impact: toStr(metadata.cost_impact),
      reference: toStr(metadata.reference),
      is_private: metadata.is_private === true,
    });
  };

  const handleSaveRfiDetails = async () => {
    if (!selectedRfi) return;
    if (!rfiEditForm.rfi_number || !rfiEditForm.subject || !rfiEditForm.question) {
      toast.error("Number, subject, and question are required");
      return;
    }

    setSavingRfiDetails(true);
    try {
      const { data, error } = await supabase
        .from("rfis")
        .update({
          rfi_number: rfiEditForm.rfi_number,
          subject: rfiEditForm.subject,
          description: rfiEditForm.question,
          assigned_to: rfiEditForm.assigned_to || null,
          due_date: rfiEditForm.due_date || null,
          metadata: {
            received_from: rfiEditForm.received_from || null,
            distribution_list: rfiEditForm.distribution_list || null,
            responsible_contractor: rfiEditForm.responsible_contractor || null,
            specification: rfiEditForm.specification || null,
            location: rfiEditForm.location || null,
            rfi_stage: rfiEditForm.rfi_stage || null,
            drawing_number: rfiEditForm.drawing_number || null,
            cost_code: rfiEditForm.cost_code || null,
            schedule_impact: rfiEditForm.schedule_impact || null,
            cost_impact: rfiEditForm.cost_impact || null,
            reference: rfiEditForm.reference || null,
            is_private: rfiEditForm.is_private === true,
            rfi_manager_id: user?.id || null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRfi.id)
        .select()
        .single();

      if (error) throw error;
      if (data) setSelectedRfi(data as RFI);
      await fetchRFIs();
      toast.success("RFI updated");
    } catch (error) {
      console.error("Error updating RFI:", error);
      toast.error("Failed to update RFI");
    } finally {
      setSavingRfiDetails(false);
    }
  };

  const handleCreateRFI = async () => {
    if (!formData.rfi_number || !formData.subject || !formData.question) {
      toast.error("Please fill in RFI number, subject, and question");
      return;
    }

    setCreatingRfi(true);
    try {
      const { data, error } = await supabase
        .from("rfis")
        .insert({
          job_id: jobId,
          company_id: currentCompany?.id,
          created_by: user?.id,
          rfi_number: formData.rfi_number,
          subject: formData.subject,
          description: formData.question,
          assigned_to: formData.assigned_to || null,
          due_date: formData.due_date || null,
          status: "draft",
          ball_in_court: "manager",
          metadata: {
            received_from: formData.received_from || null,
            distribution_list: formData.distribution_list || null,
            responsible_contractor: formData.responsible_contractor || null,
            specification: formData.specification || null,
            location: formData.location || null,
            rfi_stage: formData.rfi_stage || null,
            drawing_number: formData.drawing_number || null,
            cost_code: formData.cost_code || null,
            schedule_impact: formData.schedule_impact || null,
            cost_impact: formData.cost_impact || null,
            reference: formData.reference || null,
            is_private: formData.is_private === true,
            rfi_manager_id: user?.id || null,
          },
        })
        .select()
        .single();

      if (error) throw error;
      if (data?.id) {
        await uploadCreateAttachments(data.id);
      }

      toast.success("RFI created successfully");
      setDialogOpen(false);
      setCreateAttachments([]);
      setFormData({
        rfi_number: "",
        subject: "",
        question: "",
        assigned_to: "",
        due_date: "",
        received_from: "",
        distribution_list: "",
        responsible_contractor: "",
        specification: "",
        location: "",
        rfi_stage: "",
        drawing_number: "",
        cost_code: "",
        schedule_impact: "",
        cost_impact: "",
        reference: "",
        is_private: false,
      });
      fetchRFIs();
    } catch (error) {
      console.error("Error creating RFI:", error);
      toast.error((error as { message?: string })?.message || "Failed to create RFI");
    } finally {
      setCreatingRfi(false);
    }
  };

  const handleSubmitRFI = async (rfi: RFI) => {
    if (!rfi.assigned_to) {
      toast.error("Please assign the RFI to a design professional before submitting");
      return;
    }

    try {
      const { error } = await supabase
        .from("rfis")
        .update({
          status: "submitted",
          ball_in_court: "design_professional",
          updated_at: new Date().toISOString(),
        })
        .eq("id", rfi.id);

      if (error) throw error;

      toast.success("RFI submitted to design professional");
      fetchRFIs();
      if (selectedRfi?.id === rfi.id) {
        setSelectedRfi({ ...rfi, status: "submitted", ball_in_court: "design_professional" });
      }
    } catch (error) {
      console.error("Error submitting RFI:", error);
      toast.error("Failed to submit RFI");
    }
  };

  const handleRespondToRFI = async (rfi: RFI, response: string) => {
    try {
      const isDesignProfessional = rfi.assigned_to === user?.id;
      const newBallInCourt = isDesignProfessional ? "manager" : "design_professional";
      const newStatus = isDesignProfessional ? "responded" : "in_review";

      const { error } = await supabase
        .from("rfis")
        .update({
          status: newStatus,
          ball_in_court: newBallInCourt,
          response: isDesignProfessional ? response : rfi.response,
          responded_at: isDesignProfessional ? new Date().toISOString() : rfi.responded_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rfi.id);

      if (error) throw error;

      toast.success("RFI updated");
      fetchRFIs();
    } catch (error) {
      console.error("Error responding to RFI:", error);
      toast.error("Failed to update RFI");
    }
  };

  const handleCloseRFI = async (rfi: RFI) => {
    try {
      const { error } = await supabase
        .from("rfis")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", rfi.id);

      if (error) throw error;

      toast.success("RFI closed");
      fetchRFIs();
      if (selectedRfi?.id === rfi.id) {
        setSelectedRfi({ ...rfi, status: "closed" });
      }
    } catch (error) {
      console.error("Error closing RFI:", error);
      toast.error("Failed to close RFI");
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedRfi) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from("rfi_messages")
        .insert({
          rfi_id: selectedRfi.id,
          company_id: currentCompany?.id,
          user_id: user?.id,
          message: newMessage,
          is_internal: false,
        });

      if (error) throw error;

      if (currentCompany?.id && user?.id) {
        await createMentionNotifications({
          companyId: currentCompany.id,
          actorUserId: user.id,
          actorName,
          content: newMessage.trim(),
          contextLabel: "RFI Messages",
          targetPath: `/jobs/${jobId}`,
          jobId,
        });
      }

      setNewMessage("");
      await fetchRFIDetails(selectedRfi);
      toast.success("Message sent");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedRfi) return;

    setUploadingFile(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${currentCompany?.id}/rfis/${selectedRfi.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("company-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-files")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from("rfi_attachments")
        .insert({
          rfi_id: selectedRfi.id,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          uploaded_by: user?.id,
        });

      if (dbError) throw dbError;

      toast.success("File uploaded");
      await fetchRFIDetails(selectedRfi);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      in_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      responded: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      closed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    };
    return <Badge className={variants[status] || ""}>{status.replace("_", " ")}</Badge>;
  };

  const getBallInCourtBadge = (ballInCourt: string, rfi: RFI) => {
    const isMyTurn = (ballInCourt === "manager" && rfi.created_by === user?.id) ||
      (ballInCourt === "design_professional" && rfi.assigned_to === user?.id);

    return (
      <Badge variant={isMyTurn ? "default" : "outline"}>
        Ball in: {ballInCourt === "manager" ? "Manager's" : "Design Professional's"} Court
      </Badge>
    );
  };

  if (loading) {
    return <div className="p-6"><span className="loading-dots">Loading RFIs</span></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">RFIs (Request for Information)</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create RFI
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New RFI</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Request</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Enter RFI subject"
                    />
                  </div>
                  <div>
                    <Label htmlFor="question">Question *</Label>
                    <Textarea
                      id="question"
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      placeholder="Describe the question or clarification needed"
                      rows={5}
                    />
                  </div>
                  <div>
                    <Label>Attachments</Label>
                    <div className="mt-2 space-y-3">
                      <DragDropUpload
                        onFileSelect={(file) => queueCreateAttachment(file)}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls"
                        maxSize={20}
                        size="compact"
                        title="Attach files"
                        dropTitle="Drop file here"
                        helperText="You can add multiple files up to 20MB each"
                        disabled={creatingRfi}
                      />
                      {createAttachments.length > 0 && (
                        <div className="space-y-2">
                          {createAttachments.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                              <span className="truncate pr-2">{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCreateAttachment(index)}
                                disabled={creatingRfi}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">General Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="rfi_number">Number *</Label>
                    <Input
                      id="rfi_number"
                      value={formData.rfi_number}
                      onChange={(e) => setFormData({ ...formData, rfi_number: e.target.value })}
                      placeholder="RFI-001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="assigned_to">Assignee</Label>
                    <Select
                      value={formData.assigned_to}
                      onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
                    >
                      <SelectTrigger id="assigned_to">
                        <SelectValue placeholder="Select user" />
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
                    <Label htmlFor="received_from">Received From</Label>
                    <Input
                      id="received_from"
                      value={formData.received_from}
                      onChange={(e) => setFormData({ ...formData, received_from: e.target.value })}
                      placeholder="Person or company"
                    />
                  </div>
                  <div>
                    <Label htmlFor="distribution_list">Distribution List</Label>
                    <Input
                      id="distribution_list"
                      value={formData.distribution_list}
                      onChange={(e) => setFormData({ ...formData, distribution_list: e.target.value })}
                      placeholder="Comma-separated names"
                    />
                  </div>
                  <div>
                    <Label htmlFor="responsible_contractor">Responsible Contractor</Label>
                    <Input
                      id="responsible_contractor"
                      value={formData.responsible_contractor}
                      onChange={(e) => setFormData({ ...formData, responsible_contractor: e.target.value })}
                      placeholder="Contractor name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="specification">Specification</Label>
                    <Input
                      id="specification"
                      value={formData.specification}
                      onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                      placeholder="Section number or title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Location in project"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rfi_stage">RFI Stage</Label>
                    <Input
                      id="rfi_stage"
                      value={formData.rfi_stage}
                      onChange={(e) => setFormData({ ...formData, rfi_stage: e.target.value })}
                      placeholder="Stage"
                    />
                  </div>
                  <div>
                    <Label htmlFor="drawing_number">Drawing Number</Label>
                    <Input
                      id="drawing_number"
                      value={formData.drawing_number}
                      onChange={(e) => setFormData({ ...formData, drawing_number: e.target.value })}
                      placeholder="A-101"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cost_code">Cost Code</Label>
                    <Input
                      id="cost_code"
                      value={formData.cost_code}
                      onChange={(e) => setFormData({ ...formData, cost_code: e.target.value })}
                      placeholder="Cost code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reference">Reference</Label>
                    <Input
                      id="reference"
                      value={formData.reference}
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                      placeholder="Reference number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="schedule_impact">Schedule Impact</Label>
                    <Select
                      value={formData.schedule_impact}
                      onValueChange={(value) => setFormData({ ...formData, schedule_impact: value })}
                    >
                      <SelectTrigger id="schedule_impact">
                        <SelectValue placeholder="Select impact" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cost_impact">Cost Impact</Label>
                    <Select
                      value={formData.cost_impact}
                      onValueChange={(value) => setFormData({ ...formData, cost_impact: value })}
                    >
                      <SelectTrigger id="cost_impact">
                        <SelectValue placeholder="Select impact" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2 pb-2">
                    <Checkbox
                      id="is_private"
                      checked={formData.is_private}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_private: checked === true })}
                    />
                    <Label htmlFor="is_private">Private</Label>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creatingRfi}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRFI} disabled={creatingRfi}>
                  {creatingRfi ? "Creating..." : "Create RFI"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rfis.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No RFIs created yet. Click "Create RFI" to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rfis.map((rfi) => (
            <Card
              key={rfi.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedRfi(rfi);
                hydrateRfiEditForm(rfi);
                fetchRFIDetails(rfi);
              }}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{rfi.rfi_number}</CardTitle>
                      {getStatusBadge(rfi.status)}
                      {rfi.status !== "closed" && getBallInCourtBadge(rfi.ball_in_court, rfi)}
                    </div>
                    <p className="font-medium">{rfi.subject}</p>
                    {rfi.description && (
                      <p className="text-sm text-muted-foreground mt-2">{rfi.description}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Created: {format(new Date(rfi.created_at), "MMM d, yyyy")}</span>
                  {rfi.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Due: {format(new Date(rfi.due_date), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* RFI Detail Dialog */}
      <Dialog open={!!selectedRfi} onOpenChange={(open) => !open && setSelectedRfi(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedRfi && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    {selectedRfi.rfi_number} - {selectedRfi.subject}
                  </DialogTitle>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedRfi.status)}
                    {selectedRfi.status !== "closed" && getBallInCourtBadge(selectedRfi.ball_in_court, selectedRfi)}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Request & General Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Number *</Label>
                        <Input
                          value={rfiEditForm.rfi_number}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, rfi_number: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Due Date</Label>
                        <Input
                          type="date"
                          value={rfiEditForm.due_date}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, due_date: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Subject *</Label>
                      <Input
                        value={rfiEditForm.subject}
                        onChange={(e) => setRfiEditForm((prev) => ({ ...prev, subject: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Question *</Label>
                      <Textarea
                        rows={4}
                        value={rfiEditForm.question}
                        onChange={(e) => setRfiEditForm((prev) => ({ ...prev, question: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label>Assignee</Label>
                        <Select
                          value={rfiEditForm.assigned_to}
                          onValueChange={(value) => setRfiEditForm((prev) => ({ ...prev, assigned_to: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select user" />
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
                        <Label>Received From</Label>
                        <Input
                          value={rfiEditForm.received_from}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, received_from: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Distribution List</Label>
                        <Input
                          value={rfiEditForm.distribution_list}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, distribution_list: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Responsible Contractor</Label>
                        <Input
                          value={rfiEditForm.responsible_contractor}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, responsible_contractor: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Specification</Label>
                        <Input
                          value={rfiEditForm.specification}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, specification: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Location</Label>
                        <Input
                          value={rfiEditForm.location}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, location: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>RFI Stage</Label>
                        <Input
                          value={rfiEditForm.rfi_stage}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, rfi_stage: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Drawing Number</Label>
                        <Input
                          value={rfiEditForm.drawing_number}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, drawing_number: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Cost Code</Label>
                        <Input
                          value={rfiEditForm.cost_code}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, cost_code: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Schedule Impact</Label>
                        <Select
                          value={rfiEditForm.schedule_impact}
                          onValueChange={(value) => setRfiEditForm((prev) => ({ ...prev, schedule_impact: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select impact" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Cost Impact</Label>
                        <Select
                          value={rfiEditForm.cost_impact}
                          onValueChange={(value) => setRfiEditForm((prev) => ({ ...prev, cost_impact: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select impact" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Reference</Label>
                        <Input
                          value={rfiEditForm.reference}
                          onChange={(e) => setRfiEditForm((prev) => ({ ...prev, reference: e.target.value }))}
                        />
                      </div>
                      <div className="flex items-end gap-2 pb-2">
                        <Checkbox
                          id="rfi-detail-private"
                          checked={rfiEditForm.is_private}
                          onCheckedChange={(checked) => setRfiEditForm((prev) => ({ ...prev, is_private: checked === true }))}
                        />
                        <Label htmlFor="rfi-detail-private">Private</Label>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => void handleSaveRfiDetails()} disabled={savingRfiDetails || selectedRfi.status === "closed"}>
                        {savingRfiDetails ? "Saving..." : "Save RFI Details"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Description */}
                {selectedRfi.description && (
                  <div>
                    <Label>Description</Label>
                    <p className="text-sm mt-1">{selectedRfi.description}</p>
                  </div>
                )}

                {/* Response */}
                {selectedRfi.response && (
                  <div>
                    <Label>Response</Label>
                    <p className="text-sm mt-1">{selectedRfi.response}</p>
                    {selectedRfi.responded_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Responded: {format(new Date(selectedRfi.responded_at), "MMM d, yyyy HH:mm")}
                      </p>
                    )}
                  </div>
                )}

                <Separator />

                {/* Attachments */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Attachments ({rfiAttachments.length})</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={uploadingFile || selectedRfi.status === "closed"}
                      onClick={() => document.getElementById("rfi-file-input")?.click()}
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Add File
                    </Button>
                    <input
                      id="rfi-file-input"
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </div>
                  {rfiAttachments.length > 0 && (
                    <div className="space-y-2">
                      {rfiAttachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">{attachment.file_name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(attachment.file_url, "_blank")}
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedRfi.status !== "closed" && (
                    <div className="mt-3">
                      <DragDropUpload
                        onFileSelect={(file) => { void handleFileUpload(file); }}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls"
                        maxSize={20}
                        disabled={uploadingFile}
                        size="compact"
                        title="Drag RFI attachment here"
                        dropTitle="Drop attachment here"
                        helperText="PDF, image, Word, or Excel file up to 20MB"
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Messages */}
                <div>
                  <Label className="mb-2 block">Messages & Comments</Label>
                  <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                    {rfiMessages.map((msg) => (
                      <div key={msg.id} className="bg-muted p-3 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">
                            {msg.profiles.first_name} {msg.profiles.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.created_at), "MMM d, yyyy HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm">{msg.message}</p>
                      </div>
                    ))}
                  </div>

                  {selectedRfi.status !== "closed" && (
                    <div className="flex gap-2">
                      <MentionTextarea
                        value={newMessage}
                        onValueChange={setNewMessage}
                        companyId={currentCompany?.id}
                        jobId={jobId}
                        currentUserId={user?.id}
                        placeholder="Type your message... (use @ to tag teammates)"
                        rows={2}
                      />
                      <Button
                        size="sm"
                        onClick={handleSendMessage}
                        disabled={sendingMessage || !newMessage.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex gap-2">
                  {selectedRfi.status === "draft" && selectedRfi.created_by === user?.id && (
                    <Button onClick={() => handleSubmitRFI(selectedRfi)}>
                      Submit to Design Professional
                    </Button>
                  )}
                  {selectedRfi.status !== "closed" && (
                    <Button
                      variant="outline"
                      onClick={() => handleCloseRFI(selectedRfi)}
                    >
                      Close RFI
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
