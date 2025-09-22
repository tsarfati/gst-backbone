import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ColorPicker from '@/components/ColorPicker';

export default function ThemeSettings() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleSaveSettings = () => {
    setTheme(settings.theme);
    toast({
      title: "Theme settings saved",
      description: "Your appearance preferences have been updated successfully.",
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/theme-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      updateSettings({ customLogo: data.publicUrl });
      
      toast({
        title: "Logo uploaded successfully",
        description: "Your custom logo has been saved.",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `banner-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/theme-banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      updateSettings({ dashboardBanner: data.publicUrl });
      
      toast({
        title: "Banner uploaded successfully",
        description: "Your dashboard banner has been saved.",
      });
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload banner. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Theme & Appearance</h1>
          <p className="text-muted-foreground">
            Customize the look and feel of your application
          </p>
        </div>
        
        <div className="flex items-center justify-end">
          <Button onClick={handleSaveSettings}>Save Changes</Button>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme Settings</CardTitle>
              <CardDescription>
                Choose your preferred color scheme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={settings.theme}
                  onValueChange={(value: 'light' | 'dark' | 'system') => 
                    updateSettings({ theme: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="compact-mode">Compact Mode</Label>
                  <div className="text-sm text-muted-foreground">
                    Use a more condensed interface layout
                  </div>
                </div>
                <Switch
                  id="compact-mode"
                  checked={settings.compactMode}
                  onCheckedChange={(checked) => 
                    updateSettings({ compactMode: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo & Branding</CardTitle>
              <CardDescription>
                Customize your company branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <Label>Logo Upload</Label>
                <div className="flex items-center gap-4">
                  {settings.customLogo && (
                    <div className="flex items-center gap-2">
                      <img 
                        src={settings.customLogo} 
                        alt="Custom Logo" 
                        className="h-8 w-8 object-contain border rounded"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateSettings({ customLogo: undefined })}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="w-auto"
                    disabled={uploading}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Upload a logo to replace the default icon in the sidebar header
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Dashboard Banner</Label>
                <div className="flex items-center gap-4">
                  {settings.dashboardBanner && (
                    <div className="flex items-center gap-2">
                      <img 
                        src={settings.dashboardBanner} 
                        alt="Dashboard Banner" 
                        className="h-16 w-32 object-cover border rounded"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateSettings({ dashboardBanner: undefined })}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="w-auto"
                    disabled={uploading}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Upload a banner image to display at the top of your dashboard
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Color Customization</CardTitle>
              <CardDescription>
                Customize the application color scheme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColorPicker
                  label="Primary Color"
                  value={settings.customColors.primary}
                  onChange={(value) => updateSettings({ 
                    customColors: { ...settings.customColors, primary: value }
                  })}
                />
                <ColorPicker
                  label="Secondary Color"
                  value={settings.customColors.secondary}
                  onChange={(value) => updateSettings({ 
                    customColors: { ...settings.customColors, secondary: value }
                  })}
                />
                <ColorPicker
                  label="Accent Color"
                  value={settings.customColors.accent}
                  onChange={(value) => updateSettings({ 
                    customColors: { ...settings.customColors, accent: value }
                  })}
                />
                <ColorPicker
                  label="Success Color"
                  value={settings.customColors.success}
                  onChange={(value) => updateSettings({ 
                    customColors: { ...settings.customColors, success: value }
                  })}
                />
                <ColorPicker
                  label="Warning Color"
                  value={settings.customColors.warning}
                  onChange={(value) => updateSettings({ 
                    customColors: { ...settings.customColors, warning: value }
                  })}
                />
                <ColorPicker
                  label="Destructive Color"
                  value={settings.customColors.destructive}
                  onChange={(value) => updateSettings({ 
                    customColors: { ...settings.customColors, destructive: value }
                  })}
                />
                <ColorPicker
                  label="Button Hover Color"
                  value={settings.customColors.buttonHover}
                  onChange={(value) => updateSettings({ 
                    customColors: { ...settings.customColors, buttonHover: value }
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}