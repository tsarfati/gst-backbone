import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, FileText, Image as ImageIcon } from "lucide-react";
import { useState, useEffect } from "react";
import UrlPdfInlinePreview from "./UrlPdfInlinePreview";
import { supabase } from "@/integrations/supabase/client";

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
  const [refreshedUrl, setRefreshedUrl] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    if (!document || !isOpen) {
      setRefreshedUrl(null);
      setRefreshing(true);
      return;
    }

    const refreshSignedUrl = async () => {
      try {
        setRefreshing(true);
        // Try to extract the storage path from the URL
        const urlObj = new URL(document.url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^?]+)/);
        
        if (pathMatch) {
          const [, , fullPath] = pathMatch;
          const [bucket, ...pathParts] = fullPath.split('/');
          const filePath = pathParts.join('/');
          
          // Try to generate a fresh signed URL with proper error handling
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(filePath, 3600); // 1 hour expiry
          
          if (error) {
            console.warn('Unable to create signed URL (may lack permissions):', error.message);
            // For view-only users, try download approach instead
            const { data: downloadData } = await supabase.storage
              .from(bucket)
              .download(filePath);
            
            if (downloadData) {
              const objectUrl = URL.createObjectURL(downloadData);
              setRefreshedUrl(objectUrl);
            } else {
              // Fallback to original URL
              setRefreshedUrl(document.url);
            }
          } else if (data?.signedUrl) {
            setRefreshedUrl(data.signedUrl);
          } else {
            setRefreshedUrl(document.url);
          }
        } else {
          // Not a storage URL, use as-is
          setRefreshedUrl(document.url);
        }
      } catch (error) {
        console.error('Error refreshing signed URL:', error);
        setRefreshedUrl(document.url);
      } finally {
        setRefreshing(false);
      }
    };

    refreshSignedUrl();
  }, [document, isOpen]);

  if (!document) return null;

  const handleDownload = async () => {
    const urlToUse = refreshedUrl || document?.url;
    if (!urlToUse) return;
    
    setLoading(true);
    try {
      const response = await fetch(urlToUse);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document?.fileName || 'download';
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
    if (refreshing) {
      return (
        <div className="flex items-center justify-center h-[600px]">
          <p className="text-muted-foreground">Loading preview...</p>
        </div>
      );
    }

    if (!refreshedUrl || !document) {
      return (
        <div className="flex items-center justify-center h-[600px]">
          <p className="text-muted-foreground">Unable to load preview</p>
        </div>
      );
    }

    // Use the type prop if provided, otherwise infer from filename
    const fileType = document.type || (isPdf(document.fileName) ? 'pdf' : isImage(document.fileName) ? 'image' : 'other');
    
    if (fileType === 'pdf' || isPdf(document.fileName)) {
      return (
        <div className="w-full h-[600px] overflow-y-auto">
          <UrlPdfInlinePreview url={refreshedUrl} />
        </div>
      );
    } else if (fileType === 'image' || isImage(document.fileName)) {
      return (
        <div className="flex items-center justify-center h-[600px] bg-muted rounded-lg">
          <img
            src={refreshedUrl}
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