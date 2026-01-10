import { useState, useEffect, useRef } from 'react';
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

interface EmployeeTimecardAccess {
  is_pin: boolean;
  assigned_jobs: string[];
  assigned_cost_codes: string[];
  has_global_job_access: boolean;
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

  const accessCacheRef = useRef<Map<string, EmployeeTimecardAccess>>(new Map());

  const [formData, setFormData] = useState({
    user_id: '',
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
      // Company context changed -> clear access cache
      accessCacheRef.current = new Map();

      loadEmployees();
      // Set current user as default if not a manager
      if (!isManager && user?.id) {
        setFormData(prev => ({ ...prev, user_id: user.id }));
      }
    }
  }, [currentCompany?.id, isManager, user?.id]);

  useEffect(() => {
    if (formData.user_id && currentCompany?.id) {
      loadJobs();
    } else {
      setJobs([]);
    }
  }, [formData.user_id, currentCompany?.id]);

  useEffect(() => {
    if (formData.job_id && currentCompany?.id) {
      loadCostCodes(formData.job_id);
    } else {
      setCostCodes([]);
    }
  }, [formData.job_id, currentCompany?.id]);

  const getEmployeeTimecardAccess = async (employeeUserId: string): Promise<EmployeeTimecardAccess | null> => {
    if (!currentCompany?.id || !employeeUserId) return null;

    // Small cache to avoid re-fetching while the user is filling the form
    const cached = accessCacheRef.current.get(employeeUserId);
    if (cached) return cached;

    const { data, error } = await supabase.functions.invoke('get-employee-timecard-access', {
      body: {
        company_id: currentCompany.id,
        employee_user_id: employeeUserId,
      },
    });

    if (error) throw error;

    const access: EmployeeTimecardAccess | undefined = data?.access;
    if (!access) return null;

    accessCacheRef.current.set(employeeUserId, access);
    return access;
  };

  const loadJobs = async () => {
    if (!currentCompany?.id || !formData.user_id) return;

    try {
      const access = await getEmployeeTimecardAccess(formData.user_id);
      if (!access) {
        setJobs([]);
        return;
      }

      const hasGlobalJobs = access.is_pin
        ? (access.assigned_jobs?.length ?? 0) === 0
        : access.has_global_job_access;

      let jobsQuery = supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .in('status', ['active', 'planning'])
        .order('name');

      if (!hasGlobalJobs) {
        const assignedJobs = access.assigned_jobs ?? [];
        if (assignedJobs.length === 0) {
          setJobs([]);
          return;
        }
        jobsQuery = jobsQuery.in('id', assignedJobs);
      }

      const { data, error } = await jobsQuery;
      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load jobs.',
        variant: 'destructive',
      });
    }
  };

  const loadCostCodes = async (jobId: string) => {
    if (!currentCompany?.id || !formData.user_id) return;

    try {
      const access = await getEmployeeTimecardAccess(formData.user_id);
      if (!access) {
        setCostCodes([]);
        return;
      }

      const baseQuery = supabase
        .from('cost_codes')
        .select('id, code, description')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .eq('job_id', jobId)
        .eq('type', 'labor')
        .order('code');

      // Determine whether this employee can see all codes for the job
      const hasGlobalCodes = access.is_pin
        ? (access.assigned_cost_codes?.length ?? 0) === 0
        : access.has_global_job_access;

      const assignedCodes = access.assigned_cost_codes ?? [];

      if (!hasGlobalCodes) {
        // Not global: must have explicit code assignments
        if (assignedCodes.length === 0) {
          setCostCodes([]);
          return;
        }

        const { data, error } = await baseQuery.in('id', assignedCodes);
        if (error) throw error;
        setCostCodes(data || []);
        return;
      }

      const { data, error } = await baseQuery;
      if (error) throw error;
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error loading cost codes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cost codes.',
        variant: 'destructive',
      });
    }
  };

  const loadEmployees = async () => {
    if (!currentCompany?.id) return;
    
    try {
      // Use edge function to get all company employees (regular + PIN employees)
      const { data, error } = await supabase.functions.invoke('get-company-employees', {
        body: { company_id: currentCompany.id }
      });
      
      if (error) throw error;
      
      // Transform to match Employee interface
      let employeeList: Employee[] = (data?.employees || []).map((emp: any) => ({
        user_id: emp.user_id,
        display_name: emp.display_name
      }));

      // Fallback: derive PIN employees tied to this company via settings and recent activity
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 60); // last 60 days to keep it relevant
      const sinceISO = since.toISOString();

      const [pinSettingsRes, tcUsersRes, punchPinsRes] = await Promise.all([
        supabase.from('pin_employee_timecard_settings').select('pin_employee_id').eq('company_id', currentCompany.id),
        supabase.from('time_cards').select('user_id').eq('company_id', currentCompany.id).gte('punch_in_time', sinceISO),
        supabase.from('punch_records').select('pin_employee_id').eq('company_id', currentCompany.id).gte('punch_time', sinceISO),
      ]);

      const pinFromSettings: string[] = (pinSettingsRes.data || []).map((r: any) => r.pin_employee_id).filter(Boolean);
      const pinFromTimeCards: string[] = (tcUsersRes.data || []).map((r: any) => r.user_id).filter(Boolean);
      const pinFromPunches: string[] = (punchPinsRes.data || []).map((r: any) => r.pin_employee_id).filter(Boolean);
      const candidatePinIds = Array.from(new Set([...pinFromSettings, ...pinFromTimeCards, ...pinFromPunches]));

      if (candidatePinIds.length > 0) {
        const { data: pins } = await supabase
          .from('pin_employees')
          .select('id, display_name, first_name, last_name, is_active')
          .eq('is_active', true)
          .in('id', candidatePinIds);

        const pinList: Employee[] = (pins || []).map((p: any) => ({
          user_id: p.id,
          display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Employee',
        }));

        const existingIds = new Set(employeeList.map(e => e.user_id));
        employeeList = employeeList.concat(pinList.filter(p => !existingIds.has(p.user_id)));
      }

      
      setEmployees(employeeList.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || '')));
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

      // Get the job's company_id
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('company_id')
        .eq('id', formData.job_id)
        .single();

      if (jobError) throw jobError;

      const punchInDateTime = new Date(`${formData.date}T${formData.punch_in_time}`);
      const punchOutDateTime = new Date(`${formData.date}T${formData.punch_out_time}`);
      const overtimeHours = calculateOvertime(totalHours);

      // Check if timecard exceeds 12 or 24 hours
      const over12h = totalHours > 12;
      const over24h = totalHours > 24;
      const requiresApproval = over12h || over24h;
      const status = requiresApproval ? 'pending' : 'submitted';

      const { error } = await supabase
        .from('time_cards')
        .insert({
          user_id: formData.user_id,
          job_id: formData.job_id,
          cost_code_id: formData.cost_code_id,
          company_id: jobData.company_id,
          punch_in_time: punchInDateTime.toISOString(),
          punch_out_time: punchOutDateTime.toISOString(),
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          break_minutes: formData.break_minutes,
          notes: formData.notes || null,
          status: status,
          requires_approval: requiresApproval,
          over_12h: over12h,
          over_24h: over24h,
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
        {/* Employee Selection (for managers only) */}
        {isManager && (
          <div className="space-y-2">
            <Label htmlFor="employee" className="text-sm">Employee *</Label>
            <Select
              value={formData.user_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value, job_id: '', cost_code_id: '' }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No employees found</div>
                ) : (
                  employees.map((employee) => (
                    <SelectItem key={employee.user_id} value={employee.user_id}>
                      {employee.display_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

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
          disabled={loading || !formData.user_id || !formData.job_id || !formData.cost_code_id}
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