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
import { Clock, MapPin, Camera, Save, Bell, Shield, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import EmployeeTimecardSettings from '@/components/EmployeeTimecardSettings';
import JobPunchClockSettings from '@/components/JobPunchClockSettings';

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
  overtime_past_window_threshold_minutes: 30
};

export default function PunchClockSettingsComponent() {
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [settings, setSettings] = useState<PunchClockSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

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
          overtime_past_window_threshold_minutes: data.overtime_past_window_threshold_minutes ?? 30
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
          created_by: user?.id
        });

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

  if (loading) {
    return <div className="text-center py-8">Loading punch clock settings...</div>;
  }

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
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="employees">Employee Settings</TabsTrigger>
          <TabsTrigger value="jobs">Job Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Time Tracking Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Tracking Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="overtime-threshold">Overtime Threshold (hours)</Label>
                  <Input
                    id="overtime-threshold"
                    type="number"
                    value={settings.overtime_threshold}
                    onChange={(e) => updateSetting('overtime_threshold', parseFloat(e.target.value))}
                    min="8"
                    max="12"
                    step="0.5"
                  />
                  <p className="text-xs text-muted-foreground">Hours worked per day before overtime applies</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overtime-past-window">Overtime Past Window Threshold (minutes)</Label>
                  <Input
                    id="overtime-past-window"
                    type="number"
                    value={settings.overtime_past_window_threshold_minutes}
                    onChange={(e) => updateSetting('overtime_past_window_threshold_minutes', parseInt(e.target.value))}
                    min="0"
                    max="120"
                  />
                  <p className="text-xs text-muted-foreground">Minutes past punch window end before overtime starts. All time past window end counts as OT once threshold is reached.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grace-period">Grace Period (minutes)</Label>
                  <Input
                    id="grace-period"
                    type="number"
                    value={settings.grace_period_minutes}
                    onChange={(e) => updateSetting('grace_period_minutes', parseInt(e.target.value))}
                    min="0"
                    max="15"
                  />
                  <p className="text-xs text-muted-foreground">Late punch tolerance before penalty</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-break">Auto Break Duration (minutes)</Label>
                  <Input
                    id="auto-break"
                    type="number"
                    value={settings.auto_break_duration}
                    onChange={(e) => updateSetting('auto_break_duration', parseInt(e.target.value))}
                    min="15"
                    max="60"
                  />
                  <p className="text-xs text-muted-foreground">Automatic break deduction for shifts over 6 hours</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-break-wait">Auto Break Wait (hours)</Label>
                  <Input
                    id="auto-break-wait"
                    type="number"
                    value={settings.auto_break_wait_hours}
                    onChange={(e) => updateSetting('auto_break_wait_hours', parseFloat(e.target.value))}
                    min="4"
                    max="8"
                    step="0.5"
                  />
                  <p className="text-xs text-muted-foreground">Hours worked before automatic break deduction</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-window-start">Punch Time Window Start</Label>
                  <Input
                    id="time-window-start"
                    type="time"
                    value={settings.punch_time_window_start}
                    onChange={(e) => updateSetting('punch_time_window_start', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Earliest time employees can punch in</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-window-end">Punch Time Window End</Label>
                  <Input
                    id="time-window-end"
                    type="time"
                    value={settings.punch_time_window_end}
                    onChange={(e) => updateSetting('punch_time_window_end', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Latest time employees can punch out</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Calculate Overtime</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable overtime calculation for hours over threshold
                    </p>
                  </div>
                  <Switch
                    checked={settings.calculate_overtime}
                    onCheckedChange={(checked) => updateSetting('calculate_overtime', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Punch Rounding</Label>
                    <p className="text-sm text-muted-foreground">
                      Round punch times to nearest interval
                    </p>
                  </div>
                  <Switch
                    checked={settings.enable_punch_rounding}
                    onCheckedChange={(checked) => updateSetting('enable_punch_rounding', checked)}
                  />
                </div>

                {settings.enable_punch_rounding && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-4 p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-2">
                      <Label htmlFor="rounding-minutes">Rounding Interval (minutes)</Label>
                      <Select
                        value={settings.punch_rounding_minutes.toString()}
                        onValueChange={(value) => updateSetting('punch_rounding_minutes', parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="10">10 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rounding-direction">Rounding Direction</Label>
                      <Select
                        value={settings.punch_rounding_direction}
                        onValueChange={(value) => updateSetting('punch_rounding_direction', value as 'up' | 'down' | 'nearest')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="up">Round Up</SelectItem>
                          <SelectItem value="down">Round Down</SelectItem>
                          <SelectItem value="nearest">Round to Nearest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
                <div className="space-y-4 ml-4 p-4 border rounded-lg bg-muted/50">
                  <div className="space-y-2">
                    <Label htmlFor="location-accuracy">Location Accuracy (meters)</Label>
                    <Input
                      id="location-accuracy"
                      type="number"
                      value={settings.location_accuracy_meters}
                      onChange={(e) => updateSetting('location_accuracy_meters', parseInt(e.target.value))}
                      min="50"
                      max="500"
                    />
                    <p className="text-xs text-muted-foreground">Required accuracy for location data</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-distance">Max Distance from Job (meters)</Label>
                    <Input
                      id="max-distance"
                      type="number"
                      value={settings.max_distance_from_job_meters}
                      onChange={(e) => updateSetting('max_distance_from_job_meters', parseInt(e.target.value))}
                      min="100"
                      max="1000"
                    />
                    <p className="text-xs text-muted-foreground">Maximum allowed distance from job site</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Distance Warnings</Label>
                      <p className="text-sm text-muted-foreground">
                        Warn employees when they're too far from job site
                      </p>
                    </div>
                    <Switch
                      checked={settings.enable_distance_warnings}
                      onCheckedChange={(checked) => updateSetting('enable_distance_warnings', checked)}
                    />
                  </div>
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
            </CardContent>
          </Card>
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