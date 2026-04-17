import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDown, ArrowLeft, ArrowUp, Layers3, Mail, Save, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';
import { canAccessJobIds, ensureAllowedJobFilter } from '@/utils/jobAccess';
import { getStoragePathForDb } from '@/utils/storageUtils';
import RfpPlanPagePicker, {
  type RfpPlanPageNoteDraft,
  type RfpPlanPageOption,
  type RfpSelectedPlanPage as PickerSelectedPlanPage,
} from '@/components/RfpPlanPagePicker';
import { Badge } from '@/components/ui/badge';

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

interface SelectedRfpPlanPage extends RfpPlanPageOption {
  is_primary?: boolean;
  note?: string | null;
  callouts?: RfpPlanPageNoteDraft[];
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
  const [selectedPlanPages, setSelectedPlanPages] = useState<SelectedRfpPlanPage[]>([]);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [issuePackageEnabled, setIssuePackageEnabled] = useState(false);
  const [issuePackageName, setIssuePackageName] = useState('');
  const [issuePackageDescription, setIssuePackageDescription] = useState('');
  const [selectedIssuePackagePlanIds, setSelectedIssuePackagePlanIds] = useState<string[]>([]);
  const drawingsInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawingsDragOver, setIsDrawingsDragOver] = useState(false);
  
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
      setSelectedPlanPages((prev) => prev.filter((page) => !page.plan_id));
      setIssuePackageEnabled(false);
      setIssuePackageName('');
      setIssuePackageDescription('');
      setSelectedIssuePackagePlanIds([]);
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
      await loadSelectedPlanPages(id!);
      await loadIssuePackage(id!);
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
        setSelectedPlanPages((prev) => prev.filter((page) => planIds.includes(page.plan_id)));
        return;
      }

      const { data: pageRows, error: pageError } = await supabase
        .from('plan_pages' as any)
        .select('id, plan_id, page_number, sheet_number, page_title, discipline, thumbnail_url')
        .in('plan_id', planIds)
        .order('page_number', { ascending: true });

      if (pageError) throw pageError;

      const planById = new Map((plansData || []).map((plan: any) => [String(plan.id), plan]));
      const nextOptions: RfpPlanPageOption[] = ((pageRows || []) as any[]).map((page) => {
        const plan = planById.get(String(page.plan_id));
        return {
          plan_id: String(page.plan_id),
          plan_name: String(plan?.plan_name || 'Plan Set'),
          plan_number: plan?.plan_number || null,
          plan_file_url: plan?.file_url || null,
          plan_page_id: String(page.id),
          page_number: Number(page.page_number || 0),
          sheet_number: page.sheet_number || null,
          page_title: page.page_title || null,
          discipline: page.discipline || null,
          thumbnail_url: page.thumbnail_url || null,
        };
      });

      setAvailablePlanPages(nextOptions);
      setSelectedPlanPages((prev) =>
        prev.filter((page) => nextOptions.some((option) => option.plan_page_id === page.plan_page_id)),
      );
    } catch (error) {
      console.error('Error loading available plan pages:', error);
      setAvailablePlanPages([]);
    }
  };

  const loadSelectedPlanPages = async (rfpId: string) => {
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
          plan_page:plan_pages(id, page_number, sheet_number, page_title, discipline, thumbnail_url),
          plan:job_plans(id, plan_name, plan_number, file_url)
        `)
        .eq('rfp_id', rfpId)
        .eq('company_id', currentCompany!.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const selectedRows = ((data || []) as any[]).map((row) => ({
        rfp_plan_page_id: String(row.id),
        plan_id: String(row.plan_id),
        plan_name: String(row.plan?.plan_name || 'Plan Set'),
        plan_number: row.plan?.plan_number || null,
        plan_file_url: row.plan?.file_url || null,
        plan_page_id: String(row.plan_page_id),
        page_number: Number(row.plan_page?.page_number || 0),
        sheet_number: row.plan_page?.sheet_number || null,
        page_title: row.plan_page?.page_title || null,
        discipline: row.plan_page?.discipline || null,
        thumbnail_url: row.plan_page?.thumbnail_url || null,
        is_primary: !!row.is_primary,
        note: row.note || null,
      }));

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
    } catch (error) {
      console.error('Error loading selected RFP plan pages:', error);
      setSelectedPlanPages([]);
    }
  };

  const loadIssuePackage = async (rfpId: string) => {
    try {
      const { data: packageRow, error: packageError } = await supabase
        .from('rfp_issue_packages' as any)
        .select('id, name, description')
        .eq('rfp_id', rfpId)
        .eq('company_id', currentCompany!.id)
        .maybeSingle();

      if (packageError) throw packageError;
      if (!packageRow?.id) {
        setIssuePackageEnabled(false);
        setIssuePackageName('');
        setIssuePackageDescription('');
        setSelectedIssuePackagePlanIds([]);
        return;
      }

      const { data: itemRows, error: itemError } = await supabase
        .from('rfp_issue_package_items' as any)
        .select('plan_id')
        .eq('package_id', packageRow.id)
        .eq('company_id', currentCompany!.id)
        .order('sort_order', { ascending: true });

      if (itemError) throw itemError;
      setIssuePackageEnabled(true);
      setIssuePackageName(String(packageRow.name || ''));
      setIssuePackageDescription(String(packageRow.description || ''));
      setSelectedIssuePackagePlanIds(((itemRows || []) as any[]).map((row) => String(row.plan_id)));
    } catch (error) {
      console.error('Error loading RFP issue package:', error);
      setIssuePackageEnabled(false);
      setIssuePackageName('');
      setIssuePackageDescription('');
      setSelectedIssuePackagePlanIds([]);
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

    if (selectedPlanPages.length === 0) return;

    const rows = selectedPlanPages.map((page, index) => ({
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
      const matchingPage = selectedPlanPages.find((page) => page.plan_page_id === String(insertedRow.plan_page_id));
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
  };

  const syncIssuePackage = async (rfpId: string) => {
    if (!currentCompany?.id) return;

    const { data: existingPackage, error: existingPackageError } = await supabase
      .from('rfp_issue_packages' as any)
      .select('id')
      .eq('rfp_id', rfpId)
      .eq('company_id', currentCompany.id)
      .maybeSingle();

    if (existingPackageError) throw existingPackageError;

    if (!issuePackageEnabled || !issuePackageName.trim() || selectedIssuePackagePlanIds.length === 0) {
      if (existingPackage?.id) {
        const { error: deleteError } = await supabase
          .from('rfp_issue_packages' as any)
          .delete()
          .eq('id', existingPackage.id);
        if (deleteError) throw deleteError;
      }
      return;
    }

    let packageId = existingPackage?.id as string | undefined;
    if (packageId) {
      const { error: updateError } = await supabase
        .from('rfp_issue_packages' as any)
        .update({
          name: issuePackageName.trim(),
          description: issuePackageDescription.trim() || null,
        })
        .eq('id', packageId);
      if (updateError) throw updateError;
    } else {
      const { data: insertedPackage, error: insertError } = await supabase
        .from('rfp_issue_packages' as any)
        .insert({
          rfp_id: rfpId,
          company_id: currentCompany.id,
          name: issuePackageName.trim(),
          description: issuePackageDescription.trim() || null,
          created_by: user?.id || null,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      packageId = String(insertedPackage.id);
    }

    const { error: deleteItemsError } = await supabase
      .from('rfp_issue_package_items' as any)
      .delete()
      .eq('package_id', packageId)
      .eq('company_id', currentCompany.id);
    if (deleteItemsError) throw deleteItemsError;

    const rows = selectedIssuePackagePlanIds.map((planId, index) => ({
      package_id: packageId,
      company_id: currentCompany.id,
      plan_id: planId,
      sort_order: index,
    }));
    const { error: insertItemsError } = await supabase
      .from('rfp_issue_package_items' as any)
      .insert(rows);
    if (insertItemsError) throw insertItemsError;
  };

  const applySelectedPlanPages = (pages: PickerSelectedPlanPage[]) => {
    setSelectedPlanPages(
      pages.map((page, index) => ({
        ...page,
        is_primary: pages.some((entry) => entry.is_primary) ? !!page.is_primary : index === 0,
        note: page.note || null,
        callouts: (page.callouts || []).map((callout) => ({ ...callout })),
      })),
    );
  };

  const uploadDrawings = async (rfpId: string) => {
    if (!selectedDrawings.length) return;

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
  };

  const addDrawingFiles = (files: File[] | FileList) => {
    const nextFiles = Array.from(files || []);
    if (!nextFiles.length) return;
    setSelectedDrawings(prev => [...prev, ...nextFiles]);
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
        await uploadDrawings(savedRfpId);
        await syncRfpPlanPages(savedRfpId);
        await syncIssuePackage(savedRfpId);
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

        <Card>
          <CardHeader>
            <CardTitle>RFP Details</CardTitle>
            <CardDescription>Enter the basic information for this RFP</CardDescription>
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
                <Label htmlFor="job_id">Job (Optional)</Label>
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

            <div className="space-y-2">
              <Label htmlFor="drawings_upload">Drawings Upload</Label>
              <input
                ref={drawingsInputRef}
                id="drawings_upload"
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
                  isDrawingsDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDrawingsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDrawingsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDrawingsDragOver(false);
                  const droppedFiles = Array.from(e.dataTransfer.files || []);
                  if (droppedFiles.length > 0) addDrawingFiles(droppedFiles);
                }}
                onClick={() => drawingsInputRef.current?.click()}
              >
                <div className="flex items-center justify-center gap-3">
                  <span>{isDrawingsDragOver ? 'Drop Files Here' : 'Drag Files Here'}</span>
                  <span className="text-muted-foreground">or</span>
                  <Button type="button" variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    drawingsInputRef.current?.click();
                  }}>
                    Choose Files to Add
                  </Button>
                </div>
              </div>
              {selectedDrawings.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedDrawings.length} drawing file(s) selected for upload on save
                </p>
              )}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <CardDescription>
              Attach specific sheets for this RFP, or select a full indexed plan set for bidders to reference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!formData.job_id ? (
              <p className="text-sm text-muted-foreground">
                Select a job first to attach indexed plan pages.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {selectedPlanPages.length === 0
                      ? 'No plan pages attached yet.'
                      : `${selectedPlanPages.length} plan page${selectedPlanPages.length !== 1 ? 's' : ''} attached`}
                  </div>
                  <Button type="button" variant="outline" onClick={() => setPlanPickerOpen(true)}>
                    <Layers3 className="h-4 w-4 mr-2" />
                    Add Plan Pages
                  </Button>
                </div>

                {selectedPlanPages.length > 0 && (
                  <div className="rounded-md border divide-y">
                    {selectedPlanPages.map((page, index) => (
                      <div key={page.plan_page_id} className="flex items-start justify-between gap-3 px-4 py-3">
                        {page.thumbnail_url ? (
                          <img
                            src={page.thumbnail_url}
                            alt={page.page_title || page.sheet_number || `Page ${page.page_number}`}
                            className="h-20 w-14 rounded border object-cover shrink-0 bg-background"
                          />
                        ) : (
                          <div className="h-20 w-14 rounded border shrink-0 bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                            P{page.page_number}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">
                              {page.sheet_number || `Page ${page.page_number}`}
                            </p>
                            <Badge variant="outline">{page.plan_name}</Badge>
                            {page.plan_number ? <Badge variant="outline">#{page.plan_number}</Badge> : null}
                            {page.discipline ? <Badge variant="secondary">{page.discipline}</Badge> : null}
                            {page.is_primary ? <Badge>Primary</Badge> : null}
                            {(page.callouts || []).length > 0 ? (
                              <Badge variant="secondary">
                                {(page.callouts || []).length} linked note{(page.callouts || []).length === 1 ? '' : 's'}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {page.page_title || 'Untitled sheet'}
                          </p>
                          <Textarea
                            value={page.note || ''}
                            onChange={(e) =>
                              setSelectedPlanPages((prev) =>
                                prev.map((entry) =>
                                  entry.plan_page_id === page.plan_page_id
                                    ? { ...entry, note: e.target.value }
                                    : entry,
                                ),
                              )
                            }
                            rows={2}
                            placeholder="Optional note for bidders about this sheet"
                            className="text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              disabled={index === 0}
                              onClick={() => moveSelectedPlanPage(index, index - 1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              disabled={index === selectedPlanPages.length - 1}
                              onClick={() => moveSelectedPlanPage(index, index + 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={page.is_primary ? 'default' : 'outline'}
                            onClick={() =>
                              setSelectedPlanPages((prev) =>
                                prev.map((entry, entryIndex) => ({
                                  ...entry,
                                  is_primary: entryIndex === index,
                                })),
                              )
                            }
                          >
                            Set Primary
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setSelectedPlanPages((prev) => prev.filter((entry) => entry.plan_page_id !== page.plan_page_id))
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issued Plan Package</CardTitle>
            <CardDescription>
              Define the official plan package this RFP is based on. This is separate from the highlighted plan pages above.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!formData.job_id ? (
              <p className="text-sm text-muted-foreground">
                Select a job first to configure an issued package.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={issuePackageEnabled}
                    onChange={(e) => setIssuePackageEnabled(e.target.checked)}
                  />
                  <span>Attach an official issued package to this RFP</span>
                </label>

                {issuePackageEnabled && (
                  <div className="space-y-4 rounded-md border p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Package Name</Label>
                        <Input
                          value={issuePackageName}
                          onChange={(e) => setIssuePackageName(e.target.value)}
                          placeholder="Bid Set 1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={issuePackageDescription}
                          onChange={(e) => setIssuePackageDescription(e.target.value)}
                          placeholder="Issued for pricing"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Included Plan Sets</Label>
                      <div className="rounded-md border divide-y">
                        {availablePlanSets.length === 0 ? (
                          <div className="px-3 py-4 text-sm text-muted-foreground">
                            No plan sets are available on this job yet.
                          </div>
                        ) : (
                          availablePlanSets.map((plan) => (
                            <label key={plan.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                              <div className="min-w-0">
                                <div className="font-medium">{plan.plan_name}</div>
                                <div className="text-muted-foreground">
                                  {plan.plan_number ? `#${plan.plan_number}` : 'No plan set number'}
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedIssuePackagePlanIds.includes(plan.id)}
                                onChange={(e) =>
                                  setSelectedIssuePackagePlanIds((prev) =>
                                    e.target.checked
                                      ? [...prev, plan.id]
                                      : prev.filter((id) => id !== plan.id),
                                  )
                                }
                              />
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </form>
      )}

      <RfpPlanPagePicker
        open={planPickerOpen}
        onOpenChange={setPlanPickerOpen}
        options={availablePlanPages}
        selectedPages={selectedPlanPages}
        onApply={applySelectedPlanPages}
      />
    </div>
  );
}
