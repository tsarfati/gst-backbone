import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, ZoomIn, ZoomOut, Highlighter, Circle, Plus, X } from 'lucide-react';
import SinglePagePdfViewer from '@/components/SinglePagePdfViewer';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export interface RfpPlanPageNoteDraft {
  id: string;
  shape_type: 'rect' | 'ellipse';
  x: number;
  y: number;
  width: number;
  height: number;
  note_text?: string | null;
}

export interface RfpPlanPageOption {
  plan_id: string;
  plan_name: string;
  plan_number?: string | null;
  plan_file_url?: string | null;
  plan_page_id: string;
  page_number: number;
  sheet_number?: string | null;
  page_title?: string | null;
  discipline?: string | null;
  thumbnail_url?: string | null;
}

export interface RfpSelectedPlanPage extends RfpPlanPageOption {
  is_primary?: boolean;
  note?: string | null;
  callouts?: RfpPlanPageNoteDraft[];
}

interface RfpPlanPagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: RfpPlanPageOption[];
  selectedPages: RfpSelectedPlanPage[];
  onApply: (selectedPages: RfpSelectedPlanPage[]) => void;
}

type DrawMode = 'pan' | 'rect' | 'ellipse';

export default function RfpPlanPagePicker(props: RfpPlanPagePickerProps) {
  const { open, onOpenChange, options, selectedPages, onApply } = props;
  const [search, setSearch] = useState('');
  const [planSearch, setPlanSearch] = useState('');
  const [currentPlanId, setCurrentPlanId] = useState<string>('');
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [sheetPickerOpen, setSheetPickerOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageRect, setPageRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>('pan');
  const [stagedPages, setStagedPages] = useState<RfpSelectedPlanPage[]>(selectedPages);
  const [draftShape, setDraftShape] = useState<RfpPlanPageNoteDraft | null>(null);
  const [draftOrigin, setDraftOrigin] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setPlanSearch('');
    setPlanPickerOpen(false);
    setSheetPickerOpen(false);
    setZoomLevel(1);
    setDrawMode('pan');
    setDraftShape(null);
    setDraftOrigin(null);
    setStagedPages(selectedPages);
    const firstPage = selectedPages[0] || options[0];
    setCurrentPlanId(firstPage?.plan_id || '');
    setCurrentPageId(firstPage?.plan_page_id || '');
  }, [open, options, selectedPages]);

  const planGroups = useMemo(() => {
    const map = new Map<string, { plan_id: string; plan_name: string; plan_number?: string | null; plan_file_url?: string | null; pages: RfpPlanPageOption[] }>();
    options.forEach((option) => {
      const existing = map.get(option.plan_id);
      if (existing) {
        existing.pages.push(option);
        return;
      }
      map.set(option.plan_id, {
        plan_id: option.plan_id,
        plan_name: option.plan_name,
        plan_number: option.plan_number,
        plan_file_url: option.plan_file_url || null,
        pages: [option],
      });
    });
    return Array.from(map.values()).sort((a, b) => a.plan_name.localeCompare(b.plan_name));
  }, [options]);

  const filteredPlanGroups = useMemo(() => {
    const term = planSearch.trim().toLowerCase();
    if (!term) return planGroups;
    return planGroups.filter((group) =>
      [group.plan_name, group.plan_number, `${group.pages.length} pages`]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [planGroups, planSearch]);

  const currentPlanPages = useMemo(() => {
    return options
      .filter((option) => option.plan_id === currentPlanId)
      .sort((a, b) => a.page_number - b.page_number);
  }, [currentPlanId, options]);

  const filteredCurrentPlanPages = useMemo(() => {
    const term = search.trim().toLowerCase();
    return currentPlanPages
      .filter((option) => {
        if (!term) return true;
        return [
          option.sheet_number,
          option.page_title,
          option.discipline,
          option.plan_name,
          option.plan_number,
          `page ${option.page_number}`,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => a.page_number - b.page_number);
  }, [currentPlanPages, search]);

  useEffect(() => {
    if (!currentPlanId && planGroups[0]?.plan_id) {
      setCurrentPlanId(planGroups[0].plan_id);
    }
  }, [currentPlanId, planGroups]);

  useEffect(() => {
    if (!currentPlanId) return;
    const visiblePageIds = new Set(filteredCurrentPlanPages.map((page) => page.plan_page_id));
    if (currentPageId && visiblePageIds.has(currentPageId)) return;
    const fallback = filteredCurrentPlanPages[0] || currentPlanPages[0] || options.find((page) => page.plan_id === currentPlanId);
    setCurrentPageId(fallback?.plan_page_id || '');
  }, [currentPageId, currentPlanId, filteredCurrentPlanPages, currentPlanPages, options]);

  const activePage = useMemo(
    () => options.find((option) => option.plan_page_id === currentPageId) || null,
    [currentPageId, options],
  );

  const selectedCount = stagedPages.length;
  const stagedMap = useMemo(() => new Map(stagedPages.map((page) => [page.plan_page_id, page])), [stagedPages]);
  const activeSelection = activePage ? stagedMap.get(activePage.plan_page_id) || null : null;

  const upsertPage = (page: RfpPlanPageOption, updater?: (existing: RfpSelectedPlanPage) => RfpSelectedPlanPage) => {
    setStagedPages((prev) => {
      const existing = prev.find((entry) => entry.plan_page_id === page.plan_page_id);
      if (existing) {
        const next = updater ? updater(existing) : existing;
        return prev.map((entry) => (entry.plan_page_id === page.plan_page_id ? next : entry));
      }
      const created: RfpSelectedPlanPage = {
        ...page,
        is_primary: prev.length === 0,
        note: null,
        callouts: [],
      };
      return [...prev, updater ? updater(created) : created];
    });
  };

  const removePage = (pageId: string) => {
    setStagedPages((prev) => {
      const next = prev.filter((entry) => entry.plan_page_id !== pageId);
      if (next.length > 0 && !next.some((entry) => entry.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });
  };

  const addCurrentPageToRfp = () => {
    if (!activePage) return;
    upsertPage(activePage);
  };

  const getOverlayPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pageRect) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - pageRect.left) / pageRect.width;
    const y = (event.clientY - bounds.top - pageRect.top) / pageRect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  const handleOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawMode === 'pan' || !activePage || !pageRect) return;
    const point = getOverlayPoint(event);
    if (!point) return;
    if (!activeSelection) {
      upsertPage(activePage);
    }
    setDraftOrigin(point);
    setDraftShape({
      id: `draft-${Date.now()}`,
      shape_type: drawMode === 'ellipse' ? 'ellipse' : 'rect',
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      note_text: '',
    });
  };

  const handleOverlayPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draftOrigin || !draftShape) return;
    const point = getOverlayPoint(event);
    if (!point) return;
    const nextX = Math.min(draftOrigin.x, point.x);
    const nextY = Math.min(draftOrigin.y, point.y);
    const nextWidth = Math.abs(point.x - draftOrigin.x);
    const nextHeight = Math.abs(point.y - draftOrigin.y);
    setDraftShape({
      ...draftShape,
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
    });
  };

  const handleOverlayPointerUp = () => {
    if (!activePage || !draftShape) {
      setDraftOrigin(null);
      setDraftShape(null);
      return;
    }

    if (draftShape.width < 0.015 || draftShape.height < 0.015) {
      setDraftOrigin(null);
      setDraftShape(null);
      return;
    }

    upsertPage(activePage, (existing) => ({
      ...existing,
      callouts: [...(existing.callouts || []), draftShape],
    }));
    setDraftOrigin(null);
    setDraftShape(null);
  };

  const updateActiveSelection = (updater: (selection: RfpSelectedPlanPage) => RfpSelectedPlanPage) => {
    if (!activePage) return;
    upsertPage(activePage, updater);
  };

  const setCalloutText = (calloutId: string, noteText: string) => {
    updateActiveSelection((selection) => ({
      ...selection,
      callouts: (selection.callouts || []).map((callout) =>
        callout.id === calloutId ? { ...callout, note_text: noteText } : callout,
      ),
    }));
  };

  const removeCallout = (calloutId: string) => {
    updateActiveSelection((selection) => ({
      ...selection,
      callouts: (selection.callouts || []).filter((callout) => callout.id !== calloutId),
    }));
  };

  const orderedStagedPages = useMemo(
    () => stagedPages.map((page, index) => ({
      ...page,
      is_primary: stagedPages.some((entry) => entry.is_primary) ? !!page.is_primary : index === 0,
      callouts: (page.callouts || []).map((callout) => ({ ...callout })),
    })),
    [stagedPages],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[1680px] h-[96vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Attach Plan Pages</DialogTitle>
          <DialogDescription>
            Choose a plan set, review the sheets, zoom into the page, and place note callouts before attaching it to the RFP.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 flex items-center justify-between gap-3">
          <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-[280px_360px_minmax(260px,1fr)]">
            <Popover open={planPickerOpen} onOpenChange={setPlanPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={planPickerOpen}
                  className="justify-between"
                  disabled={planGroups.length === 0}
                >
                  <span className="truncate">
                    {currentPlanId
                      ? (() => {
                          const selected = planGroups.find((group) => group.plan_id === currentPlanId);
                          if (!selected) return 'Select a plan set';
                          const selectedPagesInSet = stagedPages.filter((page) => page.plan_id === selected.plan_id).length;
                          return `${selected.plan_name}${selected.plan_number ? ` #${selected.plan_number}` : ''}${selectedPagesInSet > 0 ? ` • ${selectedPagesInSet} attached` : ''}`;
                        })()
                      : 'Select a plan set'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="start" onWheelCapture={(e) => e.stopPropagation()}>
                <Command shouldFilter={false}>
                  <CommandInput
                    value={planSearch}
                    onValueChange={setPlanSearch}
                    placeholder="Search plan sets"
                  />
                  <CommandList className="max-h-[320px] overflow-y-auto overflow-x-hidden" onWheelCapture={(e) => e.stopPropagation()}>
                    <CommandEmpty>No plan sets found.</CommandEmpty>
                    <CommandGroup>
                      {filteredPlanGroups.map((group) => {
                        const selectedPagesInSet = stagedPages.filter((page) => page.plan_id === group.plan_id).length;
                        return (
                          <CommandItem
                            key={group.plan_id}
                            value={`${group.plan_name} ${group.plan_number || ''}`}
                            onSelect={() => {
                              setCurrentPlanId(group.plan_id);
                              setCurrentPageId('');
                              setZoomLevel(1);
                              setPlanPickerOpen(false);
                            }}
                            className="flex items-start gap-2 py-2"
                          >
                            <Check
                              className={cn(
                                'mt-0.5 h-4 w-4 shrink-0',
                                currentPlanId === group.plan_id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">
                                {group.plan_name}
                                {group.plan_number ? ` #${group.plan_number}` : ''}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {group.pages.length} pages
                                {selectedPagesInSet > 0 ? ` • ${selectedPagesInSet} attached` : ''}
                              </div>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Popover open={sheetPickerOpen} onOpenChange={setSheetPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={sheetPickerOpen}
                  className="justify-between"
                  disabled={!currentPlanId || currentPlanPages.length === 0}
                >
                  <span className="truncate">
                    {activePage
                      ? `${activePage.sheet_number || `Page ${activePage.page_number}`}${activePage.page_title ? ` • ${activePage.page_title}` : ''}`
                      : 'Select a sheet'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start" onWheelCapture={(e) => e.stopPropagation()}>
                <Command shouldFilter={false}>
                  <CommandInput
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Search sheet number, title, discipline, or page"
                  />
                  <CommandList className="max-h-[360px] overflow-y-auto overflow-x-hidden" onWheelCapture={(e) => e.stopPropagation()}>
                    <CommandEmpty>No sheets found.</CommandEmpty>
                    <CommandGroup>
                      {filteredCurrentPlanPages.map((page) => {
                        const attached = stagedMap.get(page.plan_page_id);
                        return (
                          <CommandItem
                            key={page.plan_page_id}
                            value={`${page.sheet_number || ''} ${page.page_title || ''} ${page.discipline || ''} ${page.page_number}`}
                            onSelect={() => {
                              setCurrentPageId(page.plan_page_id);
                              setZoomLevel(1);
                              setSheetPickerOpen(false);
                            }}
                            className="flex items-start gap-2 py-2"
                          >
                            <Check
                              className={cn(
                                'mt-0.5 h-4 w-4 shrink-0',
                                currentPageId === page.plan_page_id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">
                                  {page.sheet_number || `Page ${page.page_number}`}
                                </span>
                                {attached ? <Badge variant="secondary">Attached</Badge> : null}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {page.page_title || 'Untitled sheet'}
                              </div>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="secondary">{selectedCount} attached</Badge>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_360px] border-t">
          <div className="min-h-0 flex flex-col">
            <div className="border-b px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {activePage?.sheet_number || (activePage ? `Page ${activePage.page_number}` : 'Select a page')}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {activePage?.plan_name}
                  {activePage?.plan_number ? ` #${activePage.plan_number}` : ''}
                  {activePage?.page_title ? ` • ${activePage.page_title}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" size="sm" variant="outline" onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm min-w-[52px] text-center">{Math.round(zoomLevel * 100)}%</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setZoomLevel((prev) => Math.min(5, prev + 0.25))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={drawMode === 'rect' ? 'default' : 'outline'}
                  onClick={() => setDrawMode((prev) => (prev === 'rect' ? 'pan' : 'rect'))}
                >
                  <Highlighter className="h-4 w-4 mr-2" />
                  Highlight
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={drawMode === 'ellipse' ? 'default' : 'outline'}
                  onClick={() => setDrawMode((prev) => (prev === 'ellipse' ? 'pan' : 'ellipse'))}
                >
                  <Circle className="h-4 w-4 mr-2" />
                  Circle
                </Button>
                {activeSelection ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => removePage(activeSelection.plan_page_id)}>
                    Remove Page
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={addCurrentPageToRfp} disabled={!activePage}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Page
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 relative bg-muted/20">
              {activePage?.plan_file_url ? (
                <div
                  className="absolute inset-0"
                  onPointerDown={handleOverlayPointerDown}
                  onPointerMove={handleOverlayPointerMove}
                  onPointerUp={handleOverlayPointerUp}
                  onPointerLeave={() => {
                    if (draftShape) {
                      setDraftOrigin(null);
                      setDraftShape(null);
                    }
                  }}
                >
                  <SinglePagePdfViewer
                    url={activePage.plan_file_url}
                    pageNumber={activePage.page_number}
                    totalPages={totalPages}
                    zoomLevel={zoomLevel}
                    onZoomChange={setZoomLevel}
                    onTotalPagesChange={setTotalPages}
                    onPageRectChange={setPageRect}
                  />
                  {pageRect ? (
                    <div
                      className={cn('absolute inset-0', drawMode === 'pan' ? 'pointer-events-none' : 'pointer-events-auto')}
                    >
                      {[...(activeSelection?.callouts || []), ...(draftShape ? [draftShape] : [])].map((callout, index) => (
                        <div
                          key={callout.id}
                          className="absolute border-2 border-amber-500 bg-amber-300/15"
                          style={{
                            left: pageRect.left + callout.x * pageRect.width,
                            top: pageRect.top + callout.y * pageRect.height,
                            width: callout.width * pageRect.width,
                            height: callout.height * pageRect.height,
                            borderRadius: callout.shape_type === 'ellipse' ? '9999px' : '0.25rem',
                          }}
                        >
                          <div className="absolute -top-2 -left-2 h-5 min-w-5 rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-black flex items-center justify-center">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Select a page with a previewable plan file.
                </div>
              )}
            </div>
          </div>

          <div className="border-l min-h-0 flex flex-col">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-medium">Sheet Notes</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the plan set and sheet pickers above, then add the current page and place note callouts like “See Note 1”.
              </p>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4 space-y-4">
                {activeSelection ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-sm font-medium">Current Attached Sheet</label>
                        <Badge variant="secondary">
                          {(activeSelection.callouts || []).length} linked note{(activeSelection.callouts || []).length === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {activeSelection.sheet_number || `Page ${activeSelection.page_number}`}
                        {activeSelection.page_title ? ` • ${activeSelection.page_title}` : ''}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sheet Note</label>
                      <Textarea
                        value={activeSelection.note || ''}
                        onChange={(e) =>
                          updateActiveSelection((selection) => ({
                            ...selection,
                            note: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Optional note for bidders about this sheet"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Linked Notes</p>
                        <span className="text-xs text-muted-foreground">
                          {drawMode === 'pan' ? 'Choose Highlight or Circle to add a note' : 'Draw on the page to add a note'}
                        </span>
                      </div>
                      {(activeSelection.callouts || []).length === 0 ? (
                        <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                          No linked notes yet. Add the page, then draw a highlight or circle on the preview.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(activeSelection.callouts || []).map((callout, index) => (
                            <div key={callout.id} className="rounded-md border p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge>Note {index + 1}</Badge>
                                  <span className="text-xs text-muted-foreground capitalize">
                                    {callout.shape_type === 'ellipse' ? 'Circle callout' : 'Highlight callout'}
                                  </span>
                                </div>
                                <Button type="button" size="icon" variant="ghost" onClick={() => removeCallout(callout.id)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <Textarea
                                value={callout.note_text || ''}
                                onChange={(e) => setCalloutText(callout.id, e.target.value)}
                                rows={3}
                                placeholder={`Text for Note ${index + 1}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                    Pick a plan set and sheet above, then add that page to the RFP to create linked notes on it.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(orderedStagedPages);
              onOpenChange(false);
            }}
          >
            Apply Attached Plan Pages
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
