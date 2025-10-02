import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, FileText, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import PdfPreview from "./PdfPreview";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    fileName: string;
    url: string;
    type: string;
  } | null;
}

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  document
}: DocumentPreviewModalProps) {
  const [loading, setLoading] = useState(false);

  if (!document) return null;

  const handleDownload = async () => {
    if (!document.url) return;
    
    setLoading(true);
    try {
      const response = await fetch(document.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.fileName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileExtension = (fileName: string) => {
    return fileName.split('.').pop()?.toLowerCase() || '';
  };

  const isImage = (fileName: string) => {
    const ext = getFileExtension(fileName);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  };

  const isPdf = (fileName: string) => {
    const ext = getFileExtension(fileName);
    return ext === 'pdf';
  };

  const renderPreview = () => {
    // Use the type prop if provided, otherwise infer from filename
    const fileType = document.type || (isPdf(document.fileName) ? 'pdf' : isImage(document.fileName) ? 'image' : 'other');
    
    if (fileType === 'pdf' || isPdf(document.fileName)) {
      return (
        <div className="w-full h-[600px]">
          <PdfPreview url={document.url} />
        </div>
      );
    } else if (fileType === 'image' || isImage(document.fileName)) {
      return (
        <div className="flex items-center justify-center h-[600px] bg-muted rounded-lg">
          <img
            src={document.url}
            alt={document.fileName}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] bg-muted rounded-lg">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Preview Not Available</h3>
          <p className="text-muted-foreground text-center mb-4">
            This file type cannot be previewed in the browser.
          </p>
          <Button onClick={handleDownload} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            {loading ? 'Downloading...' : 'Download File'}
          </Button>
        </div>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <DialogTitle className="flex items-center gap-2">
              {isImage(document.fileName) ? (
                <ImageIcon className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
              {document.fileName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={loading}
              >
                <Download className="h-4 w-4 mr-2" />
                {loading ? 'Downloading...' : 'Download'}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}