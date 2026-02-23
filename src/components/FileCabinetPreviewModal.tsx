import { useState, useEffect } from "react";
import {
  Dialog, DialogContent
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Share2, X, Loader2, FileText, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface FilingFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
}

interface FileCabinetPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: FilingFile;
  onShare: () => void;
}

export default function FileCabinetPreviewModal({ open, onOpenChange, file, onShare }: FileCabinetPreviewModalProps) {
  const { toast } = useToast();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isImage = file.file_type?.startsWith('image/');
  const isPdf = file.file_type === 'application/pdf' || file.file_name.toLowerCase().endsWith('.pdf');
  const canPreview = isImage || isPdf;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSignedUrl(null);

    const getUrl = async () => {
      const { data, error } = await supabase.storage
        .from('job-filing-cabinet')
        .createSignedUrl(file.file_url, 3600);

      if (error || !data) {
        console.error('Failed to get signed URL:', error);
        setLoading(false);
        return;
      }
      setSignedUrl(data.signedUrl);
      setLoading(false);
    };
    getUrl();
  }, [open, file.file_url]);

  const handleDownload = async () => {
    if (!signedUrl) return;
    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const handlePrint = () => {
    if (!signedUrl) return;
    const printWindow = window.open(signedUrl, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };

  const handleShare = () => {
    onOpenChange(false);
    onShare();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{file.file_name}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleDownload} disabled={!signedUrl}>
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </Button>
            <Button variant="ghost" size="sm" onClick={handlePrint} disabled={!signedUrl || !canPreview}>
              <Printer className="h-4 w-4 mr-1.5" />
              Print
            </Button>
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1.5" />
              Email
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 ml-2" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto bg-muted/10 flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Loading preview...</span>
            </div>
          ) : !signedUrl ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-40" />
              <span className="text-sm">Failed to load file</span>
            </div>
          ) : isPdf ? (
            <iframe
              src={`${signedUrl}#toolbar=0`}
              className="w-full h-full border-0"
              title={file.file_name}
            />
          ) : isImage ? (
            <img
              src={signedUrl}
              alt={file.file_name}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-muted-foreground p-8">
              <FileText className="h-16 w-16 opacity-40" />
              <p className="text-sm font-medium">{file.file_name}</p>
              <p className="text-xs">Preview not available for this file type.</p>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download to View
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
