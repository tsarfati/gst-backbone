import React, { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreventBrowserZoom } from "@/hooks/usePreventBrowserZoom";
import UrlPdfInlinePreview from "@/components/UrlPdfInlinePreview";

interface ZoomableDocumentPreviewProps {
  url: string | null;
  fileName?: string;
  className?: string;
  showControls?: boolean;
  emptyMessage?: string;
  emptySubMessage?: string;
}

/**
 * A reusable zoomable document preview component that supports:
 * - Pinch-to-zoom (trackpad)
 * - Ctrl+scroll (mouse wheel)
 * - Click-and-drag panning when zoomed in
 * - Manual zoom buttons
 */
export default function ZoomableDocumentPreview({
  url,
  fileName,
  className,
  showControls = true,
  emptyMessage = "No attachment uploaded",
  emptySubMessage = "Upload a document to see it here",
}: ZoomableDocumentPreviewProps) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const scrollStartRef = useRef({ left: 0, top: 0 });

  // Clamp zoom between 50% and 300%
  const clampZoom = useCallback((z: number) => Math.max(50, Math.min(300, z)), []);

  // Use the hook to prevent browser zoom and route to app-level zoom
  usePreventBrowserZoom({
    containerRef: previewScrollRef,
    enabled: Boolean(url),
    zoom: zoomLevel,
    setZoom: setZoomLevel,
    clamp: clampZoom,
  });

  const normalizedUrl = (url || "").toLowerCase();
  const normalizedName = (fileName || "").toLowerCase();
  const isPdf =
    normalizedName.endsWith(".pdf") ||
    normalizedUrl.includes(".pdf") ||
    normalizedUrl.includes("application/pdf");

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 100 && previewScrollRef.current) {
      setIsPanning(true);
      const nextPanStart = { x: e.clientX, y: e.clientY };
      const nextScrollStart = {
        left: previewScrollRef.current.scrollLeft,
        top: previewScrollRef.current.scrollTop,
      };
      setPanStart(nextPanStart);
      setScrollStart(nextScrollStart);
      panStartRef.current = nextPanStart;
      scrollStartRef.current = nextScrollStart;
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && previewScrollRef.current) {
      const deltaX = panStart.x - e.clientX;
      const deltaY = panStart.y - e.clientY;
      previewScrollRef.current.scrollLeft = scrollStart.left + deltaX;
      previewScrollRef.current.scrollTop = scrollStart.top + deltaY;
    }
  };

  const handleMouseUp = () => setIsPanning(false);
  const handleMouseLeave = () => setIsPanning(false);

  useEffect(() => {
    if (!isPanning) return;
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!previewScrollRef.current) return;
      const deltaX = panStartRef.current.x - e.clientX;
      const deltaY = panStartRef.current.y - e.clientY;
      previewScrollRef.current.scrollLeft = scrollStartRef.current.left + deltaX;
      previewScrollRef.current.scrollTop = scrollStartRef.current.top + deltaY;
    };
    const handleWindowMouseUp = () => setIsPanning(false);

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isPanning]);

  return (
    <div className={cn("h-full flex flex-col min-h-0", className)}>
      {/* Header with zoom controls */}
      {showControls && (
        <div className="p-4 border-b bg-background flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-lg">Document Preview</h3>
          {url && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel((prev) => clampZoom(prev - 25))}
                disabled={zoomLevel <= 50}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[60px] text-center">
                {Math.round(zoomLevel)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel((prev) => clampZoom(prev + 25))}
                disabled={zoomLevel >= 300}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel(100)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Scrollable preview area */}
      <div
        ref={previewScrollRef}
        className={cn(
          "flex-1 overflow-auto min-h-0",
          zoomLevel > 100 && "cursor-grab",
          isPanning && "cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {url ? (
          <div
            className={cn(
              "p-4 min-h-full min-w-full flex",
              zoomLevel <= 100 ? "items-center justify-center" : "items-start justify-start"
            )}
          >
            <div
              className="inline-block select-none"
              style={{
                width: `${zoomLevel}%`,
                pointerEvents: isPanning ? "none" : "auto",
              }}
            >
              {isPdf ? (
                <UrlPdfInlinePreview url={url} className="w-full h-auto" />
              ) : (
                <img
                  src={url}
                  alt={fileName || "Attachment preview"}
                  className="w-full h-auto"
                  draggable={false}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-sm">{emptyMessage}</p>
              <p className="text-xs mt-1">{emptySubMessage}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
