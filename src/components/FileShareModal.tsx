import { useState } from "react";
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

interface FileShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    id: string;
    file_name: string;
    file_url: string;
    file_size: number | null;
  };
  jobId: string;
}

export default function FileShareModal({ open, onOpenChange, file, jobId }: FileShareModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(`Shared file: ${file.file_name}`);
  const [body, setBody] = useState(`Hi,\n\nPlease find the attached file "${file.file_name}".\n\nBest regards,\n${profile?.first_name || ''} ${profile?.last_name || ''}`);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !user) return;
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

      // Generate signed URL for the file
      const { data: signedData } = await supabase.storage
        .from('job-filing-cabinet')
        .createSignedUrl(file.file_url, 604800); // 7 days

      if (!signedData) throw new Error("Failed to generate file link");

      // Call edge function to send email
      const { error } = await supabase.functions.invoke('send-file-share-email', {
        body: {
          to: to.split(',').map(e => e.trim()),
          subject,
          body,
          file_name: file.file_name,
          file_url: signedData.signedUrl,
          user_id: user.id,
        },
      });

      if (error) throw error;

      toast({ title: "Email sent", description: `File shared with ${to}` });
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
            Share File
          </DialogTitle>
          <DialogDescription>
            Send this file as an email attachment from your configured email account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md text-sm">
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{file.file_name}</span>
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
