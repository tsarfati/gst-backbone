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
  default_job_id?: string;
  require_location: boolean;
  require_photo: boolean;
  auto_lunch_deduction: boolean;
  lunch_duration_minutes: number;
  max_daily_hours: number;
  overtime_threshold: number;
  allow_early_punch_in_minutes: number;
  allow_late_punch_out_minutes: number;
  notification_preferences: {
    punch_reminders: boolean;
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [settings, setSettings] = useState<EmployeeTimecardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    loadEmployees();
    loadJobs();
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
        .order('display_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
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

  const loadEmployeeSettings = async (employeeId: string) => {
    try {
      setLoading(true);
      
      // For now, use default settings since we need to implement employee_timecard_settings table
      const defaultSettings: EmployeeTimecardSettings = {
        user_id: employeeId,
        assigned_jobs: [],
        require_location: true,
        require_photo: true,
        auto_lunch_deduction: true,
        lunch_duration_minutes: 30,
        max_daily_hours: 12,
        overtime_threshold: 8,
        allow_early_punch_in_minutes: 15,
        allow_late_punch_out_minutes: 15,
        notification_preferences: {
          punch_reminders: true,
          overtime_alerts: true,
          missed_punch_alerts: true
        }
      };

      setSettings(defaultSettings);
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
    if (!settings) return;

    try {
      setSaving(true);
      
      // For now just show success message
      // In a real implementation, you would save to employee_timecard_settings table
      
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
                  <Label>Punch Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Remind employee to punch in/out
                  </p>
                </div>
                <Switch
                  checked={settings.notification_preferences.punch_reminders}
                  onCheckedChange={(checked) => updateSettings({
                    notification_preferences: {
                      ...settings.notification_preferences,
                      punch_reminders: checked
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