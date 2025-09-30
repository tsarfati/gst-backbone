import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, MapPin, Clock, Settings, Save, Building } from 'lucide-react';
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

interface EmployeeTimecardSettings {
  user_id: string;
  assigned_jobs: string[];
  assigned_cost_codes: string[];
  default_job_id?: string;
  default_cost_code_id?: string;
  require_location: boolean;
  require_photo: boolean;
  auto_lunch_deduction: boolean;
  lunch_duration_minutes: number;
  max_daily_hours: number;
  overtime_threshold: number;
  allow_early_punch_in_minutes: number;
  allow_late_punch_out_minutes: number;
  notification_preferences: {
    punch_in_reminders: boolean;
    punch_out_reminders: boolean;
    overtime_alerts: boolean;
    missed_punch_alerts: boolean;
  };
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
  const [costCodes, setCostCodes] = useState<{ id: string; code: string; description: string; type?: string; }[]>([]);
  const [settings, setSettings] = useState<EmployeeTimecardSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    loadEmployees();
    loadJobs();
    loadCostCodes();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadEmployeeSettings(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, first_name, last_name, role')
        .eq('role', 'employee')
        .order('display_name');

      if (error) throw error;
      setEmployees(data || []);
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
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, address')
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadCostCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('is_active', true)
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
      
      // Load existing settings from database
      const { data, error } = await supabase
        .from('employee_timecard_settings')
        .select('*')
        .eq('user_id', employeeId)
        .eq('company_id', currentCompany?.id || '')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        // Use existing settings
        setSettings({
          user_id: data.user_id,
          assigned_jobs: data.assigned_jobs || [],
          assigned_cost_codes: data.assigned_cost_codes || [],
          default_job_id: data.default_job_id,
          default_cost_code_id: data.default_cost_code_id,
          require_location: data.require_location,
          require_photo: data.require_photo,
          auto_lunch_deduction: data.auto_lunch_deduction,
          lunch_duration_minutes: data.lunch_duration_minutes,
          max_daily_hours: data.max_daily_hours,
          overtime_threshold: data.overtime_threshold,
          allow_early_punch_in_minutes: data.allow_early_punch_in_minutes,
          allow_late_punch_out_minutes: data.allow_late_punch_out_minutes,
          notification_preferences: (data.notification_preferences as any) || {
            punch_in_reminders: true,
            punch_out_reminders: true,
            overtime_alerts: true,
            missed_punch_alerts: true
          },
          notes: data.notes
        });
      } else {
        // Use default settings for new employee
        const defaultSettings: EmployeeTimecardSettings = {
          user_id: employeeId,
          assigned_jobs: [],
          assigned_cost_codes: [],
          require_location: true,
          require_photo: true,
          auto_lunch_deduction: true,
          lunch_duration_minutes: 30,
          max_daily_hours: 12,
          overtime_threshold: 8,
          allow_early_punch_in_minutes: 15,
          allow_late_punch_out_minutes: 15,
          notification_preferences: {
            punch_in_reminders: true,
            punch_out_reminders: true,
            overtime_alerts: true,
            missed_punch_alerts: true
          }
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
      
      const settingsData = {
        user_id: settings.user_id,
        company_id: profile.current_company_id || profile.user_id,
        assigned_jobs: settings.assigned_jobs,
        assigned_cost_codes: settings.assigned_cost_codes,
        default_job_id: settings.default_job_id,
        default_cost_code_id: settings.default_cost_code_id,
        require_location: settings.require_location,
        require_photo: settings.require_photo,
        auto_lunch_deduction: settings.auto_lunch_deduction,
        lunch_duration_minutes: settings.lunch_duration_minutes,
        max_daily_hours: settings.max_daily_hours,
        overtime_threshold: settings.overtime_threshold,
        allow_early_punch_in_minutes: settings.allow_early_punch_in_minutes,
        allow_late_punch_out_minutes: settings.allow_late_punch_out_minutes,
        notification_preferences: settings.notification_preferences,
        notes: settings.notes,
        created_by: profile.user_id
      };

      // Check if settings exist for this user
      const { data: existing, error: fetchErr } = await supabase
        .from('employee_timecard_settings')
        .select('id')
        .eq('user_id', settings.user_id)
        .maybeSingle();

      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;

      let error;
      if (existing?.id) {
        // Update existing
        ({ error } = await supabase
          .from('employee_timecard_settings')
          .update(settingsData)
          .eq('id', existing.id));
      } else {
        // Insert new
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
    
    updateSettings({ assigned_jobs: updatedJobs });
  };

  const toggleCostCodeAssignment = (costCodeId: string) => {
    if (!settings) return;
    
    const updatedCostCodes = settings.assigned_cost_codes.includes(costCodeId)
      ? settings.assigned_cost_codes.filter(id => id !== costCodeId)
      : [...settings.assigned_cost_codes, costCodeId];
    
    updateSettings({ assigned_cost_codes: updatedCostCodes });
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

          {/* Employee Settings */}
          {settings && (
            <div className="space-y-6">
              {/* Job Assignments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Job Assignments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Assigned Jobs ({settings.assigned_jobs.length} selected)</Label>
                    <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                      <div className="space-y-2">
                        {jobs.map((job) => (
                          <div key={job.id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`job-${job.id}`}
                                checked={settings.assigned_jobs.includes(job.id)}
                                onChange={() => toggleJobAssignment(job.id)}
                                className="rounded"
                              />
                              <Label htmlFor={`job-${job.id}`} className="text-sm">
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
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Job</Label>
                    <Select 
                      value={settings.default_job_id} 
                      onValueChange={(value) => updateSettings({ default_job_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select default job (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {settings.assigned_jobs.map((jobId) => {
                          const job = jobs.find(j => j.id === jobId);
                          return job ? (
                            <SelectItem key={job.id} value={job.id}>
                              {job.name}
                            </SelectItem>
                          ) : null;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Code Assignments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Cost Code Assignments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Assigned Cost Codes ({settings.assigned_cost_codes.length} selected)</Label>
                    <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                      <div className="space-y-2">
                        {costCodes.map((costCode) => (
                          <div key={costCode.id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`costcode-${costCode.id}`}
                                checked={settings.assigned_cost_codes.includes(costCode.id)}
                                onChange={() => toggleCostCodeAssignment(costCode.id)}
                                className="rounded"
                              />
                              <Label htmlFor={`costcode-${costCode.id}`} className="text-sm">
                                {costCode.code} - {costCode.description} {costCode.type && `(${costCode.type})`}
                              </Label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Cost Code</Label>
                    <Select 
                      value={settings.default_cost_code_id} 
                      onValueChange={(value) => updateSettings({ default_cost_code_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select default cost code (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {settings.assigned_cost_codes.map((costCodeId) => {
                          const costCode = costCodes.find(cc => cc.id === costCodeId);
                          return costCode ? (
                            <SelectItem key={costCode.id} value={costCode.id}>
                              {costCode.code} - {costCode.description} {costCode.type && `(${costCode.type})`}
                            </SelectItem>
                          ) : null;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Time Tracking Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Tracking Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Overtime Threshold (hours/day)</Label>
                  <Input
                    type="number"
                    value={settings.overtime_threshold}
                    onChange={(e) => updateSettings({ overtime_threshold: parseFloat(e.target.value) })}
                    min="6"
                    max="12"
                    step="0.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Daily Hours</Label>
                  <Input
                    type="number"
                    value={settings.max_daily_hours}
                    onChange={(e) => updateSettings({ max_daily_hours: parseFloat(e.target.value) })}
                    min="8"
                    max="16"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Lunch Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={settings.lunch_duration_minutes}
                    onChange={(e) => updateSettings({ lunch_duration_minutes: parseInt(e.target.value) })}
                    min="15"
                    max="90"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Early Punch In (minutes)</Label>
                  <Input
                    type="number"
                    value={settings.allow_early_punch_in_minutes}
                    onChange={(e) => updateSettings({ allow_early_punch_in_minutes: parseInt(e.target.value) })}
                    min="0"
                    max="60"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Location</Label>
                    <p className="text-sm text-muted-foreground">
                      Employee must share location when punching in/out
                    </p>
                  </div>
                  <Switch
                    checked={settings.require_location}
                    onCheckedChange={(checked) => updateSettings({ require_location: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Photo</Label>
                    <p className="text-sm text-muted-foreground">
                      Employee must take photo when punching in/out
                    </p>
                  </div>
                  <Switch
                    checked={settings.require_photo}
                    onCheckedChange={(checked) => updateSettings({ require_photo: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Lunch Deduction</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically deduct lunch time for shifts over 6 hours
                    </p>
                  </div>
                  <Switch
                    checked={settings.auto_lunch_deduction}
                    onCheckedChange={(checked) => updateSettings({ auto_lunch_deduction: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

              {/* Notification Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Punch In Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Remind employee to punch in at start of shift
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification_preferences.punch_in_reminders}
                      onCheckedChange={(checked) => updateSettings({
                        notification_preferences: {
                          ...settings.notification_preferences,
                          punch_in_reminders: checked
                        }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Punch Out Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Remind employee to punch out at end of shift
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification_preferences.punch_out_reminders}
                      onCheckedChange={(checked) => updateSettings({
                        notification_preferences: {
                          ...settings.notification_preferences,
                          punch_out_reminders: checked
                        }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Overtime Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Alert when approaching overtime threshold
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification_preferences.overtime_alerts}
                      onCheckedChange={(checked) => updateSettings({
                        notification_preferences: {
                          ...settings.notification_preferences,
                          overtime_alerts: checked
                        }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Missed Punch Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Alert when employee forgets to punch in/out
                      </p>
                    </div>
                    <Switch
                      checked={settings.notification_preferences.missed_punch_alerts}
                      onCheckedChange={(checked) => updateSettings({
                        notification_preferences: {
                          ...settings.notification_preferences,
                          missed_punch_alerts: checked
                        }
                      })}
                    />
                  </div>
                </CardContent>
              </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any additional notes or special instructions for this employee..."
                value={settings.notes || ''}
                onChange={(e) => updateSettings({ notes: e.target.value })}
                rows={3}
              />
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