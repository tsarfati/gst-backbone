import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Building2, Clock, Save, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { supabase } from '@/integrations/supabase/client';
import { JobShiftTimeSettings } from '@/components/JobShiftTimeSettings';
import { formatDistanceLabel } from '@/lib/distanceUnits';

interface Job { id: string; name: string }

type RoundingDirection = 'up' | 'down' | 'nearest';

interface JobSettings {
  job_id: string;
  punch_time_window_start?: string;
  punch_time_window_end?: string;
  earliest_punch_start_time?: string;
  latest_punch_in_time?: string;
  enable_punch_rounding: boolean;
  punch_rounding_minutes: number;
  punch_rounding_direction: RoundingDirection;
  require_location: boolean;
  require_photo: boolean;
  location_accuracy_meters: number;
  auto_break_duration: number;
  auto_break_wait_hours: number;
  overtime_threshold: number;
  calculate_overtime: boolean;
  grace_period_minutes: number;
  notification_enabled: boolean;
  manager_approval_required: boolean;
  allow_manual_entry: boolean;
  enable_distance_warning: boolean;
  max_distance_from_job_meters: number;
  allow_early_punch_in: boolean;
  scheduled_start_time?: string;
  early_punch_in_buffer_minutes: number;
  require_timecard_change_approval: boolean;
  overtime_past_window_threshold_minutes: number;
}

const defaultJobSettings: JobSettings = {
  job_id: '',
  punch_time_window_start: '06:00',
  punch_time_window_end: '22:00',
  earliest_punch_start_time: '05:30',
  latest_punch_in_time: '10:00',
  enable_punch_rounding: false,
  punch_rounding_minutes: 15,
  punch_rounding_direction: 'nearest',
  require_location: true,
  require_photo: true,
  location_accuracy_meters: 100,
  auto_break_duration: 30,
  auto_break_wait_hours: 6,
  overtime_threshold: 8,
  calculate_overtime: true,
  grace_period_minutes: 5,
  notification_enabled: true,
  manager_approval_required: false,
  allow_manual_entry: false,
  enable_distance_warning: true,
  max_distance_from_job_meters: 500,
  allow_early_punch_in: false,
  scheduled_start_time: '08:00',
  early_punch_in_buffer_minutes: 15,
  require_timecard_change_approval: false,
  overtime_past_window_threshold_minutes: 30,
};

export default function JobPunchClockSettings() {
  const { profile, user } = useAuth();
  const { currentCompany } = useCompany();
  const { settings: appSettings } = useSettings();
  const activeCompanyRole = useActiveCompanyRole();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [settings, setSettings] = useState<JobSettings>(defaultJobSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const distanceUnit = appSettings.distanceUnit ?? 'meters';

  // Use active company role first, fallback to profile.role for backward compatibility
  const effectiveRole = activeCompanyRole || profile?.role;
  const isManager = effectiveRole === 'admin' || effectiveRole === 'controller' || effectiveRole === 'project_manager';

  useEffect(() => {
    if (currentCompany) {
      loadJobs();
    }
  }, [currentCompany]);

  useEffect(() => {
    if (selectedJobId) {
      void loadJobSettings(selectedJobId);
    }
  }, [selectedJobId]);

  const loadJobs = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .order('name');
      if (error) throw error;
      setJobs(data || []);
    } catch (e) {
      console.error('Failed to load jobs', e);
      toast({ title: 'Error', description: 'Failed to load jobs', variant: 'destructive' });
    }
  };

  const loadJobSettings = async (jobId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_punch_clock_settings')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSettings({
          job_id: jobId,
          punch_time_window_start: data.punch_time_window_start || '06:00',
          punch_time_window_end: data.punch_time_window_end || '22:00',
          earliest_punch_start_time: data.earliest_punch_start_time || '05:30',
          latest_punch_in_time: data.latest_punch_in_time || '10:00',
          enable_punch_rounding: !!data.enable_punch_rounding,
          punch_rounding_minutes: data.punch_rounding_minutes || 15,
          punch_rounding_direction: (data.punch_rounding_direction as RoundingDirection) || 'nearest',
          require_location: !!data.require_location,
          require_photo: !!data.require_photo,
          location_accuracy_meters: data.location_accuracy_meters || 100,
          auto_break_duration: data.auto_break_duration || 30,
          auto_break_wait_hours: parseFloat(data.auto_break_wait_hours?.toString() || '6'),
          overtime_threshold: parseFloat(data.overtime_threshold?.toString() || '8'),
          calculate_overtime: data.calculate_overtime !== false,
          grace_period_minutes: data.grace_period_minutes || 5,
          notification_enabled: data.notification_enabled !== false,
          manager_approval_required: !!data.manager_approval_required,
          allow_manual_entry: !!data.allow_manual_entry,
          enable_distance_warning: data.enable_distance_warning !== false,
          max_distance_from_job_meters: data.max_distance_from_job_meters || 500,
          allow_early_punch_in: !!data.allow_early_punch_in,
          scheduled_start_time: data.scheduled_start_time || '08:00',
          early_punch_in_buffer_minutes: data.early_punch_in_buffer_minutes || 15,
          require_timecard_change_approval: !!data.require_timecard_change_approval,
          overtime_past_window_threshold_minutes: data.overtime_past_window_threshold_minutes ?? 30,
        });
      } else {
        setSettings({ ...defaultJobSettings, job_id: jobId });
      }
    } catch (e) {
      console.error('Failed to load job settings', e);
      toast({ title: 'Error', description: 'Failed to load job settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const saveJobSettings = async () => {
    if (!selectedJobId) return;
    try {
      setSaving(true);
      const payload = {
        job_id: selectedJobId,
        company_id: profile?.current_company_id || user?.id,
        punch_time_window_start: settings.punch_time_window_start,
        punch_time_window_end: settings.punch_time_window_end,
        earliest_punch_start_time: settings.earliest_punch_start_time,
        latest_punch_in_time: settings.latest_punch_in_time,
        enable_punch_rounding: settings.enable_punch_rounding,
        punch_rounding_minutes: settings.punch_rounding_minutes,
        punch_rounding_direction: settings.punch_rounding_direction,
        require_location: settings.require_location,
        require_photo: settings.require_photo,
        location_accuracy_meters: settings.location_accuracy_meters,
        auto_break_duration: settings.auto_break_duration,
        auto_break_wait_hours: settings.auto_break_wait_hours,
        overtime_threshold: settings.overtime_threshold,
        calculate_overtime: settings.calculate_overtime,
        grace_period_minutes: settings.grace_period_minutes,
        notification_enabled: settings.notification_enabled,
        manager_approval_required: settings.manager_approval_required,
        allow_manual_entry: settings.allow_manual_entry,
        allow_early_punch_in: settings.allow_early_punch_in,
        scheduled_start_time: settings.scheduled_start_time,
        early_punch_in_buffer_minutes: settings.early_punch_in_buffer_minutes,
        require_timecard_change_approval: settings.require_timecard_change_approval,
        overtime_past_window_threshold_minutes: settings.overtime_past_window_threshold_minutes,
        created_by: profile?.user_id || user?.id,
      };

      const { error } = await supabase
        .from('job_punch_clock_settings')
        .upsert(payload, { onConflict: 'job_id' });
      if (error) throw error;
      toast({ title: 'Saved', description: 'Job punch clock settings saved.' });
    } catch (e) {
      console.error('Failed to save job settings', e);
      toast({ title: 'Error', description: 'Failed to save job settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!isManager) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-muted-foreground">Only managers can manage job settings.</div>
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Select Job
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Job</Label>
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a job to configure overrides" />
            </SelectTrigger>
            <SelectContent>
              {jobs.filter((j) => j.id && j.id.trim()).map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedJobId && <JobShiftTimeSettings jobId={selectedJobId} />}

      {selectedJobId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Job Time Rules (override general)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {loading ? (
              <div className="text-muted-foreground">Loading job settings...</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Earliest Punch Start</Label>
                    <Input type="time" value={settings.earliest_punch_start_time} onChange={(e) => setSettings(s => ({...s, earliest_punch_start_time: e.target.value}))} />
                    <p className="text-xs text-muted-foreground">
                      Earliest time allowed for the first punch-in of the day
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Latest Punch In</Label>
                    <Input type="time" value={settings.latest_punch_in_time} onChange={(e) => setSettings(s => ({...s, latest_punch_in_time: e.target.value}))} />
                    <p className="text-xs text-muted-foreground">
                      Latest time allowed to punch in without being marked late
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Punch Window Start</Label>
                    <Input type="time" value={settings.punch_time_window_start} onChange={(e) => setSettings(s => ({...s, punch_time_window_start: e.target.value}))} />
                    <p className="text-xs text-muted-foreground">
                      Earliest time employees can punch in each day (blocks punches before this time)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Punch Window End</Label>
                    <Input type="time" value={settings.punch_time_window_end} onChange={(e) => setSettings(s => ({...s, punch_time_window_end: e.target.value}))} />
                    <p className="text-xs text-muted-foreground">
                      Latest time employees can punch out each day (blocks punches after this time)
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Early Punch In</Label>
                    <p className="text-sm text-muted-foreground">Employees can punch in early, but time starts at scheduled time</p>
                  </div>
                  <Switch checked={settings.allow_early_punch_in} onCheckedChange={(checked) => setSettings(s => ({...s, allow_early_punch_in: checked}))} />
                </div>

                {settings.allow_early_punch_in && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-4 p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-2">
                      <Label>Scheduled Start Time</Label>
                      <Input type="time" value={settings.scheduled_start_time} onChange={(e) => setSettings(s => ({...s, scheduled_start_time: e.target.value}))} />
                      <p className="text-xs text-muted-foreground">Actual paid time will begin at this time</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Early Punch Buffer (minutes)</Label>
                      <Input type="number" value={settings.early_punch_in_buffer_minutes} onChange={(e) => setSettings(s => ({...s, early_punch_in_buffer_minutes: parseInt(e.target.value)}))} min={5} max={60} />
                      <p className="text-xs text-muted-foreground">Maximum minutes employees can punch in before start time</p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Punch Rounding</Label>
                    <p className="text-sm text-muted-foreground">Round punch times for this job</p>
                  </div>
                  <Switch checked={settings.enable_punch_rounding} onCheckedChange={(checked) => setSettings(s => ({...s, enable_punch_rounding: checked}))} />
                </div>

                {settings.enable_punch_rounding && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-4 p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-2">
                      <Label>Rounding Interval (minutes)</Label>
                      <Select value={settings.punch_rounding_minutes.toString()} onValueChange={(v) => setSettings(s => ({...s, punch_rounding_minutes: parseInt(v)}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="10">10 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rounding Direction</Label>
                      <Select value={settings.punch_rounding_direction} onValueChange={(v) => setSettings(s => ({...s, punch_rounding_direction: v as RoundingDirection}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="up">Round Up</SelectItem>
                          <SelectItem value="down">Round Down</SelectItem>
                          <SelectItem value="nearest">Nearest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location Accuracy ({distanceUnit === 'feet' ? 'ft' : 'm'})</Label>
                    <Select value={settings.location_accuracy_meters.toString()} onValueChange={(v) => setSettings(s => ({...s, location_accuracy_meters: parseInt(v)}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="50">{formatDistanceLabel(50, distanceUnit)} (High)</SelectItem>
                          <SelectItem value="100">{formatDistanceLabel(100, distanceUnit)} (Medium)</SelectItem>
                          <SelectItem value="200">{formatDistanceLabel(200, distanceUnit)} (Low)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Auto Break Duration (min)</Label>
                    <Input type="number" value={settings.auto_break_duration} onChange={(e) => setSettings(s => ({...s, auto_break_duration: parseInt(e.target.value)}))} min={15} max={60} />
                  </div>
                  <div className="space-y-2">
                    <Label>Auto Break Wait (hours)</Label>
                    <Input type="number" value={settings.auto_break_wait_hours} onChange={(e) => setSettings(s => ({...s, auto_break_wait_hours: parseFloat(e.target.value)}))} step={0.5} min={4} max={8} />
                  </div>
                  <div className="space-y-2">
                    <Label>Overtime Threshold (hours)</Label>
                    <Input type="number" value={settings.overtime_threshold} onChange={(e) => setSettings(s => ({...s, overtime_threshold: parseFloat(e.target.value)}))} step={0.5} min={6} max={12} />
                  </div>
                  <div className="space-y-2">
                    <Label>Grace Period (minutes)</Label>
                    <Input type="number" value={settings.grace_period_minutes} onChange={(e) => setSettings(s => ({...s, grace_period_minutes: parseInt(e.target.value)}))} min={0} max={15} />
                  </div>
                  <div className="space-y-2">
                    <Label>Punch Out Grace Period (min)</Label>
                    <Input type="number" value={settings.overtime_past_window_threshold_minutes} onChange={(e) => setSettings(s => ({...s, overtime_past_window_threshold_minutes: parseInt(e.target.value)}))} min={0} max={120} />
                    <p className="text-xs text-muted-foreground">Grace period past punch window end to count time past window</p>
                    <p className="text-xs text-muted-foreground">Minutes past window end before all subsequent time is OT</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require Location</Label>
                      <p className="text-sm text-muted-foreground">Required when punching</p>
                    </div>
                    <Switch checked={settings.require_location} onCheckedChange={(checked) => setSettings(s => ({...s, require_location: checked}))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require Photo</Label>
                      <p className="text-sm text-muted-foreground">Photo captured on punch</p>
                    </div>
                    <Switch checked={settings.require_photo} onCheckedChange={(checked) => setSettings(s => ({...s, require_photo: checked}))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Calculate Overtime</Label>
                      <p className="text-sm text-muted-foreground">Enable OT for this job</p>
                    </div>
                    <Switch checked={settings.calculate_overtime} onCheckedChange={(checked) => setSettings(s => ({...s, calculate_overtime: checked}))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Manager Approval Required</Label>
                      <p className="text-sm text-muted-foreground">Manual review on punches</p>
                    </div>
                    <Switch checked={settings.manager_approval_required} onCheckedChange={(checked) => setSettings(s => ({...s, manager_approval_required: checked}))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Manual Entry</Label>
                      <p className="text-sm text-muted-foreground">Permit manual time entries</p>
                    </div>
                    <Switch checked={settings.allow_manual_entry} onCheckedChange={(checked) => setSettings(s => ({...s, allow_manual_entry: checked}))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require Approval for Time Card Changes</Label>
                      <p className="text-sm text-muted-foreground">Employee time card change requests need manager approval</p>
                    </div>
                    <Switch checked={settings.require_timecard_change_approval} onCheckedChange={(checked) => setSettings(s => ({...s, require_timecard_change_approval: checked}))} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Enable Distance Warnings
                      </Label>
                      <p className="text-sm text-muted-foreground">Show warning if punch location is far from job site</p>
                    </div>
                    <Switch checked={settings.enable_distance_warning} onCheckedChange={(checked) => setSettings(s => ({...s, enable_distance_warning: checked}))} />
                  </div>

                  {settings.enable_distance_warning && (
                    <div className="ml-4 space-y-2">
                      <Label>Maximum Distance from Job ({distanceUnit === 'feet' ? 'feet' : 'meters'})</Label>
                      <Select value={settings.max_distance_from_job_meters.toString()} onValueChange={(v) => setSettings(s => ({...s, max_distance_from_job_meters: parseInt(v)}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">{formatDistanceLabel(100, distanceUnit)} (Very Close)</SelectItem>
                          <SelectItem value="200">{formatDistanceLabel(200, distanceUnit)} (Close)</SelectItem>
                          <SelectItem value="500">{formatDistanceLabel(500, distanceUnit)} (Medium)</SelectItem>
                          <SelectItem value="1000">{formatDistanceLabel(1000, distanceUnit)} (Far)</SelectItem>
                          <SelectItem value="2000">{formatDistanceLabel(2000, distanceUnit)} (Very Far)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Punches beyond this distance will show a warning badge on time cards
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5" />
          Job settings override general rules when set. Unset values fall back to general settings.
        </CardContent>
      </Card>
    </div>
  );
}
