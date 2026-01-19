import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FullPagePdfViewerProps {
  file: File | { name: string; url: string };
  onBack: () => void;
  hideBackButton?: boolean;
  selectedPage?: number; // externally controlled page to scroll to
  zoom?: number; // visual zoom factor affecting canvas CSS size
}

export default function FullPagePdfViewer({ file, onBack, hideBackButton = false, selectedPage, zoom = 1 }: FullPagePdfViewerProps) {
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileKey = typeof (file as any).url === 'string' ? (file as any).url : (file as File).name;

  useEffect(() => {
    let cancelled = false;

    async function renderAllPages() {
      setLoading(true);
      setError(null);

      try {
        const pdfjs = await import('pdfjs-dist');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

        // Handle both File objects and URL objects
        let arrayBuffer: ArrayBuffer;
        if (file instanceof File) {
          arrayBuffer = await file.arrayBuffer();
        } else {
          const response = await fetch(file.url);
          arrayBuffer = await response.arrayBuffer();
        }

        const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        if (cancelled) return;

        const numPages = pdf.numPages;
        setTotalPages(numPages);
        const canvases: HTMLCanvasElement[] = [];

      // Render all pages
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (cancelled) break;

        const page = await pdf.getPage(pageNum);
        
        // Calculate scale to fit the viewport width
        const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
        const pageViewport = page.getViewport({ scale: 1 });
        const scale = (containerWidth * 0.95) / pageViewport.width; // 95% to add some padding
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        canvases.push(canvas);
      }

        if (!cancelled) {
          setPages(canvases);
          setLoading(false);
        }

        await pdf.cleanup();
        await pdf.destroy();
      } catch (err: any) {
        console.error('PDF rendering error:', err);
        if (!cancelled) {
          setError('Unable to load PDF.');
          setLoading(false);
        }
      }
    }

    renderAllPages();

    return () => {
      cancelled = true;
    };
  }, [fileKey]);

  // Track scroll position to update current page indicator
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollPosition = container.scrollTop;
      const canvasElements = container.querySelectorAll('canvas');
      
      for (let i = 0; i < canvasElements.length; i++) {
        const canvas = canvasElements[i];
        const rect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        if (rect.top <= containerRect.top + 100 && rect.bottom >= containerRect.top + 100) {
          setCurrentPage(i + 1);
          break;
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [pages]);

  const scrollToPage = (pageNum: number) => {
    const container = containerRef.current;
    if (!container) return;

    const canvasElements = container.querySelectorAll('canvas');
    const targetCanvas = canvasElements[pageNum - 1];
    if (targetCanvas) {
      targetCanvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (selectedPage && pages.length > 0) {
      scrollToPage(Math.max(1, Math.min(selectedPage, totalPages || pages.length)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage, pages.length, totalPages]);

  return (
    <div className={`${hideBackButton ? 'relative w-full h-full min-h-0' : 'fixed inset-0'} bg-background z-30 flex flex-col`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${hideBackButton ? 'hidden' : ''}`}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="border-l pl-3">
            <p className="font-medium text-sm truncate max-w-xs">{file.name}</p>
            {totalPages > 0 && (
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>
        </div>

        {/* Page Navigation */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-muted/30" ref={containerRef}>
        <div className="w-full h-full">
          {loading && (
            <div className="flex flex-col items-center justify-center h-96 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading PDF pages...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-96 gap-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={onBack} variant="outline">
                Go Back
              </Button>
            </div>
          )}

          {!loading && !error && pages.length > 0 && (
            <div className="space-y-4 p-2">
              {pages.map((canvas, index) => (
                <div key={index} className="bg-white shadow-lg rounded-lg overflow-hidden">
                  <div className="p-1 border-b bg-muted/50">
                    <p className="text-xs text-muted-foreground text-center">
                      Page {index + 1}
                    </p>
                  </div>
                  <div className="w-full">
                    <canvas
                      ref={(el) => {
                        if (el && canvas) {
                          el.width = canvas.width;
                          el.height = canvas.height;
                          const ctx = el.getContext('2d');
                          if (ctx) {
                            ctx.drawImage(canvas, 0, 0);
                          }
                        }
                      }}
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
