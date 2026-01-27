import React, { useRef, useState, useCallback } from "react";
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

  const isPdf = url?.toLowerCase().includes(".pdf");

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 100 && previewScrollRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setScrollStart({
        left: previewScrollRef.current.scrollLeft,
        top: previewScrollRef.current.scrollTop,
      });
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
          zoomLevel > 100 && "cursor-grab active:cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {url ? (
          <div className="p-4">
            <div
              className="inline-block select-none"
              style={{
                width: `${zoomLevel}%`,
                minWidth: "100%",
                transformOrigin: "top left",
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
