import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, MessageSquare, Send, Users, Building2, Calendar, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { canAccessAssignedJobOnly } from "@/utils/jobAccess";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ZoomableDocumentPreview from "@/components/ZoomableDocumentPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MentionTextarea from "@/components/MentionTextarea";
import { createMentionNotifications } from "@/utils/mentions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveStorageUrl } from "@/utils/storageUtils";
import { persistNonDirectMessageReadEverywhere } from "@/utils/nonDirectMessageRead";

interface BidRecord {
  id: string;
  company_id: string;
  rfp_id: string;
  vendor_id: string;
  bid_amount: number;
  proposed_timeline: string | null;
  notes: string | null;
  status: string;
  submitted_at: string;
  version_number?: number;
  bid_contact_name?: string | null;
  bid_contact_email?: string | null;
  bid_contact_phone?: string | null;
  shipping_included?: boolean;
  shipping_amount?: number;
  taxes_included?: boolean;
  tax_amount?: number;
  discount_amount?: number;
  comparison_notes?: string | null;
  rfp?: { id: string; title: string; rfp_number: string; job_id?: string | null } | null;
  vendor?: {
    id: string;
    name: string;
    email?: string | null;
    logo_url?: string | null;
    logo_display_url?: string | null;
  } | null;
}

interface BidCommunication {
  id: string;
  message: string;
  message_type: "intercompany" | "vendor";
  user_id: string;
  created_at: string;
  sender_name: string;
  sender_avatar_url?: string | null;
}

interface BidEmailMessage {
  id: string;
  direction: "inbound" | "outbound";
  from_email: string | null;
  to_emails: string[] | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  created_at: string;
}

interface BidAttachment {
  id: string;
  file_name: string;
  file_url: string;
  attachment_type: string;
  description?: string | null;
  uploaded_at: string;
}

const ATTACHMENT_TYPE_OPTIONS = [
  "quote",
  "quote_v1",
  "quote_v2",
  "quote_v3",
  "best_and_final",
  "spec_sheet",
  "catalog",
  "product_data",
  "drawing",
  "other",
] as const;

const ATTACHMENT_TYPE_LABELS: Record<(typeof ATTACHMENT_TYPE_OPTIONS)[number], string> = {
  quote: "Quote",
  quote_v1: "Quote Version 1",
  quote_v2: "Quote Version 2",
  quote_v3: "Quote Version 3",
  best_and_final: "Best and Final",
  spec_sheet: "Spec Sheet",
  catalog: "Catalog",
  product_data: "Product Data",
  drawing: "Drawing",
  other: "Other",
};

const BID_STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted" },
  { value: "verbal_quote", label: "Verbal Quote" },
  { value: "questions_pending", label: "Questions Pending" },
  { value: "waiting_for_revisions", label: "Waiting for Revisions" },
  { value: "subcontract_review", label: "Reviewing Subcontract" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "retracted", label: "Retracted" },
] as const;

const isQuoteAttachmentType = (attachmentType: string | null | undefined) => {
  const value = String(attachmentType || "").toLowerCase();
  return value === "quote" || value.startsWith("quote_") || value === "best_and_final";
};

const getAttachmentTypeSelectValue = (attachmentType: string | null | undefined) => {
  const value = String(attachmentType || "quote");
  return ATTACHMENT_TYPE_OPTIONS.includes(value as (typeof ATTACHMENT_TYPE_OPTIONS)[number]) ? value : "custom";
};

const getCustomAttachmentTypeLabel = (attachmentType: string | null | undefined) => {
  const value = String(attachmentType || "");
  if (value.startsWith("custom:")) return value.replace("custom:", "").trim();
  return "";
};

const toNumber = (v: string | number | null | undefined) => Number(v || 0);

const computeTotal = (bid: {
  bid_amount: string | number;
  shipping_included: boolean;
  shipping_amount: string | number;
  taxes_included: boolean;
  tax_amount: string | number;
  discount_amount: string | number;
}) => {
  const base = toNumber(bid.bid_amount);
  const discount = toNumber(bid.discount_amount);
  const taxableBase = Math.max(0, base - discount);
  const shipping = bid.shipping_included ? 0 : toNumber(bid.shipping_amount);
  const taxRatePercent = bid.taxes_included ? 0 : toNumber(bid.tax_amount);
  const tax = taxableBase * (Math.max(0, taxRatePercent) / 100);
  return Math.max(0, taxableBase + shipping + tax);
};

export default function BidDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bid, setBid] = useState<BidRecord | null>(null);
  const [communications, setCommunications] = useState<BidCommunication[]>([]);
  const [loadingCommunications, setLoadingCommunications] = useState(false);
  const [vendorHasAccount, setVendorHasAccount] = useState(false);
  const [newTeamMessage, setNewTeamMessage] = useState("");
  const [newVendorMessage, setNewVendorMessage] = useState("");
  const [sendingTeam, setSendingTeam] = useState(false);
  const [sendingVendor, setSendingVendor] = useState(false);
  const [emailMessages, setEmailMessages] = useState<BidEmailMessage[]>([]);
  const [activeEmailPreview, setActiveEmailPreview] = useState<BidEmailMessage | null>(null);
  const [trackingEmail, setTrackingEmail] = useState<string>("");
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [attachments, setAttachments] = useState<BidAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [editingAttachmentName, setEditingAttachmentName] = useState("");
  const [savingAttachmentId, setSavingAttachmentId] = useState<string | null>(null);
  const [editingCustomTypeId, setEditingCustomTypeId] = useState<string | null>(null);
  const [customTypeDraft, setCustomTypeDraft] = useState("");
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [editingDescriptionText, setEditingDescriptionText] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    status: "submitted",
    bid_amount: "",
    proposed_timeline: "",
    notes: "",
    bid_contact_name: "",
    bid_contact_email: "",
    bid_contact_phone: "",
    shipping_included: false,
    shipping_amount: "0",
    taxes_included: true,
    tax_amount: "0",
    discount_amount: "0",
    comparison_notes: "",
  });

  const totalBid = useMemo(() => computeTotal(form), [form]);
  const teamMessages = communications.filter((message) => message.message_type === "intercompany");
  const vendorMessages = communications.filter((message) => message.message_type === "vendor");
  const selectedAttachment = attachments.find((attachment) => attachment.id === selectedAttachmentId) || null;
  const highlightedMessageId = searchParams.get("messageId");
  const highlightedMessageSource = searchParams.get("messageSource");

  const loadAttachments = async (bidId: string) => {
    try {
      setLoadingAttachments(true);
      const { data, error } = await supabase
        .from("bid_attachments")
        .select("id, file_name, file_url, attachment_type, description, uploaded_at")
        .eq("bid_id", bidId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      const rows = (data as BidAttachment[]) || [];
      setAttachments(rows);
      const latestQuote = rows.find((row) => isQuoteAttachmentType(row.attachment_type)) || null;
      setSelectedAttachmentId(latestQuote?.id || rows[0]?.id || null);
    } catch (error) {
      console.error("Error loading bid attachments:", error);
      setAttachments([]);
      setSelectedAttachmentId(null);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const loadBidEmails = async (bidId: string) => {
    try {
      setLoadingEmails(true);
      const [{ data: channelData }, { data: messageRows }] = await Promise.all([
        supabase.functions.invoke("get-bid-email-channel", {
          body: { bidId },
        }),
        supabase
          .from("bid_email_messages" as any)
          .select("id, direction, from_email, to_emails, subject, body_text, body_html, created_at")
          .eq("bid_id", bidId)
          .order("created_at", { ascending: false }),
      ]);
      setTrackingEmail(String((channelData as any)?.trackingEmail || ""));
      setEmailMessages((messageRows as unknown as BidEmailMessage[]) || []);
    } catch (error) {
      console.error("Error loading bid emails:", error);
      setTrackingEmail("");
      setEmailMessages([]);
    } finally {
      setLoadingEmails(false);
    }
  };

  const loadCommunications = async (bidId: string, vendorId: string) => {
    try {
      setLoadingCommunications(true);

      const { data: messageRows, error: messageError } = await supabase
        .from("bid_communications" as any)
        .select("id, message, message_type, user_id, created_at")
        .eq("bid_id", bidId)
        .order("created_at", { ascending: true });
      if (messageError) throw messageError;

      const rows = ((messageRows || []) as unknown) as Array<{
        id: string;
        message: string;
        message_type: "intercompany" | "vendor";
        user_id: string;
        created_at: string;
      }>;

      const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
      let profileMap = new Map<string, { name: string; avatarUrl: string | null }>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, first_name, last_name, avatar_url")
          .in("user_id", userIds);

        profileMap = new Map(
          (profiles || []).map((profile: any) => {
            const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
            return [
              profile.user_id,
              {
                name: profile?.display_name || fullName || "Unknown User",
                avatarUrl: profile?.avatar_url || null,
              },
            ];
          }),
        );
      }

      setCommunications(
        rows.map((row) => ({
          ...row,
          sender_name: profileMap.get(row.user_id)?.name || "Unknown User",
          sender_avatar_url: profileMap.get(row.user_id)?.avatarUrl || null,
        })),
      );

      const { count } = await supabase
        .from("profiles")
        .select("user_id", { head: true, count: "exact" })
        .eq("vendor_id", vendorId);
      setVendorHasAccount((count || 0) > 0);
    } catch (error) {
      console.error("Error loading bid communications:", error);
      setCommunications([]);
      setVendorHasAccount(false);
    } finally {
      setLoadingCommunications(false);
    }
  };

  const load = async () => {
    if (!id || websiteJobAccessLoading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bids")
        .select(`
          *,
          rfp:rfps(id, title, rfp_number, job_id),
          vendor:vendors(id, name, email, logo_url)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      const bidData = data as unknown as BidRecord;
      if (!canAccessAssignedJobOnly([bidData?.rfp?.job_id], isPrivileged, allowedJobIds)) {
        toast({
          title: "Access denied",
          description: "You do not have access to this bid's job.",
          variant: "destructive",
        });
        navigate("/construction/rfps");
        return;
      }

      if (bidData.vendor?.logo_url) {
        const logoDisplayUrl = await resolveStorageUrl("receipts", bidData.vendor.logo_url as unknown as string);
        bidData.vendor = {
          ...bidData.vendor,
          logo_display_url: logoDisplayUrl,
        } as any;
      }

      setBid(bidData);
      setForm({
        status: bidData.status || "submitted",
        bid_amount: String(bidData.bid_amount ?? ""),
        proposed_timeline: bidData.proposed_timeline || "",
        notes: bidData.notes || "",
        bid_contact_name: bidData.bid_contact_name || "",
        bid_contact_email: bidData.bid_contact_email || "",
        bid_contact_phone: bidData.bid_contact_phone || "",
        shipping_included: !!bidData.shipping_included,
        shipping_amount: String(bidData.shipping_amount ?? 0),
        taxes_included: bidData.taxes_included ?? true,
        tax_amount: String(bidData.tax_amount ?? 0),
        discount_amount: String(bidData.discount_amount ?? 0),
        comparison_notes: bidData.comparison_notes || "",
      });

      await loadCommunications(bidData.id, bidData.vendor_id);
      await loadBidEmails(bidData.id);
      await loadAttachments(bidData.id);
    } catch (error) {
      console.error("Error loading bid:", error);
      toast({ title: "Error", description: "Failed to load bid details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  useEffect(() => {
    if (!user?.id || !bid?.company_id || communications.length === 0) return;
    if (highlightedMessageSource !== "bid_intercompany_communication" || !highlightedMessageId) return;

    const highlightedMessage = communications.find((message) => message.id === highlightedMessageId);
    if (!highlightedMessage) return;
    if (highlightedMessage.user_id === user.id) return;
    if (highlightedMessage.message_type !== "intercompany") return;

    void persistNonDirectMessageReadEverywhere(
      {
        id: highlightedMessage.id,
        message_source: "bid_intercompany_communication",
        source_record_id: highlightedMessage.id,
      },
      user.id,
      bid.company_id,
    );
  }, [communications, user?.id, bid?.company_id, highlightedMessageId, highlightedMessageSource]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const el = document.getElementById(`bid-message-${highlightedMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedMessageId, communications]);

  const sendMessage = async (messageType: "intercompany" | "vendor") => {
    if (!bid || !user || !currentCompany) return;

    const value = messageType === "intercompany" ? newTeamMessage.trim() : newVendorMessage.trim();
    if (!value) return;

    try {
      if (messageType === "intercompany") {
        setSendingTeam(true);
      } else {
        setSendingVendor(true);
      }

      const { error } = await supabase
        .from("bid_communications" as any)
        .insert({
          bid_id: bid.id,
          company_id: bid.company_id,
          vendor_id: bid.vendor_id,
          user_id: user.id,
          message: value,
          message_type: messageType,
        });
      if (error) throw error;

      await createMentionNotifications({
        companyId: bid.company_id,
        actorUserId: user.id,
        actorName:
          (user as any)?.user_metadata?.full_name ||
          (user as any)?.user_metadata?.name ||
          (user as any)?.email ||
          "A teammate",
        content: value,
        contextLabel: messageType === "vendor" ? "Bid Vendor Communication" : "Bid Team Notes",
        targetPath: `/construction/bids/${bid.id}`,
        jobId: bid?.rfp?.job_id || null,
      });

      if (messageType === "intercompany") {
        setNewTeamMessage("");
      } else {
        setNewVendorMessage("");
      }

      await loadCommunications(bid.id, bid.vendor_id);
      toast({
        title: "Message sent",
        description: messageType === "vendor" ? "Vendor message posted" : "Team note posted",
      });
    } catch (error: any) {
      console.error("Error sending bid message:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      if (messageType === "intercompany") {
        setSendingTeam(false);
      } else {
        setSendingVendor(false);
      }
    }
  };

  const uploadBidAttachments = async (files: FileList | File[]) => {
    if (!bid || !currentCompany?.id || !user?.id) return;
    const uploadList = Array.from(files || []);
    if (uploadList.length === 0) return;

    try {
      setUploadingAttachment(true);
      let lastInsertedId: string | null = null;

      for (const file of uploadList) {
        const filePath = `${currentCompany.id}/${bid.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("bid-attachments")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("bid-attachments").getPublicUrl(filePath);
        const { data: inserted, error: insertError } = await supabase
          .from("bid_attachments")
          .insert({
            bid_id: bid.id,
            company_id: currentCompany.id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            attachment_type: "quote",
            file_size: file.size,
            file_type: file.type || null,
            uploaded_by: user.id,
          } as any)
          .select("id")
          .single();
        if (insertError) throw insertError;
        lastInsertedId = inserted?.id || lastInsertedId;
      }

      await loadAttachments(bid.id);
      if (lastInsertedId) setSelectedAttachmentId(lastInsertedId);
      toast({
        title: "Uploaded",
        description: `${uploadList.length} quote attachment${uploadList.length === 1 ? "" : "s"} uploaded`,
      });
    } catch (error: any) {
      console.error("Error uploading bid attachment:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to upload attachment",
        variant: "destructive",
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleUploadAttachmentInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) {
      await uploadBidAttachments(files);
    }
    event.target.value = "";
  };

  const startRenameAttachment = (attachment: BidAttachment) => {
    setEditingAttachmentId(attachment.id);
    setEditingAttachmentName(attachment.file_name);
  };

  const saveAttachmentName = async (attachmentId: string) => {
    const nextName = editingAttachmentName.trim();
    if (!nextName || !bid) {
      setEditingAttachmentId(null);
      setEditingAttachmentName("");
      return;
    }
    try {
      setSavingAttachmentId(attachmentId);
      const { error } = await supabase
        .from("bid_attachments")
        .update({ file_name: nextName } as any)
        .eq("id", attachmentId)
        .eq("bid_id", bid.id);
      if (error) throw error;
      await loadAttachments(bid.id);
    } catch (error: any) {
      console.error("Error renaming attachment:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to rename file",
        variant: "destructive",
      });
    } finally {
      setSavingAttachmentId(null);
      setEditingAttachmentId(null);
      setEditingAttachmentName("");
    }
  };

  const updateAttachmentType = async (attachmentId: string, attachmentType: string) => {
    if (!bid) return;
    try {
      setSavingAttachmentId(attachmentId);
      const { error } = await supabase
        .from("bid_attachments")
        .update({ attachment_type: attachmentType } as any)
        .eq("id", attachmentId)
        .eq("bid_id", bid.id);
      if (error) throw error;
      await loadAttachments(bid.id);
    } catch (error: any) {
      console.error("Error updating attachment type:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update attachment type",
        variant: "destructive",
      });
    } finally {
      setSavingAttachmentId(null);
    }
  };

  const saveAttachmentDescription = async (attachmentId: string) => {
    if (!bid) return;
    const nextDescription = editingDescriptionText.trim();
    try {
      setSavingAttachmentId(attachmentId);
      const { error } = await supabase
        .from("bid_attachments")
        .update({ description: nextDescription || null } as any)
        .eq("id", attachmentId)
        .eq("bid_id", bid.id);
      if (error) throw error;
      await loadAttachments(bid.id);
    } catch (error: any) {
      console.error("Error updating attachment description:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update description",
        variant: "destructive",
      });
    } finally {
      setSavingAttachmentId(null);
      setEditingDescriptionId(null);
      setEditingDescriptionText("");
    }
  };

  const handleSave = async () => {
    if (!bid) return;
    if (!form.bid_amount || Number(form.bid_amount) <= 0) {
      toast({ title: "Validation Error", description: "Enter a valid bid amount", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase
        .from("bids")
        .update({
          status: form.status || "submitted",
          bid_amount: Number(form.bid_amount),
          proposed_timeline: form.proposed_timeline || null,
          notes: form.notes || null,
          bid_contact_name: form.bid_contact_name || null,
          bid_contact_email: form.bid_contact_email || null,
          bid_contact_phone: form.bid_contact_phone || null,
          shipping_included: form.shipping_included,
          shipping_amount: Number(form.shipping_amount || 0),
          taxes_included: form.taxes_included,
          tax_amount: form.taxes_included ? 0 : Number(form.tax_amount || 0),
          discount_amount: Number(form.discount_amount || 0),
          comparison_notes: form.comparison_notes || null,
        } as any)
        .eq("id", bid.id);
      if (error) throw error;

      toast({ title: "Saved", description: "Bid updated successfully" });
      await load();
    } catch (error: any) {
      console.error("Error saving bid:", error);
      toast({ title: "Error", description: error.message || "Failed to save bid", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center"><span className="loading-dots">Loading bid</span></div>;
  if (!bid) return <div className="p-6 text-center text-muted-foreground">Bid not found</div>;

  const communicationsCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Communications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="intercompany" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="intercompany" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Notes ({teamMessages.length})
            </TabsTrigger>
            <TabsTrigger value="vendor" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Vendor Communication ({vendorMessages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="intercompany" className="space-y-3">
            <div className="max-h-64 overflow-y-auto space-y-2 rounded-md border p-3">
              {loadingCommunications ? (
                <p className="text-sm text-muted-foreground"><span className="loading-dots">Loading</span></p>
              ) : teamMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team notes yet.</p>
              ) : (
                teamMessages.map((message) => (
                  <div
                    key={message.id}
                    id={`bid-message-${message.id}`}
                    className={`rounded-md bg-muted/40 p-3 ${
                      highlightedMessageSource === "bid_intercompany_communication" && highlightedMessageId === message.id
                        ? "ring-2 ring-primary/60 bg-primary/5"
                        : ""
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={message.sender_avatar_url || undefined} alt={message.sender_name} />
                        <AvatarFallback className="text-[10px]">
                          {message.sender_name
                            .split(" ")
                            .map((part) => part[0] || "")
                            .join("")
                            .slice(0, 2)
                            .toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span>{message.sender_name}</span>
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(message.created_at), "MMM d, yyyy h:mm a")}</span>
                      {highlightedMessageSource === "bid_intercompany_communication" && highlightedMessageId === message.id && (
                        <Badge variant="default" className="ml-1 h-5 text-[10px]">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <MentionTextarea
                companyId={currentCompany?.id}
                jobId={bid?.rfp?.job_id || null}
                currentUserId={user?.id}
                rows={3}
                placeholder="Add internal notes or updates for your team..."
                value={newTeamMessage}
                onValueChange={setNewTeamMessage}
              />
              <Button onClick={() => sendMessage("intercompany")} disabled={sendingTeam || !newTeamMessage.trim()}>
                <Send className="mr-2 h-4 w-4" />
                {sendingTeam ? "Sending..." : "Post Team Note"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="vendor" className="space-y-3">
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              {vendorHasAccount
                ? "Vendor account detected. Messages here are visible in the vendor portal."
                : "No vendor portal account detected yet. You can still log communications for this bid."}
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 rounded-md border p-3">
              {loadingCommunications ? (
                <p className="text-sm text-muted-foreground"><span className="loading-dots">Loading</span></p>
              ) : vendorMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vendor communications yet.</p>
              ) : (
                vendorMessages.map((message) => (
                  <div key={message.id} className="rounded-md bg-muted/40 p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={message.sender_avatar_url || undefined} alt={message.sender_name} />
                        <AvatarFallback className="text-[10px]">
                          {message.sender_name
                            .split(" ")
                            .map((part) => part[0] || "")
                            .join("")
                            .slice(0, 2)
                            .toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span>{message.sender_name}</span>
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(message.created_at), "MMM d, yyyy h:mm a")}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <MentionTextarea
                companyId={currentCompany?.id}
                jobId={bid?.rfp?.job_id || null}
                currentUserId={user?.id}
                rows={3}
                placeholder="Type a message to the vendor..."
                value={newVendorMessage}
                onValueChange={setNewVendorMessage}
              />
              <Button onClick={() => sendMessage("vendor")} disabled={sendingVendor || !newVendorMessage.trim()}>
                <Send className="mr-2 h-4 w-4" />
                {sendingVendor ? "Sending..." : "Send Vendor Message"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 px-4 md:px-6 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/construction/rfps/${bid.rfp_id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={bid.vendor?.logo_display_url || bid.vendor?.logo_url || undefined} alt={bid.vendor?.name || "Vendor"} />
                <AvatarFallback className="text-[11px]">
                  {String(bid.vendor?.name || "")
                    .split(" ")
                    .map((part) => part[0] || "")
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "V"}
                </AvatarFallback>
              </Avatar>
              <h1 className="text-3xl font-bold">Vendor - {bid.vendor?.name || "-"}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              RFP - {bid.rfp?.rfp_number || "-"} - {bid.rfp?.title || "Untitled RFP"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-10 gap-4">
        <div className="xl:col-span-7 space-y-4">
          <Card>
            <div
              className="h-[660px]"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files?.length) {
                  uploadBidAttachments(e.dataTransfer.files);
                }
              }}
            >
              <ZoomableDocumentPreview
                url={selectedAttachment?.file_url || null}
                fileName={selectedAttachment?.file_name}
                showControls={true}
                emptyMessage="No quote preview available"
                emptySubMessage="Upload a quote document for this bid version"
              />
            </div>
            <CardContent className="space-y-3">
              <input ref={attachmentInputRef} type="file" multiple className="hidden" onChange={handleUploadAttachmentInput} />

              {loadingAttachments ? (
                <p className="text-sm text-muted-foreground"><span className="loading-dots">Loading</span></p>
              ) : attachments.length === 0 ? (
                <div
                  className="rounded-md border-2 border-dashed p-4 text-center text-sm text-muted-foreground cursor-pointer"
                  onClick={() => attachmentInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files?.length) {
                      uploadBidAttachments(e.dataTransfer.files);
                    }
                  }}
                >
                  {uploadingAttachment ? "Uploading..." : "Drag and drop multiple quote files here"}
                </div>
              ) : (
                <div
                  className="space-y-1 rounded-md border border-dashed border-border/60 p-2"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files?.length) {
                      uploadBidAttachments(e.dataTransfer.files);
                    }
                  }}
                >
                  <div className="grid grid-cols-12 gap-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <div className="col-span-4">File</div>
                    <div className="col-span-3">Description</div>
                    <div className="col-span-3">Type</div>
                    <div className="col-span-2">Date</div>
                  </div>
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className={`grid grid-cols-12 items-center gap-2 rounded-md border px-2 py-1 text-xs ${
                        selectedAttachmentId === attachment.id ? "border-primary bg-primary/5" : ""
                      }`}
                      onClick={() => setSelectedAttachmentId(attachment.id)}
                    >
                      <div className="col-span-4 min-w-0">
                        {editingAttachmentId === attachment.id ? (
                          <Input
                            value={editingAttachmentName}
                            autoFocus
                            className="h-7 text-xs"
                            onChange={(e) => setEditingAttachmentName(e.target.value)}
                            onBlur={() => saveAttachmentName(attachment.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveAttachmentName(attachment.id);
                              if (e.key === "Escape") {
                                setEditingAttachmentId(null);
                                setEditingAttachmentName("");
                              }
                            }}
                          />
                        ) : (
                          <span
                            className="block w-full truncate text-left hover:underline cursor-text"
                            onClick={() => {
                              startRenameAttachment(attachment);
                            }}
                            title="Click to rename"
                          >
                            {attachment.file_name}
                          </span>
                        )}
                      </div>
                      <div className="col-span-3 min-w-0">
                        {editingDescriptionId === attachment.id ? (
                          <Input
                            value={editingDescriptionText}
                            autoFocus
                            className="h-7 text-xs"
                            onChange={(e) => setEditingDescriptionText(e.target.value)}
                            onBlur={() => saveAttachmentDescription(attachment.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveAttachmentDescription(attachment.id);
                              if (e.key === "Escape") {
                                setEditingDescriptionId(null);
                                setEditingDescriptionText("");
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="block w-full truncate text-left text-muted-foreground hover:underline"
                            onClick={() => {
                              setEditingDescriptionId(attachment.id);
                              setEditingDescriptionText(attachment.description || "");
                            }}
                          >
                            {attachment.description?.trim() || "Add description"}
                          </button>
                        )}
                      </div>
                      <div className="col-span-3">
                        <Select
                          value={getAttachmentTypeSelectValue(attachment.attachment_type)}
                          onValueChange={(value) => {
                            if (value === "custom") {
                              setEditingCustomTypeId(attachment.id);
                              setCustomTypeDraft(getCustomAttachmentTypeLabel(attachment.attachment_type));
                              return;
                            }
                            updateAttachmentType(attachment.id, value);
                          }}
                          disabled={savingAttachmentId === attachment.id}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTACHMENT_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {ATTACHMENT_TYPE_LABELS[option]}
                              </SelectItem>
                            ))}
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        {editingCustomTypeId === attachment.id ? (
                          <Input
                            className="mt-1 h-7 text-xs"
                            placeholder="Custom type"
                            autoFocus
                            value={customTypeDraft}
                            onChange={(e) => setCustomTypeDraft(e.target.value)}
                            onBlur={() => {
                              const next = customTypeDraft.trim() || "custom";
                              setEditingCustomTypeId(null);
                              updateAttachmentType(attachment.id, `custom:${next}`);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const next = customTypeDraft.trim() || "custom";
                                setEditingCustomTypeId(null);
                                updateAttachmentType(attachment.id, `custom:${next}`);
                              }
                              if (e.key === "Escape") {
                                setEditingCustomTypeId(null);
                                setCustomTypeDraft("");
                              }
                            }}
                          />
                        ) : (
                          getAttachmentTypeSelectValue(attachment.attachment_type) === "custom" && (
                            <button
                              type="button"
                              className="mt-1 w-full truncate text-left text-[11px] text-muted-foreground hover:underline cursor-text"
                              onClick={() => {
                                setEditingCustomTypeId(attachment.id);
                                setCustomTypeDraft(getCustomAttachmentTypeLabel(attachment.attachment_type));
                              }}
                            >
                              {getCustomAttachmentTypeLabel(attachment.attachment_type) || "Custom"}
                            </button>
                          )
                        )}
                      </div>
                      <div className="col-span-2 text-muted-foreground">
                        {format(new Date(attachment.uploaded_at), "MMM d")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {communicationsCard}

        </div>

        <div className="xl:col-span-3 space-y-4">
          <Card>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status || "submitted"}
                onValueChange={(value) => setForm((p) => ({ ...p, status: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {BID_STATUS_OPTIONS.map((statusOption) => (
                    <SelectItem key={statusOption.value} value={statusOption.value}>
                      {statusOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Bid Amount</Label>
                <Input type="number" step="0.01" min="0" value={form.bid_amount} onChange={(e) => setForm((p) => ({ ...p, bid_amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Timeline</Label>
                <Input value={form.proposed_timeline} onChange={(e) => setForm((p) => ({ ...p, proposed_timeline: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input value={form.bid_contact_name} onChange={(e) => setForm((p) => ({ ...p, bid_contact_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input type="email" value={form.bid_contact_email} onChange={(e) => setForm((p) => ({ ...p, bid_contact_email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={form.bid_contact_phone} onChange={(e) => setForm((p) => ({ ...p, bid_contact_phone: e.target.value }))} />
              </div>
            </div>

            <div className="rounded-md border p-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <Label className="mb-0">Shipping Included</Label>
                    <Checkbox checked={form.shipping_included} onCheckedChange={(v) => setForm((p) => ({ ...p, shipping_included: !!v }))} />
                  </div>
                  {!form.shipping_included && (
                    <div className="mt-2">
                      <Input type="number" step="0.01" min="0" value={form.shipping_amount} onChange={(e) => setForm((p) => ({ ...p, shipping_amount: e.target.value }))} />
                    </div>
                  )}
                </div>
                <div className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <Label className="mb-0">Taxes Included</Label>
                    <Checkbox checked={form.taxes_included} onCheckedChange={(v) => setForm((p) => ({ ...p, taxes_included: !!v }))} />
                  </div>
                  {!form.taxes_included && (
                    <div className="mt-2 space-y-1">
                      <Label>Tax Rate (%)</Label>
                      <Input type="number" step="0.01" min="0" max="100" value={form.tax_amount} onChange={(e) => setForm((p) => ({ ...p, tax_amount: e.target.value }))} />
                      <p className="text-xs text-muted-foreground">Tax rate %, applied to (Base Bid - Discount)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Amount</Label>
                <Input type="number" step="0.01" min="0" value={form.discount_amount} onChange={(e) => setForm((p) => ({ ...p, discount_amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Final Total Bid</Label>
                <div className="h-10 rounded-md border px-3 flex items-center font-semibold">
                  ${totalBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Inclusions / Exclusions Notes</Label>
              <Textarea
                rows={3}
                value={form.comparison_notes}
                onChange={(e) => setForm((p) => ({ ...p, comparison_notes: e.target.value }))}
                placeholder="Notes used for bid comparison"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={5} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email ({emailMessages.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <div className="font-medium">Bid Tracking Email</div>
                {trackingEmail ? (
                  <div className="mt-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{trackingEmail}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard?.writeText(trackingEmail)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Include this email on all communications regarding this bid with the vendor to keep every email logged here.
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground">Tracking email unavailable.</p>
                )}
              </div>

              <div className="space-y-2 rounded-md border p-3">
                {loadingEmails ? (
                  <p className="text-sm text-muted-foreground"><span className="loading-dots">Loading</span></p>
                ) : emailMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No email activity logged yet.</p>
                ) : (
                  emailMessages.map((email) => {
                    return (
                      <div
                        key={email.id}
                        className="rounded-md bg-muted/40 border"
                      >
                        <button
                          type="button"
                          className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
                          onClick={() => setActiveEmailPreview(email)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground">
                              {email.direction === "inbound" ? "Inbound" : "Outbound"} • {format(new Date(email.created_at), "MMM d, yyyy h:mm a")}
                            </div>
                            <span className="text-xs text-primary">Preview</span>
                          </div>
                          <div className="text-sm font-medium mt-1">{email.subject || "(No subject)"}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            From: {email.from_email || "-"} | To: {(email.to_emails || []).join(", ") || "-"}
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!activeEmailPreview} onOpenChange={(open) => !open && setActiveEmailPreview(null)}>
        <DialogContent className="max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>{activeEmailPreview?.subject || "(No subject)"}</DialogTitle>
          </DialogHeader>
          {activeEmailPreview && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                <div>Direction: {activeEmailPreview.direction === "inbound" ? "Inbound" : "Outbound"}</div>
                <div>From: {activeEmailPreview.from_email || "-"}</div>
                <div>To: {(activeEmailPreview.to_emails || []).join(", ") || "-"}</div>
                <div>Sent: {format(new Date(activeEmailPreview.created_at), "MMM d, yyyy h:mm a")}</div>
              </div>
              {activeEmailPreview.body_html ? (
                <iframe
                  title={`email-preview-${activeEmailPreview.id}`}
                  sandbox=""
                  srcDoc={activeEmailPreview.body_html}
                  className="h-[65vh] w-full rounded border bg-white"
                />
              ) : activeEmailPreview.body_text ? (
                <p className="text-sm whitespace-pre-wrap rounded border bg-background p-3 max-h-[65vh] overflow-y-auto">
                  {activeEmailPreview.body_text}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground rounded border bg-background p-3">
                  No body available for this message.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
