import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Job {
  id: string;
  name: string;
}

export default function AddRFP() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  
  const preselectedJobId = searchParams.get('jobId');
  
  const [formData, setFormData] = useState({
    rfp_number: '',
    title: '',
    description: '',
    scope_of_work: '',
    job_id: preselectedJobId || '',
    issue_date: '',
    due_date: ''
  });

  useEffect(() => {
    if (currentCompany?.id) {
      loadJobs();
      generateRFPNumber();
    }
  }, [currentCompany?.id]);

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', currentCompany!.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setJobs(data || []);
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

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('rfps')
        .insert({
          company_id: currentCompany!.id,
          rfp_number: formData.rfp_number,
          title: formData.title,
          description: formData.description || null,
          scope_of_work: formData.scope_of_work || null,
          job_id: formData.job_id || null,
          issue_date: formData.issue_date || null,
          due_date: formData.due_date || null,
          status: 'draft',
          created_by: user!.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'RFP created successfully'
      });

      navigate(`/construction/rfps/${data.id}`);
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
          <h1 className="text-3xl font-bold">Create RFP</h1>
        </div>
      </div>

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
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Creating...' : 'Create RFP'}
          </Button>
        </div>
      </form>
    </div>
  );
}
