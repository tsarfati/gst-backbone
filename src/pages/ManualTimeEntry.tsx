import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, ArrowLeft, Save, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Job {
  id: string;
  name: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
}

interface Employee {
  user_id: string;
  display_name: string;
}

export default function ManualTimeEntry() {
  const { profile, user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [formData, setFormData] = useState({
    user_id: user?.id || '',
    job_id: '',
    cost_code_id: '',
    date: new Date().toISOString().split('T')[0],
    punch_in_time: '',
    punch_out_time: '',
    break_minutes: 30,
    notes: ''
  });

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    if (currentCompany?.id) {
      loadJobs();
      loadEmployees();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (formData.job_id && currentCompany?.id) {
      loadCostCodes(formData.job_id);
    } else {
      setCostCodes([]);
    }
  }, [formData.job_id, currentCompany?.id]);

  const loadJobs = async () => {
    if (!currentCompany?.id || !user?.id) return;
    
    try {
      // Check if user has assigned jobs
      const { data: settings } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_jobs')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      
      const assignedJobs = settings?.assigned_jobs || [];
      const hasGlobal = profile?.has_global_job_access;

      let jobsQuery = supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .in('status', ['active', 'planning'])
        .order('name');
      
      // Filter by assigned jobs if user has specific assignments and no global access
      if (!hasGlobal && assignedJobs.length > 0) {
        jobsQuery = jobsQuery.in('id', assignedJobs);
      } else if (!hasGlobal && assignedJobs.length === 0) {
        // No jobs available for this user
        setJobs([]);
        return;
      }
      
      const { data, error } = await jobsQuery;
      
      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load jobs.",
        variant: "destructive",
      });
    }
  };

  const loadCostCodes = async (jobId: string) => {
    if (!currentCompany?.id || !user?.id) return;
    
    try {
      // Check if user has assigned cost codes
      const { data: settings } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_cost_codes')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      
      const assignedCostCodes = settings?.assigned_cost_codes || [];
      const hasGlobal = profile?.has_global_job_access;

      let costCodesQuery = supabase
        .from('cost_codes')
        .select('id, code, description, job_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .eq('job_id', jobId)
        .order('code');
      
      // Filter by assigned cost codes if user has specific assignments and no global access
      if (!hasGlobal && assignedCostCodes.length > 0) {
        costCodesQuery = costCodesQuery.in('id', assignedCostCodes);
      } else if (!hasGlobal && assignedCostCodes.length === 0) {
        // No cost codes available for this user
        setCostCodes([]);
        return;
      }
      
      const { data, error } = await costCodesQuery;
      
      if (error) throw error;
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error loading cost codes:', error);
      toast({
        title: "Error",
        description: "Failed to load cost codes.",
        variant: "destructive",
      });
    }
  };

  const loadEmployees = async () => {
    if (!currentCompany?.id || !isManager) return;
    
    try {
      // Get all users with access to the current company
      const { data: companyUsers } = await supabase
        .from('user_company_access')
        .select('user_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      const userIds = (companyUsers || []).map(u => u.user_id);
      
      if (userIds.length === 0) {
        setEmployees([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds)
        .order('display_name');
      
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast({
        title: "Error",
        description: "Failed to load employees.",
        variant: "destructive",
      });
    }
  };

  const calculateHours = () => {
    if (!formData.punch_in_time || !formData.punch_out_time) return 0;
    
    const punchIn = new Date(`${formData.date}T${formData.punch_in_time}`);
    const punchOut = new Date(`${formData.date}T${formData.punch_out_time}`);
    
    if (punchOut <= punchIn) return 0;
    
    const diffMs = punchOut.getTime() - punchIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    
    // Subtract break time
    const breakHours = formData.break_minutes / 60;
    return Math.max(0, hours - breakHours);
  };

  const calculateOvertime = (totalHours: number) => {
    return Math.max(0, totalHours - 8);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.user_id || !formData.job_id || !formData.cost_code_id || !formData.punch_in_time || !formData.punch_out_time) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including job and cost code.",
        variant: "destructive",
      });
      return;
    }

    const totalHours = calculateHours();
    if (totalHours <= 0) {
      toast({
        title: "Invalid Time",
        description: "Punch out time must be after punch in time.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const punchInDateTime = new Date(`${formData.date}T${formData.punch_in_time}`);
      const punchOutDateTime = new Date(`${formData.date}T${formData.punch_out_time}`);
      const overtimeHours = calculateOvertime(totalHours);

      const { error } = await supabase
        .from('time_cards')
        .insert({
          user_id: formData.user_id,
          job_id: formData.job_id,
          cost_code_id: formData.cost_code_id,
          company_id: currentCompany?.id || '',
          punch_in_time: punchInDateTime.toISOString(),
          punch_out_time: punchOutDateTime.toISOString(),
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          break_minutes: formData.break_minutes,
          notes: formData.notes || null,
          status: 'submitted',
          created_via_punch_clock: false
        });

      if (error) throw error;

      toast({
        title: "Time Entry Created",
        description: "Manual time entry has been created successfully.",
      });

      navigate('/time-sheets');
    } catch (error) {
      console.error('Error creating time entry:', error);
      toast({
        title: "Error",
        description: "Failed to create time entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalHours = calculateHours();
  const overtimeHours = calculateOvertime(totalHours);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="date" className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date *
          </Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            required
            className="w-full"
          />
        </div>

        {/* Time In and Time Out */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="punch-in" className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time In *
            </Label>
            <Input
              id="punch-in"
              type="time"
              value={formData.punch_in_time}
              onChange={(e) => setFormData(prev => ({ ...prev, punch_in_time: e.target.value }))}
              required
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="punch-out" className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time Out *
            </Label>
            <Input
              id="punch-out"
              type="time"
              value={formData.punch_out_time}
              onChange={(e) => setFormData(prev => ({ ...prev, punch_out_time: e.target.value }))}
              required
              className="w-full"
            />
          </div>
        </div>

        {/* Job */}
        <div className="space-y-2">
          <Label htmlFor="job" className="text-sm">Job *</Label>
          <Select
            value={formData.job_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, job_id: value, cost_code_id: '' }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select job" />
            </SelectTrigger>
            <SelectContent>
              {jobs.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No jobs assigned</div>
              ) : (
                jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Cost Code */}
        <div className="space-y-2">
          <Label htmlFor="cost-code" className="text-sm">Cost Code *</Label>
          <Select
            value={formData.cost_code_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, cost_code_id: value }))}
            disabled={!formData.job_id}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={formData.job_id ? "Select cost code" : "Select job first"} />
            </SelectTrigger>
            <SelectContent>
              {costCodes.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">
                  {formData.job_id ? "No cost codes assigned" : "Select a job first"}
                </div>
              ) : (
                costCodes.map((code) => (
                  <SelectItem key={code.id} value={code.id}>
                    {code.code} - {code.description}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Break Minutes */}
        <div className="space-y-2">
          <Label htmlFor="break" className="text-sm">Break (minutes)</Label>
          <Input
            id="break"
            type="number"
            min="0"
            max="480"
            value={formData.break_minutes}
            onChange={(e) => setFormData(prev => ({ ...prev, break_minutes: parseInt(e.target.value) || 0 }))}
            className="w-full"
          />
        </div>

        {/* Hours Summary */}
        {totalHours > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Total Hours</p>
                <p className="font-semibold text-lg">{totalHours.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Overtime</p>
                <p className="font-semibold text-lg text-warning">{overtimeHours.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm">Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Add any additional notes..."
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full resize-none"
          />
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading || !formData.job_id || !formData.cost_code_id}
          className="w-full gap-2"
          size="lg"
        >
          <Save className="h-4 w-4" />
          {loading ? 'Creating...' : 'Submit Time Entry'}
        </Button>
      </form>
    </div>
  );
}