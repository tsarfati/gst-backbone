import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

// Minimal inline PDF preview using pdfjs-dist. Renders first page.
// Uses ArrayBuffer from File to avoid blob URL navigation issues in sandboxed iframes.

interface PdfInlinePreviewProps {
  file: File; // PDF file to render
  className?: string;
  height?: number; // desired height in px (default 384 = h-96)
}

export default function PdfInlinePreview({ file, className, height = 384 }: PdfInlinePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function renderPdf() {
      setError(null);
      setLoading(true);

      try {
        if (file.type !== 'application/pdf') {
          throw new Error('Not a PDF file');
        }

        // Lazy import to keep main bundle smaller
        const pdfjs = await import('pdfjs-dist');
        // Set worker to CDN for reliability in this environment
        // Version must match the installed version to avoid warnings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        // Wait for container to be rendered and get its width
        await new Promise(resolve => setTimeout(resolve, 0));
        const containerWidth = containerRef.current?.clientWidth || 800;
        const viewport = page.getViewport({ scale: 1 });
        
        // Scale to fit full width of container
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas not available');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('2D context not available');

        canvas.width = Math.ceil(scaledViewport.width);
        canvas.height = Math.ceil(scaledViewport.height);

        const renderTask = page.render({ canvasContext: context, viewport: scaledViewport });
        await renderTask.promise;
        if (cancelled) return;

        setLoading(false);
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
  }, [file, height]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)} style={{ height }}>
      <canvas ref={canvasRef} className="w-full h-full object-contain rounded border bg-white" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-background/60">
          Rendering preview...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4 bg-background/80 rounded">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}
