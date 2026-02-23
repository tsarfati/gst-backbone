import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function FileShareModal({ open, onOpenChange, file, files, jobId }: FileShareModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const allFiles = files && files.length > 0 ? files : file ? [file] : [];

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

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
    }
  }, [open]);

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

      // Generate signed URLs for all files
      const fileAttachments = await Promise.all(
        allFiles.map(async (f) => {
          const { data: signedData } = await supabase.storage
            .from('job-filing-cabinet')
            .createSignedUrl(f.file_url, 604800); // 7 days

          return {
            file_name: f.file_name,
            file_url: signedData?.signedUrl || '',
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
            Send {allFiles.length === 1 ? 'this file' : 'these files'} as email attachment{allFiles.length > 1 ? 's' : ''} from your configured email account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Attachment list */}
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {allFiles.map(f => (
              <div key={f.id} className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{f.file_name}</span>
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
