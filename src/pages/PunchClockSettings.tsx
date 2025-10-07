import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Clock, MapPin, Camera, Save, Bell, Shield, Users, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import EmployeeTimecardSettings from '@/components/EmployeeTimecardSettings';
import JobPunchClockSettings from '@/components/JobPunchClockSettings';

// Helper to resize any image to square PNG (contain) at desired size
async function resizeImageToPng(file: File, size: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const scale = Math.min(size / img.width, size / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const dx = Math.floor((size - w) / 2);
    const dy = Math.floor((size - h) / 2);
    ctx.drawImage(img, dx, dy, w, h);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    });
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
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
  pwa_icon_192_url: string;
  pwa_icon_512_url: string;
  enable_install_prompt: boolean;
  show_install_button: boolean;
  cost_code_selection_timing: 'punch_in' | 'punch_out';
  time_display_format: 'hours_minutes' | 'decimal';
  shift_start_time: string;
  shift_end_time: string;
  shift_hours: number;
  overtime_grace_period_minutes: number;
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
  pwa_icon_192_url: '',
  pwa_icon_512_url: '',
  enable_install_prompt: true,
  show_install_button: true,
  cost_code_selection_timing: 'punch_in',
  time_display_format: 'hours_minutes',
  shift_start_time: '07:00',
  shift_end_time: '15:30',
  shift_hours: 8,
  overtime_grace_period_minutes: 30,
};

export default function PunchClockSettings() {
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

  // Persist PWA icon URLs and app name for early manifest before React loads
  useEffect(() => {
    try {
      if (settings.pwa_icon_192_url) localStorage.setItem('pwa_icon_192_url', settings.pwa_icon_192_url);
      if (settings.pwa_icon_512_url) localStorage.setItem('pwa_icon_512_url', settings.pwa_icon_512_url);
      const appName = (currentCompany?.display_name || currentCompany?.name || 'Punch Clock') as string;
      if (appName) localStorage.setItem('pwa_app_name', appName);
    } catch {}
  }, [settings.pwa_icon_192_url, settings.pwa_icon_512_url, currentCompany?.id]);

  const loadSettings = async () => {
    if (!currentCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load punch clock settings from database for current company
      // Use null job_id for company-wide settings
      const { data, error } = await supabase
        .from('job_punch_clock_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .is('job_id', null)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
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
          time_display_format: (data.time_display_format as 'hours_minutes' | 'decimal') ?? 'hours_minutes',
          shift_start_time: data.shift_start_time?.toString() ?? '07:00',
          shift_end_time: data.shift_end_time?.toString() ?? '15:30',
          shift_hours: data.shift_hours ?? 8,
          overtime_grace_period_minutes: data.grace_period_minutes ?? 30,
          notification_enabled: data.notification_enabled !== false,
          manager_approval_required: data.manager_approval_required === true,
          grace_period_minutes: data.grace_period_minutes ?? 5,
          allowed_job_sites: [],
          break_reminder_minutes: 240, // Default value since not in DB
          punch_time_window_start: data.punch_time_window_start || '06:00',
          punch_time_window_end: data.punch_time_window_end || '22:00',
          enable_punch_rounding: data.enable_punch_rounding === true,
          punch_rounding_minutes: data.punch_rounding_minutes ?? 15,
          punch_rounding_direction: (data.punch_rounding_direction as 'up' | 'down' | 'nearest') || 'nearest',
          auto_break_wait_hours: parseFloat((data.auto_break_wait_hours ?? 6).toString()),
          calculate_overtime: data.calculate_overtime !== false,
          enable_distance_warnings: true, // Default value since not in DB
          max_distance_from_job_meters: 200, // Default value since not in DB
          pwa_icon_192_url: data.pwa_icon_192_url ? `${data.pwa_icon_192_url}?t=${Date.now()}` : '',
          pwa_icon_512_url: data.pwa_icon_512_url ? `${data.pwa_icon_512_url}?t=${Date.now()}` : '',
          enable_install_prompt: data.enable_install_prompt !== false,
          show_install_button: (data as any).show_install_button !== false,
          cost_code_selection_timing: ((data as any).cost_code_selection_timing as 'punch_in' | 'punch_out') || 'punch_in'
        });
        console.log('PunchClockSettings: loaded settings', data);
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
      
      // Upsert punch clock settings for current company
      // Use null job_id for company-wide settings
      const { error } = await supabase
        .from('job_punch_clock_settings')
        .upsert({
          job_id: null, // null for company-wide settings
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
          pwa_icon_192_url: settings.pwa_icon_192_url,
          pwa_icon_512_url: settings.pwa_icon_512_url,
          enable_install_prompt: settings.enable_install_prompt,
          show_install_button: settings.show_install_button,
          cost_code_selection_timing: settings.cost_code_selection_timing,
          time_display_format: settings.time_display_format,
          shift_start_time: settings.shift_start_time,
          shift_end_time: settings.shift_end_time,
          shift_hours: settings.shift_hours,
          overtime_grace_period_minutes: settings.overtime_grace_period_minutes,
          created_by: user?.id
        } as any);

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
    return <div className="p-6 text-center">Loading punch clock settings...</div>;
  }

  if (!isManager) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">Only managers can access punch clock settings.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-7 w-7" />
            Punch Clock Settings
          </h1>
          <p className="text-muted-foreground">
            Configure time tracking rules and employee settings for {currentCompany?.display_name || currentCompany?.name || 'your company'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors">General Settings</TabsTrigger>
          <TabsTrigger value="employees" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors">Employee Settings</TabsTrigger>
          <TabsTrigger value="jobs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors">Job Settings</TabsTrigger>
          <TabsTrigger value="pwa" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors">Mobile App</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="flex justify-end mb-4">
            <Button onClick={saveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

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
                  <Label htmlFor="break-reminder">Break Reminder (minutes)</Label>
                  <Input
                    id="break-reminder"
                    type="number"
                    value={settings.break_reminder_minutes}
                    onChange={(e) => updateSetting('break_reminder_minutes', parseInt(e.target.value))}
                    min="120"
                    max="480"
                  />
                  <p className="text-xs text-muted-foreground">Remind employees to take breaks after this time</p>
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

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="location-accuracy">Location Accuracy (meters)</Label>
                <Select
                  value={settings.location_accuracy_meters.toString()}
                  onValueChange={(value) => updateSetting('location_accuracy_meters', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 meters (High accuracy)</SelectItem>
                    <SelectItem value="100">100 meters (Medium accuracy)</SelectItem>
                    <SelectItem value="200">200 meters (Low accuracy)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Maximum distance from job site for valid punch
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Distance Warnings</Label>
                  <p className="text-sm text-muted-foreground">
                    Flag time cards when punches are outside job site radius
                  </p>
                </div>
                <Switch
                  checked={settings.enable_distance_warnings}
                  onCheckedChange={(checked) => updateSetting('enable_distance_warnings', checked)}
                />
              </div>

              {settings.enable_distance_warnings && (
                <div className="space-y-2 ml-4 p-4 border rounded-lg bg-muted/50">
                  <Label htmlFor="max-distance-warning">Warning Distance (meters)</Label>
                  <Select
                    value={settings.max_distance_from_job_meters?.toString() || '200'}
                    onValueChange={(value) => updateSetting('max_distance_from_job_meters', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 meters</SelectItem>
                      <SelectItem value="200">200 meters</SelectItem>
                      <SelectItem value="300">300 meters</SelectItem>
                      <SelectItem value="500">500 meters</SelectItem>
                      <SelectItem value="1000">1000 meters</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Time cards will be flagged with a warning if punch locations are beyond this distance from the job site
                  </p>
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

              <Separator />

              {settings.require_photo && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Manual Photo Capture</Label>
                    <p className="text-sm text-muted-foreground">
                      Require employees to manually click button to take photo (with face detection)
                    </p>
                  </div>
                  <Switch
                    checked={settings.manual_photo_capture}
                    onCheckedChange={(checked) => updateSetting('manual_photo_capture', checked)}
                  />
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Photo Required for Corrections</Label>
                  <p className="text-sm text-muted-foreground">
                    Require photo when submitting time card corrections
                  </p>
                </div>
                <Switch
                  checked={settings.photo_required_for_corrections}
                  onCheckedChange={(checked) => updateSetting('photo_required_for_corrections', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Approval Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Approval & Corrections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cost Code Selection Timing</Label>
                <Select
                  value={settings.cost_code_selection_timing}
                  onValueChange={(value) => updateSetting('cost_code_selection_timing', value as 'punch_in' | 'punch_out')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="punch_in">Select at Punch In</SelectItem>
                    <SelectItem value="punch_out">Select at Punch Out</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  When set to "Punch Out", employees only select the job when punching in, and select their Daily Task (cost code) when punching out
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Manual Time Entry</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow employees to manually enter time (requires approval)
                  </p>
                </div>
                <Switch
                  checked={settings.allow_manual_entry}
                  onCheckedChange={(checked) => updateSetting('allow_manual_entry', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Manager Approval Required</Label>
                  <p className="text-sm text-muted-foreground">
                    All time entries require manager approval before processing
                  </p>
                </div>
                <Switch
                  checked={settings.manager_approval_required}
                  onCheckedChange={(checked) => updateSetting('manager_approval_required', checked)}
                />
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Card Processing Rules
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Completed punch cycles (in + out) are automatically logged</li>
                  <li>• Only time card corrections require approval</li>
                  <li>• Overtime calculations are applied automatically</li>
                  <li>• Break deductions are applied based on shift length</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Shift Time Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Shift Time Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Time Display Format</Label>
                <Select
                  value={settings.time_display_format}
                  onValueChange={(value) => updateSetting('time_display_format', value as 'hours_minutes' | 'decimal')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours_minutes">Hours and Minutes (e.g., 1h 15m)</SelectItem>
                    <SelectItem value="decimal">Decimal Hours (e.g., 1.25)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose how time is displayed throughout the app
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Shift Start Time</Label>
                  <Input
                    type="time"
                    value={settings.shift_start_time}
                    onChange={(e) => updateSetting('shift_start_time', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    When hours begin counting
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Shift End Time</Label>
                  <Input
                    type="time"
                    value={settings.shift_end_time}
                    onChange={(e) => updateSetting('shift_end_time', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Official end of shift
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Standard Shift Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="1"
                  max="16"
                  value={settings.shift_hours}
                  onChange={(e) => updateSetting('shift_hours', parseFloat(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Full shift duration (e.g., 8 hours). Employees punching in early will have hours capped at this value.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Overtime Grace Period (minutes)</Label>
                <Input
                  type="number"
                  step="5"
                  min="0"
                  max="60"
                  value={settings.overtime_grace_period_minutes}
                  onChange={(e) => updateSetting('overtime_grace_period_minutes', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Grace period before overtime starts counting after shift end time
                </p>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Example Calculation</h4>
                <p className="text-sm text-muted-foreground">
                  Shift: {settings.shift_start_time} - {settings.shift_end_time} ({settings.shift_hours} hours, automatic 30 min lunch)
                  <br />
                  If employee punches at 6:55 AM and out at 3:30 PM, they get {settings.shift_hours} hours (not including early arrival)
                  <br />
                  Overtime starts at {settings.overtime_grace_period_minutes} min after {settings.shift_end_time}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send notifications for punch reminders and approvals
                  </p>
                </div>
                <Switch
                  checked={settings.notification_enabled}
                  onCheckedChange={(checked) => updateSetting('notification_enabled', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Current Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Current Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <Badge variant={settings.require_location ? "default" : "secondary"}>
                    {settings.require_location ? "Location Required" : "Location Optional"}
                  </Badge>
                </div>
                <div className="text-center">
                  <Badge variant={settings.require_photo ? "default" : "secondary"}>
                    {settings.require_photo ? "Photo Required" : "Photo Optional"}
                  </Badge>
                </div>
                <div className="text-center">
                  <Badge variant="outline">
                    OT: {settings.overtime_threshold}h
                  </Badge>
                </div>
                <div className="text-center">
                  <Badge variant="outline">
                    Grace: {settings.grace_period_minutes}m
                  </Badge>
                </div>
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

        <TabsContent value="pwa" className="space-y-6">
          <div className="flex justify-end mb-4">
            <Button onClick={saveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Mobile Home Screen Installation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Add to Home Screen Feature</p>
                <p className="text-sm text-muted-foreground">
                  Enable employees to install the Punch Clock as a native app on their mobile devices. Upload custom icons to brand the app icon on their home screens.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Install Prompt</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically show prompt to install app after login
                  </p>
                </div>
                <Switch
                  checked={settings.enable_install_prompt}
                  onCheckedChange={(checked) => updateSetting('enable_install_prompt', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Install Button on Login Page</Label>
                  <p className="text-sm text-muted-foreground">
                    Display "Install App" button on the login page
                  </p>
                </div>
                <Switch
                  checked={settings.show_install_button}
                  onCheckedChange={(checked) => updateSetting('show_install_button', checked)}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Home Screen Icons</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload custom icons for the mobile home screen. Icons should be square PNG images.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="icon-192">Small Icon (192x192px)</Label>
                    <Input
                      id="icon-192"
                      type="file"
                      accept="image/png,image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && currentCompany) {
                          try {
                            // Force exact 192x192 PNG
                            const resized = await resizeImageToPng(file, 192);
                            const fileName = `${currentCompany.id}-192.png`;

                            const { error: uploadError } = await supabase.storage
                              .from('company-logos')
                              .upload(fileName, resized, { upsert: true, cacheControl: '3600', contentType: 'image/png' });

                            if (uploadError) {
                              toast({ title: 'Error', description: 'Failed to upload icon', variant: 'destructive' });
                              return;
                            }

                            const { data: { publicUrl } } = supabase.storage
                              .from('company-logos')
                              .getPublicUrl(fileName);

                            await supabase
                              .from('job_punch_clock_settings')
                              .upsert({ job_id: null, company_id: currentCompany.id, pwa_icon_192_url: publicUrl, created_by: user?.id });

                            const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
                            updateSetting('pwa_icon_192_url', urlWithTimestamp);
                            try { localStorage.setItem('pwa_icon_192_url', publicUrl); } catch {}

                            toast({ title: 'Success', description: '192x192 icon resized, uploaded and saved' });
                          } catch (err) {
                            console.error(err);
                            toast({ title: 'Error', description: 'Failed to process icon', variant: 'destructive' });
                          }
                        }
                      }}
                    />
                    {settings.pwa_icon_192_url && (
                      <div className="mt-2">
                        <img 
                          src={settings.pwa_icon_192_url} 
                          alt="192x192 icon preview" 
                          className="w-24 h-24 rounded-lg border object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="icon-512">Large Icon (512x512px)</Label>
                    <Input
                      id="icon-512"
                      type="file"
                      accept="image/png,image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && currentCompany) {
                          try {
                            // Force exact 512x512 PNG
                            const resized = await resizeImageToPng(file, 512);
                            const fileName = `${currentCompany.id}-512.png`;

                            const { error: uploadError } = await supabase.storage
                              .from('company-logos')
                              .upload(fileName, resized, { upsert: true, cacheControl: '3600', contentType: 'image/png' });

                            if (uploadError) {
                              toast({ title: 'Error', description: 'Failed to upload icon', variant: 'destructive' });
                              return;
                            }

                            const { data: { publicUrl } } = supabase.storage
                              .from('company-logos')
                              .getPublicUrl(fileName);

                            await supabase
                              .from('job_punch_clock_settings')
                              .upsert({ job_id: null, company_id: currentCompany.id, pwa_icon_512_url: publicUrl, created_by: user?.id });

                            const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
                            updateSetting('pwa_icon_512_url', urlWithTimestamp);
                            try { localStorage.setItem('pwa_icon_512_url', publicUrl); } catch {}

                            toast({ title: 'Success', description: '512x512 icon resized, uploaded and saved' });
                          } catch (err) {
                            console.error(err);
                            toast({ title: 'Error', description: 'Failed to process icon', variant: 'destructive' });
                          }
                        }
                      }}
                    />
                    {settings.pwa_icon_512_url && (
                      <div className="mt-2">
                        <img 
                          src={settings.pwa_icon_512_url} 
                          alt="512x512 icon preview" 
                          className="w-24 h-24 rounded-lg border object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}