import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useTenant } from '@/contexts/TenantContext';
import ColorPicker from '@/components/ColorPicker';
import { FolderOpen, ImagePlus, Palette, SlidersHorizontal } from 'lucide-react';
import MultiFileUploadDropzone from '@/components/MultiFileUploadDropzone';
import { AVATAR_LIBRARY, AVATAR_LIBRARY_CATEGORY_LABELS, type AvatarLibraryAlbumId, type AvatarLibraryCategory, type CustomAvatarEntry } from '@/components/avatarLibrary';
import { useSystemAvatarLibraries } from '@/hooks/useSystemAvatarLibraries';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';


interface ThemeSettingsProps {
  embedded?: boolean;
  hideSaveButtons?: boolean;
  onRegisterSaveHandler?: (handler: () => void) => void;
  canEdit?: boolean;
}

export default function ThemeSettings({
  embedded = false,
  hideSaveButtons = false,
  onRegisterSaveHandler,
  canEdit = true,
}: ThemeSettingsProps) {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { isSuperAdmin } = useTenant();
  const { hasAccess, permissions } = useMenuPermissions();
  const { libraries: systemAvatarLibraries } = useSystemAvatarLibraries(currentCompany?.id);
  const [uploading, setUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [selectedAvatarAlbum, setSelectedAvatarAlbum] = useState<AvatarLibraryAlbumId>('nintendo');
  const [activeTab, setActiveTab] = useState('general');
  const canAccessThemeTab = (tabPermissionBase: string) => {
    if (isSuperAdmin) return true;
    const viewKey = `${tabPermissionBase}-view`;
    if (typeof permissions[viewKey] === 'boolean') {
      return hasAccess(viewKey);
    }
    if (typeof permissions[tabPermissionBase] === 'boolean') {
      return hasAccess(tabPermissionBase);
    }
    return false;
  };

  const themeTabs = [
    { value: 'general', permissionKey: 'company-settings-tab-theme-general' },
    { value: 'display-operation', permissionKey: 'company-settings-tab-theme-display-operation' },
    { value: 'avatars', permissionKey: 'company-settings-tab-theme-avatars' },
  ].filter((tab) => canAccessThemeTab(tab.permissionKey));

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

  useEffect(() => {
    if (themeTabs.length === 0) return;
    if (!themeTabs.some((tab) => tab.value === activeTab)) {
      setActiveTab(themeTabs[0].value);
    }
  }, [activeTab, themeTabs]);

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

  const handleBannerFilesSelected = async (files: File[]) => {
    await uploadThemeBannerFile(files[0]);
  };

  const enabledAvatarCategories = settings.avatarLibrary?.enabledCategories ?? ['nintendo', 'generic', 'sports', 'construction'];
  const enabledSystemLibraryIds = settings.avatarLibrary?.enabledSystemLibraryIds ?? [];
  const customAvatarLibrary = settings.avatarLibrary?.customAvatars ?? [];
  const avatarAlbums: AvatarLibraryCategory[] = ['nintendo', 'generic', 'sports', 'construction', 'custom'];
  const avatarAlbumDescriptions: Record<AvatarLibraryCategory, string> = {
    nintendo: 'Playful game-inspired avatars for colorful profile options.',
    generic: 'Clean neutral avatars for general company-wide use.',
    sports: 'Team-style avatars with bold color palettes and energy.',
    construction: 'Field and office construction-themed avatar options.',
    custom: 'Your company-managed avatar uploads and internal avatar sets.',
  };
  const selectedAvatarAlbumPreview = selectedAvatarAlbum === 'custom'
    ? customAvatarLibrary
    : typeof selectedAvatarAlbum === 'string' && selectedAvatarAlbum.startsWith('system:')
      ? (systemAvatarLibraries.find((library) => library.id === selectedAvatarAlbum.replace('system:', ''))?.items || []).map((item) => ({
          id: item.id,
          name: item.name,
          avatarUrl: item.image_url,
        }))
      : AVATAR_LIBRARY.filter((avatar) => avatar.category === selectedAvatarAlbum);
  const selectedSystemLibrary = selectedAvatarAlbum.startsWith('system:')
    ? systemAvatarLibraries.find((library) => library.id === selectedAvatarAlbum.replace('system:', ''))
    : null;
  const selectedAvatarAlbumLabel = selectedSystemLibrary?.name || AVATAR_LIBRARY_CATEGORY_LABELS[selectedAvatarAlbum as AvatarLibraryCategory];
  const selectedAvatarAlbumDescription = selectedSystemLibrary?.description || avatarAlbumDescriptions[selectedAvatarAlbum as AvatarLibraryCategory] || 'Shared system avatar album from super admin.';

  const toggleAvatarCategory = (category: AvatarLibraryCategory, enabled: boolean) => {
    const next = enabled
      ? Array.from(new Set([...enabledAvatarCategories, category]))
      : enabledAvatarCategories.filter((entry) => entry !== category);

    updateSettings({
      avatarLibrary: {
        enabledCategories: next,
        enabledSystemLibraryIds,
        customAvatars: customAvatarLibrary,
      },
    });
  };

  const toggleSystemLibrary = (libraryId: string, enabled: boolean) => {
    const next = enabled
      ? Array.from(new Set([...enabledSystemLibraryIds, libraryId]))
      : enabledSystemLibraryIds.filter((entry) => entry !== libraryId);

    updateSettings({
      avatarLibrary: {
        enabledCategories: enabledAvatarCategories,
        enabledSystemLibraryIds: next,
        customAvatars: customAvatarLibrary,
      },
    });
  };

  const uploadCustomAvatarFile = async (file?: File | null) => {
    if (!file || !user || !currentCompany?.id) return;

    setAvatarUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `custom-avatar-${Date.now()}.${fileExt}`;
      const filePath = `${currentCompany.id}/avatar-library/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      const nextEntry: CustomAvatarEntry = {
        id: fileName,
        name: file.name.replace(/\.[^.]+$/, ''),
        avatarUrl: data.publicUrl,
        category: 'custom',
      };

      updateSettings({
        avatarLibrary: {
          enabledCategories: enabledAvatarCategories,
          enabledSystemLibraryIds,
          customAvatars: [...customAvatarLibrary, nextEntry],
        },
      });

      toast({
        title: "Avatar added",
        description: "Custom avatar added to your company library.",
      });

      if (selectedAvatarAlbum !== 'custom') {
        setSelectedAvatarAlbum('custom');
      }
    } catch (error) {
      console.error('Error uploading custom avatar:', error);
      toast({
        title: "Upload failed",
        description: "Could not upload custom avatar.",
        variant: "destructive",
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleCustomAvatarFilesSelected = async (files: File[]) => {
    await uploadCustomAvatarFile(files[0]);
  };

  const removeCustomAvatar = (avatarId: string) => {
    updateSettings({
      avatarLibrary: {
        enabledCategories: enabledAvatarCategories,
        enabledSystemLibraryIds,
        customAvatars: customAvatarLibrary.filter((avatar) => avatar.id !== avatarId),
      },
    });
  };

  useEffect(() => {
    if (selectedAvatarAlbum === 'custom') return;
    if (selectedAvatarAlbum.startsWith('system:')) {
      const libraryId = selectedAvatarAlbum.replace('system:', '');
      const libraryStillAvailable = systemAvatarLibraries.some((library) => library.id === libraryId);
      const libraryStillEnabled = enabledSystemLibraryIds.includes(libraryId);
      if (!libraryStillAvailable || !libraryStillEnabled) {
        setSelectedAvatarAlbum(enabledAvatarCategories[0] ?? 'nintendo');
      }
      return;
    }

    if (!enabledAvatarCategories.includes(selectedAvatarAlbum as AvatarLibraryCategory)) {
      setSelectedAvatarAlbum(enabledAvatarCategories[0] ?? 'nintendo');
    }
  }, [enabledAvatarCategories, enabledSystemLibraryIds, selectedAvatarAlbum, systemAvatarLibraries]);

  return (
    <div className={embedded ? '' : 'p-4 md:p-6'}>
      <div className="space-y-6">
        {!embedded && (
          <div>
            <h1 className="text-3xl font-bold">Theme & Appearance</h1>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            {canAccessThemeTab('company-settings-tab-theme-general') && (
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              General Theme
            </TabsTrigger>
            )}
            {canAccessThemeTab('company-settings-tab-theme-display-operation') && (
            <TabsTrigger value="display-operation" className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Display & Operation
            </TabsTrigger>
            )}
            {canAccessThemeTab('company-settings-tab-theme-avatars') && (
            <TabsTrigger value="avatars">Avatars</TabsTrigger>
            )}
          </TabsList>

          {canAccessThemeTab('company-settings-tab-theme-general') && (
          <TabsContent value="general" className="space-y-6">
            {!hideSaveButtons && canEdit && !settings.autoSave && (
              <div className="flex items-center justify-end">
                <Button onClick={handleSaveSettings}>Save Changes</Button>
              </div>
            )}

            <Card className={!canEdit ? 'pointer-events-none opacity-75' : undefined}>
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

                <div className="space-y-2">
                  <Label htmlFor="sidebar-highlight-opacity">Left Navigation Highlight Intensity</Label>
                  <Select
                    value={String(settings.sidebarHighlightOpacity ?? 0.14)}
                    onValueChange={(value) => updateSettings({ sidebarHighlightOpacity: Number(value) })}
                  >
                    <SelectTrigger id="sidebar-highlight-opacity">
                      <SelectValue placeholder="Select highlight intensity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.08">Subtle (8%)</SelectItem>
                      <SelectItem value="0.12">Soft (12%)</SelectItem>
                      <SelectItem value="0.14">Balanced (14%)</SelectItem>
                      <SelectItem value="0.18">Strong (18%)</SelectItem>
                      <SelectItem value="0.24">High (24%)</SelectItem>
                    </SelectContent>
                  </Select>
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

                <Separator />

                <div className="space-y-4">
                  <Label>Dashboard Banner</Label>
                  <MultiFileUploadDropzone
                    onFilesSelected={handleBannerFilesSelected}
                    accept="image/*"
                    disabled={uploading}
                    buttonLabel={uploading ? "Choose Banner to Upload" : "Choose Banner to Upload"}
                    dragLabel="Drag Banner Image Here"
                    subtitle="Upload a banner image to display at the top of your dashboard. Recommended size: 1600 x 320 pixels."
                    compact
                    className="max-w-3xl min-h-[120px]"
                    previewImageUrl={settings.dashboardBanner || null}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={!canEdit ? 'pointer-events-none opacity-75' : undefined}>
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
                  <ColorPicker
                    label="Left Navigation Background"
                    value={settings.customColors.sidebarBackground}
                    onChange={(value) => updateSettings({
                      customColors: { ...settings.customColors, sidebarBackground: value }
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {canAccessThemeTab('company-settings-tab-theme-display-operation') && (
          <TabsContent value="display-operation" className={canEdit ? "space-y-6" : "space-y-6 pointer-events-none opacity-75"}>
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
                    <Label htmlFor="theme-time-zone">Time Zone</Label>
                    <Select
                      value={settings.timeZone}
                      onValueChange={(value: string) =>
                        updateSettings({ timeZone: value })
                      }
                    >
                      <SelectTrigger id="theme-time-zone">
                        <SelectValue placeholder="Select time zone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time (New York, UTC-5/-4)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (Chicago, UTC-6/-5)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (Denver, UTC-7/-6)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (Los Angeles, UTC-8/-7)</SelectItem>
                        <SelectItem value="America/Phoenix">Arizona Time (Phoenix, UTC-7)</SelectItem>
                        <SelectItem value="America/Anchorage">Alaska Time (Anchorage, UTC-9/-8)</SelectItem>
                        <SelectItem value="Pacific/Honolulu">Hawaii Time (Honolulu, UTC-10)</SelectItem>
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {canAccessThemeTab('company-settings-tab-theme-avatars') && (
          <TabsContent value="avatars" className={canEdit ? "space-y-6" : "space-y-6 pointer-events-none opacity-75"}>
            <Card>
              <CardHeader>
                <CardTitle>Avatar Library</CardTitle>
                <CardDescription>
                  Organize avatar albums, control which sets users can choose from, and manage your company avatar library.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Avatar Albums</Label>
                      <span className="text-xs text-muted-foreground">
                        Choose what users can browse
                      </span>
                    </div>

                    <div className="space-y-3">
                      {avatarAlbums.map((category) => {
                        const itemCount = category === 'custom'
                          ? customAvatarLibrary.length
                          : AVATAR_LIBRARY.filter((avatar) => avatar.category === category).length;
                        const isEnabled = category === 'custom'
                          ? customAvatarLibrary.length > 0
                          : enabledAvatarCategories.includes(category);
                        const isSelected = selectedAvatarAlbum === category;

                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setSelectedAvatarAlbum(category)}
                            className={`w-full rounded-xl border p-4 text-left transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-muted/40">
                                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-medium">
                                      {AVATAR_LIBRARY_CATEGORY_LABELS[category]}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {itemCount} avatar{itemCount === 1 ? '' : 's'}
                                    </div>
                                  </div>
                                  {category === 'custom' ? (
                                    <div className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                                      {itemCount > 0 ? 'Available' : 'Empty'}
                                    </div>
                                  ) : (
                                    <div
                                      className="flex items-center gap-2"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <Checkbox
                                        checked={isEnabled}
                                        onCheckedChange={(checked) => toggleAvatarCategory(category, checked === true)}
                                        aria-label={`Enable ${AVATAR_LIBRARY_CATEGORY_LABELS[category]} album`}
                                      />
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs leading-5 text-muted-foreground">
                                  {avatarAlbumDescriptions[category]}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {systemAvatarLibraries.map((library) => {
                        const isEnabled = enabledSystemLibraryIds.includes(library.id);
                        const isSelected = selectedAvatarAlbum === `system:${library.id}`;

                        return (
                          <button
                            key={library.id}
                            type="button"
                            onClick={() => setSelectedAvatarAlbum(`system:${library.id}`)}
                            className={`w-full rounded-xl border p-4 text-left transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                                {library.cover_image_url ? (
                                  <img src={library.cover_image_url} alt={library.name} className="h-full w-full object-cover" />
                                ) : (
                                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-medium">{library.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {library.items.length} avatar{library.items.length === 1 ? '' : 's'}
                                    </div>
                                  </div>
                                  <div
                                    className="flex items-center gap-2"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={isEnabled}
                                      onCheckedChange={(checked) => toggleSystemLibrary(library.id, checked === true)}
                                      aria-label={`Enable ${library.name} album`}
                                    />
                                  </div>
                                </div>
                                <p className="text-xs leading-5 text-muted-foreground">
                                  {library.description || 'Shared system avatar album from super admin.'}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border bg-card p-4 md:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">
                          {selectedAvatarAlbumLabel}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedAvatarAlbumDescription}
                        </p>
                      </div>
                      <div className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                        {selectedAvatarAlbumPreview.length} preview item{selectedAvatarAlbumPreview.length === 1 ? '' : 's'}
                      </div>
                    </div>

                    <Separator />

                    {selectedAvatarAlbum === 'custom' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <ImagePlus className="h-4 w-4" />
                          Add to Custom Library
                        </div>
                        <MultiFileUploadDropzone
                          onFilesSelected={handleCustomAvatarFilesSelected}
                          accept="image/*"
                          disabled={avatarUploading}
                          buttonLabel={avatarUploading ? "Uploading..." : "Choose Avatar to Add"}
                          dragLabel="Drag Avatar Here"
                          compact
                          className="max-w-3xl"
                        />
                      </div>
                    )}

                    {selectedAvatarAlbumPreview.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {selectedAvatarAlbumPreview.map((avatar) => {
                          const avatarUrl = 'avatarUrl' in avatar ? avatar.avatarUrl : '';
                          const avatarName = avatar.name;
                          const isCustom = selectedAvatarAlbum === 'custom';
                          const isSystemLibrary = selectedAvatarAlbum.startsWith('system:');

                          return (
                            <div key={avatar.id} className="rounded-xl border bg-background/40 p-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={avatarUrl}
                                  alt={avatarName}
                                  className="h-16 w-16 rounded-full object-cover ring-1 ring-border"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium">{avatarName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {isCustom ? 'Custom company avatar' : isSystemLibrary ? 'Shared system avatar' : 'Built-in album avatar'}
                                  </div>
                                </div>
                              </div>
                              {isCustom && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-4 w-full"
                                  onClick={() => removeCustomAvatar(avatar.id)}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        {selectedAvatarAlbum === 'custom'
                          ? 'No custom company avatars yet. Upload a few here to build your own company avatar album.'
                          : 'This album preview is currently empty.'}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

        </Tabs>
      </div>
    </div>
  );
}
