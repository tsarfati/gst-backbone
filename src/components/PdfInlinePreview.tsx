import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

// Enhanced inline PDF preview using pdfjs-dist. Renders all pages.
// Uses ArrayBuffer from File to avoid blob URL navigation issues in sandboxed iframes.

interface PdfInlinePreviewProps {
  file: File; // PDF file to render
  className?: string;
}

export default function PdfInlinePreview({ file, className }: PdfInlinePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function renderPdf() {
      setError(null);
      setLoading(true);
      setPages([]);

      try {
        if (file.type !== 'application/pdf') {
          throw new Error('Not a PDF file');
        }

        // Lazy import to keep main bundle smaller
        const pdfjs = await import('pdfjs-dist');
        // Set worker to CDN for reliability in this environment
        // Version must match the installed version to avoid warnings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.530/pdf.worker.min.mjs`;

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        // Wait for container to be rendered and get its width
        await new Promise(resolve => setTimeout(resolve, 0));
        const containerWidth = containerRef.current?.clientWidth || 800;

        const renderedPages: HTMLCanvasElement[] = [];

        // Render all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break;

          const page = await pdf.getPage(pageNum);
          if (cancelled) break;

          const viewport = page.getViewport({ scale: 1 });
          
          // Scale to fit full width of container
          const scale = containerWidth / viewport.width;
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) throw new Error('2D context not available');

          canvas.width = Math.ceil(scaledViewport.width);
          canvas.height = Math.ceil(scaledViewport.height);
          canvas.className = "w-full h-auto border-b bg-white";

          const renderTask = page.render({ canvasContext: context, viewport: scaledViewport, canvas });
          await renderTask.promise;
          
          renderedPages.push(canvas);
        }

        if (!cancelled) {
          setPages(renderedPages);
          setLoading(false);
        }

        await pdf.cleanup();
        await pdf.destroy();
      } catch (err: any) {
        console.error('PDF inline preview error:', err);
        if (!cancelled) {
          setError('Unable to preview PDF.');
          setLoading(false);
        }
      }
    }

    renderPdf();

    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    // Append rendered canvases to container
    if (containerRef.current && pages.length > 0) {
      containerRef.current.innerHTML = '';
      pages.forEach(canvas => {
        containerRef.current?.appendChild(canvas);
      });
    }
  }, [pages]);

  return (
    <div className={cn("relative w-full", className)}>
      <div ref={containerRef} className="w-full" />
      {loading && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground bg-background/60">
          Rendering preview...
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center gap-2 text-center p-8 bg-background/80 rounded">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}
