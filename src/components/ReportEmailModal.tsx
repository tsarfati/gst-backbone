import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

interface ReportEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Function that generates the PDF and returns a jsPDF doc (must have .output('blob')) */
  generatePdf: () => Promise<any> | any;
  reportName: string;
  /** Optional default filename for the attachment */
  fileName?: string;
}

export default function ReportEmailModal({
  open,
  onOpenChange,
  generatePdf,
  reportName,
  fileName,
}: ReportEmailModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      setTo("");
      setSubject(`${reportName}`);
      setBody(
        `Hi,\n\nPlease find the attached "${reportName}" report.\n\nBest regards,\n${profile?.first_name || ''} ${profile?.last_name || ''}`
      );
    }
  }, [open, reportName]);

  const handleSend = async () => {
    if (!to.trim() || !user) return;
    setSending(true);
    setGenerating(true);

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
        setGenerating(false);
        return;
      }

      // Generate the PDF
      const doc = await generatePdf();
      if (!doc) throw new Error("Failed to generate PDF");
      
      setGenerating(false);

      // Convert PDF to base64
      const pdfBlob = doc.output('blob') as Blob;
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const pdfBase64 = btoa(binary);

      const attachmentFileName = fileName || `${reportName.replace(/\s+/g, '_')}.pdf`;

      // Call edge function
      const { error } = await supabase.functions.invoke('send-file-share-email', {
        body: {
          to: to.split(',').map(e => e.trim()),
          subject,
          body,
          user_id: user.id,
          pdf_attachment: {
            filename: attachmentFileName,
            content: pdfBase64,
          },
        },
      });

      if (error) throw error;

      toast({ title: "Email sent", description: `Report sent to ${to}` });
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error sending report email:', err);
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Email Report
          </DialogTitle>
          <DialogDescription>
            Send this report as a PDF attachment from your configured email account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Attachment indicator */}
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{fileName || `${reportName}.pdf`}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-to">To (comma-separated emails)</Label>
            <Input
              id="report-to"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-subject">Subject</Label>
            <Input
              id="report-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-body">Message</Label>
            <Textarea
              id="report-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={!to.trim() || sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {generating ? 'Generating PDF...' : 'Sending...'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
