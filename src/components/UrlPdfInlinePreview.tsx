import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface UrlPdfInlinePreviewProps {
  url: string;
  className?: string;
}

// Renders all pages of a PDF from a URL using pdfjs to avoid iframe blocking
export default function UrlPdfInlinePreview({ url, className }: UrlPdfInlinePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function renderPdf() {
      setError(null);
      setLoading(true);

      try {
        // Lazy import pdf.js
        const pdfjs = await import('pdfjs-dist');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const numPages = pdf.numPages;
        setPageCount(numPages);

        // Clear container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        await new Promise(resolve => setTimeout(resolve, 0));
        const containerWidth = containerRef.current?.clientWidth || 800;

        // Render all pages
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          if (cancelled) break;

          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / viewport.width;
          const scaledViewport = page.getViewport({ scale });

          // Create canvas for this page
          const canvas = document.createElement('canvas');
          canvas.className = 'w-full h-auto border-b bg-white';
          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.width = Math.ceil(scaledViewport.width);
          canvas.height = Math.ceil(scaledViewport.height);

          containerRef.current?.appendChild(canvas);

          const renderTask = page.render({ canvasContext: context, viewport: scaledViewport, canvas });
          await renderTask.promise;
        }

        if (!cancelled) {
          setLoading(false);
        }
        
        await pdf.cleanup();
        await pdf.destroy();
      } catch (err) {
        console.error('URL PDF inline preview error:', err);
        if (!cancelled) {
          setError('Unable to preview PDF.');
          setLoading(false);
        }
      }
    }

    renderPdf();
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className={cn("relative w-full", className)}>
      <div ref={containerRef} className="w-full space-y-0" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-background/60">
          {pageCount > 0 ? `Rendering ${pageCount} page${pageCount !== 1 ? 's' : ''}...` : 'Loading PDF...'}
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-0 bg-background/0 rounded">
          {/* Fallback to iframe if pdf.js render fails */}
          <iframe
            src={`${url}`}
            className="w-full h-[480px] border-0 bg-white"
            title="PDF Preview Fallback"
          />
        </div>
      )}
    </div>
  );
}
