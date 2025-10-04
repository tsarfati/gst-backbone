import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, Clock, MapPin, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface AutoLogoutSettings {
  id?: string;
  job_id: string;
  company_id: string;
  auto_logout_enabled: boolean;
  auto_logout_hours: number;
  geolocation_logout_enabled: boolean;
  geolocation_distance_meters: number;
  sms_check_enabled: boolean;
  sms_check_interval_hours: number;
}

interface VisitorLogSettingsEnhancedProps {
  jobId: string;
}

export function VisitorLogSettingsEnhanced({ jobId }: VisitorLogSettingsEnhancedProps) {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<AutoLogoutSettings>({
    job_id: jobId,
    company_id: currentCompany?.id || '',
    auto_logout_enabled: false,
    auto_logout_hours: 8,
    geolocation_logout_enabled: false,
    geolocation_distance_meters: 500,
    sms_check_enabled: false,
    sms_check_interval_hours: 4,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentCompany?.id && jobId) {
      loadSettings();
    }
  }, [currentCompany?.id, jobId]);

  const loadSettings = async () => {
    if (!currentCompany?.id || !jobId) return;

    try {
      const { data, error } = await supabase
        .from('visitor_auto_logout_settings')
        .select('*')
        .eq('job_id', jobId)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      } else {
        setSettings(prev => ({ 
          ...prev, 
          job_id: jobId,
          company_id: currentCompany.id 
        }));
      }
    } catch (error) {
      console.error('Error loading auto-logout settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentCompany?.id || !jobId) return;

    setSaving(true);
    try {
      const settingsData = {
        ...settings,
        job_id: jobId,
        company_id: currentCompany.id,
      };

      const { error } = await supabase
        .from('visitor_auto_logout_settings')
        .upsert([settingsData], { 
          onConflict: 'job_id,company_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Auto-logout settings have been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving auto-logout settings:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Visitor Auto-Logout Settings</h2>
          <p className="text-muted-foreground">
            Configure automatic check-out rules for visitors
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Settings className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Time-Based Auto Logout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Time-Based Auto Logout</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Auto Logout</Label>
              <p className="text-sm text-muted-foreground">
                Automatically check out visitors after a set time period
              </p>
            </div>
            <Switch
              checked={settings.auto_logout_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, auto_logout_enabled: checked }))
              }
            />
          </div>

          {settings.auto_logout_enabled && (
            <div className="space-y-2">
              <Label htmlFor="auto-logout-hours">Auto Logout After (hours)</Label>
              <Input
                id="auto-logout-hours"
                type="number"
                min="1"
                max="24"
                value={settings.auto_logout_hours}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  auto_logout_hours: parseInt(e.target.value) || 8 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Visitors will be automatically checked out after this many hours
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Geolocation-Based Auto Logout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Geolocation-Based Auto Logout</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Geolocation Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Check out visitors when they leave the job site area
              </p>
            </div>
            <Switch
              checked={settings.geolocation_logout_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, geolocation_logout_enabled: checked }))
              }
            />
          </div>

          {settings.geolocation_logout_enabled && (
            <div className="space-y-2">
              <Label htmlFor="distance-meters">Distance Threshold (meters)</Label>
              <Input
                id="distance-meters"
                type="number"
                min="100"
                max="5000"
                step="50"
                value={settings.geolocation_distance_meters}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  geolocation_distance_meters: parseInt(e.target.value) || 500 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Auto check-out when visitor moves beyond this distance from the job site
              </p>
            </div>
          )}

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Geolocation tracking requires visitors to grant location 
              permissions on their device. Tracking updates every few minutes while they're on site.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SMS Check-In Reminder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>SMS Check-In Reminder</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable SMS Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Send text messages asking if visitor is still on site
              </p>
            </div>
            <Switch
              checked={settings.sms_check_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, sms_check_enabled: checked }))
              }
            />
          </div>

          {settings.sms_check_enabled && (
            <div className="space-y-2">
              <Label htmlFor="sms-interval">Check Interval (hours)</Label>
              <Input
                id="sms-interval"
                type="number"
                min="1"
                max="12"
                value={settings.sms_check_interval_hours}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  sms_check_interval_hours: parseInt(e.target.value) || 4 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                How often to send SMS reminders to visitors still checked in
              </p>
            </div>
          )}

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>SMS Message:</strong> Visitors will receive a text asking "Are you still at 
              [Job Name]? Reply YES if still on site, or NO if you've left." Replying NO will 
              automatically check them out.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
