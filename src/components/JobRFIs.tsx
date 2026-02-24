import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, FileText, Send, MessageSquare, Paperclip, Calendar } from "lucide-react";
import { format } from "date-fns";
import DragDropUpload from "@/components/DragDropUpload";

interface JobRFIsProps {
  jobId: string;
}

interface RFI {
  id: string;
  rfi_number: string;
  subject: string;
  description: string;
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

  const [formData, setFormData] = useState({
    rfi_number: "",
    subject: "",
    description: "",
    assigned_to: "",
    due_date: "",
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchRFIs();
      fetchCompanyUsers();
    }
  }, [jobId, currentCompany?.id]);

  const fetchRFIs = async () => {
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
  };

  const fetchCompanyUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_company_access")
        .select("user_id, profiles(user_id, first_name, last_name)")
        .eq("company_id", currentCompany?.id)
        .eq("is_active", true);

      if (error) throw error;
      const users = data?.map((item: any) => item.profiles).filter(Boolean) || [];
      setCompanyUsers(users);
    } catch (error) {
      console.error("Error fetching company users:", error);
    }
  };

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

  const handleCreateRFI = async () => {
    if (!formData.rfi_number || !formData.subject) {
      toast.error("Please fill in RFI number and subject");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("rfis")
        .insert({
          job_id: jobId,
          company_id: currentCompany?.id,
          created_by: user?.id,
          rfi_number: formData.rfi_number,
          subject: formData.subject,
          description: formData.description,
          assigned_to: formData.assigned_to || null,
          due_date: formData.due_date || null,
          status: "draft",
          ball_in_court: "manager",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("RFI created successfully");
      setDialogOpen(false);
      setFormData({ rfi_number: "", subject: "", description: "", assigned_to: "", due_date: "" });
      fetchRFIs();
    } catch (error: any) {
      console.error("Error creating RFI:", error);
      toast.error(error.message || "Failed to create RFI");
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
    return <div className="p-6">Loading RFIs...</div>;
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New RFI</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rfi_number">RFI Number *</Label>
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
              </div>
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
                <Label htmlFor="assigned_to">Assign to Design Professional</Label>
                <Select
                  value={formData.assigned_to}
                  onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter detailed description"
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRFI}>Create RFI</Button>
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
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
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
