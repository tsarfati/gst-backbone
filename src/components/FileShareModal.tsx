import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

interface ShareableFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
}

interface FileShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single file (legacy support) */
  file?: ShareableFile;
  /** Multiple files */
  files?: ShareableFile[];
  jobId: string;
}

type DeliveryMethod = "attachment" | "link";

interface FileDeliveryOption {
  method: DeliveryMethod;
  linkExpirySeconds: number;
}

const LINK_EXPIRY_OPTIONS = [
  { label: "1 day", value: 60 * 60 * 24 },
  { label: "3 days", value: 60 * 60 * 24 * 3 },
  { label: "7 days", value: 60 * 60 * 24 * 7 },
  { label: "14 days", value: 60 * 60 * 24 * 14 },
  { label: "30 days", value: 60 * 60 * 24 * 30 },
];

export default function FileShareModal({ open, onOpenChange, file, files, jobId }: FileShareModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const allFiles = files && files.length > 0 ? files : file ? [file] : [];

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [fileOptions, setFileOptions] = useState<Record<string, FileDeliveryOption>>({});

  // Reset form when opening
  useEffect(() => {
    if (open) {
      const names = allFiles.map(f => f.file_name);
      setTo("");
      setSubject(
        names.length === 1
          ? `Shared file: ${names[0]}`
          : `Shared ${names.length} files`
      );
      setBody(
        names.length === 1
          ? `Hi,\n\nPlease find the attached file "${names[0]}".\n\nBest regards,\n${profile?.first_name || ''} ${profile?.last_name || ''}`
          : `Hi,\n\nPlease find the following attached files:\n${names.map(n => `• ${n}`).join('\n')}\n\nBest regards,\n${profile?.first_name || ''} ${profile?.last_name || ''}`
      );
      setFileOptions(
        Object.fromEntries(
          allFiles.map((f) => [
            f.id,
            {
              method: "attachment" as DeliveryMethod,
              linkExpirySeconds: 60 * 60 * 24 * 7,
            },
          ])
        )
      );
    }
  }, [open]);

  const formatBytes = (bytes: number | null) => {
    if (!bytes || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const setFileMethod = (fileId: string, method: DeliveryMethod) => {
    setFileOptions((prev) => ({
      ...prev,
      [fileId]: {
        method,
        linkExpirySeconds: prev[fileId]?.linkExpirySeconds ?? 60 * 60 * 24 * 7,
      },
    }));
  };

  const setFileExpiry = (fileId: string, seconds: number) => {
    setFileOptions((prev) => ({
      ...prev,
      [fileId]: {
        method: prev[fileId]?.method ?? "link",
        linkExpirySeconds: seconds,
      },
    }));
  };

  const handleSend = async () => {
    if (!to.trim() || !user || allFiles.length === 0) return;
    setSending(true);

    try {
      // Check if user has SMTP configured
      const { data: emailSettings } = await supabase
        .from('user_email_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!emailSettings?.is_configured) {
        toast({
          title: "Email not configured",
          description: "Please configure your SMTP/IMAP settings in Profile Settings to send emails.",
          variant: "destructive",
        });
        setSending(false);
        return;
      }

      // Generate signed URLs for all files. Attachment-mode URLs are short-lived fetch URLs
      // for the edge function to download; link-mode URLs use the user-selected expiration.
      const fileAttachments = await Promise.all(
        allFiles.map(async (f) => {
          const option = fileOptions[f.id] ?? { method: "attachment" as DeliveryMethod, linkExpirySeconds: 604800 };
          const expiresIn = option.method === "link" ? option.linkExpirySeconds : 3600;
          const { data: signedData } = await supabase.storage
            .from('job-filing-cabinet')
            .createSignedUrl(f.file_url, expiresIn);

          return {
            id: f.id,
            file_name: f.file_name,
            file_size: f.file_size,
            file_url: signedData?.signedUrl || '',
            delivery_method: option.method,
            link_expires_in_seconds: option.method === "link" ? option.linkExpirySeconds : null,
            link_expires_label:
              option.method === "link"
                ? LINK_EXPIRY_OPTIONS.find((o) => o.value === option.linkExpirySeconds)?.label || `${Math.round(option.linkExpirySeconds / 86400)} days`
                : null,
          };
        })
      );

      const validAttachments = fileAttachments.filter(a => a.file_url);
      if (validAttachments.length === 0) throw new Error("Failed to generate file links");

      // Call edge function to send email
      const { error } = await supabase.functions.invoke('send-file-share-email', {
        body: {
          to: to.split(',').map(e => e.trim()),
          subject,
          body,
          // Legacy single file support
          file_name: validAttachments[0].file_name,
          file_url: validAttachments[0].file_url,
          // Multi-file support
          attachments: validAttachments,
          user_id: user.id,
        },
      });

      if (error) throw error;

      toast({ title: "Email sent", description: `${validAttachments.length} file(s) shared with ${to}` });
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error sending:', err);
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Share {allFiles.length === 1 ? 'File' : `${allFiles.length} Files`}
          </DialogTitle>
          <DialogDescription>
            Choose per file whether to send it as an email attachment or a secure link with an expiration date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Attachment list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allFiles.map(f => (
              <div key={f.id} className="rounded-md border p-2 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{f.file_name}</span>
                  {formatBytes(f.file_size) && (
                    <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.file_size)}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[180px_160px] gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Send as</Label>
                    <Select
                      value={(fileOptions[f.id]?.method ?? "attachment")}
                      onValueChange={(value) => setFileMethod(f.id, value as DeliveryMethod)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attachment">Email attachment</SelectItem>
                        <SelectItem value="link">Secure link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(fileOptions[f.id]?.method ?? "attachment") === "link" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Link expires</Label>
                      <Select
                        value={String(fileOptions[f.id]?.linkExpirySeconds ?? 604800)}
                        onValueChange={(value) => setFileExpiry(f.id, Number(value))}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LINK_EXPIRY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-to">To (comma-separated emails)</Label>
            <Input
              id="share-to"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-subject">Subject</Label>
            <Input
              id="share-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-body">Message</Label>
            <Textarea
              id="share-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={!to.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
