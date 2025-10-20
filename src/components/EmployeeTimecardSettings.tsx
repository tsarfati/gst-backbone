import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { User, MapPin, Save, Building } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

interface Employee {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Job {
  id: string;
  name: string;
  address?: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  type?: string;
  job_id?: string;
}

interface JobCostCodes {
  jobId: string;
  costCodeIds: string[];
}

interface EmployeeTimecardSettings {
  user_id: string;
  assigned_jobs: string[];
  job_cost_codes: JobCostCodes[];
  require_location: boolean;
  require_photo: boolean;
  auto_lunch_deduction: boolean;
  notes?: string;
}

interface EmployeeTimecardSettingsProps {
  selectedEmployeeId?: string;
  onEmployeeChange: (employeeId: string) => void;
}

export default function EmployeeTimecardSettings({
  selectedEmployeeId,
  onEmployeeChange
}: EmployeeTimecardSettingsProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [settings, setSettings] = useState<EmployeeTimecardSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    loadEmployees();
    loadJobs();
    loadCostCodes();
  }, [currentCompany?.id]);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadEmployeeSettings(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  const loadEmployees = async () => {
    if (!currentCompany?.id) return;
    try {
      const { data: accessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id, role')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (accessError) throw accessError;
      const userIds = (accessData || []).map(a => a.user_id);
      const roleMap = new Map((accessData || []).map((a: any) => [a.user_id, a.role]));

      const filterIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];

      const [profilesRes, pinsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, user_id, display_name, first_name, last_name, role')
          .in('user_id', filterIds)
          .order('display_name'),
        supabase
          .from('pin_employees')
          .select('id, display_name, first_name, last_name, is_active')
          .in('id', filterIds)
          .eq('is_active', true)
          .order('display_name')
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (pinsRes.error && (pinsRes.error as any).code !== 'PGRST116') throw pinsRes.error;

      const profileEmployees = (profilesRes.data || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        display_name: p.display_name,
        first_name: p.first_name,
        last_name: p.last_name,
        role: roleMap.get(p.user_id) || 'employee'
      } as Employee));

      const pinEmployees = (pinsRes.data || []).map((pe: any) => ({
        id: pe.id,
        user_id: pe.id,
        display_name: pe.display_name,
        first_name: pe.first_name,
        last_name: pe.last_name,
        role: 'employee'
      } as Employee));

      setEmployees([...profileEmployees, ...pinEmployees]);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive",
      });
    }
  };

  const loadJobs = async () => {
    if (!currentCompany?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, address')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      const uniqueJobs = data?.reduce((acc, job) => {
        if (!acc.find(j => j.id === job.id)) {
          acc.push(job);
        }
        return acc;
      }, [] as Job[]);
      
      setJobs(uniqueJobs || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadCostCodes = async () => {
    if (!currentCompany?.id) return;
    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, type, job_id')
        .eq('is_active', true)
        .eq('company_id', currentCompany.id)
        .order('code');

      if (error) throw error;
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error loading cost codes:', error);
    }
  };

  const loadEmployeeSettings = async (employeeId: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('employee_timecard_settings')
        .select('*')
        .eq('user_id', employeeId)
        .eq('company_id', currentCompany?.id || '')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings({
          user_id: data.user_id,
          assigned_jobs: data.assigned_jobs || [],
          job_cost_codes: (data.assigned_cost_codes || []).map((ccId: string) => {
            const costCode = costCodes.find(cc => cc.id === ccId);
            return {
              jobId: costCode?.job_id || '',
              costCodeIds: [ccId]
            };
          }),
          require_location: data.require_location,
          require_photo: data.require_photo,
          auto_lunch_deduction: data.auto_lunch_deduction,
          notes: data.notes
        });
      } else {
        const defaultSettings: EmployeeTimecardSettings = {
          user_id: employeeId,
          assigned_jobs: [],
          job_cost_codes: [],
          require_location: true,
          require_photo: true,
          auto_lunch_deduction: true
        };
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading employee settings:', error);
      toast({
        title: "Error",
        description: "Failed to load employee settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveEmployeeSettings = async () => {
    if (!settings || !profile?.user_id) return;

    try {
      setSaving(true);
      
      // Flatten job_cost_codes to assigned_cost_codes array
      const assignedCostCodes = settings.job_cost_codes.flatMap(jcc => jcc.costCodeIds);
      
      const settingsData = {
        user_id: settings.user_id,
        company_id: currentCompany?.id,
        assigned_jobs: settings.assigned_jobs,
        assigned_cost_codes: assignedCostCodes,
        require_location: settings.require_location,
        require_photo: settings.require_photo,
        auto_lunch_deduction: settings.auto_lunch_deduction,
        notes: settings.notes,
        created_by: profile.user_id
      };

      const { data: existing, error: fetchErr } = await supabase
        .from('employee_timecard_settings')
        .select('id')
        .eq('user_id', settings.user_id)
        .eq('company_id', currentCompany?.id || '')
        .maybeSingle();

      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;

      let error;
      if (existing?.id) {
        ({ error } = await supabase
          .from('employee_timecard_settings')
          .update(settingsData)
          .eq('id', existing.id));
      } else {
        ({ error } = await supabase
          .from('employee_timecard_settings')
          .insert(settingsData));
      }

      if (error) throw error;
      
      toast({
        title: "Settings Saved",
        description: "Employee timecard settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving employee settings:', error);
      toast({
        title: "Error",
        description: "Failed to save employee settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (updates: Partial<EmployeeTimecardSettings>) => {
    if (settings) {
      setSettings({ ...settings, ...updates });
    }
  };

  const toggleJobAssignment = (jobId: string) => {
    if (!settings) return;
    
    const updatedJobs = settings.assigned_jobs.includes(jobId)
      ? settings.assigned_jobs.filter(id => id !== jobId)
      : [...settings.assigned_jobs, jobId];
    
    // Remove cost codes for unassigned jobs
    const updatedJobCostCodes = settings.job_cost_codes.filter(jcc => 
      updatedJobs.includes(jcc.jobId)
    );
    
    updateSettings({ 
      assigned_jobs: updatedJobs,
      job_cost_codes: updatedJobCostCodes
    });
  };

  const toggleCostCodeForJob = (jobId: string, costCodeId: string) => {
    if (!settings) return;
    
    const jobCostCodesIndex = settings.job_cost_codes.findIndex(jcc => jcc.jobId === jobId);
    const updatedJobCostCodes = [...settings.job_cost_codes];
    
    if (jobCostCodesIndex >= 0) {
      const currentCostCodes = updatedJobCostCodes[jobCostCodesIndex].costCodeIds;
      if (currentCostCodes.includes(costCodeId)) {
        updatedJobCostCodes[jobCostCodesIndex].costCodeIds = currentCostCodes.filter(id => id !== costCodeId);
      } else {
        updatedJobCostCodes[jobCostCodesIndex].costCodeIds.push(costCodeId);
      }
    } else {
      updatedJobCostCodes.push({
        jobId,
        costCodeIds: [costCodeId]
      });
    }
    
    updateSettings({ job_cost_codes: updatedJobCostCodes });
  };

  const getJobCostCodes = (jobId: string) => {
    return costCodes.filter(cc => 
      cc.job_id === jobId && 
      (cc.type === 'labor' || cc.type === undefined)
    );
  };

  const isCostCodeSelectedForJob = (jobId: string, costCodeId: string) => {
    const jobCostCode = settings?.job_cost_codes.find(jcc => jcc.jobId === jobId);
    return jobCostCode?.costCodeIds.includes(costCodeId) || false;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-muted-foreground">Loading employee settings...</div>
        </CardContent>
      </Card>
    );
  }

  if (!isManager) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">Only managers can access employee timecard settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Employee Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Select Employee
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={selectedEmployeeId} onValueChange={onEmployeeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an employee to configure" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.user_id}>
                    <div className="flex items-center gap-2">
                      <span>{employee.display_name || `${employee.first_name} ${employee.last_name}`}</span>
                      <Badge variant="outline" className="text-xs">
                        {employee.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {settings && (
        <div className="space-y-6">
          {/* Job Assignments & Cost Codes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Job Assignments & Cost Codes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {jobs.map((job) => {
                const jobCostCodes = getJobCostCodes(job.id);
                const isJobAssigned = settings.assigned_jobs.includes(job.id);
                
                return (
                  <div key={job.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`job-${job.id}`}
                          checked={isJobAssigned}
                          onChange={() => toggleJobAssignment(job.id)}
                          className="rounded"
                        />
                        <Label htmlFor={`job-${job.id}`} className="font-semibold">
                          {job.name}
                        </Label>
                      </div>
                      {job.address && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {job.address}
                        </div>
                      )}
                    </div>
                    
                    {isJobAssigned && jobCostCodes.length > 0 && (
                      <div className="ml-6 space-y-2 pt-2 border-t">
                        <Label className="text-sm text-muted-foreground">
                          Labor Cost Codes ({jobCostCodes.filter(cc => isCostCodeSelectedForJob(job.id, cc.id)).length} selected)
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {jobCostCodes.map((costCode) => (
                            <div key={costCode.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`cc-${job.id}-${costCode.id}`}
                                checked={isCostCodeSelectedForJob(job.id, costCode.id)}
                                onChange={() => toggleCostCodeForJob(job.id, costCode.id)}
                                className="rounded"
                              />
                              <Label htmlFor={`cc-${job.id}-${costCode.id}`} className="text-sm">
                                {costCode.code} - {costCode.description}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Location</Label>
                  <p className="text-sm text-muted-foreground">Employee must share location when punching</p>
                </div>
                <Switch
                  checked={settings.require_location}
                  onCheckedChange={(checked) => updateSettings({ require_location: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Photo</Label>
                  <p className="text-sm text-muted-foreground">Employee must take photo when punching</p>
                </div>
                <Switch
                  checked={settings.require_photo}
                  onCheckedChange={(checked) => updateSettings({ require_photo: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Lunch Deduction</Label>
                  <p className="text-sm text-muted-foreground">Automatically deduct lunch break from hours</p>
                </div>
                <Switch
                  checked={settings.auto_lunch_deduction}
                  onCheckedChange={(checked) => updateSettings({ auto_lunch_deduction: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Add any additional notes for this employee..."
                  value={settings.notes || ''}
                  onChange={(e) => updateSettings({ notes: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={saveEmployeeSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Employee Settings'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
