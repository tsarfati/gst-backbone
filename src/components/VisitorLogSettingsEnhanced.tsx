import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Clock, MapPin, MessageSquare, Palette, Image, X, Upload, Eye } from 'lucide-react';
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

interface VisitorLoginSettings {
  id?: string;
  company_id: string;
  background_image_url?: string;
  header_logo_url?: string;
  primary_color: string;
  button_color: string;
  confirmation_title: string;
  confirmation_message: string;
  require_company_name: boolean;
  require_purpose_visit: boolean;
  enable_checkout: boolean;
}

interface VisitorLogSettingsEnhancedProps {
  jobId: string;
}

export function VisitorLogSettingsEnhanced({ jobId }: VisitorLogSettingsEnhancedProps) {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [autoLogoutSettings, setAutoLogoutSettings] = useState<AutoLogoutSettings>({
    job_id: jobId,
    company_id: currentCompany?.id || '',
    auto_logout_enabled: false,
    auto_logout_hours: 8,
    geolocation_logout_enabled: false,
    geolocation_distance_meters: 500,
    sms_check_enabled: false,
    sms_check_interval_hours: 4,
  });

  const [loginSettings, setLoginSettings] = useState<VisitorLoginSettings>({
    company_id: currentCompany?.id || '',
    primary_color: '#3b82f6',
    button_color: '#10b981',
    confirmation_title: 'Welcome to the Job Site!',
    confirmation_message: 'Thank you for checking in. Please follow all safety protocols.',
    require_company_name: true,
    require_purpose_visit: false,
    enable_checkout: true,
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
      // Load auto-logout settings
      const { data: autoData, error: autoError } = await supabase
        .from('visitor_auto_logout_settings')
        .select('*')
        .eq('job_id', jobId)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (autoError && autoError.code !== 'PGRST116') {
        throw autoError;
      }

      if (autoData) {
        setAutoLogoutSettings(autoData);
      } else {
        setAutoLogoutSettings(prev => ({ 
          ...prev, 
          job_id: jobId,
          company_id: currentCompany.id 
        }));
      }

      // Load visitor login settings
      const { data: loginData, error: loginError } = await supabase
        .from('visitor_login_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (loginError && loginError.code !== 'PGRST116') {
        throw loginError;
      }

      if (loginData) {
        setLoginSettings(loginData);
      } else {
        setLoginSettings(prev => ({ ...prev, company_id: currentCompany.id }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File, type: 'background' | 'header') => {
    if (!currentCompany?.id) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      setLoginSettings(prev => ({
        ...prev,
        [type === 'background' ? 'background_image_url' : 'header_logo_url']: publicUrl
      }));

      toast({
        title: "Upload Successful",
        description: `${type === 'background' ? 'Background image' : 'Header logo'} uploaded successfully.`,
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveImage = (type: 'background' | 'header') => {
    setLoginSettings(prev => ({
      ...prev,
      [type === 'background' ? 'background_image_url' : 'header_logo_url']: undefined
    }));
  };

  const handleSave = async () => {
    if (!currentCompany?.id || !jobId) return;

    setSaving(true);
    try {
      // Save auto-logout settings
      const autoSettingsData = {
        ...autoLogoutSettings,
        job_id: jobId,
        company_id: currentCompany.id,
      };

      const { error: autoError } = await supabase
        .from('visitor_auto_logout_settings')
        .upsert([autoSettingsData], { 
          onConflict: 'job_id,company_id',
          ignoreDuplicates: false 
        });

      if (autoError) throw autoError;

      // Save visitor login settings
      const loginSettingsData = {
        ...loginSettings,
        company_id: currentCompany.id,
        created_by: currentCompany.id, // Using company_id as created_by
      };

      const { error: loginError } = await supabase
        .from('visitor_login_settings')
        .upsert([loginSettingsData], { 
          onConflict: 'company_id',
          ignoreDuplicates: false 
        });

      if (loginError) throw loginError;

      toast({
        title: "Settings Saved",
        description: "All visitor settings have been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
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
          <h2 className="text-2xl font-semibold">Visitor Log Settings</h2>
          <p className="text-muted-foreground">
            Configure visitor login appearance and auto-logout rules
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Settings className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>

      {/* Visual Customization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>Visitor Login Appearance</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Header Logo */}
            <div className="space-y-2">
              <Label>Header Logo</Label>
              {loginSettings.header_logo_url ? (
                <div className="relative inline-block">
                  <img 
                    src={loginSettings.header_logo_url} 
                    alt="Header Logo" 
                    className="h-16 object-contain border rounded p-2"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => handleRemoveImage('header')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                    <div className="mt-2">
                      <Label htmlFor="header-logo" className="cursor-pointer text-primary hover:underline">
                        Upload Header Logo
                      </Label>
                      <Input
                        id="header-logo"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, 'header');
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Background Image */}
            <div className="space-y-2">
              <Label>Background Image</Label>
              {loginSettings.background_image_url ? (
                <div className="relative inline-block">
                  <img 
                    src={loginSettings.background_image_url} 
                    alt="Background" 
                    className="h-24 w-32 object-cover border rounded"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => handleRemoveImage('background')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                  <div className="text-center">
                    <Image className="mx-auto h-8 w-8 text-muted-foreground" />
                    <div className="mt-2">
                      <Label htmlFor="background-image" className="cursor-pointer text-primary hover:underline">
                        Upload Background Image
                      </Label>
                      <Input
                        id="background-image"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, 'background');
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Color Customization */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex space-x-2">
                <Input
                  id="primary-color"
                  type="color"
                  value={loginSettings.primary_color}
                  onChange={(e) => setLoginSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="w-16 h-10 p-1 border-none"
                />
                <Input
                  value={loginSettings.primary_color}
                  onChange={(e) => setLoginSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="button-color">Button Color</Label>
              <div className="flex space-x-2">
                <Input
                  id="button-color"
                  type="color"
                  value={loginSettings.button_color}
                  onChange={(e) => setLoginSettings(prev => ({ ...prev, button_color: e.target.value }))}
                  className="w-16 h-10 p-1 border-none"
                />
                <Input
                  value={loginSettings.button_color}
                  onChange={(e) => setLoginSettings(prev => ({ ...prev, button_color: e.target.value }))}
                  placeholder="#10b981"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Form Settings */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Form Requirements</Label>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Company Name</Label>
                <p className="text-sm text-muted-foreground">
                  Visitors must enter their company name
                </p>
              </div>
              <Switch
                checked={loginSettings.require_company_name}
                onCheckedChange={(checked) => 
                  setLoginSettings(prev => ({ ...prev, require_company_name: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Purpose of Visit</Label>
                <p className="text-sm text-muted-foreground">
                  Visitors must specify their purpose
                </p>
              </div>
              <Switch
                checked={loginSettings.require_purpose_visit}
                onCheckedChange={(checked) => 
                  setLoginSettings(prev => ({ ...prev, require_purpose_visit: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Checkout</Label>
                <p className="text-sm text-muted-foreground">
                  Allow visitors to check out when leaving
                </p>
              </div>
              <Switch
                checked={loginSettings.enable_checkout}
                onCheckedChange={(checked) => 
                  setLoginSettings(prev => ({ ...prev, enable_checkout: checked }))
                }
              />
            </div>
          </div>

          <Separator />

          {/* Confirmation Message */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Confirmation Screen</Label>
            
            <div className="space-y-2">
              <Label htmlFor="confirmation-title">Title</Label>
              <Input
                id="confirmation-title"
                value={loginSettings.confirmation_title}
                onChange={(e) => setLoginSettings(prev => ({ ...prev, confirmation_title: e.target.value }))}
                placeholder="Welcome to the Job Site!"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmation-message">Message</Label>
              <Textarea
                id="confirmation-message"
                value={loginSettings.confirmation_message}
                onChange={(e) => setLoginSettings(prev => ({ ...prev, confirmation_message: e.target.value }))}
                placeholder="Thank you for checking in. Please follow all safety protocols."
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
              checked={autoLogoutSettings.auto_logout_enabled}
              onCheckedChange={(checked) => 
                setAutoLogoutSettings(prev => ({ ...prev, auto_logout_enabled: checked }))
              }
            />
          </div>

          {autoLogoutSettings.auto_logout_enabled && (
            <div className="space-y-2">
              <Label htmlFor="auto-logout-hours">Auto Logout After (hours)</Label>
              <Input
                id="auto-logout-hours"
                type="number"
                min="1"
                max="24"
                value={autoLogoutSettings.auto_logout_hours}
                onChange={(e) => setAutoLogoutSettings(prev => ({ 
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
              checked={autoLogoutSettings.geolocation_logout_enabled}
              onCheckedChange={(checked) => 
                setAutoLogoutSettings(prev => ({ ...prev, geolocation_logout_enabled: checked }))
              }
            />
          </div>

          {autoLogoutSettings.geolocation_logout_enabled && (
            <div className="space-y-2">
              <Label htmlFor="distance-meters">Distance Threshold (meters)</Label>
              <Input
                id="distance-meters"
                type="number"
                min="100"
                max="5000"
                step="50"
                value={autoLogoutSettings.geolocation_distance_meters}
                onChange={(e) => setAutoLogoutSettings(prev => ({ 
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
              checked={autoLogoutSettings.sms_check_enabled}
              onCheckedChange={(checked) => 
                setAutoLogoutSettings(prev => ({ ...prev, sms_check_enabled: checked }))
              }
            />
          </div>

          {autoLogoutSettings.sms_check_enabled && (
            <div className="space-y-2">
              <Label htmlFor="sms-interval">Check Interval (hours)</Label>
              <Input
                id="sms-interval"
                type="number"
                min="1"
                max="12"
                value={autoLogoutSettings.sms_check_interval_hours}
                onChange={(e) => setAutoLogoutSettings(prev => ({ 
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
