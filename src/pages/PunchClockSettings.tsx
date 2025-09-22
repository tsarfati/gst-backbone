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
import { Settings, Clock, MapPin, Camera, Save, Bell, Shield, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import EmployeeTimecardSettings from '@/components/EmployeeTimecardSettings';

interface PunchClockSettings {
  require_location: boolean;
  require_photo: boolean;
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
}

const defaultSettings: PunchClockSettings = {
  require_location: true,
  require_photo: true,
  allow_manual_entry: false,
  auto_break_duration: 30,
  overtime_threshold: 8,
  location_accuracy_meters: 100,
  photo_required_for_corrections: true,
  notification_enabled: true,
  manager_approval_required: false,
  grace_period_minutes: 5,
  allowed_job_sites: [],
  break_reminder_minutes: 240
};

export default function PunchClockSettings() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<PunchClockSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load punch clock settings from database
      const { data, error } = await supabase
        .from('punch_clock_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      if (data) {
        setSettings({
          require_location: data.require_location,
          require_photo: data.require_photo,
          allow_manual_entry: data.allow_manual_entry,
          auto_break_duration: data.auto_break_duration,
          overtime_threshold: parseFloat(data.overtime_threshold.toString()),
          location_accuracy_meters: data.location_accuracy_meters,
          photo_required_for_corrections: data.photo_required_for_corrections,
          notification_enabled: data.notification_enabled,
          manager_approval_required: data.manager_approval_required,
          grace_period_minutes: data.grace_period_minutes,
          allowed_job_sites: [],
          break_reminder_minutes: data.break_reminder_minutes
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
    try {
      setSaving(true);
      
      // Upsert punch clock settings
      const { error } = await supabase
        .from('punch_clock_settings')
        .upsert({
          company_id: profile?.current_company_id || user?.id, // Use company_id when available
          require_location: settings.require_location,
          require_photo: settings.require_photo,
          allow_manual_entry: settings.allow_manual_entry,
          auto_break_duration: settings.auto_break_duration,
          overtime_threshold: settings.overtime_threshold,
          location_accuracy_meters: settings.location_accuracy_meters,
          photo_required_for_corrections: settings.photo_required_for_corrections,
          notification_enabled: settings.notification_enabled,
          manager_approval_required: settings.manager_approval_required,
          grace_period_minutes: settings.grace_period_minutes,
          break_reminder_minutes: settings.break_reminder_minutes
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
            Configure time tracking rules and employee settings
          </p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="employees">Employee Settings</TabsTrigger>
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

          {/* Notification Settings */}
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
      </Tabs>
    </div>
  );
}