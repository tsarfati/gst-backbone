import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Settings, MapPin, MessageSquare, Palette, X, Upload, Eye, Image as ImageIcon2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QrCode, Settings as SettingsIcon, Clock } from 'lucide-react';
import { JobQRCode } from '@/components/JobQRCode';
import DragDropUpload from '@/components/DragDropUpload';
import { formatDistanceLabel } from '@/lib/distanceUnits';

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
  send_sms_on_checkin: boolean;
  sms_message_template: string;
  sms_reminder_enabled?: boolean;
  sms_reminder_hours?: number;
  sms_reminder_message?: string;
}

interface VisitorLoginSettings {
  id?: string;
  company_id: string;
  background_image_url?: string;
  background_color?: string;
  header_logo_url?: string;
  primary_color: string;
  button_color: string;
  text_color?: string;
  require_company_name: boolean;
  require_purpose_visit: boolean;
  enable_checkout: boolean;
  theme: 'light' | 'dark';
  require_photo: boolean;
}

interface JobVisitorSettings {
  id?: string;
  job_id: string;
  company_id: string;
  confirmation_title: string;
  confirmation_message: string;
  checkout_title: string;
  checkout_message: string;
  checkout_show_duration: boolean;
}

interface VisitorLogSettingsEnhancedProps {
  jobId: string;
}

export function VisitorLogSettingsEnhanced({ jobId }: VisitorLogSettingsEnhancedProps) {
  const { currentCompany } = useCompany();
  const { settings: appSettings } = useSettings();
  const { toast } = useToast();
  const distanceUnit = appSettings.distanceUnit ?? 'meters';
  
  const [autoLogoutSettings, setAutoLogoutSettings] = useState<AutoLogoutSettings>({
    job_id: jobId,
    company_id: currentCompany?.id || '',
    auto_logout_enabled: false,
    auto_logout_hours: 8,
    geolocation_logout_enabled: false,
    geolocation_distance_meters: 500,
    sms_check_enabled: false,
    sms_check_interval_hours: 4,
    send_sms_on_checkin: false,
    sms_message_template: 'Thanks for checking in at {{job_name}} on {{date_time}}. When you leave, tap here to check out: {{checkout_link}}',
    sms_reminder_enabled: false,
    sms_reminder_hours: 4,
    sms_reminder_message: 'You are still checked in at {{job_name}}. If you have left, please check out here: {{checkout_link}}',
  });

  const [loginSettings, setLoginSettings] = useState<VisitorLoginSettings>({
    company_id: currentCompany?.id || '',
    background_color: '#3b82f6',
    primary_color: '#3b82f6',
    button_color: '#10b981',
    text_color: '#000000',
    require_company_name: true,
    require_purpose_visit: false,
    enable_checkout: true,
    theme: 'light',
    require_photo: false,
  });

  const [jobVisitorSettings, setJobVisitorSettings] = useState<JobVisitorSettings>({
    job_id: jobId,
    company_id: currentCompany?.id || '',
    confirmation_title: 'Welcome to the Job Site!',
    confirmation_message: 'Thank you for checking in. Please follow all safety protocols.',
    checkout_title: 'Successfully Checked Out',
    checkout_message: 'Thank you for visiting. Have a safe trip!',
    checkout_show_duration: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    if (currentCompany?.id && jobId) {
      loadSettings();
    }
  }, [currentCompany?.id, jobId]);

  const loadSettings = async () => {
    if (!currentCompany?.id || !jobId) return;

    try {
      // Load job data
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id, name, visitor_qr_code')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

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

      // Load visitor login settings (company-wide appearance settings)
      const { data: loginData, error: loginError } = await supabase
        .from('visitor_login_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (loginError && loginError.code !== 'PGRST116') {
        throw loginError;
      }

      if (loginData) {
        setLoginSettings({
          ...loginData,
          theme: (loginData as any).theme || 'light',
        });
      } else {
        setLoginSettings(prev => ({ ...prev, company_id: currentCompany.id }));
      }

      // Load job-specific visitor settings (confirmation/checkout messages)
      const { data: jobSettings, error: jobSettingsError } = await supabase
        .from('job_visitor_settings')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      if (jobSettingsError && jobSettingsError.code !== 'PGRST116') {
        throw jobSettingsError;
      }

      if (jobSettings) {
        setJobVisitorSettings(jobSettings);
      } else {
        setJobVisitorSettings(prev => ({ 
          ...prev, 
          job_id: jobId,
          company_id: currentCompany.id 
        }));
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

      // Save visitor login settings (company-wide appearance)
      const loginSettingsData = {
        ...loginSettings,
        company_id: currentCompany.id,
        created_by: currentCompany.id,
      };

      const { error: loginError } = await supabase
        .from('visitor_login_settings')
        .upsert([loginSettingsData], { 
          onConflict: 'company_id',
          ignoreDuplicates: false 
        });

      if (loginError) throw loginError;

      // Save job-specific visitor settings (confirmation/checkout messages)
      const jobVisitorSettingsData = {
        ...jobVisitorSettings,
        job_id: jobId,
        company_id: currentCompany.id,
      };

      const { error: jobSettingsError } = await supabase
        .from('job_visitor_settings')
        .upsert([jobVisitorSettingsData], { 
          onConflict: 'job_id',
          ignoreDuplicates: false 
        });

      if (jobSettingsError) throw jobSettingsError;

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
            Configure QR codes, visitor login appearance and auto-logout rules
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <SettingsIcon className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>

      <Tabs defaultValue="qr-code" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="qr-code" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            QR Code
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <ImageIcon2 className="h-4 w-4" />
            Check-In
          </TabsTrigger>
          <TabsTrigger value="checkout" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Check-Out
          </TabsTrigger>
          <TabsTrigger value="auto-logout" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Auto Logout
          </TabsTrigger>
        </TabsList>

        {/* QR Code Tab */}
        <TabsContent value="qr-code" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <QrCode className="h-5 w-5" />
                <span>Visitor Check-In QR Code</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate and manage QR codes for this job site. Visitors can scan this code to quickly check in.
              </p>
              
              {job && (
                <JobQRCode 
                  jobId={jobId}
                  jobName={job.name}
                  visitorQrCode={job.visitor_qr_code}
                  onQrCodeUpdate={(newCode) => setJob(prev => ({ ...prev, visitor_qr_code: newCode }))}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="mt-6 space-y-6">
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
                <DragDropUpload
                  onFileSelect={(file) => { void handleImageUpload(file, 'header'); }}
                  accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                  maxSize={10}
                  size="compact"
                  title="Drag header logo here"
                  dropTitle="Drop header logo here"
                  helperText="Image file up to 10MB"
                />
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
                <DragDropUpload
                  onFileSelect={(file) => { void handleImageUpload(file, 'background'); }}
                  accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                  maxSize={10}
                  size="compact"
                  title="Drag background image here"
                  dropTitle="Drop background image here"
                  helperText="Image file up to 10MB"
                />
              )}
            </div>
          </div>

          <Separator />

          {/* Theme Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Theme</Label>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Login Page Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose light or dark theme for the visitor login page
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={loginSettings.theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLoginSettings(prev => ({ ...prev, theme: 'light' }))}
                >
                  Light
                </Button>
                <Button
                  type="button"
                  variant={loginSettings.theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLoginSettings(prev => ({ ...prev, theme: 'dark' }))}
                >
                  Dark
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Background Color (shown if no image uploaded) */}
          {!loginSettings.background_image_url && (
            <div className="space-y-2">
              <Label htmlFor="background-color">Background Color</Label>
              <p className="text-sm text-muted-foreground">
                Used when no background image is uploaded
              </p>
              <div className="flex space-x-2">
                <Input
                  id="background-color"
                  type="color"
                  value={loginSettings.background_color || '#3b82f6'}
                  onChange={(e) => setLoginSettings(prev => ({ ...prev, background_color: e.target.value }))}
                  className="w-16 h-10 p-1 border-none"
                />
                <Input
                  value={loginSettings.background_color || '#3b82f6'}
                  onChange={(e) => setLoginSettings(prev => ({ ...prev, background_color: e.target.value }))}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
          )}

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

            <div className="space-y-2">
              <Label htmlFor="text-color">Text Color</Label>
              <div className="flex space-x-2">
                <Input
                  id="text-color"
                  type="color"
                  value={loginSettings.text_color || '#000000'}
                  onChange={(e) => setLoginSettings(prev => ({ ...prev, text_color: e.target.value }))}
                  className="w-16 h-10 p-1 border-none"
                />
                <Input
                  value={loginSettings.text_color || '#000000'}
                  onChange={(e) => setLoginSettings(prev => ({ ...prev, text_color: e.target.value }))}
                  placeholder="#000000"
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

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Visitor Photo</Label>
                <p className="text-sm text-muted-foreground">
                  Require visitors to take a photo before checking in
                </p>
              </div>
              <Switch
                checked={loginSettings.require_photo}
                onCheckedChange={(checked) => 
                  setLoginSettings(prev => ({ ...prev, require_photo: checked }))
                }
              />
            </div>
          </div>

          <Separator />

          {/* Confirmation Message - Job Specific */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Confirmation Screen (Job Specific)</Label>
            <p className="text-sm text-muted-foreground">
              These messages are specific to this job site.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="confirmation-title">Title</Label>
              <Input
                id="confirmation-title"
                value={jobVisitorSettings.confirmation_title}
                onChange={(e) => setJobVisitorSettings(prev => ({ ...prev, confirmation_title: e.target.value }))}
                placeholder="Welcome to the Job Site!"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmation-message">Message</Label>
              <Textarea
                id="confirmation-message"
                value={jobVisitorSettings.confirmation_message}
                onChange={(e) => setJobVisitorSettings(prev => ({ ...prev, confirmation_message: e.target.value }))}
                placeholder="Thank you for checking in. Please follow all safety protocols."
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {/* Checkout Template Tab */}
        <TabsContent value="checkout" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5" />
                <span>Checkout Confirmation Template</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Customize the confirmation page visitors see when they click the checkout link. These settings are specific to this job.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="checkout-title">Checkout Title</Label>
                  <Input
                    id="checkout-title"
                    value={jobVisitorSettings.checkout_title}
                    onChange={(e) => setJobVisitorSettings(prev => ({ ...prev, checkout_title: e.target.value }))}
                    placeholder="Successfully Checked Out"
                  />
                  <p className="text-xs text-muted-foreground">
                    This appears at the top of the checkout confirmation page
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkout-message">Checkout Message</Label>
                  <Textarea
                    id="checkout-message"
                    value={jobVisitorSettings.checkout_message}
                    onChange={(e) => setJobVisitorSettings(prev => ({ ...prev, checkout_message: e.target.value }))}
                    placeholder="Thank you for visiting. Have a safe trip!"
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    This message is shown to visitors after they successfully check out
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Visit Duration</Label>
                    <p className="text-sm text-muted-foreground">
                      Display how long the visitor was on site
                    </p>
                  </div>
                  <Switch
                    checked={jobVisitorSettings.checkout_show_duration}
                    onCheckedChange={(checked) => 
                      setJobVisitorSettings(prev => ({ ...prev, checkout_show_duration: checked }))
                    }
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Preview</p>
                <div className="bg-background rounded-lg p-4 border">
                  <div className="text-center space-y-3">
                    <div className="text-green-600 text-2xl">✓</div>
                    <h3 className="font-semibold text-lg">{jobVisitorSettings.checkout_title}</h3>
                    <p className="text-muted-foreground">{jobVisitorSettings.checkout_message}</p>
                    {jobVisitorSettings.checkout_show_duration && (
                      <p className="text-sm text-muted-foreground">
                        Time on site: <span className="font-medium">2 hours 34 minutes</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto Logout Tab */}
        <TabsContent value="auto-logout" className="mt-6 space-y-6">
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
                  <Label htmlFor="distance-meters">
                    Distance Threshold ({distanceUnit === 'feet' ? 'feet' : 'meters'})
                  </Label>
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
                    Auto check-out when visitor moves beyond {formatDistanceLabel(autoLogoutSettings.geolocation_distance_meters, distanceUnit)} from the job site
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
                <span>SMS Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* SMS on Check-In */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Send SMS on Check-In</Label>
                    <p className="text-sm text-muted-foreground">
                      Send checkout link via SMS when visitor checks in
                    </p>
                  </div>
                  <Switch
                    checked={autoLogoutSettings.send_sms_on_checkin}
                    onCheckedChange={(checked) => 
                      setAutoLogoutSettings(prev => ({ ...prev, send_sms_on_checkin: checked }))
                    }
                  />
                </div>

                {autoLogoutSettings.send_sms_on_checkin && (
                  <div className="space-y-2">
                    <Label htmlFor="sms-template">SMS Message Template</Label>
                    <Textarea
                      id="sms-template"
                      value={autoLogoutSettings.sms_message_template}
                      onChange={(e) => setAutoLogoutSettings(prev => ({ 
                        ...prev, 
                        sms_message_template: e.target.value 
                      }))}
                      placeholder="Thanks for checking in at {{job_name}} on {{date_time}}..."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Available placeholders: <code>{'{{job_name}}'}</code>, <code>{'{{date_time}}'}</code>, <code>{'{{checkout_link}}'}</code>
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* SMS Check-In Reminders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable SMS Check Reminders</Label>
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
              </div>

              <Separator />

              {/* Still Logged In SMS Reminder */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Still Logged In SMS Reminder</Label>
                    <p className="text-sm text-muted-foreground">
                      Send reminder to visitors still logged in after specific hours
                    </p>
                  </div>
                  <Switch
                    checked={autoLogoutSettings.sms_reminder_enabled || false}
                    onCheckedChange={(checked) => 
                      setAutoLogoutSettings(prev => ({ ...prev, sms_reminder_enabled: checked }))
                    }
                  />
                </div>

                {autoLogoutSettings.sms_reminder_enabled && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="reminder-hours">Send Reminder After (hours)</Label>
                      <Input
                        id="reminder-hours"
                        type="number"
                        min="1"
                        max="24"
                        value={autoLogoutSettings.sms_reminder_hours || 4}
                        onChange={(e) => setAutoLogoutSettings(prev => ({ 
                          ...prev, 
                          sms_reminder_hours: parseInt(e.target.value) || 4 
                        }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Hours after check-in before sending reminder
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reminder-message">Reminder Message</Label>
                      <Textarea
                        id="reminder-message"
                        value={autoLogoutSettings.sms_reminder_message || ''}
                        onChange={(e) => setAutoLogoutSettings(prev => ({ 
                          ...prev, 
                          sms_reminder_message: e.target.value 
                        }))}
                        rows={3}
                        placeholder="You are still checked in at {{job_name}}. If you have left, please check out here: {{checkout_link}}"
                      />
                      <p className="text-xs text-muted-foreground">
                        Available placeholders: <code>{'{{job_name}}'}</code>, <code>{'{{checkout_link}}'}</code>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
