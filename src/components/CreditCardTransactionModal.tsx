import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Paperclip, FileText, X } from "lucide-react";

interface CreditCardTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  onComplete: () => void;
}

export function CreditCardTransactionModal({
  open,
  onOpenChange,
  transactionId,
  onComplete
}: CreditCardTransactionModalProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [transaction, setTransaction] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [costCodes, setCostCodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoders, setSelectedCoders] = useState<string[]>([]);
  const [requestedUsers, setRequestedUsers] = useState<any[]>([]);
  const [communications, setCommunications] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

  useEffect(() => {
    if (open && transactionId && currentCompany) {
      fetchData();
    }
  }, [open, transactionId, currentCompany]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch transaction
      const { data: transData, error: transError } = await supabase
        .from("credit_card_transactions")
        .select(`
          *,
          jobs:job_id(id, name),
          cost_codes:cost_code_id(id, code, description)
        `)
        .eq("id", transactionId)
        .single();

      if (transError) throw transError;
      setTransaction(transData);

      // Fetch jobs
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("id, name")
        .eq("company_id", currentCompany?.id)
        .eq("status", "active")
        .order("name");

      setJobs(jobsData || []);

      // Fetch cost codes
      const { data: costCodesData } = await supabase
        .from("cost_codes")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .eq("is_active", true)
        .order("code");

      setCostCodes(costCodesData || []);

      // Fetch users for coding requests
      const { data: usersData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, role")
        .in("role", ["admin", "controller", "project_manager"])
        .order("first_name");

      setUsers(usersData || []);

      // Fetch coding requests
      const { data: requests } = await supabase
        .from("credit_card_coding_requests")
        .select("requested_coder_id")
        .eq("transaction_id", transactionId)
        .eq("status", "pending");

      if (requests && requests.length > 0) {
        const coderIds = requests.map(r => r.requested_coder_id);
        setSelectedCoders(coderIds);

        const { data: userDetails } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", coderIds);

        setRequestedUsers(userDetails || []);
      }

      // Fetch communications
      const { data: comms } = await supabase
        .from("credit_card_transaction_communications")
        .select(`
          *,
          user:user_id(user_id, first_name, last_name)
        `)
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      setCommunications(comms || []);

      // Set attachment preview
      if (transData.attachment_url) {
        if (transData.attachment_url.includes('.jpg') ||
            transData.attachment_url.includes('.jpeg') ||
            transData.attachment_url.includes('.png')) {
          setAttachmentPreview(transData.attachment_url);
        } else if (transData.attachment_url.includes('.pdf')) {
          setAttachmentPreview(transData.attachment_url);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateCodingStatus = async () => {
    if (!transaction) return;

    const hasJob = !!transaction.job_id;
    const hasCostCode = !!transaction.cost_code_id;
    const hasAttachment = !!transaction.attachment_url;

    const isCoded = hasJob && hasCostCode && hasAttachment;
    const newStatus = isCoded ? 'coded' : 'uncoded';

    await supabase
      .from("credit_card_transactions")
      .update({ coding_status: newStatus })
      .eq("id", transactionId);

    setTransaction({ ...transaction, coding_status: newStatus });
  };

  const handleJobChange = async (jobId: string | null) => {
    await supabase
      .from("credit_card_transactions")
      .update({
        job_id: jobId,
        cost_code_id: null,
      })
      .eq("id", transactionId);

    setTransaction({ ...transaction, job_id: jobId, cost_code_id: null });
    await updateCodingStatus();
  };

  const handleCostCodeChange = async (costCodeId: string | null) => {
    await supabase
      .from("credit_card_transactions")
      .update({ cost_code_id: costCodeId })
      .eq("id", transactionId);

    setTransaction({ ...transaction, cost_code_id: costCodeId });
    await updateCodingStatus();
  };

  const handleAttachmentUpload = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany?.id}/${transactionId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("credit-card-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("credit-card-attachments")
        .getPublicUrl(fileName);

      await supabase
        .from("credit_card_transactions")
        .update({ attachment_url: publicUrl })
        .eq("id", transactionId);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setAttachmentPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        setAttachmentPreview(publicUrl);
      }

      setTransaction({ ...transaction, attachment_url: publicUrl });
      await updateCodingStatus();

      toast({
        title: "Success",
        description: "Attachment uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from("credit_card_transaction_communications")
        .insert({
          transaction_id: transactionId,
          company_id: currentCompany?.id,
          user_id: user?.id,
          message: newMessage.trim(),
        });

      if (error) throw error;

      const { data: comms } = await supabase
        .from("credit_card_transaction_communications")
        .select(`
          *,
          user:user_id(user_id, first_name, last_name)
        `)
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      setCommunications(comms || []);
      setNewMessage("");

      toast({
        title: "Success",
        description: "Message sent",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMarkComplete = async () => {
    try {
      await supabase
        .from("credit_card_coding_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("transaction_id", transactionId);

      toast({
        title: "Success",
        description: "Coding request completed",
      });

      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredCostCodes = (jobId: string | null) => {
    if (!jobId) return [];
    return costCodes.filter(cc => !cc.job_id || cc.job_id === jobId);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!transaction) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Code Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Transaction Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <Label className="text-sm text-muted-foreground">Date</Label>
              <p className="font-medium">
                {new Date(transaction.transaction_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Amount</Label>
              <p className="text-lg font-semibold">
                ${Number(transaction.amount).toLocaleString()}
              </p>
            </div>
            <div className="col-span-2">
              <Label className="text-sm text-muted-foreground">Description</Label>
              <p className="font-medium">{transaction.description}</p>
            </div>
            {requestedUsers.length > 0 && (
              <div className="col-span-2">
                <Label className="text-sm text-muted-foreground">Requested Coders</Label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {requestedUsers.map((u: any) => (
                    <Badge key={u.user_id} variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                      {u.first_name} {u.last_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Job Selection */}
          <div>
            <Label>Job *</Label>
            <Select
              value={transaction.job_id || "none"}
              onValueChange={(value) => handleJobChange(value === "none" ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Job</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cost Code Selection */}
          <div>
            <Label>Cost Code *</Label>
            <Select
              value={transaction.cost_code_id || "none"}
              onValueChange={(value) => handleCostCodeChange(value === "none" ? null : value)}
              disabled={!transaction.job_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cost code" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Cost Code</SelectItem>
                {filteredCostCodes(transaction.job_id).map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.code} - {cc.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!transaction.job_id && (
              <p className="text-xs text-muted-foreground mt-1">Select a job first</p>
            )}
          </div>

          {/* Attachment */}
          <div>
            <Label>Attachment *</Label>
            {transaction.attachment_url ? (
              <div className="space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(transaction.attachment_url, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Full Size
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      supabase
                        .from("credit_card_transactions")
                        .update({ attachment_url: null })
                        .eq("id", transactionId)
                        .then(() => {
                          setTransaction({ ...transaction, attachment_url: null });
                          setAttachmentPreview(null);
                          updateCodingStatus();
                        });
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>

                {attachmentPreview && (
                  <div className="border rounded-lg overflow-hidden bg-muted">
                    {attachmentPreview.includes('.pdf') ? (
                      <iframe
                        src={attachmentPreview}
                        className="w-full h-96"
                        title="PDF Preview"
                      />
                    ) : (
                      <img
                        src={attachmentPreview}
                        alt="Attachment preview"
                        className="w-full h-auto max-h-96 object-contain"
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAttachmentUpload(file);
                  }}
                />
                <Button size="sm" variant="outline" asChild className="mt-2">
                  <span>
                    <Paperclip className="h-4 w-4 mr-2" />
                    Upload Attachment
                  </span>
                </Button>
              </label>
            )}
          </div>

          {/* Communication Section */}
          <div className="border-t pt-6">
            <Label className="text-lg font-semibold">Discussion</Label>
            <div className="mt-3 space-y-3 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/30">
              {communications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No messages yet. Start the discussion below.
                </p>
              ) : (
                communications.map((comm: any) => (
                  <div key={comm.id} className="bg-background p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">
                        {comm.user?.first_name} {comm.user?.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comm.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{comm.message}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                size="sm"
              >
                Send
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleMarkComplete}>
              Mark Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
