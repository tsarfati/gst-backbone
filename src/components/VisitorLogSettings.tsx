import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Upload, X, Palette, Image, Settings, Eye, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

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

export function VisitorLogSettings() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<VisitorLoginSettings>({
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
    if (currentCompany?.id) {
      loadSettings();
    }
  }, [currentCompany?.id]);

  const loadSettings = async () => {
    if (!currentCompany?.id) return;

    try {
      const { data, error } = await supabase
        .from('visitor_login_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
      } else {
        // Set company_id for new settings
        setSettings(prev => ({ ...prev, company_id: currentCompany.id }));
      }
    } catch (error) {
      console.error('Error loading visitor login settings:', error);
      toast({
        title: "Error",
        description: "Failed to load visitor login settings.",
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

      setSettings(prev => ({
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
    setSettings(prev => ({
      ...prev,
      [type === 'background' ? 'background_image_url' : 'header_logo_url']: undefined
    }));
  };

  const handleSave = async () => {
    if (!currentCompany?.id) return;

    setSaving(true);
    try {
      const settingsData = {
        ...settings,
        company_id: currentCompany.id,
        created_by: currentCompany.id, // Using company_id as created_by for now
      };

      const { error } = await supabase
        .from('visitor_login_settings')
        .upsert([settingsData], { 
          onConflict: 'company_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Visitor login settings have been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving visitor login settings:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    // Open a preview window with sample visitor login
    const previewUrl = `${window.location.origin}/visitor/preview`;
    window.open(previewUrl, '_blank', 'width=400,height=800');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading visitor login settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Visitor Login Settings</h2>
          <p className="text-muted-foreground">
            Customize the appearance and behavior of your visitor login page
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Settings className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visual Customization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Palette className="h-5 w-5" />
              <span>Visual Customization</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Header Logo */}
            <div className="space-y-2">
              <Label>Header Logo</Label>
              {settings.header_logo_url ? (
                <div className="relative inline-block">
                  <img 
                    src={settings.header_logo_url} 
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
              {settings.background_image_url ? (
                <div className="relative inline-block">
                  <img 
                    src={settings.background_image_url} 
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

            <Separator />

            {/* Color Customization */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Primary Color</Label>
                <div className="flex space-x-2">
                  <Input
                    id="primary-color"
                    type="color"
                    value={settings.primary_color}
                    onChange={(e) => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="w-16 h-10 p-1 border-none"
                  />
                  <Input
                    value={settings.primary_color}
                    onChange={(e) => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
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
                    value={settings.button_color}
                    onChange={(e) => setSettings(prev => ({ ...prev, button_color: e.target.value }))}
                    className="w-16 h-10 p-1 border-none"
                  />
                  <Input
                    value={settings.button_color}
                    onChange={(e) => setSettings(prev => ({ ...prev, button_color: e.target.value }))}
                    placeholder="#10b981"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Form Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Required Fields */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Required Fields</Label>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Company Name</Label>
                  <p className="text-sm text-muted-foreground">
                    Visitors must enter their company name
                  </p>
                </div>
                <Switch
                  checked={settings.require_company_name}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, require_company_name: checked }))
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
                  checked={settings.require_purpose_visit}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, require_purpose_visit: checked }))
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
                  checked={settings.enable_checkout}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, enable_checkout: checked }))
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
                  value={settings.confirmation_title}
                  onChange={(e) => setSettings(prev => ({ ...prev, confirmation_title: e.target.value }))}
                  placeholder="Welcome to the Job Site!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmation-message">Message</Label>
                <Textarea
                  id="confirmation-message"
                  value={settings.confirmation_message}
                  onChange={(e) => setSettings(prev => ({ ...prev, confirmation_message: e.target.value }))}
                  placeholder="Thank you for checking in. Please follow all safety protocols."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}