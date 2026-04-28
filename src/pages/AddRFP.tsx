import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, FolderOpen, Layers3, Mail, Paperclip, Save, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';
import { canAccessJobIds, ensureAllowedJobFilter } from '@/utils/jobAccess';
import { createRfpNotifications } from '@/utils/rfpNotifications';
import { getStoragePathForDb } from '@/utils/storageUtils';
import { backfillPlanPageThumbnails } from '@/utils/planPageThumbnails';
import RfpPlanPagePicker, {
  type RfpPlanPageNoteDraft,
  type RfpPlanPageOption,
  type RfpSelectedPlanPage as PickerSelectedPlanPage,
} from '@/components/RfpPlanPagePicker';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface Job {
  id: string;
  name: string;
}

interface AvailablePlanSet {
  id: string;
  plan_name: string;
  plan_number: string | null;
  file_url: string | null;
}

interface AvailableJobFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  folder_id: string | null;
}

interface JobFolder {
  id: string;
  name: string;
  parent_folder_id: string | null;
  is_system_folder: boolean;
}

interface SelectedRfpPlanPage extends RfpPlanPageOption {
  is_primary?: boolean;
  note?: string | null;
  callouts?: RfpPlanPageNoteDraft[];
}

const INITIAL_PLAN_PAGE_BATCH_SIZE = 12;
const BACKGROUND_PLAN_PAGE_BATCH_SIZE = 50;

function pickJoinedRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const isMissingRfpPlanPageNotesTableError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return (
    code === '42p01' ||
    message.includes('rfp_plan_page_notes') ||
    details.includes('rfp_plan_page_notes') ||
    message.includes('schema cache')
  );
};

const buildPlanSelectionSignature = (pages: SelectedRfpPlanPage[]) =>
  JSON.stringify(
    [...pages]
      .map((page) => ({
        plan_id: page.plan_id,
        plan_page_id: page.plan_page_id,
        is_primary: !!page.is_primary,
        note: page.note || null,
        callouts: [...(page.callouts || [])]
          .map((callout) => ({
            shape_type: callout.shape_type,
            x: callout.x,
            y: callout.y,
            width: callout.width,
            height: callout.height,
            note_text: callout.note_text || '',
          }))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      }))
      .sort((a, b) =>
        `${a.plan_id}:${a.plan_page_id}`.localeCompare(`${b.plan_id}:${b.plan_page_id}`),
      ),
  );

const buildCommentSelectionSignature = (pages: SelectedRfpPlanPage[]) =>
  JSON.stringify(
    [...pages]
      .map((page) => ({
        plan_page_id: page.plan_page_id,
        note: page.note || null,
        callouts: [...(page.callouts || [])]
          .map((callout) => ({
            shape_type: callout.shape_type,
            x: callout.x,
            y: callout.y,
            width: callout.width,
            height: callout.height,
            note_text: callout.note_text || '',
          }))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      }))
      .filter((page) => page.note || page.callouts.length > 0)
      .sort((a, b) => a.plan_page_id.localeCompare(b.plan_page_id)),
  );

export default function AddRFP() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  
  const isEditMode = !!id;
  const [loading, setLoading] = useState(false);
  const [loadingRfp, setLoadingRfp] = useState(false);
  const [selectedDrawings, setSelectedDrawings] = useState<File[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [availablePlanSets, setAvailablePlanSets] = useState<AvailablePlanSet[]>([]);
  const [availablePlanPages, setAvailablePlanPages] = useState<RfpPlanPageOption[]>([]);
  const [availableJobFiles, setAvailableJobFiles] = useState<AvailableJobFile[]>([]);
  const [availableJobFolders, setAvailableJobFolders] = useState<JobFolder[]>([]);
  const [selectedPlanPages, setSelectedPlanPages] = useState<SelectedRfpPlanPage[]>([]);
  const [selectedFullPlanSetIds, setSelectedFullPlanSetIds] = useState<string[]>([]);
  const [selectedJobFileIds, setSelectedJobFileIds] = useState<string[]>([]);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState<Record<string, string> | null>(null);
  const [initialPlanSelectionSignature, setInitialPlanSelectionSignature] = useState('[]');
  const [initialCommentSelectionSignature, setInitialCommentSelectionSignature] = useState('[]');
  const [loadedPlanPagePlanIds, setLoadedPlanPagePlanIds] = useState<string[]>([]);
  const [loadingPlanPagePlanIds, setLoadingPlanPagePlanIds] = useState<string[]>([]);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [planSetPickerOpen, setPlanSetPickerOpen] = useState(false);
  const [jobFilePickerOpen, setJobFilePickerOpen] = useState(false);
  const [expandedJobFolderIds, setExpandedJobFolderIds] = useState<string[]>([]);
  const attachmentsInputRef = useRef<HTMLInputElement | null>(null);
  const [isAttachmentsDragOver, setIsAttachmentsDragOver] = useState(false);
  
  const preselectedJobId = ensureAllowedJobFilter(searchParams.get('jobId'), isPrivileged, allowedJobIds);
  
  const [formData, setFormData] = useState({
    rfp_number: '',
    title: '',
    description: '',
    scope_of_work: '',
    logistics_details: '',
    job_id: preselectedJobId || '',
    issue_date: '',
    due_date: ''
  });

  useEffect(() => {
    if (currentCompany?.id && !websiteJobAccessLoading) {
      loadJobs();
      if (isEditMode) {
        loadRfpForEdit();
      } else {
        generateRFPNumber();
      }
    }
  }, [currentCompany?.id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(','), id]);

  useEffect(() => {
    if (!currentCompany?.id || !formData.job_id) {
      setAvailablePlanSets([]);
      setAvailablePlanPages([]);
      setLoadedPlanPagePlanIds([]);
      setLoadingPlanPagePlanIds([]);
      setAvailableJobFiles([]);
      setAvailableJobFolders([]);
      setSelectedPlanPages((prev) => prev.filter((page) => !page.plan_id));
      setSelectedFullPlanSetIds([]);
      setSelectedJobFileIds([]);
      return;
    }
    void loadAvailablePlanPages(formData.job_id);
  }, [currentCompany?.id, formData.job_id]);

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', currentCompany!.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      const filteredJobs = (data || []).filter((job) => canAccessJobIds([job.id], isPrivileged, allowedJobIds));
      setJobs(filteredJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const generateRFPNumber = async () => {
    try {
      const { count } = await supabase
        .from('rfps')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', currentCompany!.id);

      const nextNumber = (count || 0) + 1;
      setFormData(prev => ({
        ...prev,
        rfp_number: `RFP-${String(nextNumber).padStart(4, '0')}`
      }));
    } catch (error) {
      console.error('Error generating RFP number:', error);
    }
  };

  const loadRfpForEdit = async () => {
    try {
      setLoadingRfp(true);
      const { data, error } = await supabase
        .from('rfps')
        .select('*')
        .eq('id', id)
        .eq('company_id', currentCompany!.id)
        .single();

      if (error) throw error;
      const rfpData = data as any;

      if (rfpData?.job_id && !canAccessJobIds([rfpData.job_id], isPrivileged, allowedJobIds)) {
        toast({
          title: 'Access denied',
          description: 'You do not have access to this RFP job.',
          variant: 'destructive'
        });
        navigate('/construction/rfps');
        return;
      }

      setFormData({
        rfp_number: rfpData?.rfp_number || '',
        title: rfpData?.title || '',
        description: rfpData?.description || '',
        scope_of_work: rfpData?.scope_of_work || '',
        logistics_details: rfpData?.logistics_details || '',
        job_id: rfpData?.job_id || '',
        issue_date: rfpData?.issue_date || '',
        due_date: rfpData?.due_date || '',
      });
      setInitialFormSnapshot({
        rfp_number: rfpData?.rfp_number || '',
        title: rfpData?.title || '',
        description: rfpData?.description || '',
        scope_of_work: rfpData?.scope_of_work || '',
        logistics_details: rfpData?.logistics_details || '',
        job_id: rfpData?.job_id || '',
        issue_date: rfpData?.issue_date || '',
        due_date: rfpData?.due_date || '',
      });
      const loadedPages = await loadSelectedPlanPages(id!);
      setInitialPlanSelectionSignature(buildPlanSelectionSignature(loadedPages));
      setInitialCommentSelectionSignature(buildCommentSelectionSignature(loadedPages));
    } catch (error) {
      console.error('Error loading RFP for edit:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RFP details',
        variant: 'destructive'
      });
      navigate('/construction/rfps');
    } finally {
      setLoadingRfp(false);
    }
  };

  const loadAvailablePlanPages = async (jobId: string) => {
    try {
      const { data: plansData, error: plansError } = await supabase
        .from('job_plans')
        .select('id, plan_name, plan_number, file_url')
        .eq('company_id', currentCompany!.id)
        .eq('job_id', jobId)
        .order('uploaded_at', { ascending: false });

      if (plansError) throw plansError;
      setAvailablePlanSets(
        ((plansData || []) as any[]).map((plan) => ({
          id: String(plan.id),
          plan_name: String(plan.plan_name || 'Plan Set'),
          plan_number: plan.plan_number || null,
          file_url: plan.file_url || null,
        })),
      );
      const planIds = (plansData || []).map((plan: any) => String(plan.id)).filter(Boolean);
      if (planIds.length === 0) {
        setAvailablePlanPages([]);
        setLoadedPlanPagePlanIds([]);
        setLoadingPlanPagePlanIds([]);
        setAvailableJobFiles([]);
        setAvailableJobFolders([]);
        setSelectedPlanPages((prev) => prev.filter((page) => planIds.includes(page.plan_id)));
        setSelectedFullPlanSetIds([]);
        setSelectedJobFileIds([]);
        return;
      }

      setAvailablePlanPages((prev) => prev.filter((page) => planIds.includes(page.plan_id)));
      setLoadedPlanPagePlanIds((prev) => prev.filter((planId) => planIds.includes(planId)));
      setLoadingPlanPagePlanIds((prev) => prev.filter((planId) => planIds.includes(planId)));
      const { data: jobFileRows, error: jobFilesError } = await supabase
        .from('job_files')
        .select('id, file_name, file_url, file_size, file_type, folder_id')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (jobFilesError) throw jobFilesError;

      const { data: folderRows, error: folderError } = await supabase
        .from('job_folders')
        .select('id, name, parent_folder_id, is_system_folder')
        .eq('job_id', jobId)
        .order('sort_order', { ascending: true });

      if (folderError) throw folderError;

      setAvailableJobFiles(
        ((jobFileRows || []) as any[]).map((file) => ({
          id: String(file.id),
          file_name: String(file.file_name || 'Attachment'),
          file_url: String(file.file_url || ''),
          file_size: file.file_size || null,
          file_type: file.file_type || null,
          folder_id: file.folder_id || null,
        })),
      );
      setAvailableJobFolders(
        ((folderRows || []) as any[]).map((folder) => ({
          id: String(folder.id),
          name: String(folder.name || 'Folder'),
          parent_folder_id: folder.parent_folder_id || null,
          is_system_folder: !!folder.is_system_folder,
        })),
      );
      setExpandedJobFolderIds(
        ((folderRows || []) as any[])
          .filter((folder) => !folder.parent_folder_id)
          .map((folder) => String(folder.id)),
      );
      setSelectedPlanPages((prev) =>
        prev.filter((page) => planIds.includes(page.plan_id)),
      );
      setSelectedFullPlanSetIds((prev) => prev.filter((planId) => planIds.includes(planId)));
      setSelectedJobFileIds((prev) => prev.filter((fileId) => (jobFileRows || []).some((file: any) => String(file.id) === fileId)));

    } catch (error) {
      console.error('Error loading available plan pages:', error);
      setAvailablePlanPages([]);
      setAvailableJobFiles([]);
      setAvailableJobFolders([]);
    }
  };

  const loadPlanPagesForPlan = async (planId: string) => {
    if (!planId || loadedPlanPagePlanIds.includes(planId) || loadingPlanPagePlanIds.includes(planId)) {
      return;
    }

    const plan = availablePlanSets.find((entry) => entry.id === planId);
    if (!plan) return;

    try {
      setLoadingPlanPagePlanIds((prev) => [...prev, planId]);
      const mapPageRows = (pageRows: any[]): RfpPlanPageOption[] =>
        pageRows.map((page) => ({
          plan_id: String(page.plan_id),
          plan_name: plan.plan_name,
          plan_number: plan.plan_number || null,
          plan_file_url: plan.file_url || null,
          plan_page_id: String(page.id),
          page_number: Number(page.page_number || 0),
          sheet_number: page.sheet_number || null,
          page_title: page.page_title || null,
          discipline: page.discipline || null,
          thumbnail_url: page.thumbnail_url || null,
        }));

      const mergePlanPages = (pages: RfpPlanPageOption[]) => {
        setAvailablePlanPages((prev) => {
          const next = new Map<string, RfpPlanPageOption>();
          prev.forEach((page) => {
            if (page.plan_id !== planId) {
              next.set(page.plan_page_id, page);
            }
          });

          const existingForPlan = prev
            .filter((page) => page.plan_id === planId)
            .sort((a, b) => a.page_number - b.page_number);

          [...existingForPlan, ...pages]
            .sort((a, b) => a.page_number - b.page_number)
            .forEach((page) => {
              next.set(page.plan_page_id, page);
            });

          return Array.from(next.values());
        });
      };

      const { data: initialRows, error } = await supabase
        .from('plan_pages' as any)
        .select('id, plan_id, page_number, sheet_number, page_title, discipline, thumbnail_url')
        .eq('plan_id', planId)
        .range(0, INITIAL_PLAN_PAGE_BATCH_SIZE - 1)
        .order('page_number', { ascending: true });

      if (error) throw error;

      const initialOptions = mapPageRows((initialRows || []) as any[]);
      mergePlanPages(initialOptions);

      const initialMissingThumbnailRows = ((initialRows || []) as any[])
        .filter((row) => !row.thumbnail_url)
        .map((row) => ({
          page_number: Number(row.page_number || 0),
          thumbnail_url: row.thumbnail_url || null,
        }))
        .filter((row) => row.page_number > 0)
        .sort((a, b) => a.page_number - b.page_number);
      const prioritizedMissingThumbnailRows = initialMissingThumbnailRows.slice(0, 5);

      if (plan.file_url && prioritizedMissingThumbnailRows.length > 0) {
        void backfillPlanPageThumbnails({
          planId,
          planUrl: plan.file_url,
          companyId: currentCompany!.id,
          pageRows: prioritizedMissingThumbnailRows,
          onBatch: (results) => {
            setAvailablePlanPages((prev) =>
              prev.map((page) => {
                const match = results.find((result) => result.pageNumber === page.page_number && page.plan_id === planId);
                return match ? { ...page, thumbnail_url: match.thumbnailUrl } : page;
              }),
            );
          },
        });
      }

      let offset = INITIAL_PLAN_PAGE_BATCH_SIZE;
      let done = ((initialRows || []) as any[]).length < INITIAL_PLAN_PAGE_BATCH_SIZE;
      const deferredMissingThumbnailRows: Array<{ page_number: number; thumbnail_url?: string | null }> =
        initialMissingThumbnailRows.slice(5);

      while (!done) {
        const { data: batchRows, error: batchError } = await supabase
          .from('plan_pages' as any)
          .select('id, plan_id, page_number, sheet_number, page_title, discipline, thumbnail_url')
          .eq('plan_id', planId)
          .range(offset, offset + BACKGROUND_PLAN_PAGE_BATCH_SIZE - 1)
          .order('page_number', { ascending: true });

        if (batchError) throw batchError;

        const rows = (batchRows || []) as any[];
        if (rows.length === 0) {
          done = true;
          break;
        }

        mergePlanPages(mapPageRows(rows));
        rows
          .filter((row) => !row.thumbnail_url)
          .forEach((row) => {
            const pageNumber = Number(row.page_number || 0);
            if (pageNumber > 0) {
              deferredMissingThumbnailRows.push({
                page_number: pageNumber,
                thumbnail_url: row.thumbnail_url || null,
              });
            }
          });
        offset += rows.length;
        done = rows.length < BACKGROUND_PLAN_PAGE_BATCH_SIZE;
      }

      if (plan.file_url && deferredMissingThumbnailRows.length > 0) {
        void backfillPlanPageThumbnails({
          planId,
          planUrl: plan.file_url,
          companyId: currentCompany!.id,
          pageRows: deferredMissingThumbnailRows,
          onBatch: (results) => {
            setAvailablePlanPages((prev) =>
              prev.map((page) => {
                const match = results.find((result) => result.pageNumber === page.page_number && page.plan_id === planId);
                return match ? { ...page, thumbnail_url: match.thumbnailUrl } : page;
              }),
            );
          },
        });
      }

      setLoadedPlanPagePlanIds((prev) => [...prev, planId]);
    } catch (error) {
      console.error(`Error loading plan pages for plan ${planId}:`, error);
    } finally {
      setLoadingPlanPagePlanIds((prev) => prev.filter((entry) => entry !== planId));
    }
  };

  const loadSelectedPlanPages = async (rfpId: string): Promise<SelectedRfpPlanPage[]> => {
    try {
      const { data, error } = await supabase
        .from('rfp_plan_pages' as any)
        .select(`
          id,
          plan_id,
          plan_page_id,
          sort_order,
          is_primary,
          note,
          plan_page:plan_pages!rfp_plan_pages_plan_page_id_fkey(id, page_number, sheet_number, page_title, discipline, thumbnail_url),
          plan:job_plans!rfp_plan_pages_plan_id_fkey(id, plan_name, plan_number, file_url)
        `)
        .eq('rfp_id', rfpId)
        .eq('company_id', currentCompany!.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const selectedRows = ((data || []) as any[]).map((row) => {
        const resolvedPlan = pickJoinedRow<any>(row.plan);
        const resolvedPlanPage = pickJoinedRow<any>(row.plan_page);
        return ({
        rfp_plan_page_id: String(row.id),
        plan_id: String(row.plan_id),
        plan_name: String(resolvedPlan?.plan_name || 'Plan Set'),
        plan_number: resolvedPlan?.plan_number || null,
        plan_file_url: resolvedPlan?.file_url || null,
        plan_page_id: String(row.plan_page_id),
        page_number: Number(resolvedPlanPage?.page_number || 0),
        sheet_number: resolvedPlanPage?.sheet_number || null,
        page_title: resolvedPlanPage?.page_title || null,
        discipline: resolvedPlanPage?.discipline || null,
        thumbnail_url: resolvedPlanPage?.thumbnail_url || null,
        is_primary: !!row.is_primary,
        note: row.note || null,
      });
      });

      let calloutsByRfpPlanPageId = new Map<string, RfpPlanPageNoteDraft[]>();
      if (selectedRows.length > 0) {
        const { data: noteRows, error: noteError } = await supabase
          .from('rfp_plan_page_notes' as any)
          .select('id, rfp_plan_page_id, shape_type, x, y, width, height, note_text, sort_order')
          .in('rfp_plan_page_id', selectedRows.map((row) => row.rfp_plan_page_id))
          .eq('company_id', currentCompany!.id)
          .order('sort_order', { ascending: true });

        if (noteError && !isMissingRfpPlanPageNotesTableError(noteError)) throw noteError;

        if (!noteError) {
          calloutsByRfpPlanPageId = new Map<string, RfpPlanPageNoteDraft[]>();
          ((noteRows || []) as any[]).forEach((row) => {
            const key = String(row.rfp_plan_page_id);
            const list = calloutsByRfpPlanPageId.get(key) || [];
            list.push({
              id: String(row.id),
              shape_type: row.shape_type === 'ellipse' ? 'ellipse' : 'rect',
              x: Number(row.x || 0),
              y: Number(row.y || 0),
              width: Number(row.width || 0),
              height: Number(row.height || 0),
              note_text: row.note_text || '',
            });
            calloutsByRfpPlanPageId.set(key, list);
          });
        }
      }

      const next = selectedRows.map(({ rfp_plan_page_id, ...row }) => ({
        ...row,
        callouts: calloutsByRfpPlanPageId.get(rfp_plan_page_id) || [],
      }));

      setSelectedPlanPages(next);
      setAvailablePlanPages((prev) => {
        const merged = new Map<string, RfpPlanPageOption>();
        [...prev, ...next].forEach((page) => {
          merged.set(page.plan_page_id, {
            plan_id: page.plan_id,
            plan_name: page.plan_name,
            plan_number: page.plan_number || null,
            plan_file_url: page.plan_file_url || null,
            plan_page_id: page.plan_page_id,
            page_number: page.page_number,
            sheet_number: page.sheet_number || null,
            page_title: page.page_title || null,
            discipline: page.discipline || null,
            thumbnail_url: page.thumbnail_url || null,
          });
        });
        return Array.from(merged.values());
      });

      const selectedPlanIds = Array.from(new Set(next.map((page) => page.plan_id)));
      if (selectedPlanIds.length > 0) {
        const { data: allPlanRows, error: allPlanRowsError } = await supabase
          .from('plan_pages' as any)
          .select('id, plan_id')
          .in('plan_id', selectedPlanIds);

        if (allPlanRowsError) throw allPlanRowsError;

        const totalByPlanId = ((allPlanRows || []) as any[]).reduce<Map<string, number>>((map, row) => {
          const key = String(row.plan_id || '');
          map.set(key, (map.get(key) || 0) + 1);
          return map;
        }, new Map());

        const selectedByPlanId = next.reduce<Map<string, number>>((map, page) => {
          map.set(page.plan_id, (map.get(page.plan_id) || 0) + 1);
          return map;
        }, new Map());

        setSelectedFullPlanSetIds(
          selectedPlanIds.filter((planId) => {
            const total = totalByPlanId.get(planId) || 0;
            const selected = selectedByPlanId.get(planId) || 0;
            return total > 0 && total === selected;
          }),
        );
      } else {
        setSelectedFullPlanSetIds([]);
      }
      return next;
    } catch (error) {
      console.error('Error loading selected RFP plan pages:', error);
      setSelectedPlanPages([]);
      return [];
    }
  };

  const syncRfpPlanPages = async (rfpId: string) => {
    if (!currentCompany?.id) return;

    const { error: deleteError } = await supabase
      .from('rfp_plan_pages' as any)
      .delete()
      .eq('rfp_id', rfpId)
      .eq('company_id', currentCompany.id);

    if (deleteError) throw deleteError;

    let fullPlanSetPages: Array<{ plan_id: string; plan_page_id: string }> = [];
    if (selectedFullPlanSetIds.length > 0) {
      const { data: fullPlanSetRows, error: fullPlanSetRowsError } = await supabase
        .from('plan_pages' as any)
        .select('id, plan_id')
        .in('plan_id', selectedFullPlanSetIds);

      if (fullPlanSetRowsError) throw fullPlanSetRowsError;

      fullPlanSetPages = ((fullPlanSetRows || []) as any[]).map((row) => ({
        plan_id: String(row.plan_id),
        plan_page_id: String(row.id),
      }));
    }
    const mergedPages = [...selectedPlanPages];
    fullPlanSetPages.forEach((page) => {
      if (!mergedPages.some((entry) => entry.plan_page_id === page.plan_page_id)) {
        mergedPages.push({
          ...availablePlanPages.find((entry) => entry.plan_page_id === page.plan_page_id),
          plan_id: page.plan_id,
          plan_page_id: page.plan_page_id,
          plan_name: availablePlanSets.find((entry) => entry.id === page.plan_id)?.plan_name || 'Plan Set',
          plan_number: availablePlanSets.find((entry) => entry.id === page.plan_id)?.plan_number || null,
          plan_file_url: availablePlanSets.find((entry) => entry.id === page.plan_id)?.file_url || null,
          page_number: 0,
          sheet_number: null,
          page_title: null,
          discipline: null,
          thumbnail_url: null,
          is_primary: false,
          note: null,
          callouts: [],
        });
      }
    });

    if (mergedPages.length === 0) return { pageCount: 0, noteCount: 0 };

    const rows = mergedPages.map((page, index) => ({
      rfp_id: rfpId,
      company_id: currentCompany.id,
      plan_id: page.plan_id,
      plan_page_id: page.plan_page_id,
      sort_order: index,
      is_primary: !!page.is_primary,
      note: page.note || null,
      created_by: user?.id || null,
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from('rfp_plan_pages' as any)
      .insert(rows)
      .select('id, plan_page_id');

    if (insertError) throw insertError;

    const noteRows = ((insertedRows || []) as any[]).flatMap((insertedRow: any) => {
      const matchingPage = mergedPages.find((page) => page.plan_page_id === String(insertedRow.plan_page_id));
      return (matchingPage?.callouts || []).map((callout, index) => ({
        rfp_plan_page_id: insertedRow.id,
        company_id: currentCompany.id,
        shape_type: callout.shape_type,
        x: callout.x,
        y: callout.y,
        width: callout.width,
        height: callout.height,
        note_text: callout.note_text || null,
        sort_order: index,
        created_by: user?.id || null,
      }));
    });

    if (noteRows.length > 0) {
      const { error: insertNotesError } = await supabase
        .from('rfp_plan_page_notes' as any)
        .insert(noteRows);
      if (insertNotesError && !isMissingRfpPlanPageNotesTableError(insertNotesError)) {
        throw insertNotesError;
      }
    }

    return {
      pageCount: rows.length,
      noteCount: noteRows.length,
    };
  };

  const applySelectedPlanPages = (pages: PickerSelectedPlanPage[]) => {
    const normalizedPages = pages.map((page, index) => ({
        ...page,
        is_primary: pages.some((entry) => entry.is_primary) ? !!page.is_primary : index === 0,
        note: page.note || null,
        callouts: (page.callouts || []).map((callout) => ({ ...callout })),
      }));
    setSelectedPlanPages(normalizedPages);
    const touchedPlanIds = new Set(normalizedPages.map((page) => page.plan_id));
    setSelectedFullPlanSetIds((prev) => prev.filter((planId) => !touchedPlanIds.has(planId)));
  };

  const uploadAttachments = async (rfpId: string) => {
    if (!selectedDrawings.length) return 0;

    const uploads = [];
    for (const file of selectedDrawings) {
      const storagePath = `rfp-drawings/${currentCompany!.id}/${rfpId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('company-files')
        .upload(storagePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      uploads.push({
        rfp_id: rfpId,
        company_id: currentCompany!.id,
        file_name: file.name,
        file_url: getStoragePathForDb('company-files', storagePath),
        file_size: file.size,
        file_type: file.type || null,
        uploaded_by: user!.id,
      });
    }

    const { error: insertError } = await supabase
      .from('rfp_attachments')
      .insert(uploads);
    if (insertError) throw insertError;
    return uploads.length;
  };

  const attachJobFiles = async (rfpId: string) => {
    if (!selectedJobFileIds.length) return 0;

    const filesToAttach = availableJobFiles.filter((file) => selectedJobFileIds.includes(file.id));
    if (!filesToAttach.length) return 0;

    const rows = filesToAttach.map((file) => ({
      rfp_id: rfpId,
      company_id: currentCompany!.id,
      file_name: file.file_name,
      file_url: file.file_url,
      file_size: file.file_size,
      file_type: file.file_type,
      uploaded_by: user!.id,
    }));

    const { error } = await supabase
      .from('rfp_attachments')
      .insert(rows);
    if (error) throw error;
    return rows.length;
  };

  const addDrawingFiles = (files: File[] | FileList) => {
    const nextFiles = Array.from(files || []);
    if (!nextFiles.length) return;
    setSelectedDrawings(prev => [...prev, ...nextFiles]);
  };

  const selectedPlanSetRecords = availablePlanSets.filter((plan) => selectedFullPlanSetIds.includes(plan.id));
  const selectedPlanSetSummaries = Array.from(
    selectedPlanPages.reduce<Map<string, {
      planId: string;
      planName: string;
      planNumber: string | null;
      thumbnailUrl: string | null;
      selectedPageCount: number;
      fullSetSelected: boolean;
      noteCount: number;
      hasPrimary: boolean;
      firstPageLabel: string;
      firstPageTitle: string | null;
    }>>((map, page) => {
      const existing = map.get(page.plan_id);
      if (existing) {
        existing.selectedPageCount += 1;
        existing.noteCount += (page.callouts || []).length;
        existing.hasPrimary = existing.hasPrimary || !!page.is_primary;
        return map;
      }

      map.set(page.plan_id, {
        planId: page.plan_id,
        planName: page.plan_name,
        planNumber: page.plan_number || null,
        thumbnailUrl: page.thumbnail_url || null,
        selectedPageCount: 1,
        fullSetSelected: selectedFullPlanSetIds.includes(page.plan_id),
        noteCount: (page.callouts || []).length,
        hasPrimary: !!page.is_primary,
        firstPageLabel: page.sheet_number || `Page ${page.page_number}`,
        firstPageTitle: page.page_title || null,
      });
      return map;
    }, new Map()).values(),
  );
  const planSetOnlySummaries = selectedPlanSetRecords
    .filter((plan) => !selectedPlanSetSummaries.some((summary) => summary.planId === plan.id))
    .map((plan) => ({
      planId: plan.id,
      planName: plan.plan_name,
      planNumber: plan.plan_number || null,
      thumbnailUrl: null,
      selectedPageCount: 0,
      fullSetSelected: true,
      noteCount: 0,
      hasPrimary: false,
      firstPageLabel: 'Full plan set',
      firstPageTitle: null,
    }));
  const groupedSelectedPlanSets = [...selectedPlanSetSummaries, ...planSetOnlySummaries];
  const selectedJobFileRecords = availableJobFiles.filter((file) => selectedJobFileIds.includes(file.id));
  const folderChildrenByParent = availableJobFolders.reduce<Record<string, JobFolder[]>>((acc, folder) => {
    const key = folder.parent_folder_id || '__root__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(folder);
    return acc;
  }, {});
  const filesByFolderId = availableJobFiles.reduce<Record<string, AvailableJobFile[]>>((acc, file) => {
    const key = file.folder_id || '__root__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(file);
    return acc;
  }, {});

  const getDescendantFileIds = (folderId: string): string[] => {
    const directFiles = filesByFolderId[folderId] || [];
    const childFolders = folderChildrenByParent[folderId] || [];
    return [
      ...directFiles.map((file) => file.id),
      ...childFolders.flatMap((folder) => getDescendantFileIds(folder.id)),
    ];
  };

  const getFolderSelectionState = (folderId: string): boolean | 'indeterminate' => {
    const fileIds = getDescendantFileIds(folderId);
    if (fileIds.length === 0) return false;
    const selectedCount = fileIds.filter((fileId) => selectedJobFileIds.includes(fileId)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === fileIds.length) return true;
    return 'indeterminate';
  };

  const toggleFolderSelection = (folderId: string, checked: boolean) => {
    const fileIds = getDescendantFileIds(folderId);
    setSelectedJobFileIds((prev) => {
      const next = new Set(prev);
      if (checked) fileIds.forEach((fileId) => next.add(fileId));
      else fileIds.forEach((fileId) => next.delete(fileId));
      return Array.from(next);
    });
  };

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedJobFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId],
    );
  };

  const renderJobFolderTree = (parentFolderId: string | null = null, depth = 0): React.ReactNode[] => {
    const key = parentFolderId || '__root__';
    const childFolders = [...(folderChildrenByParent[key] || [])].sort((a, b) => {
      if (a.is_system_folder !== b.is_system_folder) return a.is_system_folder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const directFiles = [...(filesByFolderId[key] || [])].sort((a, b) => a.file_name.localeCompare(b.file_name));

    return [
      ...childFolders.flatMap((folder) => {
        const isExpanded = expandedJobFolderIds.includes(folder.id);
        const selectionState = getFolderSelectionState(folder.id);
        const hasChildren =
          (folderChildrenByParent[folder.id] || []).length > 0 ||
          (filesByFolderId[folder.id] || []).length > 0;

        return [
          <div
            key={`folder-${folder.id}`}
            className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40"
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
          >
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
              onClick={() => hasChildren && toggleFolderExpanded(folder.id)}
            >
              {hasChildren ? <ArrowRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} /> : <span className="h-4 w-4" />}
            </button>
            <Checkbox
              checked={selectionState === 'indeterminate' ? 'indeterminate' : selectionState}
              onCheckedChange={(checked) => toggleFolderSelection(folder.id, checked === true)}
            />
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{folder.name}</div>
            </div>
          </div>,
          ...(isExpanded ? renderJobFolderTree(folder.id, depth + 1) : []),
        ];
      }),
      ...directFiles.map((file) => (
        <label
          key={`file-${file.id}`}
          className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40"
          style={{ paddingLeft: `${depth * 20 + 40}px` }}
        >
          <Checkbox
            checked={selectedJobFileIds.includes(file.id)}
            onCheckedChange={(checked) =>
              setSelectedJobFileIds((prev) =>
                checked === true ? [...new Set([...prev, file.id])] : prev.filter((id) => id !== file.id),
              )
            }
          />
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{file.file_name}</div>
            <div className="text-xs text-muted-foreground">
              {file.file_type || 'File'}
              {typeof file.file_size === 'number' ? ` • ${Math.max(1, Math.round(file.file_size / 1024))} KB` : ''}
            </div>
          </div>
        </label>
      )),
    ];
  };

  const moveSelectedPlanPage = (fromIndex: number, toIndex: number) => {
    setSelectedPlanPages((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      const primaryExists = next.some((entry) => entry.is_primary);
      if (primaryExists) return next;
      return next.map((entry, index) => ({
        ...entry,
        is_primary: index === 0,
      }));
    });
  };

  const handleSubmit = async (
    e?: React.FormEvent,
    options?: {
      redirectToInvite?: boolean;
    },
  ) => {
    e?.preventDefault();
    const redirectToInvite = !!options?.redirectToInvite;
    
    if (!formData.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a title for the RFP',
        variant: 'destructive'
      });
      return;
    }

    if (formData.job_id && !canAccessJobIds([formData.job_id], isPrivileged, allowedJobIds)) {
      toast({
        title: 'Access denied',
        description: 'You do not have access to the selected job.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      let savedRfpId = id;
      const detailsChanged = isEditMode && !!initialFormSnapshot && (
        formData.rfp_number !== initialFormSnapshot.rfp_number ||
        formData.title !== initialFormSnapshot.title ||
        formData.description !== initialFormSnapshot.description ||
        formData.scope_of_work !== initialFormSnapshot.scope_of_work ||
        formData.logistics_details !== initialFormSnapshot.logistics_details ||
        formData.job_id !== initialFormSnapshot.job_id ||
        formData.issue_date !== initialFormSnapshot.issue_date ||
        formData.due_date !== initialFormSnapshot.due_date
      );
      const currentPlanSignature = buildPlanSelectionSignature(selectedPlanPages);
      const currentCommentSignature = buildCommentSelectionSignature(selectedPlanPages);
      const planSelectionChanged = isEditMode && currentPlanSignature !== initialPlanSelectionSignature;
      const commentSelectionChanged = isEditMode && currentCommentSignature !== initialCommentSelectionSignature;

      if (isEditMode) {
        const { error } = await supabase
          .from('rfps')
          .update({
            rfp_number: formData.rfp_number,
            title: formData.title,
            description: formData.description || null,
            scope_of_work: formData.scope_of_work || null,
            logistics_details: formData.logistics_details || null,
            job_id: formData.job_id || null,
            issue_date: formData.issue_date || null,
            due_date: formData.due_date || null,
          } as any)
          .eq('id', id)
          .eq('company_id', currentCompany!.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('rfps')
          .insert({
            company_id: currentCompany!.id,
            rfp_number: formData.rfp_number,
            title: formData.title,
            description: formData.description || null,
            scope_of_work: formData.scope_of_work || null,
            logistics_details: formData.logistics_details || null,
            job_id: formData.job_id || null,
            issue_date: formData.issue_date || null,
            due_date: formData.due_date || null,
            status: 'draft',
            created_by: user!.id
          } as any)
          .select()
          .single();

        if (error) throw error;
        savedRfpId = data.id;
      }

      if (savedRfpId) {
        const uploadedDrawingCount = await uploadAttachments(savedRfpId);
        const attachedJobFileCount = await attachJobFiles(savedRfpId);
        const syncedPlanResult = await syncRfpPlanPages(savedRfpId);

        if (isEditMode && currentCompany?.id) {
          const notificationPromises: Promise<void>[] = [];

          if (detailsChanged) {
            notificationPromises.push(
              createRfpNotifications({
                rfpId: savedRfpId,
                companyId: currentCompany.id,
                actorUserId: user?.id || null,
                title: 'RFP Updated',
                message: `${formData.rfp_number || 'RFP'} - ${formData.title || 'Untitled RFP'} was updated.`,
                preferenceKey: 'rfp_update_notifications',
              }),
            );
          }

          if (uploadedDrawingCount > 0 || attachedJobFileCount > 0 || planSelectionChanged) {
            notificationPromises.push(
              createRfpNotifications({
                rfpId: savedRfpId,
                companyId: currentCompany.id,
                actorUserId: user?.id || null,
                title: 'RFP Plans Updated',
                message: `${formData.rfp_number || 'RFP'} now has updated drawings, files, or attached plan pages available for review.`,
                preferenceKey: 'rfp_plan_update_notifications',
              }),
            );
          }

          if (commentSelectionChanged && (syncedPlanResult?.noteCount || 0) >= 0) {
            notificationPromises.push(
              createRfpNotifications({
                rfpId: savedRfpId,
                companyId: currentCompany.id,
                actorUserId: user?.id || null,
                title: 'RFP Comments Updated',
                message: `${formData.rfp_number || 'RFP'} has updated plan page notes or callouts.`,
                preferenceKey: 'rfp_comment_update_notifications',
              }),
            );
          }

          await Promise.allSettled(notificationPromises);
          setInitialFormSnapshot({ ...formData });
          setInitialPlanSelectionSignature(currentPlanSignature);
          setInitialCommentSelectionSignature(currentCommentSignature);
        }
      }

      toast({
        title: 'Success',
        description: isEditMode ? 'RFP updated successfully' : 'RFP created successfully'
      });

      navigate(
        redirectToInvite && savedRfpId
          ? `/construction/rfps/${savedRfpId}?tab=invited`
          : `/construction/rfps/${savedRfpId}`,
      );
    } catch (error: any) {
      console.error('Error creating RFP:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create RFP',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {loadingRfp ? (
        <>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{isEditMode ? 'Edit RFP' : 'Create RFP'}</h1>
            </div>
          </div>
          <div className="h-40 flex items-center justify-center"><span className="loading-dots">Loading</span></div>
        </>
      ) : (
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{isEditMode ? 'Edit RFP' : 'Create RFP'}</h1>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {isEditMode && id ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/construction/rfps/${id}?tab=invited`)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Invite Vendors
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            {!isEditMode ? (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => void handleSubmit(undefined, { redirectToInvite: true })}
              >
                <Mail className="h-4 w-4 mr-2" />
                {loading ? 'Creating...' : 'Create RFP & Invite Vendors'}
              </Button>
            ) : null}
            <Button type="submit" disabled={loading}>
              {selectedDrawings.length > 0 ? <Upload className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create RFP')}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
          <Card>
            <CardHeader>
              <CardTitle>RFP Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rfp_number">RFP Number</Label>
                <Input
                  id="rfp_number"
                  value={formData.rfp_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, rfp_number: e.target.value }))}
                  placeholder="RFP-0001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_id">Job</Label>
                <Select 
                  value={formData.job_id || "none"} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, job_id: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Job</SelectItem>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issue_date">Issue Date</Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., HVAC System Installation"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the RFP..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope_of_work">Scope of Work</Label>
              <Textarea
                id="scope_of_work"
                value={formData.scope_of_work}
                onChange={(e) => setFormData(prev => ({ ...prev, scope_of_work: e.target.value }))}
                placeholder="Detailed scope of work requirements..."
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logistics_details">Logistics Details</Label>
              <Textarea
                id="logistics_details"
                value={formData.logistics_details}
                onChange={(e) => setFormData(prev => ({ ...prev, logistics_details: e.target.value }))}
                placeholder="Site access, staging areas, delivery windows, parking, safety constraints, etc."
                rows={4}
              />
            </div>
          </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Plans and Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!formData.job_id ? (
                <p className="text-sm text-muted-foreground">
                  Select a job first to attach indexed plan pages and job files.
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => setPlanSetPickerOpen(true)}>
                          <Layers3 className="h-4 w-4 mr-2" />
                          Add Plan Sets
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setPlanPickerOpen(true)}>
                          <Layers3 className="h-4 w-4 mr-2" />
                          Add Plan Pages
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setJobFilePickerOpen(true)}>
                        <FolderOpen className="h-4 w-4 mr-2" />
                          Filing Cabinet
                        </Button>
                      </div>
                    </div>

                    {(groupedSelectedPlanSets.length > 0 || selectedJobFileRecords.length > 0) ? (
                      <div className="rounded-md border divide-y">
                        {groupedSelectedPlanSets.map((planSet) => (
                          <div key={`plan-${planSet.planId}`} className="flex items-start justify-between gap-3 px-4 py-3">
                            {planSet.thumbnailUrl ? (
                              <img
                                src={planSet.thumbnailUrl}
                                alt={planSet.planName}
                                className="h-20 w-14 rounded border object-cover shrink-0 bg-background"
                              />
                            ) : (
                              <div className="h-20 w-14 rounded border shrink-0 bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                                Set
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{planSet.planName}</p>
                                {planSet.planNumber ? <Badge variant="outline">#{planSet.planNumber}</Badge> : null}
                                <Badge variant="outline">
                                  {planSet.fullSetSelected
                                    ? 'Full plan set'
                                    : `${planSet.selectedPageCount} selected page${planSet.selectedPageCount === 1 ? '' : 's'}`}
                                </Badge>
                                {planSet.hasPrimary ? <Badge>Primary Page Included</Badge> : null}
                                {planSet.noteCount > 0 ? (
                                  <Badge variant="secondary">
                                    {planSet.noteCount} linked note{planSet.noteCount === 1 ? '' : 's'}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {planSet.fullSetSelected
                                  ? 'All pages in this plan set will be included on the RFP.'
                                  : `${planSet.firstPageLabel}${planSet.firstPageTitle ? ` • ${planSet.firstPageTitle}` : ''}`}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedPlanPages((prev) => prev.filter((entry) => entry.plan_id !== planSet.planId));
                                setSelectedFullPlanSetIds((prev) => prev.filter((planId) => planId !== planSet.planId));
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}

                        {selectedJobFileRecords.map((file) => (
                          <div key={file.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{file.file_name}</div>
                              <div className="text-muted-foreground">
                                {file.file_type || 'File'}
                                {typeof file.file_size === 'number' ? ` • ${Math.max(1, Math.round(file.file_size / 1024))} KB` : ''}
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setSelectedJobFileIds((prev) => prev.filter((entryId) => entryId !== file.id))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <input
                      ref={attachmentsInputRef}
                      id="attachments_upload"
                      type="file"
                      multiple
                      onChange={(e) => {
                        addDrawingFiles(e.target.files || []);
                        e.target.value = '';
                      }}
                      accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                    />
                    <div
                      className={`rounded-md border-2 border-dashed px-4 py-3 text-center text-sm transition-colors ${
                        isAttachmentsDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsAttachmentsDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsAttachmentsDragOver(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsAttachmentsDragOver(false);
                        const droppedFiles = Array.from(e.dataTransfer.files || []);
                        if (droppedFiles.length > 0) addDrawingFiles(droppedFiles);
                      }}
                      onClick={() => attachmentsInputRef.current?.click()}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <span>{isAttachmentsDragOver ? 'Drop Files Here' : 'Drag Files Here'}</span>
                        <span className="text-muted-foreground">or</span>
                        <Button type="button" variant="outline" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          attachmentsInputRef.current?.click();
                        }}>
                          Choose Files to Add
                        </Button>
                      </div>
                    </div>
                    {selectedDrawings.length > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {selectedDrawings.length} file{selectedDrawings.length === 1 ? '' : 's'} selected for upload on save
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

      </form>
      )}

        <RfpPlanPagePicker
          open={planPickerOpen}
          onOpenChange={setPlanPickerOpen}
          planSets={availablePlanSets}
          options={availablePlanPages}
          selectedPages={selectedPlanPages}
          onApply={applySelectedPlanPages}
          onLoadPlanPages={loadPlanPagesForPlan}
          loadingPlanSetIds={loadingPlanPagePlanIds}
        />

      <Dialog open={planSetPickerOpen} onOpenChange={setPlanSetPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Plan Sets</DialogTitle>
            <DialogDescription>
              Choose the full plan sets you want to include with this RFP.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md border divide-y">
            {availablePlanSets.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground">
                No plan sets are available on this job yet.
              </div>
            ) : (
              availablePlanSets.map((plan) => (
                <label key={plan.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{plan.plan_name}</div>
                    <div className="text-muted-foreground">
                      {plan.plan_number ? `#${plan.plan_number}` : 'No plan set number'}
                    </div>
                  </div>
                  <Checkbox
                    checked={selectedFullPlanSetIds.includes(plan.id)}
                    onCheckedChange={(checked) => {
                      setSelectedFullPlanSetIds((prev) =>
                        checked === true
                          ? [...new Set([...prev, plan.id])]
                          : prev.filter((id) => id !== plan.id),
                      );

                      if (checked !== true) {
                        setSelectedPlanPages((prev) =>
                          prev.filter((page) => page.plan_id !== plan.id),
                        );
                      }
                    }}
                  />
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPlanSetPickerOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={jobFilePickerOpen} onOpenChange={setJobFilePickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Attach Files from Job Filing Cabinet</DialogTitle>
            <DialogDescription>
              Expand folders and select the files you want to share with this RFP.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-md border p-2">
            {availableJobFolders.length === 0 && availableJobFiles.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground">
                No job filing cabinet files are available on this job yet.
              </div>
            ) : (
              renderJobFolderTree(null, 0)
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setJobFilePickerOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
