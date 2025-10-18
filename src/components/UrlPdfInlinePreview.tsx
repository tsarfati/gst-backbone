import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface UrlPdfInlinePreviewProps {
  url: string;
  className?: string;
}

// Renders first page of a PDF from a URL using pdfjs to avoid iframe blocking
export default function UrlPdfInlinePreview({ url, className }: UrlPdfInlinePreviewProps) {
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
        // Lazy import pdf.js
        const pdfjs = await import('pdfjs-dist');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        await new Promise(resolve => setTimeout(resolve, 0));
        const containerWidth = containerRef.current?.clientWidth || 800;
        const viewport = page.getViewport({ scale: 1 });
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
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <canvas ref={canvasRef} className="w-full h-auto rounded border bg-white" />
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
