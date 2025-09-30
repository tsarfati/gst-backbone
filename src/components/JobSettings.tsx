import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Briefcase, DollarSign, Users, Clock, CheckCircle, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const jobSettingsSchema = z.object({
  budget_require_approval: z.boolean(),
  budget_approval_threshold: z.number().min(0),
  budget_approval_roles: z.array(z.string()),
  budget_change_approval_percentage: z.number().min(0).max(100),
  require_project_manager: z.boolean(),
  auto_assign_pm_role: z.string(),
  require_job_description: z.boolean(),
  require_start_date: z.boolean(),
  require_budget: z.boolean(),
  require_cost_codes: z.boolean(),
  auto_create_default_cost_codes: z.boolean(),
  default_cost_codes: z.array(z.string()),
  default_job_status: z.string(),
  allow_status_change_roles: z.array(z.string()),
  require_completion_approval: z.boolean(),
  require_timecard_approval: z.boolean(),
  timecard_approval_roles: z.array(z.string()),
  overtime_approval_required: z.boolean(),
  overtime_approval_threshold: z.number().min(0),
});

interface JobSettingsData {
  budget_require_approval: boolean;
  budget_approval_threshold: number;
  budget_approval_roles: string[];
  budget_change_approval_percentage: number;
  require_project_manager: boolean;
  auto_assign_pm_role: string;
  require_job_description: boolean;
  require_start_date: boolean;
  require_budget: boolean;
  require_cost_codes: boolean;
  auto_create_default_cost_codes: boolean;
  default_cost_codes: string[];
  default_job_status: string;
  allow_status_change_roles: string[];
  require_completion_approval: boolean;
  require_timecard_approval: boolean;
  timecard_approval_roles: string[];
  overtime_approval_required: boolean;
  overtime_approval_threshold: number;
}

const defaultSettings: JobSettingsData = {
  budget_require_approval: true,
  budget_approval_threshold: 10000,
  budget_approval_roles: ['admin', 'controller'],
  budget_change_approval_percentage: 10,
  require_project_manager: true,
  auto_assign_pm_role: 'project_manager',
  require_job_description: false,
  require_start_date: true,
  require_budget: true,
  require_cost_codes: true,
  auto_create_default_cost_codes: true,
  default_cost_codes: ['General', 'Labor', 'Materials', 'Equipment'],
  default_job_status: 'planning',
  allow_status_change_roles: ['admin', 'controller', 'project_manager'],
  require_completion_approval: true,
  require_timecard_approval: true,
  timecard_approval_roles: ['project_manager', 'admin', 'controller'],
  overtime_approval_required: true,
  overtime_approval_threshold: 8,
};

const availableRoles = [
  { value: 'admin', label: 'Admin', icon: Settings },
  { value: 'controller', label: 'Controller', icon: DollarSign },
  { value: 'project_manager', label: 'Project Manager', icon: Users },
  { value: 'manager', label: 'Manager', icon: Users },
  { value: 'employee', label: 'Employee', icon: Users },
];

const jobStatuses = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function JobSettings() {
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<JobSettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCostCode, setNewCostCode] = useState('');

  useEffect(() => {
    if (currentCompany?.id) {
      loadSettings();
    }
  }, [currentCompany?.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('job_settings')
        .select('*')
        .eq('company_id', currentCompany?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          budget_require_approval: data.budget_require_approval,
           budget_approval_threshold: parseFloat(String(data.budget_approval_threshold || '10000')),
           budget_approval_roles: data.budget_approval_roles,
           budget_change_approval_percentage: parseFloat(String(data.budget_change_approval_percentage || '10')),
          require_project_manager: data.require_project_manager,
          auto_assign_pm_role: data.auto_assign_pm_role,
          require_job_description: data.require_job_description,
          require_start_date: data.require_start_date,
          require_budget: data.require_budget,
          require_cost_codes: data.require_cost_codes,
          auto_create_default_cost_codes: data.auto_create_default_cost_codes,
          default_cost_codes: data.default_cost_codes,
          default_job_status: data.default_job_status,
          allow_status_change_roles: data.allow_status_change_roles,
          require_completion_approval: data.require_completion_approval,
          require_timecard_approval: data.require_timecard_approval,
          timecard_approval_roles: data.timecard_approval_roles,
          overtime_approval_required: data.overtime_approval_required,
          overtime_approval_threshold: parseFloat(String(data.overtime_approval_threshold || '8')),
        });
      }
    } catch (error) {
      console.error('Error loading job settings:', error);
      toast({
        title: "Error",
        description: "Failed to load job settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      const validatedSettings = jobSettingsSchema.parse(settings);
      
      const { error } = await supabase
        .from('job_settings')
        .upsert({
          company_id: currentCompany?.id,
          ...validatedSettings,
          created_by: profile?.user_id,
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Job settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving job settings:', error);
      toast({
        title: "Error",
        description: "Failed to save job settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (key: keyof JobSettingsData, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const addRole = (settingKey: keyof JobSettingsData, role: string) => {
    const currentRoles = settings[settingKey] as string[];
    if (!currentRoles.includes(role)) {
      updateSettings(settingKey, [...currentRoles, role]);
    }
  };

  const removeRole = (settingKey: keyof JobSettingsData, role: string) => {
    const currentRoles = settings[settingKey] as string[];
    updateSettings(settingKey, currentRoles.filter(r => r !== role));
  };

  const addCostCode = () => {
    if (newCostCode.trim() && !settings.default_cost_codes.includes(newCostCode.trim())) {
      updateSettings('default_cost_codes', [...settings.default_cost_codes, newCostCode.trim()]);
      setNewCostCode('');
    }
  };

  const removeCostCode = (costCode: string) => {
    updateSettings('default_cost_codes', settings.default_cost_codes.filter(c => c !== costCode));
  };

  const RoleSelector = ({ 
    settingKey, 
    title, 
    description 
  }: { 
    settingKey: keyof JobSettingsData;
    title: string;
    description: string;
  }) => {
    const selectedRoles = settings[settingKey] as string[];
    
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">{title}</Label>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedRoles.map(role => {
            const roleInfo = availableRoles.find(r => r.value === role);
            return (
              <Badge key={role} variant="secondary" className="flex items-center gap-1">
                {roleInfo?.label || role}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeRole(settingKey, role)}
                />
              </Badge>
            );
          })}
        </div>
        <Select onValueChange={(role) => addRole(settingKey, role)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Add role..." />
          </SelectTrigger>
          <SelectContent>
            {availableRoles
              .filter(role => !selectedRoles.includes(role.value))
              .map(role => (
                <SelectItem key={role.value} value={role.value}>
                  <div className="flex items-center gap-2">
                    <role.icon className="h-4 w-4" />
                    {role.label}
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading job settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h3 className="text-lg font-semibold">Job Management Settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure job creation, budget approvals, time tracking, and workflow settings for your company
            </p>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Budget Approval Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Budget Approval Settings</h3>
            </div>
        
        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Budget Approval</Label>
              <p className="text-sm text-muted-foreground">Job budgets above threshold require approval</p>
            </div>
            <Switch
              checked={settings.budget_require_approval}
              onCheckedChange={(checked) => updateSettings('budget_require_approval', checked)}
            />
          </div>

          {settings.budget_require_approval && (
            <>
              <div className="space-y-3">
                <Label>Budget Approval Threshold</Label>
                <p className="text-sm text-muted-foreground">Job budgets above this amount require approval</p>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.budget_approval_threshold}
                  onChange={(e) => updateSettings('budget_approval_threshold', parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
              </div>

              <RoleSelector
                settingKey="budget_approval_roles"
                title="Budget Approval Roles"
                description="User roles that can approve job budgets"
              />

              <div className="space-y-3">
                <Label>Budget Change Approval Percentage</Label>
                <p className="text-sm text-muted-foreground">Budget changes above this percentage require approval</p>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.budget_change_approval_percentage}
                  onChange={(e) => updateSettings('budget_change_approval_percentage', parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Job Cost Setup Navigation */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold">Job Cost Setup</h3>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/settings/company/job-cost-setup')}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Open Job Cost Setup
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure cost code templates and job costing settings for your projects.
        </p>
      </div>

      <Separator />

      {/* Job Creation Settings */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Job Creation Requirements</h3>
        </div>
        
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Project Manager</Label>
              <p className="text-sm text-muted-foreground">All jobs must have an assigned project manager</p>
            </div>
            <Switch
              checked={settings.require_project_manager}
              onCheckedChange={(checked) => updateSettings('require_project_manager', checked)}
            />
          </div>

          {settings.require_project_manager && (
            <div className="space-y-3">
              <Label>Auto-Assign PM Role</Label>
              <p className="text-sm text-muted-foreground">Default role to assign as project manager</p>
              <Select
                value={settings.auto_assign_pm_role}
                onValueChange={(value) => updateSettings('auto_assign_pm_role', value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <role.icon className="h-4 w-4" />
                        {role.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Job Description</Label>
              <p className="text-sm text-muted-foreground">Jobs must have a description</p>
            </div>
            <Switch
              checked={settings.require_job_description}
              onCheckedChange={(checked) => updateSettings('require_job_description', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Start Date</Label>
              <p className="text-sm text-muted-foreground">Jobs must have a start date</p>
            </div>
            <Switch
              checked={settings.require_start_date}
              onCheckedChange={(checked) => updateSettings('require_start_date', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Budget</Label>
              <p className="text-sm text-muted-foreground">Jobs must have a budget defined</p>
            </div>
            <Switch
              checked={settings.require_budget}
              onCheckedChange={(checked) => updateSettings('require_budget', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Cost Code Settings */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold">Cost Code Settings</h3>
        </div>
        
        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Cost Codes</Label>
              <p className="text-sm text-muted-foreground">Jobs must have cost codes defined</p>
            </div>
            <Switch
              checked={settings.require_cost_codes}
              onCheckedChange={(checked) => updateSettings('require_cost_codes', checked)}
            />
          </div>

          {settings.require_cost_codes && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Auto-Create Default Cost Codes</Label>
                  <p className="text-sm text-muted-foreground">Automatically create default cost codes for new jobs</p>
                </div>
                <Switch
                  checked={settings.auto_create_default_cost_codes}
                  onCheckedChange={(checked) => updateSettings('auto_create_default_cost_codes', checked)}
                />
              </div>

              {settings.auto_create_default_cost_codes && (
                <div className="space-y-3">
                  <Label>Default Cost Codes</Label>
                  <p className="text-sm text-muted-foreground">Cost codes automatically created for new jobs</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {settings.default_cost_codes.map(costCode => (
                      <Badge key={costCode} variant="outline" className="flex items-center gap-1">
                        {costCode}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:text-destructive" 
                          onClick={() => removeCostCode(costCode)}
                        />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add cost code..."
                      value={newCostCode}
                      onChange={(e) => setNewCostCode(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCostCode()}
                      className="w-48"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addCostCode}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Status Workflow Settings */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-orange-600" />
          <h3 className="text-lg font-semibold">Job Status Workflow</h3>
        </div>
        
        <div className="grid gap-6">
          <div className="space-y-3">
            <Label>Default Job Status</Label>
            <p className="text-sm text-muted-foreground">Initial status for new jobs</p>
            <Select
              value={settings.default_job_status}
              onValueChange={(value) => updateSettings('default_job_status', value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {jobStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <RoleSelector
            settingKey="allow_status_change_roles"
            title="Status Change Roles"
            description="User roles that can change job status"
          />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Completion Approval</Label>
              <p className="text-sm text-muted-foreground">Job completion requires approval</p>
            </div>
            <Switch
              checked={settings.require_completion_approval}
              onCheckedChange={(checked) => updateSettings('require_completion_approval', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Time Tracking Settings */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-red-600" />
          <h3 className="text-lg font-semibold">Time Tracking Settings</h3>
        </div>
        
        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Timecard Approval</Label>
              <p className="text-sm text-muted-foreground">Timecards require approval before payroll</p>
            </div>
            <Switch
              checked={settings.require_timecard_approval}
              onCheckedChange={(checked) => updateSettings('require_timecard_approval', checked)}
            />
          </div>

          {settings.require_timecard_approval && (
            <RoleSelector
              settingKey="timecard_approval_roles"
              title="Timecard Approval Roles"
              description="User roles that can approve timecards"
            />
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Overtime Approval Required</Label>
              <p className="text-sm text-muted-foreground">Overtime hours require additional approval</p>
            </div>
            <Switch
              checked={settings.overtime_approval_required}
              onCheckedChange={(checked) => updateSettings('overtime_approval_required', checked)}
            />
          </div>

          {settings.overtime_approval_required && (
            <div className="space-y-3">
              <Label>Overtime Threshold (hours per day)</Label>
              <p className="text-sm text-muted-foreground">Hours per day that trigger overtime approval</p>
              <Input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={settings.overtime_approval_threshold}
                onChange={(e) => updateSettings('overtime_approval_threshold', parseFloat(e.target.value) || 8)}
                className="w-32"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Job Settings'}
        </Button>
      </div>
        </CardContent>
      </Card>
    </div>
  );
}