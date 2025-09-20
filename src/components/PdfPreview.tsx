import React, { useEffect, useRef, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

// Use CDN worker to avoid bundling issues in Vite
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

interface PdfPreviewProps {
  url: string;
  height?: number; // in px
}

const PdfPreview: React.FC<PdfPreviewProps> = ({ url, height = 720 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function renderPdf() {
      try {
        setLoading(true);
        setError(null);
        console.log('PdfPreview: fetching', url);
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const pdf = await getDocument({ data: buffer }).promise;
        if (canceled) return;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = containerRef.current?.clientWidth || viewport.width;
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas not ready');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context not available');

        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
      } catch (e: any) {
        console.error('PdfPreview error:', e);
        setError(e?.message || 'Failed to render PDF');
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    renderPdf();

    const handleResize = () => {
      // Re-render on resize for crisp scaling
      renderPdf();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      canceled = true;
      window.removeEventListener('resize', handleResize);
    };
  }, [url]);

  return (
    <div ref={containerRef} className="w-full bg-background" style={{ height }}>
      {loading && !error && (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <FileText className="h-10 w-10 mx-auto mb-2" />
            <p>Unable to preview PDF. {error}</p>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className={`${loading || error ? 'hidden' : 'block'} w-full h-auto`} />
    </div>
  );
};

export default PdfPreview;
