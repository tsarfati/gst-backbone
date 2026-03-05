import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';
import { canAccessJobIds, ensureAllowedJobFilter } from '@/utils/jobAccess';
import { getStoragePathForDb } from '@/utils/storageUtils';

interface Job {
  id: string;
  name: string;
}

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      }

      toast({
        title: 'Success',
        description: isEditMode ? 'RFP updated successfully' : 'RFP created successfully'
      });

      navigate(`/construction/rfps/${savedRfpId}`);
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{isEditMode ? 'Edit RFP' : 'Create RFP'}</h1>
        </div>
      </div>

      {loadingRfp ? (
        <div className="h-40 flex items-center justify-center"><span className="loading-dots">Loading</span></div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-6">
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
              <Input
                id="drawings_upload"
                type="file"
                multiple
                onChange={(e) => setSelectedDrawings(Array.from(e.target.files || []))}
                accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp"
              />
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

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {selectedDrawings.length > 0 ? <Upload className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create RFP')}
          </Button>
        </div>
      </form>
      )}
    </div>
  );
}
