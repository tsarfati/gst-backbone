import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, MapPin, Camera, Save, Bell, Shield, Users, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import EmployeeTimecardSettings from '@/components/EmployeeTimecardSettings';
import JobPunchClockSettings from '@/components/JobPunchClockSettings';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
interface PunchClockSettings {
  require_location: boolean;
  require_photo: boolean;
  manual_photo_capture: boolean;
  allow_manual_entry: boolean;
  auto_break_duration: number;
  overtime_threshold: number;
  location_accuracy_meters: number;
  photo_required_for_corrections: boolean;
  notification_enabled: boolean;
  manager_approval_required: boolean;
  grace_period_minutes: number;
  allowed_job_sites: string[];
  break_reminder_minutes: number;
  punch_time_window_start: string;
  punch_time_window_end: string;
  enable_punch_rounding: boolean;
  punch_rounding_minutes: number;
  punch_rounding_direction: 'up' | 'down' | 'nearest';
  auto_break_wait_hours: number;
  calculate_overtime: boolean;
  enable_distance_warnings: boolean;
  max_distance_from_job_meters: number;
  company_policies: string;
  overtime_past_window_threshold_minutes: number;
}

interface PunchClockSettings {
  require_location: boolean;
  require_photo: boolean;
  manual_photo_capture: boolean;
  allow_manual_entry: boolean;
  auto_break_duration: number;
  overtime_threshold: number;
  location_accuracy_meters: number;
  photo_required_for_corrections: boolean;
  notification_enabled: boolean;
  manager_approval_required: boolean;
  grace_period_minutes: number;
  allowed_job_sites: string[];
  break_reminder_minutes: number;
  punch_time_window_start: string;
  punch_time_window_end: string;
  enable_punch_rounding: boolean;
  punch_rounding_minutes: number;
  punch_rounding_direction: 'up' | 'down' | 'nearest';
  auto_break_wait_hours: number;
  calculate_overtime: boolean;
  enable_distance_warnings: boolean;
  max_distance_from_job_meters: number;
  company_policies: string;
  overtime_past_window_threshold_minutes: number;
  sms_punchout_reminder_enabled?: boolean;
  sms_punchout_reminder_minutes?: number;
  flag_timecards_over_12hrs?: boolean;
  flag_timecards_over_24hrs?: boolean;
}

const defaultSettings: PunchClockSettings = {
  require_location: true,
  require_photo: true,
  manual_photo_capture: true,
  allow_manual_entry: false,
  auto_break_duration: 30,
  overtime_threshold: 8,
  location_accuracy_meters: 100,
  photo_required_for_corrections: true,
  notification_enabled: true,
  manager_approval_required: false,
  grace_period_minutes: 5,
  allowed_job_sites: [],
  break_reminder_minutes: 240,
  punch_time_window_start: '06:00',
  punch_time_window_end: '22:00',
  enable_punch_rounding: false,
  punch_rounding_minutes: 15,
  punch_rounding_direction: 'nearest',
  auto_break_wait_hours: 6,
  calculate_overtime: true,
  enable_distance_warnings: true,
  max_distance_from_job_meters: 200,
  company_policies: '',
  overtime_past_window_threshold_minutes: 30,
  sms_punchout_reminder_enabled: false,
  sms_punchout_reminder_minutes: 30,
  flag_timecards_over_12hrs: true,
  flag_timecards_over_24hrs: true,
};

export default function PunchClockSettingsComponent() {
  const { user, profile } = useAuth();
  const { currentCompany, userCompanies, loading: companyLoading } = useCompany();
  const { toast } = useToast();
  const [settings, setSettings] = useState<PunchClockSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Use centralized hook for company-specific role
  const normalizeRole = (role?: string | null) => {
    const r = (role ?? '').trim().toLowerCase();
    return r.length ? r : null;
  };

  const activeCompanyRole = useActiveCompanyRole();
  const effectiveRole = normalizeRole(activeCompanyRole ?? profile?.role);

  const isManager =
    effectiveRole === 'admin' ||
    effectiveRole === 'company_admin' ||
    effectiveRole === 'owner' ||
    effectiveRole === 'controller' ||
    effectiveRole === 'project_manager' ||
    effectiveRole === 'manager';

  useEffect(() => {
    if (currentCompany) {
      loadSettings();
    }
  }, [currentCompany]);

  const loadSettings = async () => {
    if (!currentCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load punch clock settings from database for current company
      const { data, error } = await supabase
        .from('job_punch_clock_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('job_id', '00000000-0000-0000-0000-000000000000')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          require_location: data.require_location !== false,
          require_photo: data.require_photo !== false,
          manual_photo_capture: data.manual_photo_capture !== false,
          allow_manual_entry: data.allow_manual_entry === true,
          auto_break_duration: data.auto_break_duration ?? 30,
          overtime_threshold: parseFloat((data.overtime_threshold ?? 8).toString()),
          location_accuracy_meters: data.location_accuracy_meters ?? 100,
          photo_required_for_corrections: true,
          notification_enabled: data.notification_enabled !== false,
          manager_approval_required: data.manager_approval_required === true,
          grace_period_minutes: data.grace_period_minutes ?? 5,
          allowed_job_sites: [],
          break_reminder_minutes: 240,
          punch_time_window_start: data.punch_time_window_start || '06:00',
          punch_time_window_end: data.punch_time_window_end || '22:00',
          enable_punch_rounding: data.enable_punch_rounding === true,
          punch_rounding_minutes: data.punch_rounding_minutes ?? 15,
          punch_rounding_direction: (data.punch_rounding_direction as 'up' | 'down' | 'nearest') || 'nearest',
          auto_break_wait_hours: parseFloat((data.auto_break_wait_hours ?? 6).toString()),
          calculate_overtime: data.calculate_overtime !== false,
          enable_distance_warnings: true,
          max_distance_from_job_meters: 200,
          company_policies: data.company_policies || '',
          overtime_past_window_threshold_minutes: data.overtime_past_window_threshold_minutes ?? 30,
          sms_punchout_reminder_enabled: data.sms_punchout_reminder_enabled ?? false,
          sms_punchout_reminder_minutes: data.sms_punchout_reminder_minutes ?? 30,
          flag_timecards_over_12hrs: data.flag_timecards_over_12hrs ?? true,
          flag_timecards_over_24hrs: data.flag_timecards_over_24hrs ?? true,
        });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error",
        description: "Failed to load punch clock settings",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!currentCompany) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('job_punch_clock_settings')
        .upsert({
          job_id: '00000000-0000-0000-0000-000000000000',
          company_id: currentCompany.id,
          require_location: settings.require_location,
          require_photo: settings.require_photo,
          manual_photo_capture: settings.manual_photo_capture,
          allow_manual_entry: settings.allow_manual_entry,
          auto_break_duration: settings.auto_break_duration,
          overtime_threshold: settings.overtime_threshold,
          location_accuracy_meters: settings.location_accuracy_meters,
          notification_enabled: settings.notification_enabled,
          manager_approval_required: settings.manager_approval_required,
          grace_period_minutes: settings.grace_period_minutes,
          punch_time_window_start: settings.punch_time_window_start,
          punch_time_window_end: settings.punch_time_window_end,
          enable_punch_rounding: settings.enable_punch_rounding,
          punch_rounding_minutes: settings.punch_rounding_minutes,
          punch_rounding_direction: settings.punch_rounding_direction,
          auto_break_wait_hours: settings.auto_break_wait_hours,
          calculate_overtime: settings.calculate_overtime,
          company_policies: settings.company_policies,
          overtime_past_window_threshold_minutes: settings.overtime_past_window_threshold_minutes,
          sms_punchout_reminder_enabled: settings.sms_punchout_reminder_enabled,
          sms_punchout_reminder_minutes: settings.sms_punchout_reminder_minutes,
          flag_timecards_over_12hrs: settings.flag_timecards_over_12hrs,
          flag_timecards_over_24hrs: settings.flag_timecards_over_24hrs,
          created_by: user?.id
        }, { onConflict: 'job_id,company_id' });

      if (error) throw error;
      
      toast({
        title: "Settings Saved",
        description: "Punch clock settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save punch clock settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof PunchClockSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleRecalculate = async () => {
    if (!currentCompany) return;

    // Use effectiveRole (company-specific role when available) instead of profile.role
    // so company admins/controllers aren't blocked by a generic profile role.
    const isAdmin = effectiveRole === 'admin' || effectiveRole === 'controller';
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins and controllers can recalculate time cards",
        variant: "destructive",
      });
      return;
    }

    try {
      setRecalculating(true);
      
      const { data, error } = await supabase.functions.invoke('recalculate-timecards', {
        body: {
          company_id: currentCompany.id
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Recalculated ${data.updated_count} of ${data.total_processed} time cards`,
      });
    } catch (error: any) {
      console.error('Recalculation error:', error);
      toast({
        title: "Error",
        description: "Failed to recalculate time cards",
        variant: "destructive",
      });
    } finally {
      setRecalculating(false);
    }
  };

  // Wait for company context to fully load before checking permissions
  // activeCompanyRole will be null until userCompanies is populated with correct data
  const isRoleReady = activeCompanyRole !== null || !currentCompany;
  
  if (loading || companyLoading || !isRoleReady) {
    return <div className="text-center py-8">Loading punch clock settings...</div>;
  }

  // Debug: log role information
  console.log('PunchClockSettings - activeCompanyRole:', activeCompanyRole);
  console.log('PunchClockSettings - effectiveRole:', effectiveRole);
  console.log('PunchClockSettings - isManager:', isManager);
  console.log('PunchClockSettings - userCompanies:', userCompanies);

  if (!isManager) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-muted-foreground">Only managers can access punch clock settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="employees">Employee Settings</TabsTrigger>
          <TabsTrigger value="jobs">Job Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Break and Flagging Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Tracking Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auto-break">Auto Lunch Deduction (minutes)</Label>
                <Input
                  id="auto-break"
                  type="number"
                  value={settings.auto_break_duration}
                  onChange={(e) => updateSetting('auto_break_duration', parseInt(e.target.value))}
                  min="15"
                  max="60"
                />
                <p className="text-xs text-muted-foreground">Automatic lunch deduction for longer shifts</p>
              </div>

              <Separator />

              {/* Timecard Flagging */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Flag Time Cards Over 12 Hours</Label>
                    <p className="text-sm text-muted-foreground">
                      Highlight time cards exceeding 12 hours with pulsating badge
                    </p>
                  </div>
                  <Switch
                    checked={settings.flag_timecards_over_12hrs || false}
                    onCheckedChange={(checked) => updateSetting('flag_timecards_over_12hrs', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Flag Time Cards Over 24 Hours</Label>
                    <p className="text-sm text-muted-foreground">
                      Highlight time cards exceeding 24 hours with pulsating badge
                    </p>
                  </div>
                  <Switch
                    checked={settings.flag_timecards_over_24hrs || false}
                    onCheckedChange={(checked) => updateSetting('flag_timecards_over_24hrs', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Manual Time Entry</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow employees to manually enter time entries
                  </p>
                </div>
                <Switch
                  checked={settings.allow_manual_entry}
                  onCheckedChange={(checked) => updateSetting('allow_manual_entry', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Manager Approval Required</Label>
                  <p className="text-sm text-muted-foreground">
                    Require manager approval for time entries
                  </p>
                </div>
                <Switch
                  checked={settings.manager_approval_required}
                  onCheckedChange={(checked) => updateSetting('manager_approval_required', checked)}
                />
              </div>

          {/* Location Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Location for Punch</Label>
                  <p className="text-sm text-muted-foreground">
                    Employees must share location when punching in/out
                  </p>
                </div>
                <Switch
                  checked={settings.require_location}
                  onCheckedChange={(checked) => updateSetting('require_location', checked)}
                />
              </div>

              {settings.require_location && (
                <div className="space-y-2 ml-4 p-4 border rounded-lg bg-muted/50">
                  <Label htmlFor="location-accuracy">Location Accuracy (meters)</Label>
                  <Input
                    id="location-accuracy"
                    type="number"
                    value={settings.location_accuracy_meters}
                    onChange={(e) => updateSetting('location_accuracy_meters', parseInt(e.target.value))}
                    min="50"
                    max="500"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photo Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Photo Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Photo for Punch</Label>
                  <p className="text-sm text-muted-foreground">
                    Employees must take a photo when punching in/out
                  </p>
                </div>
                <Switch
                  checked={settings.require_photo}
                  onCheckedChange={(checked) => updateSetting('require_photo', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Photo Required for Corrections</Label>
                  <p className="text-sm text-muted-foreground">
                    Require photo when making time corrections
                  </p>
                </div>
                <Switch
                  checked={settings.photo_required_for_corrections}
                  onCheckedChange={(checked) => updateSetting('photo_required_for_corrections', checked)}
                />
              </div>
            </CardContent>
          </Card>
          
              <div className="space-y-2">
                <Label htmlFor="company-policies">Company Policies</Label>
                <Textarea
                  id="company-policies"
                  placeholder="Enter company policies that employees can view from their punch clock..."
                  value={settings.company_policies}
                  onChange={(e) => updateSetting('company_policies', e.target.value)}
                  rows={10}
                />
                <p className="text-xs text-muted-foreground">
                  These policies will be visible to employees in their punch clock dashboard
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send notifications for missed punches and alerts
                  </p>
                </div>
                <Switch
                  checked={settings.notification_enabled}
                  onCheckedChange={(checked) => updateSetting('notification_enabled', checked)}
                />
              </div>

              <Separator />

              {/* SMS Punch Out Reminder */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable SMS Punch Out Reminder</Label>
                    <p className="text-sm text-muted-foreground">
                      Text employees still punched in after punch window ends
                    </p>
                  </div>
                  <Switch
                    checked={settings.sms_punchout_reminder_enabled || false}
                    onCheckedChange={(checked) => updateSetting('sms_punchout_reminder_enabled', checked)}
                  />
                </div>

                {settings.sms_punchout_reminder_enabled && (
                  <div className="space-y-2">
                    <Label htmlFor="punchout-reminder-minutes">Send Reminder After Punch Window Ends (minutes)</Label>
                    <Input
                      id="punchout-reminder-minutes"
                      type="number"
                      min="0"
                      max="120"
                      value={settings.sms_punchout_reminder_minutes || 30}
                      onChange={(e) => updateSetting('sms_punchout_reminder_minutes', parseInt(e.target.value) || 30)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Minutes after punch window ends to send reminder to users still punched in
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={saveSettings} disabled={saving} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            
            {(profile?.role === 'admin' || profile?.role === 'controller') && (
              <Button 
                onClick={handleRecalculate}
                disabled={recalculating}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                {recalculating ? 'Recalculating...' : 'Recalculate Time Cards'}
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="employees" className="space-y-6">
          <EmployeeTimecardSettings 
            selectedEmployeeId={selectedEmployeeId}
            onEmployeeChange={setSelectedEmployeeId}
          />
        </TabsContent>

        <TabsContent value="jobs" className="space-y-6">
          <JobPunchClockSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}