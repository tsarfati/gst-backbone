import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import ColorPicker from '@/components/ColorPicker';
import { Palette, SlidersHorizontal } from 'lucide-react';
import DragDropUpload from '@/components/DragDropUpload';


interface ThemeSettingsProps {
  embedded?: boolean;
  hideSaveButtons?: boolean;
  onRegisterSaveHandler?: (handler: () => void) => void;
}

export default function ThemeSettings({
  embedded = false,
  hideSaveButtons = false,
  onRegisterSaveHandler,
}: ThemeSettingsProps) {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [uploading, setUploading] = useState(false);

  const handleSaveSettings = () => {
    setTheme(settings.theme);
    toast({
      title: "Theme settings saved",
      description: "Your appearance preferences have been updated successfully.",
    });
  };

  useEffect(() => {
    if (!onRegisterSaveHandler) return;
    onRegisterSaveHandler(handleSaveSettings);
  }, [onRegisterSaveHandler, settings.theme]);

  const uploadThemeLogoFile = async (file?: File | null) => {
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

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await uploadThemeLogoFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const uploadThemeBannerFile = async (file?: File | null) => {
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

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await uploadThemeBannerFile(event.target.files?.[0]);
    event.target.value = '';
  };

  return (
    <div className={embedded ? '' : 'p-4 md:p-6'}>
      <div className="space-y-6">
        {!embedded && (
          <div>
            <h1 className="text-3xl font-bold">Theme & Appearance</h1>
          </div>
        )}
        
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              General Theme
            </TabsTrigger>
            <TabsTrigger value="display-operation" className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Display & Operation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {!hideSaveButtons && !settings.autoSave && (
              <div className="flex items-center justify-end">
                <Button onClick={handleSaveSettings}>Save Changes</Button>
              </div>
            )}

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

                <Separator />

                <div className="space-y-3">
                  <Label>Sidebar Categories</Label>
                  <RadioGroup
                    value={settings.navigationMode}
                    onValueChange={(value: 'single' | 'multiple') => updateSettings({ navigationMode: value })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="multiple" id="theme-general-nav-multiple" />
                      <Label htmlFor="theme-general-nav-multiple" className="flex-1">
                        <div>
                          <div className="font-medium">Multiple Categories Open</div>
                          <div className="text-sm text-muted-foreground">
                            Allow multiple navigation categories to be expanded simultaneously
                          </div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="single" id="theme-general-nav-single" />
                      <Label htmlFor="theme-general-nav-single" className="flex-1">
                        <div>
                          <div className="font-medium">Single Category Open</div>
                          <div className="text-sm text-muted-foreground">
                            Only one navigation category can be open at a time (accordion style)
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Logo & Branding</CardTitle>
                <CardDescription>
                  Customize your company branding for {currentCompany?.display_name || currentCompany?.name || 'your company'}
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
                    <div className="min-w-[260px]">
                      <DragDropUpload
                        onFileSelect={(file) => { void uploadThemeLogoFile(file); }}
                        accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                        maxSize={10}
                        size="compact"
                        disabled={uploading}
                        title="Drag logo here"
                        dropTitle="Drop logo here"
                        helperText="Image file up to 10MB"
                      />
                    </div>
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
                    <div className="min-w-[260px]">
                      <DragDropUpload
                        onFileSelect={(file) => { void uploadThemeBannerFile(file); }}
                        accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                        maxSize={10}
                        size="compact"
                        disabled={uploading}
                        title="Drag banner image here"
                        dropTitle="Drop banner image here"
                        helperText="Image file up to 10MB"
                      />
                    </div>
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
          </TabsContent>

          <TabsContent value="display-operation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Navigation Behavior</CardTitle>
                <CardDescription>
                  Configure how the sidebar navigation behaves
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Sidebar Categories</Label>
                  <RadioGroup
                    value={settings.navigationMode}
                    onValueChange={(value: 'single' | 'multiple') => updateSettings({ navigationMode: value })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="multiple" id="theme-nav-multiple" />
                      <Label htmlFor="theme-nav-multiple" className="flex-1">
                        <div>
                          <div className="font-medium">Multiple Categories Open</div>
                          <div className="text-sm text-muted-foreground">
                            Allow multiple navigation categories to be expanded simultaneously
                          </div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="single" id="theme-nav-single" />
                      <Label htmlFor="theme-nav-single" className="flex-1">
                        <div>
                          <div className="font-medium">Single Category Open</div>
                          <div className="text-sm text-muted-foreground">
                            Only one navigation category can be open at a time (accordion style)
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Display Preferences</CardTitle>
                <CardDescription>
                  Customize how content is displayed across the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme-default-view">Default View</Label>
                    <Select
                      value={settings.defaultView}
                      onValueChange={(value: 'tiles' | 'list' | 'compact') => updateSettings({ defaultView: value })}
                    >
                      <SelectTrigger id="theme-default-view">
                        <SelectValue placeholder="Select default view" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tiles">Tiles</SelectItem>
                        <SelectItem value="list">List</SelectItem>
                        <SelectItem value="compact">Compact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="theme-items-per-page">Items Per Page</Label>
                    <Select
                      value={settings.itemsPerPage.toString()}
                      onValueChange={(value) => updateSettings({ itemsPerPage: parseInt(value) as 10 | 25 | 50 | 100 })}
                    >
                      <SelectTrigger id="theme-items-per-page">
                        <SelectValue placeholder="Select items per page" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 items</SelectItem>
                        <SelectItem value="25">25 items</SelectItem>
                        <SelectItem value="50">50 items</SelectItem>
                        <SelectItem value="100">100 items</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="theme-auto-save">Auto-save Forms</Label>
                    <div className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3">
                      <span className="text-sm text-muted-foreground">Save while typing</span>
                      <Switch
                        id="theme-auto-save"
                        checked={settings.autoSave}
                        onCheckedChange={(checked) => updateSettings({ autoSave: checked })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme-date-format">Date Format</Label>
                    <Select
                      value={settings.dateFormat}
                      onValueChange={(value: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD') =>
                        updateSettings({ dateFormat: value })
                      }
                    >
                      <SelectTrigger id="theme-date-format">
                        <SelectValue placeholder="Select date format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="theme-currency-format">Currency Format</Label>
                    <Select
                      value={settings.currencyFormat}
                      onValueChange={(value: 'USD' | 'EUR' | 'GBP') =>
                        updateSettings({ currencyFormat: value })
                      }
                    >
                      <SelectTrigger id="theme-currency-format">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="theme-distance-unit">Distance Units</Label>
                    <Select
                      value={settings.distanceUnit}
                      onValueChange={(value: 'meters' | 'feet') =>
                        updateSettings({ distanceUnit: value })
                      }
                    >
                      <SelectTrigger id="theme-distance-unit">
                        <SelectValue placeholder="Select distance unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meters">Meters (m)</SelectItem>
                        <SelectItem value="feet">Feet (ft)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
