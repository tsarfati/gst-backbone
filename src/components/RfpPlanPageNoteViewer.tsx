import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import SinglePagePdfViewer from '@/components/SinglePagePdfViewer';
import { ZoomIn, ZoomOut } from 'lucide-react';

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
  fileUrl: string | null;
  pageNumber: number;
  sheetNumber?: string | null;
  pageTitle?: string | null;
  planName?: string | null;
  planNumber?: string | null;
  notes: RfpPlanPageNoteViewerNote[];
}

export default function RfpPlanPageNoteViewer(props: RfpPlanPageNoteViewerProps) {
  const { fileUrl, pageNumber, sheetNumber, pageTitle, planName, planNumber, notes } = props;
  const [zoomLevel, setZoomLevel] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageRect, setPageRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  return (
    <div className="h-full min-h-0 grid grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-h-0 flex flex-col border-r">
        <div className="border-b px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{sheetNumber || `Page ${pageNumber}`}</p>
            <p className="text-xs text-muted-foreground truncate">
              {planName}
              {planNumber ? ` #${planNumber}` : ''}
              {pageTitle ? ` • ${pageTitle}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[52px] text-center">{Math.round(zoomLevel * 100)}%</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setZoomLevel((prev) => Math.min(5, prev + 0.25))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative bg-muted/20">
          {fileUrl ? (
            <>
              <SinglePagePdfViewer
                url={fileUrl}
                pageNumber={pageNumber}
                totalPages={totalPages}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                onTotalPagesChange={setTotalPages}
                onPageRectChange={setPageRect}
              />
              {pageRect ? (
                <div className="absolute inset-0 pointer-events-none">
                  {notes.map((note, index) => (
                    <div
                      key={note.id}
                      className="absolute border-2 border-amber-500 bg-amber-300/15"
                      style={{
                        left: pageRect.left + note.x * pageRect.width,
                        top: pageRect.top + note.y * pageRect.height,
                        width: note.width * pageRect.width,
                        height: note.height * pageRect.height,
                        borderRadius: note.shape_type === 'ellipse' ? '9999px' : '0.25rem',
                      }}
                    >
                      <div className="absolute -top-2 -left-2 h-5 min-w-5 rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-black flex items-center justify-center">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
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
              <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No linked notes were added to this page.
              </div>
            ) : (
              notes.map((note, index) => (
                <div key={note.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge>Note {index + 1}</Badge>
                    <span className="text-xs text-muted-foreground capitalize">
                      {note.shape_type === 'ellipse' ? 'Circle callout' : 'Highlight callout'}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    {note.note_text?.trim() || 'No note text was entered for this callout.'}
                  </p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
