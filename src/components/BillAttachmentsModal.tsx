import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Eye, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";

interface BillAttachmentsModalProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InvoiceDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  uploaded_at?: string;
}

export default function BillAttachmentsModal({ invoiceId, open, onOpenChange }: BillAttachmentsModalProps) {
  const [docs, setDocs] = useState<InvoiceDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<InvoiceDocument | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (doc: InvoiceDocument) => {
    setDownloading(doc.id);
    try {
      const response = await fetch(doc.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
    } finally {
      setDownloading(null);
    }
  };

  useEffect(() => {
    if (!open || !invoiceId) return;
    const load = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('invoice_documents')
          .select('id, file_name, file_url, file_type, uploaded_at')
          .eq('invoice_id', invoiceId)
          .order('uploaded_at', { ascending: false });
        if (error) throw error;
        setDocs(data || []);
      } catch (e) {
        console.error('Failed to load invoice attachments', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, invoiceId]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Bill Attachments
            </DialogTitle>
            <DialogDescription className="sr-only">Preview bill attachments</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading attachments...
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">No attachments found for this bill.</div>
          ) : (
            <div className="space-y-3">
              {docs.map((d) => (
                <Card key={d.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{d.file_name}</div>
                      {d.uploaded_at && (
                        <div className="text-xs text-muted-foreground">Uploaded {new Date(d.uploaded_at).toLocaleString()}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleDownload(d)} disabled={downloading === d.id}>
                        <Download className="h-4 w-4 mr-2" /> {downloading === d.id ? 'Downloading...' : 'Download'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedDoc(d)}>
                        <Eye className="h-4 w-4 mr-2" /> View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Separator />
              <div className="text-xs text-muted-foreground">Click View to preview an attachment.</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DocumentPreviewModal
        isOpen={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        document={selectedDoc ? { fileName: selectedDoc.file_name, url: selectedDoc.file_url, type: selectedDoc.file_type || 'pdf' } : null}
      />
    </>
  );
}
