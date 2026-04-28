import { useEffect, useMemo, useRef, useState } from 'react';
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, ZoomIn, ZoomOut, Highlighter, Circle, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { resolveStorageUrl } from '@/utils/storageUtils';

const previewRenderCache = new Map<string, string>();
const resolvedPlanUrlCache = new Map<string, string>();
const pdfDocumentPromiseCache = new Map<string, Promise<any>>();
const PICKER_PREVIEW_TARGET_WIDTH = 1800;
const PICKER_MAX_PREVIEW_TARGET_WIDTH = 5200;
const MIN_ZOOM_LEVEL = 0.5;
const MAX_ZOOM_LEVEL = 5;

function inferBucket(pathOrUrl: string) {
  if (pathOrUrl.includes("/job-filing-cabinet/") || pathOrUrl.startsWith("job-filing-cabinet/")) {
    return "job-filing-cabinet" as const;
  }
  return "company-files" as const;
}

async function getResolvedPlanUrl(planFileUrl: string) {
  const cached = resolvedPlanUrlCache.get(planFileUrl);
  if (cached) return cached;
  const resolved = await resolveStorageUrl(inferBucket(planFileUrl) as any, planFileUrl);
  if (!resolved) {
    throw new Error("No plan URL available for preview");
  }
  resolvedPlanUrlCache.set(planFileUrl, resolved);
  return resolved;
}

async function getCachedPdfDocument(planFileUrl: string) {
  const existing = pdfDocumentPromiseCache.get(planFileUrl);
  if (existing) return existing;

  const nextPromise = (async () => {
    const resolvedPlanUrl = await getResolvedPlanUrl(planFileUrl);
    const pdfjs: any = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    const loadingTask = pdfjs.getDocument({
      url: resolvedPlanUrl,
      withCredentials: false,
      disableAutoFetch: false,
      disableStream: false,
      rangeChunkSize: 1024 * 1024,
    });

    return await loadingTask.promise;
  })().catch((error) => {
    pdfDocumentPromiseCache.delete(planFileUrl);
    throw error;
  });

  pdfDocumentPromiseCache.set(planFileUrl, nextPromise);
  return nextPromise;
}

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

interface RfpPlanSetOption {
  id: string;
  plan_name: string;
  plan_number?: string | null;
  file_url?: string | null;
}

interface RfpPlanPagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planSets: RfpPlanSetOption[];
  options: RfpPlanPageOption[];
  selectedPages: RfpSelectedPlanPage[];
  onApply: (selectedPages: RfpSelectedPlanPage[]) => void;
  onLoadPlanPages?: (planId: string) => Promise<void> | void;
  loadingPlanSetIds?: string[];
}

type DrawMode = 'pan' | 'rect' | 'ellipse';

export default function RfpPlanPagePicker(props: RfpPlanPagePickerProps) {
  const {
    open,
    onOpenChange,
    planSets,
    options,
    selectedPages,
    onApply,
    onLoadPlanPages,
    loadingPlanSetIds = [],
  } = props;
  const [search, setSearch] = useState('');
  const [planSearch, setPlanSearch] = useState('');
  const [currentPlanId, setCurrentPlanId] = useState<string>('');
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [sheetPickerOpen, setSheetPickerOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [drawMode, setDrawMode] = useState<DrawMode>('pan');
  const [stagedPages, setStagedPages] = useState<RfpSelectedPlanPage[]>(selectedPages);
  const [draftShape, setDraftShape] = useState<RfpPlanPageNoteDraft | null>(null);
  const [draftOrigin, setDraftOrigin] = useState<{ x: number; y: number } | null>(null);
  const [previewPageId, setPreviewPageId] = useState<string>('');
  const [resolvedPreviewThumbnailUrl, setResolvedPreviewThumbnailUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [brokenThumbnailPageIds, setBrokenThumbnailPageIds] = useState<string[]>([]);
  const [imagePreviewRect, setImagePreviewRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [previewViewportWidth, setPreviewViewportWidth] = useState(960);
  const [isPanningPreview, setIsPanningPreview] = useState(false);
  const thumbnailViewportRef = useRef<HTMLDivElement | null>(null);
  const thumbnailImageRef = useRef<HTMLImageElement | null>(null);
  const previewPanRef = useRef<{ pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);

  const adjustZoom = (delta: number) => {
    setZoomLevel((prev) => Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, Number((prev + delta).toFixed(2)))));
  };

  const handlePreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    adjustZoom(event.deltaY > 0 ? -0.15 : 0.15);
  };

  const handlePreviewPanStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawMode !== 'pan') return;
    if (event.button !== 0) return;
    const viewport = thumbnailViewportRef.current;
    if (!viewport) return;
    previewPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanningPreview(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePreviewPanMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = previewPanRef.current;
    const viewport = thumbnailViewportRef.current;
    if (!state || !viewport || state.pointerId !== event.pointerId) return;
    viewport.scrollLeft = state.scrollLeft - (event.clientX - state.startX);
    viewport.scrollTop = state.scrollTop - (event.clientY - state.startY);
  };

  const handlePreviewPanEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = previewPanRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    previewPanRef.current = null;
    setIsPanningPreview(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    handlePreviewPanStart(event);
    handleOverlayPointerDown(event);
  };

  const handlePreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    handlePreviewPanMove(event);
    handleOverlayPointerMove(event);
  };

  const handlePreviewPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    handlePreviewPanEnd(event);
    handleOverlayPointerUp();
  };

  const handlePreviewPointerLeave = () => {
    if (draftShape) {
      setDraftOrigin(null);
      setDraftShape(null);
    }
  };

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
    setCurrentPlanId(firstPage?.plan_id || planSets[0]?.id || '');
    setCurrentPageId(firstPage?.plan_page_id || '');
    setPreviewPageId(firstPage?.plan_page_id || '');
    setResolvedPreviewThumbnailUrl(null);
    setBrokenThumbnailPageIds([]);
  }, [open, options, planSets, selectedPages]);

  const planGroups = useMemo(() => {
    const map = new Map<string, { plan_id: string; plan_name: string; plan_number?: string | null; plan_file_url?: string | null; pages: RfpPlanPageOption[] }>();
    planSets.forEach((planSet) => {
      map.set(planSet.id, {
        plan_id: planSet.id,
        plan_name: planSet.plan_name,
        plan_number: planSet.plan_number,
        plan_file_url: planSet.file_url || null,
        pages: [],
      });
    });
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
  }, [options, planSets]);

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

  const isCurrentPlanLoading = !!currentPlanId && loadingPlanSetIds.includes(currentPlanId);
  const currentPlanGroup = useMemo(
    () => planGroups.find((group) => group.plan_id === currentPlanId) || null,
    [currentPlanId, planGroups],
  );

  useEffect(() => {
    if (!currentPlanId && planGroups[0]?.plan_id) {
      setCurrentPlanId(planGroups[0].plan_id);
    }
  }, [currentPlanId, planGroups]);

  useEffect(() => {
    if (!open || !currentPlanId) return;
    void onLoadPlanPages?.(currentPlanId);
  }, [open, currentPlanId, onLoadPlanPages]);

  useEffect(() => {
    if (!open || !currentPlanGroup?.plan_file_url) return;
    void getCachedPdfDocument(currentPlanGroup.plan_file_url).catch(() => {
      // ignore prewarm failures; active preview path will handle errors visibly
    });
  }, [currentPlanGroup?.plan_file_url, open]);

  useEffect(() => {
    if (!currentPlanId) return;
    const pageStillBelongsToPlan = currentPlanPages.some((page) => page.plan_page_id === currentPageId);
    if (pageStillBelongsToPlan) return;
    setCurrentPageId('');
  }, [currentPageId, currentPlanId, currentPlanPages]);

  useEffect(() => {
    if (!open || !currentPlanId || currentPageId) return;
    const firstPage = currentPlanPages[0];
    if (!firstPage) return;
    setCurrentPageId(firstPage.plan_page_id);
    setPreviewPageId(firstPage.plan_page_id);
  }, [currentPageId, currentPlanId, currentPlanPages, open]);

  const activePage = useMemo(
    () => options.find((option) => option.plan_page_id === currentPageId) || null,
    [currentPageId, options],
  );
  const previewPage = useMemo(
    () => options.find((option) => option.plan_page_id === previewPageId) || null,
    [previewPageId, options],
  );
  const previewRenderZoomBucket = useMemo(() => {
    if (zoomLevel <= 1) return 1;
    return Math.ceil(zoomLevel * 2) / 2;
  }, [zoomLevel]);
  const previewRenderTargetWidth = useMemo(() => {
    const deviceScale = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const requestedWidth = Math.round(previewViewportWidth * previewRenderZoomBucket * deviceScale);
    return Math.max(
      PICKER_PREVIEW_TARGET_WIDTH,
      Math.min(PICKER_MAX_PREVIEW_TARGET_WIDTH, requestedWidth),
    );
  }, [previewRenderZoomBucket, previewViewportWidth]);

  const selectedCount = stagedPages.length;
  const stagedMap = useMemo(() => new Map(stagedPages.map((page) => [page.plan_page_id, page])), [stagedPages]);
  const activeSelection = activePage ? stagedMap.get(activePage.plan_page_id) || null : null;

  useEffect(() => {
    if (!open) return;
    if (!currentPageId) {
      setPreviewPageId('');
      return;
    }
    setPreviewPageId(currentPageId);
  }, [open, currentPageId]);

  useEffect(() => {
    setResolvedPreviewThumbnailUrl(null);
    setZoomLevel(1);
    setImagePreviewRect(null);
  }, [previewPageId]);

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      if (!previewPage) {
        if (!cancelled) {
          setResolvedPreviewThumbnailUrl(null);
          setPreviewLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setPreviewLoading(true);
      }

      const shouldBypassStoredThumbnail = brokenThumbnailPageIds.includes(previewPage.plan_page_id);

      const renderHighResPreview = async () => {
        if (!previewPage.plan_file_url) {
          if (!cancelled) {
            setPreviewLoading(false);
          }
          return;
        }

        const cacheKey = `${previewPage.plan_file_url}::${previewPage.page_number}::w${previewRenderTargetWidth}`;
        const cachedPreview = previewRenderCache.get(cacheKey);
        if (cachedPreview) {
          if (!cancelled) {
            setResolvedPreviewThumbnailUrl(cachedPreview);
            setPreviewLoading(false);
          }
          return;
        }

        const pdf = await getCachedPdfDocument(previewPage.plan_file_url);
        const safePage = Math.min(Math.max(1, previewPage.page_number || 1), pdf.numPages);
        const page = await pdf.getPage(safePage);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.max(0.1, previewRenderTargetWidth / Math.max(1, baseViewport.width));
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas not available for plan preview");
        }

        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));

        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise;

        const nextPreviewUrl = canvas.toDataURL("image/png");
        previewRenderCache.set(cacheKey, nextPreviewUrl);

        if (!cancelled) {
          setResolvedPreviewThumbnailUrl(nextPreviewUrl);
          setPreviewLoading(false);
        }
      };

      if (previewPage.thumbnail_url && !shouldBypassStoredThumbnail) {
        try {
          const resolved = await resolveStorageUrl('company-files', previewPage.thumbnail_url);
          if (!cancelled) {
            setResolvedPreviewThumbnailUrl(resolved || previewPage.thumbnail_url);
          }
          await renderHighResPreview();
          return;
        } catch {
          await renderHighResPreview();
          return;
        }
      }

      if (!previewPage.plan_file_url) {
        if (!cancelled) {
          setResolvedPreviewThumbnailUrl(null);
          setPreviewLoading(false);
        }
        return;
      }

      try {
        await renderHighResPreview();
      } catch {
        if (!cancelled) {
          setResolvedPreviewThumbnailUrl(null);
          setPreviewLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [brokenThumbnailPageIds, previewPage, previewRenderTargetWidth]);

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

  const effectivePageRect = imagePreviewRect;

  useEffect(() => {
    if (!resolvedPreviewThumbnailUrl) return;

    const viewport = thumbnailViewportRef.current;
    const image = thumbnailImageRef.current;
    if (!viewport || !image) return;

    const updateRect = () => {
      const viewportRect = viewport.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      setPreviewViewportWidth(Math.max(320, viewportRect.width - 48));
      setImagePreviewRect({
        left: imageRect.left - viewportRect.left,
        top: imageRect.top - viewportRect.top,
        width: imageRect.width,
        height: imageRect.height,
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      updateRect();
    });

    resizeObserver.observe(viewport);
    resizeObserver.observe(image);
    image.addEventListener('load', updateRect);
    window.addEventListener('resize', updateRect);
    updateRect();

    return () => {
      resizeObserver.disconnect();
      image.removeEventListener('load', updateRect);
      window.removeEventListener('resize', updateRect);
    };
  }, [previewPage?.plan_file_url, resolvedPreviewThumbnailUrl, zoomLevel]);

  const getOverlayPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!effectivePageRect) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - effectivePageRect.left) / effectivePageRect.width;
    const y = (event.clientY - bounds.top - effectivePageRect.top) / effectivePageRect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  const handleOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawMode === 'pan' || !activePage || !effectivePageRect) return;
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
                  disabled={!currentPlanId || (currentPlanPages.length === 0 && isCurrentPlanLoading)}
                >
                  <span className="truncate">
                    {activePage
                      ? `${activePage.sheet_number || `Page ${activePage.page_number}`}${activePage.page_title ? ` • ${activePage.page_title}` : ''}`
                      : isCurrentPlanLoading
                        ? 'Loading sheets...'
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
                <Button type="button" size="sm" variant="outline" onClick={() => adjustZoom(-0.25)}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm min-w-[52px] text-center">{Math.round(zoomLevel * 100)}%</span>
                <Button type="button" size="sm" variant="outline" onClick={() => adjustZoom(0.25)}>
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
              {resolvedPreviewThumbnailUrl ? (
                <div
                  ref={thumbnailViewportRef}
                  className={cn("absolute inset-0 overflow-auto p-6", drawMode === 'pan' ? (isPanningPreview ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair')}
                  onWheel={handlePreviewWheel}
                  onPointerDown={handlePreviewPointerDown}
                  onPointerMove={handlePreviewPointerMove}
                  onPointerUp={handlePreviewPointerUp}
                  onPointerCancel={handlePreviewPanEnd}
                  onPointerLeave={handlePreviewPointerLeave}
                >
                  <div className="flex min-h-full min-w-max items-center justify-center">
                    <div
                      className="relative inline-block shrink-0"
                      style={{ width: `${Math.max(320, previewViewportWidth * zoomLevel)}px`, maxWidth: 'none' }}
                    >
                      <img
                        ref={thumbnailImageRef}
                        src={resolvedPreviewThumbnailUrl}
                        alt={activePage?.sheet_number || `Page ${activePage?.page_number || 1}`}
                        onError={() => {
                          if (!previewPage?.plan_page_id) return;
                          setBrokenThumbnailPageIds((prev) =>
                            prev.includes(previewPage.plan_page_id) ? prev : [...prev, previewPage.plan_page_id],
                          );
                          setResolvedPreviewThumbnailUrl(null);
                          setPreviewLoading(true);
                        }}
                        className="block h-auto max-h-none w-full rounded border bg-background object-contain shadow-sm"
                      />
                      {effectivePageRect ? (
                        <div
                          className={cn('absolute inset-0', drawMode === 'pan' ? 'pointer-events-none' : 'pointer-events-auto')}
                        >
                          {[...(activeSelection?.callouts || []), ...(draftShape ? [draftShape] : [])].map((callout, index) => (
                            <div
                              key={callout.id}
                              className="absolute border-2 border-amber-500 bg-amber-300/15"
                              style={{
                                left: `${callout.x * 100}%`,
                                top: `${callout.y * 100}%`,
                                width: `${callout.width * 100}%`,
                                height: `${callout.height * 100}%`,
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
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <div>
                    {previewLoading
                      ? 'Loading sheet preview...'
                      : !activePage && isCurrentPlanLoading
                      ? 'Loading the first sheets for this plan set...'
                      : activePage?.plan_file_url
                      ? 'No preview available for this page yet.'
                      : activePage
                        ? 'No sheet thumbnail available yet.'
                        : 'Select a page with a previewable plan file.'}
                  </div>
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
