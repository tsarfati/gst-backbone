import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { User, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import JobCostCodeAssignments, { JobCostCodes } from './JobCostCodeAssignments';

interface Employee {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  role: string;
  is_pin?: boolean;
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
  const [settings, setSettings] = useState<EmployeeTimecardSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    loadEmployees();
  }, [currentCompany?.id]);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadEmployeeSettings(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  const loadEmployees = async () => {
    if (!currentCompany?.id) return;
    try {
      // Get regular users for this company
      const { data: companyUsers } = await supabase
        .from('user_company_access')
        .select('user_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      const userIds = (companyUsers || []).map((u: any) => u.user_id);

      // Build candidate PIN employee IDs from settings and recent activity (last 21 days)
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 21);
      const sinceISO = since.toISOString();

      const [pinSettingsRes, tcUsersRes, punchPinsRes] = await Promise.all([
        supabase
          .from('pin_employee_timecard_settings')
          .select('pin_employee_id')
          .eq('company_id', currentCompany.id),
        supabase
          .from('time_cards')
          .select('user_id')
          .eq('company_id', currentCompany.id)
          .gte('punch_in_time', sinceISO),
        supabase
          .from('punch_records')
          .select('pin_employee_id')
          .eq('company_id', currentCompany.id)
          .gte('punch_time', sinceISO)
      ]);

      const pinFromSettings: string[] = (pinSettingsRes.data || []).map((r: any) => r.pin_employee_id).filter(Boolean);
      const pinFromTimeCards: string[] = (tcUsersRes.data || []).map((r: any) => r.user_id).filter(Boolean);
      const pinFromPunches: string[] = (punchPinsRes.data || []).map((r: any) => r.pin_employee_id).filter(Boolean);
      const candidatePinIds = Array.from(new Set([...pinFromSettings, ...pinFromTimeCards, ...pinFromPunches]));

      // Fetch regular profiles and candidate PIN employees in parallel
      const [profilesData, pinData] = await Promise.all([
        userIds.length > 0
          ? supabase
              .from('profiles')
              .select('user_id, display_name, first_name, last_name, role')
              .in('user_id', userIds)
          : Promise.resolve({ data: [] }),
        candidatePinIds.length > 0
          ? supabase
              .from('pin_employees')
              .select('id, display_name, first_name, last_name, is_active')
              .eq('is_active', true)
              .in('id', candidatePinIds)
          : Promise.resolve({ data: [] }),
      ]);

      const list: Employee[] = [];

      // Add regular profiles
      (profilesData.data || []).forEach((p: any) => {
        list.push({
          id: p.user_id,
          user_id: p.user_id,
          display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Employee',
          first_name: p.first_name || '',
          last_name: p.last_name || '',
          role: p.role || 'employee',
          is_pin: false,
        });
      });

      // Add PIN employees (avoid duplicates)
      const addedIds = new Set(list.map(e => e.user_id));
      (pinData.data || []).forEach((p: any) => {
        if (!addedIds.has(p.id)) {
          list.push({
            id: p.id,
            user_id: p.id,
            display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Employee',
            first_name: p.first_name || '',
            last_name: p.last_name || '',
            role: 'employee',
            is_pin: true,
          });
        }
      });

      list.sort((a, b) => a.display_name.localeCompare(b.display_name));
      setEmployees(list);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast({ title: "Error", description: "Failed to load employees", variant: "destructive" });
    }
  };

  const loadEmployeeSettings = async (userId: string) => {
    if (!currentCompany?.id) return;
    try {
      setLoading(true);
      const isPin = employees.some(e => e.user_id === userId && e.is_pin);

      if (isPin) {
        const { data, error } = await supabase
          .from('pin_employee_timecard_settings')
          .select('*')
          .eq('pin_employee_id', userId)
          .eq('company_id', currentCompany.id)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          const jobCostCodesMap = new Map<string, string[]>();
          if ((data as any).assigned_cost_codes) {
            const { data: costCodeData } = await supabase
              .from('cost_codes')
              .select('id, job_id')
              .in('id', (data as any).assigned_cost_codes);
            costCodeData?.forEach(cc => {
              if (cc.job_id) {
                if (!jobCostCodesMap.has(cc.job_id)) jobCostCodesMap.set(cc.job_id, []);
                jobCostCodesMap.get(cc.job_id)!.push(cc.id);
              }
            });
          }
          const job_cost_codes = Array.from(jobCostCodesMap.entries()).map(([jobId, costCodeIds]) => ({ jobId, costCodeIds }));
          setSettings({
            user_id: userId,
            assigned_jobs: (data as any).assigned_jobs || [],
            job_cost_codes,
            require_location: true,
            require_photo: true,
            auto_lunch_deduction: true,
            notes: undefined,
          });
        } else {
          setSettings({ user_id: userId, assigned_jobs: [], job_cost_codes: [], require_location: true, require_photo: true, auto_lunch_deduction: true });
        }
      } else {
        const { data, error } = await supabase
          .from('employee_timecard_settings')
          .select('*')
          .eq('user_id', userId)
          .eq('company_id', currentCompany.id)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          const jobCostCodesMap = new Map<string, string[]>();
          if (data.assigned_cost_codes) {
            const { data: costCodeData } = await supabase
              .from('cost_codes')
              .select('id, job_id')
              .in('id', data.assigned_cost_codes);
            costCodeData?.forEach(cc => {
              if (cc.job_id) {
                if (!jobCostCodesMap.has(cc.job_id)) jobCostCodesMap.set(cc.job_id, []);
                jobCostCodesMap.get(cc.job_id)!.push(cc.id);
              }
            });
          }
          const job_cost_codes = Array.from(jobCostCodesMap.entries()).map(([jobId, costCodeIds]) => ({ jobId, costCodeIds }));
          setSettings({
            user_id: data.user_id,
            assigned_jobs: data.assigned_jobs || [],
            job_cost_codes,
            require_location: data.require_location ?? true,
            require_photo: data.require_photo ?? true,
            auto_lunch_deduction: data.auto_lunch_deduction ?? true,
            notes: data.notes
          });
        } else {
          setSettings({ user_id: userId, assigned_jobs: [], job_cost_codes: [], require_location: true, require_photo: true, auto_lunch_deduction: true });
        }
      }
    } catch (error) {
      console.error('Error loading employee settings:', error);
      toast({ title: "Error", description: "Failed to load employee settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveEmployeeSettings = async () => {
    if (!settings || !currentCompany?.id) return;

    try {
      setSaving(true);
      const isPin = employees.some(e => e.user_id === settings.user_id && e.is_pin);

      // Flatten job_cost_codes back to assigned_cost_codes array
      const assigned_cost_codes = settings.job_cost_codes.flatMap(jcc => jcc.costCodeIds);

      if (isPin) {
        const { data: existing } = await supabase
          .from('pin_employee_timecard_settings')
          .select('id')
          .eq('pin_employee_id', settings.user_id)
          .eq('company_id', currentCompany.id)
          .maybeSingle();

        const payload: any = {
          pin_employee_id: settings.user_id,
          company_id: currentCompany.id,
          assigned_jobs: settings.assigned_jobs,
          assigned_cost_codes,
          updated_at: new Date().toISOString(),
        };

        const { error } = existing
          ? await supabase.from('pin_employee_timecard_settings').update(payload).eq('id', existing.id)
          : await supabase.from('pin_employee_timecard_settings').insert({ ...payload, created_by: profile?.user_id });
        if (error) throw error;
      } else {
        const settingsData = {
          user_id: settings.user_id,
          company_id: currentCompany.id,
          assigned_jobs: settings.assigned_jobs,
          assigned_cost_codes,
          require_location: settings.require_location,
          require_photo: settings.require_photo,
          auto_lunch_deduction: settings.auto_lunch_deduction,
          notes: settings.notes,
          created_by: profile?.user_id
        };

        const { data: existing } = await supabase
          .from('employee_timecard_settings')
          .select('id')
          .eq('user_id', settings.user_id)
          .eq('company_id', currentCompany.id)
          .maybeSingle();

        const { error } = existing
          ? await supabase.from('employee_timecard_settings').update(settingsData).eq('id', existing.id)
          : await supabase.from('employee_timecard_settings').insert(settingsData);
        if (error) throw error;
      }

      toast({ title: "Settings Saved", description: "Employee timecard settings have been updated successfully." });
    } catch (error) {
      console.error('Error saving employee settings:', error);
      toast({ title: "Error", description: "Failed to save employee settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (updates: Partial<EmployeeTimecardSettings>) => {
    if (settings) {
      setSettings({ ...settings, ...updates });
    }
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

      {settings && currentCompany && (
        <div className="space-y-6">
          {/* Job Assignments & Cost Codes */}
          <JobCostCodeAssignments
            companyId={currentCompany.id}
            assignedJobs={settings.assigned_jobs}
            jobCostCodes={settings.job_cost_codes}
            onJobsChange={(jobs) => updateSettings({ assigned_jobs: jobs })}
            onCostCodesChange={(jobCostCodes) => updateSettings({ job_cost_codes: jobCostCodes })}
          />

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
