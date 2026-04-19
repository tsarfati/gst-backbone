import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Download, Loader2, MessageSquare, Paperclip, Send, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import UserAvatar from "@/components/UserAvatar";
import { getStoragePathForDb, resolveStorageUrl, uploadFileWithProgress } from "@/utils/storageUtils";
import UrlPdfInlinePreview from "@/components/UrlPdfInlinePreview";

interface BillVendorThreadMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject: string | null;
  content: string;
  read: boolean;
  created_at: string;
  attachment_type: string | null;
  thread_id: string | null;
  attachment_url?: string | null;
}

interface BillVendorThreadProps {
  billId: string;
  title?: string;
  subject: string;
  defaultRecipientId?: string | null;
  emptyMessage?: string;
  composerPlaceholder?: string;
  onMessageSent?: () => Promise<void> | void;
}

export default function BillVendorThread({
  billId,
  title = "Vendor Conversation",
  subject,
  defaultRecipientId = null,
  emptyMessage = "No vendor conversation yet.",
  composerPlaceholder = "Type your message...",
  onMessageSent,
}: BillVendorThreadProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<BillVendorThreadMessage[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, { name: string; avatar_url: string | null }>>({});
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [attachmentSizes, setAttachmentSizes] = useState<Record<string, number | null>>({});
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentUserId = user?.id || null;

  const formatBytes = (bytes: number | null) => {
    if (!bytes || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const getAttachmentFileName = (urlOrPath?: string | null) => {
    if (!urlOrPath) return "Attachment";
    const rawName = urlOrPath.split("/").pop() || "Attachment";
    return decodeURIComponent(rawName.split("?")[0] || rawName);
  };

  const loadMessages = async () => {
    if (!billId || !currentCompany?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("id, from_user_id, to_user_id, subject, content, read, created_at, attachment_type, thread_id, attachment_url")
        .eq("company_id", currentCompany.id)
        .eq("thread_id", billId)
        .eq("attachment_type", "bill_vendor_thread")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const nextMessages = ((data || []) as BillVendorThreadMessage[]).filter(Boolean);
      setMessages(nextMessages);

      const messagesWithAttachments = nextMessages.filter((message) => message.attachment_url);
      if (messagesWithAttachments.length > 0) {
        const resolvedEntries = await Promise.all(
          messagesWithAttachments.map(async (message) => {
            const resolved = await resolveStorageUrl("receipts", String(message.attachment_url || ""));
            return [message.id, resolved || String(message.attachment_url || "")] as const;
          }),
        );
        const nextAttachmentUrls = Object.fromEntries(resolvedEntries);
        setAttachmentUrls(nextAttachmentUrls);

        const sizeEntries = await Promise.all(
          messagesWithAttachments.map(async (message) => {
            const resolvedUrl = nextAttachmentUrls[message.id];
            if (!resolvedUrl) return [message.id, null] as const;
            try {
              const response = await fetch(resolvedUrl, { method: "HEAD" });
              const contentLength = response.headers.get("content-length");
              return [message.id, contentLength ? Number(contentLength) : null] as const;
            } catch {
              return [message.id, null] as const;
            }
          }),
        );
        setAttachmentSizes(Object.fromEntries(sizeEntries));
      } else {
        setAttachmentUrls({});
        setAttachmentSizes({});
      }

      const userIds = Array.from(
        new Set(
          nextMessages
            .flatMap((message) => [message.from_user_id, message.to_user_id])
            .filter(Boolean),
        ),
      );

      if (userIds.length > 0) {
        const { data: resolvedNames, error: namesError } = await supabase.rpc("resolve_user_names", {
          p_user_ids: userIds,
        });
        if (!namesError && resolvedNames) {
          const nextMap: Record<string, { name: string; avatar_url: string | null }> = {};
          (resolvedNames as any[]).forEach((row) => {
            nextMap[String(row.user_id)] = {
              name: String(row.name || "Unknown User"),
              avatar_url: row.avatar_url || null,
            };
          });
          setNameMap(nextMap);
        }
      }

      if (currentUserId) {
        const unreadForUser = nextMessages.filter((message) => message.to_user_id === currentUserId && !message.read);
        await Promise.all(
          unreadForUser.map((message) =>
            supabase.rpc("mark_message_read", {
              p_message_id: message.id,
              p_user_id: currentUserId,
            }),
          ),
        );
      }
    } catch (error) {
      console.error("BillVendorThread: failed loading thread", error);
      toast({
        title: "Could not load conversation",
        description: "The bill conversation could not be loaded right now.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMessages();
  }, [billId, currentCompany?.id, currentUserId]);

  const replyRecipientId = useMemo(() => {
    if (defaultRecipientId) return defaultRecipientId;
    if (!currentUserId) return null;
    const latestInbound = [...messages].reverse().find((message) => message.from_user_id !== currentUserId);
    return latestInbound?.from_user_id || null;
  }, [defaultRecipientId, messages, currentUserId]);

  const sendMessage = async () => {
    if (!currentUserId || !currentCompany?.id || !replyRecipientId || (!draft.trim() && !pendingFile)) return;

    try {
      setSending(true);
      let storedAttachmentUrl: string | undefined;
      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop() || "file";
        const storagePath = `${currentCompany.id}/bill-thread/${billId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        await uploadFileWithProgress({
          bucketName: "receipts",
          filePath: storagePath,
          file: pendingFile,
        });
        storedAttachmentUrl = getStoragePathForDb("receipts", storagePath);
      }

      const { error } = await supabase.rpc("send_message", {
        p_from_user_id: currentUserId,
        p_to_user_id: replyRecipientId,
        p_company_id: currentCompany.id,
        p_subject: subject,
        p_content: draft.trim() || (pendingFile ? "Attached updated backup." : ""),
        p_thread_id: billId,
        p_attachment_type: "bill_vendor_thread",
        p_attachment_url: storedAttachmentUrl,
      });

      if (error) throw error;

      setDraft("");
      setPendingFile(null);
      await loadMessages();
      await onMessageSent?.();
    } catch (error: any) {
      console.error("BillVendorThread: failed sending message", error);
      toast({
        title: "Could not send message",
        description: error?.message || "The bill conversation message could not be sent.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading conversation...
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isMine = message.from_user_id === currentUserId;
              const isUnreadForMe = message.to_user_id === currentUserId && !message.read;
              const identity = nameMap[isMine ? message.from_user_id : message.from_user_id];
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 rounded-lg border p-3 ${
                    isMine ? "bg-primary/5 border-primary/20" : "bg-muted/20"
                  } ${isUnreadForMe ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}
                >
                  <UserAvatar
                    src={identity?.avatar_url || undefined}
                    name={identity?.name || "User"}
                    className="h-8 w-8 shrink-0"
                    fallbackClassName="text-xs"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{identity?.name || "Unknown User"}</p>
                      <Badge variant={isMine ? "secondary" : "outline"}>{isMine ? "You" : "Vendor / Builder"}</Badge>
                      {isUnreadForMe ? <Badge variant="default">Unread</Badge> : null}
                      <p className="text-xs text-muted-foreground">{new Date(message.created_at).toLocaleString()}</p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>
                    {message.attachment_url ? (
                      <div className="pt-2 space-y-2">
                        <a
                          href={attachmentUrls[message.id] || String(message.attachment_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-foreground transition-colors hover:bg-background"
                        >
                          <Paperclip className="h-4 w-4" />
                          <span>{getAttachmentFileName(message.attachment_url)}</span>
                          {formatBytes(attachmentSizes[message.id] ?? null) ? (
                            <span className="text-xs text-muted-foreground">
                              {formatBytes(attachmentSizes[message.id] ?? null)}
                            </span>
                          ) : null}
                          <Download className="h-4 w-4" />
                        </a>
                        {(() => {
                          const resolvedUrl = attachmentUrls[message.id] || String(message.attachment_url);
                          const lower = resolvedUrl.toLowerCase();
                          const isPdf = lower.includes(".pdf") || lower.includes("application/pdf");
                          const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((ext) => lower.includes(ext));
                          if (isPdf) {
                            return (
                              <div className="overflow-hidden rounded-lg border bg-background">
                                <UrlPdfInlinePreview url={resolvedUrl} className="h-[320px] overflow-auto" />
                              </div>
                            );
                          }
                          if (isImage) {
                            return (
                              <div className="overflow-hidden rounded-lg border bg-background p-2">
                                <img
                                  src={resolvedUrl}
                                  alt="Attachment preview"
                                  className="max-h-[320px] w-full object-contain"
                                />
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`bill-thread-${billId}`}>Reply</Label>
          <Textarea
            id={`bill-thread-${billId}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={replyRecipientId ? composerPlaceholder : "A builder or vendor needs to start the thread before you can reply here."}
            className="min-h-[120px]"
            disabled={!replyRecipientId || sending}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  setPendingFile(event.target.files?.[0] || null);
                  event.currentTarget.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={!replyRecipientId || sending}>
                <Paperclip className="mr-2 h-4 w-4" />
                Attach File
              </Button>
              {pendingFile ? (
                <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                  <span>{pendingFile.name}</span>
                  {formatBytes(pendingFile.size) ? <span>{formatBytes(pendingFile.size)}</span> : null}
                  <button type="button" onClick={() => setPendingFile(null)}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={sendMessage} disabled={sending || !replyRecipientId || (!draft.trim() && !pendingFile)}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
