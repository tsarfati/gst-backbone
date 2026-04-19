import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SinglePagePdfViewer from '@/components/SinglePagePdfViewer';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { resolveStorageUrl } from '@/utils/storageUtils';
import { cn } from '@/lib/utils';

export interface RfpPlanPageNoteViewerNote {
  id: string;
  shape_type: 'rect' | 'ellipse';
  x: number;
  y: number;
  width: number;
  height: number;
  note_text?: string | null;
}

interface RfpPlanPageNoteViewerProps {
  planId?: string | null;
  fileUrl: string | null;
  pageNumber: number;
  sheetNumber?: string | null;
  pageTitle?: string | null;
  planName?: string | null;
  planNumber?: string | null;
  thumbnailUrl?: string | null;
  sheetNote?: string | null;
  notes: RfpPlanPageNoteViewerNote[];
  selectedNoteIndex?: number | null;
  onSelectNote?: (noteIndex: number | null) => void;
  onClose?: () => void;
  onDownload?: () => void;
  pageOptions?: Array<{ id: string; label: string }>;
  selectedPageId?: string | null;
  onSelectPage?: (pageId: string) => void;
}

export default function RfpPlanPageNoteViewer(props: RfpPlanPageNoteViewerProps) {
  const { planId, fileUrl, pageNumber, sheetNumber, pageTitle, planName, planNumber, thumbnailUrl, sheetNote, notes, selectedNoteIndex, onSelectNote, onClose, onDownload, pageOptions, selectedPageId, onSelectPage } = props;
  const [zoomLevel, setZoomLevel] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageRect, setPageRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [resolvedFileUrl, setResolvedFileUrl] = useState<string | null>(null);
  const [resolvedThumbnailUrl, setResolvedThumbnailUrl] = useState<string | null>(null);
  const [resolvingFileUrl, setResolvingFileUrl] = useState(true);
  const [shouldRenderPdf, setShouldRenderPdf] = useState(false);
  const noteRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeNoteIndex = useMemo(() => (
    typeof selectedNoteIndex === 'number' && selectedNoteIndex >= 0 && selectedNoteIndex < notes.length
      ? selectedNoteIndex
      : null
  ), [notes.length, selectedNoteIndex]);

  useEffect(() => {
    let cancelled = false;

    const loadResolvedUrl = async () => {
      if (!cancelled) {
        setResolvingFileUrl(true);
        setResolvedFileUrl(null);
      }
      try {
        let rawUrl = fileUrl;
        let sourceBucket: 'company-files' | 'job-filing-cabinet' = (
          rawUrl?.includes('/job-filing-cabinet/') || rawUrl?.startsWith('job-filing-cabinet/')
            ? 'job-filing-cabinet'
            : 'company-files'
        );

        if (!rawUrl && planId) {
          const { data, error } = await supabase
            .from('job_plans')
            .select('file_url')
            .eq('id', planId)
            .maybeSingle();

          if (error) {
            console.error('RfpPlanPageNoteViewer: failed loading fallback plan file URL', error);
          } else {
            rawUrl = data?.file_url || null;
            if (rawUrl) {
              sourceBucket = 'company-files';
            }
          }
        }

        if (!rawUrl && planId) {
          const { data: cabinetFile, error: cabinetError } = await supabase
            .from('job_files')
            .select('file_url')
            .eq('source_plan_id', planId)
            .maybeSingle();

          if (cabinetError) {
            console.error('RfpPlanPageNoteViewer: failed loading filing cabinet fallback plan URL', cabinetError);
          } else {
            rawUrl = cabinetFile?.file_url || null;
            if (rawUrl) {
              sourceBucket = 'job-filing-cabinet';
            }
          }
        }

        let nextUrl: string | null = null;
        if (rawUrl) {
          nextUrl = await resolveStorageUrl(sourceBucket, rawUrl);

          if (
            (!nextUrl || nextUrl === rawUrl) &&
            !rawUrl.startsWith('http')
          ) {
            const fallbackBucket = sourceBucket === 'company-files' ? 'job-filing-cabinet' : 'company-files';
            nextUrl = await resolveStorageUrl(fallbackBucket, rawUrl);
          }
        }
        if (!cancelled) {
          setResolvedFileUrl(nextUrl || null);
          setResolvingFileUrl(false);
        }
      } catch (error) {
        console.error('RfpPlanPageNoteViewer: failed resolving plan preview URL', error);
        if (!cancelled) {
          setResolvedFileUrl(null);
          setResolvingFileUrl(false);
        }
      }
    };

    void loadResolvedUrl();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, planId]);

  useEffect(() => {
    setShouldRenderPdf(false);

    if (!resolvedFileUrl) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShouldRenderPdf(true);
    }, resolvedThumbnailUrl ? 120 : 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resolvedFileUrl, resolvedThumbnailUrl]);

  useEffect(() => {
    let cancelled = false;

    const loadThumbnailUrl = async () => {
      if (!thumbnailUrl) {
        if (!cancelled) setResolvedThumbnailUrl(null);
        return;
      }

      try {
        const resolved = await resolveStorageUrl('company-files', thumbnailUrl);
        if (!cancelled) {
          setResolvedThumbnailUrl(resolved || thumbnailUrl);
        }
      } catch (error) {
        console.error('RfpPlanPageNoteViewer: failed resolving thumbnail URL', error);
        if (!cancelled) {
          setResolvedThumbnailUrl(thumbnailUrl);
        }
      }
    };

    void loadThumbnailUrl();

    return () => {
      cancelled = true;
    };
  }, [thumbnailUrl]);

  useEffect(() => {
    if (activeNoteIndex == null) return;
    noteRefs.current[activeNoteIndex]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [activeNoteIndex]);

  useEffect(() => {
    console.info('RfpPlanPageNoteViewer: rendering sheet annotations', {
      sheet: sheetNumber || `Page ${pageNumber}`,
      noteCount: notes.length,
      hasSheetNote: Boolean(sheetNote),
      hasResolvedFileUrl: Boolean(resolvedFileUrl),
      hasResolvedThumbnailUrl: Boolean(resolvedThumbnailUrl),
    });
  }, [notes.length, pageNumber, resolvedFileUrl, resolvedThumbnailUrl, sheetNote, sheetNumber]);

  const thumbnailOverlayRects = useMemo(() => {
    if (!resolvedThumbnailUrl || !notes.length) return [];

    return notes.map((note, index) => ({
      key: note.id,
      index,
      left: `${Math.max(0, note.x) * 100}%`,
      top: `${Math.max(0, note.y) * 100}%`,
      width: `${Math.max(0, note.width) * 100}%`,
      height: `${Math.max(0, note.height) * 100}%`,
      ellipse: note.shape_type === 'ellipse',
    }));
  }, [notes, resolvedThumbnailUrl]);

  return (
    <div className="h-full min-h-0 grid grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-h-0 flex flex-col border-r">
        <div className="border-b px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{sheetNumber || `Page ${pageNumber}`}</p>
            <p className="text-xs text-muted-foreground truncate">
              {planName}
              {planNumber ? ` #${planNumber}` : ''}
              {pageTitle ? ` • ${pageTitle}` : ''}
            </p>
          </div>
          {pageOptions && pageOptions.length > 1 && selectedPageId && onSelectPage ? (
            <Select value={selectedPageId} onValueChange={onSelectPage}>
              <SelectTrigger className="w-[260px] shrink-0">
                <SelectValue placeholder="Select page" />
              </SelectTrigger>
              <SelectContent>
                {pageOptions.map((pageOption) => (
                  <SelectItem key={pageOption.id} value={pageOption.id}>
                    {pageOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[52px] text-center">{Math.round(zoomLevel * 100)}%</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setZoomLevel((prev) => Math.min(5, prev + 0.25))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            {onDownload ? (
              <Button type="button" size="sm" variant="outline" onClick={onDownload}>
                <Download className="h-4 w-4" />
              </Button>
            ) : null}
            {onClose ? (
              <Button type="button" size="sm" variant="outline" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 min-h-0 relative bg-muted/20">
          {resolvingFileUrl ? (
            <div className="relative h-full">
              {resolvedThumbnailUrl ? (
                <div className="absolute inset-0 flex items-center justify-center overflow-auto p-6">
                  <img
                    src={resolvedThumbnailUrl}
                    alt={sheetNumber || `Page ${pageNumber}`}
                    className="max-h-full max-w-full rounded border bg-background object-contain opacity-90 shadow-sm"
                  />
                </div>
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Loading plan preview...
              </div>
            </div>
          ) : resolvedFileUrl ? (
            <div className="relative h-full">
              {resolvedThumbnailUrl ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-auto p-6">
                  <img
                    src={resolvedThumbnailUrl}
                    alt={sheetNumber || `Page ${pageNumber}`}
                    className="max-h-full max-w-full rounded border bg-background object-contain opacity-70 shadow-sm"
                  />
                </div>
              ) : null}
              {shouldRenderPdf ? (
                <SinglePagePdfViewer
                  url={resolvedFileUrl}
                  pageNumber={pageNumber}
                  totalPages={totalPages}
                  zoomLevel={zoomLevel}
                  onZoomChange={setZoomLevel}
                  onTotalPagesChange={setTotalPages}
                  onPageRectChange={setPageRect}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Preparing full plan preview...
                </div>
              )}
              {pageRect ? (
                <div className="absolute inset-0 pointer-events-none">
                  {notes.map((note, index) => (
                    <button
                      key={note.id}
                      type="button"
                      aria-label={`Focus note ${index + 1}`}
                      onClick={() => onSelectNote?.(index)}
                      className={cn(
                        "absolute border-2 bg-amber-300/15 transition-all",
                        activeNoteIndex === index
                          ? "border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.35)]"
                          : "border-amber-500",
                      )}
                      style={{
                        left: pageRect.left + note.x * pageRect.width,
                        top: pageRect.top + note.y * pageRect.height,
                        width: note.width * pageRect.width,
                        height: note.height * pageRect.height,
                        borderRadius: note.shape_type === 'ellipse' ? '9999px' : '0.25rem',
                        pointerEvents: 'auto',
                      }}
                    >
                      <div className={cn(
                        "absolute -top-2 -left-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-black",
                        activeNoteIndex === index ? 'bg-amber-300' : 'bg-amber-500',
                      )}>
                        {index + 1}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : resolvedThumbnailUrl ? (
            <div className="flex h-full items-center justify-center overflow-auto p-6">
              <div className="relative inline-block max-h-full max-w-full">
                <img
                  src={resolvedThumbnailUrl}
                  alt={sheetNumber || `Page ${pageNumber}`}
                  className="block max-h-full max-w-full rounded border bg-background object-contain shadow-sm"
                />
                {thumbnailOverlayRects.length > 0 ? (
                  <div className="pointer-events-none absolute inset-0">
                    {thumbnailOverlayRects.map((noteRect) => (
                      <button
                        key={noteRect.key}
                        type="button"
                        aria-label={`Focus note ${noteRect.index + 1}`}
                        onClick={() => onSelectNote?.(noteRect.index)}
                        className={cn(
                          "pointer-events-auto absolute border-2 bg-amber-300/15 transition-all",
                          activeNoteIndex === noteRect.index
                            ? "border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.35)]"
                            : "border-amber-500",
                        )}
                        style={{
                          left: noteRect.left,
                          top: noteRect.top,
                          width: noteRect.width,
                          height: noteRect.height,
                          borderRadius: noteRect.ellipse ? '9999px' : '0.25rem',
                        }}
                      >
                        <div className={cn(
                          "absolute -top-2 -left-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-black",
                          activeNoteIndex === noteRect.index ? 'bg-amber-300' : 'bg-amber-500',
                        )}>
                          {noteRect.index + 1}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No plan preview available for this sheet.
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex flex-col">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Linked Notes</p>
          <p className="text-xs text-muted-foreground mt-1">
            These note numbers are referenced directly from the attached plan sheet.
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {notes.length === 0 ? (
              sheetNote?.trim() ? (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge>Sheet Note</Badge>
                    <span className="text-xs text-muted-foreground">
                      Attached with this plan page
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{sheetNote}</p>
                </div>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  No linked notes were added to this page.
                </div>
              )
            ) : (
              notes.map((note, index) => (
                <button
                  key={note.id}
                  type="button"
                  ref={(element) => {
                    noteRefs.current[index] = element;
                  }}
                  onClick={() => onSelectNote?.(index)}
                  className={cn(
                    "w-full rounded-md border p-3 space-y-2 text-left transition-colors",
                    activeNoteIndex === index ? "border-amber-400 bg-amber-50/70" : "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Badge>Note {index + 1}</Badge>
                    <span className="text-xs text-muted-foreground capitalize">
                      {note.shape_type === 'ellipse' ? 'Circle callout' : 'Highlight callout'}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    {note.note_text?.trim() || 'No note text was entered for this callout.'}
                  </p>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
