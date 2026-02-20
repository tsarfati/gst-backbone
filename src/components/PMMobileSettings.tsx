import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import ColorPicker from '@/components/ColorPicker';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function PMMobileSettings() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [mobileLogoUrl, setMobileLogoUrl] = useState<string | null>(null);
  const [defaultDashboardStyle, setDefaultDashboardStyle] = useState('grid');
  const [primaryColor, setPrimaryColor] = useState('#E88A2D');
  const [darkModeDefault, setDarkModeDefault] = useState(true);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [containerOpacity, setContainerOpacity] = useState(1.0);
  const [uploadingBg, setUploadingBg] = useState(false);

  useEffect(() => {
    if (!currentCompany?.id) return;
    loadSettings();
  }, [currentCompany?.id]);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pm_mobile_settings' as any)
      .select('*')
      .eq('company_id', currentCompany!.id)
      .maybeSingle();

    if (data) {
      setMobileLogoUrl((data as any).mobile_logo_url);
      setDefaultDashboardStyle((data as any).default_dashboard_style || 'grid');
      setPrimaryColor((data as any).primary_color || '#E88A2D');
      setDarkModeDefault((data as any).dark_mode_default ?? true);
      setBackgroundImageUrl((data as any).background_image_url || null);
      setContainerOpacity((data as any).container_opacity ?? 1.0);
    }
    setLoading(false);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentCompany?.id) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentCompany.id}/pm-mobile-logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('company-logos').getPublicUrl(filePath);
      setMobileLogoUrl(data.publicUrl);

      toast({ title: 'Logo uploaded', description: 'PM LYNK mobile logo has been updated.' });
    } catch (error) {
      console.error('Logo upload error:', error);
      toast({ title: 'Upload failed', description: 'Failed to upload logo.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setMobileLogoUrl(null);
  };

  const handleSave = async () => {
    if (!currentCompany?.id) return;
    setSaving(true);

    const payload = {
      company_id: currentCompany.id,
      mobile_logo_url: mobileLogoUrl,
      default_dashboard_style: defaultDashboardStyle,
      primary_color: primaryColor,
      dark_mode_default: darkModeDefault,
      background_image_url: backgroundImageUrl,
      container_opacity: containerOpacity,
    };

    const { error } = await (supabase.from('pm_mobile_settings' as any) as any)
      .upsert(payload, { onConflict: 'company_id' });

    if (error) {
      console.error('Save error:', error);
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Settings saved', description: 'PM LYNK mobile settings updated successfully.' });
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground p-4">Loading PM LYNK settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mobile App Logo</CardTitle>
          <CardDescription>
            Upload a logo shown at the top of the PM LYNK dashboard instead of the default logo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {mobileLogoUrl && (
              <div className="flex items-center gap-2">
                <img
                  src={mobileLogoUrl}
                  alt="PM LYNK Mobile Logo"
                  className="h-10 w-10 object-contain border rounded"
                />
                <Button variant="outline" size="sm" onClick={handleRemoveLogo}>
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
          <p className="text-sm text-muted-foreground">
            Recommended: square image, at least 192×192px
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard Layout</CardTitle>
          <CardDescription>
            Set the default dashboard style for new PM LYNK users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Dashboard Style</Label>
            <Select value={defaultDashboardStyle} onValueChange={setDefaultDashboardStyle}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid (Icon Grid)</SelectItem>
                <SelectItem value="list">List (Compact Sidebar)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Users can still override this in their local PM LYNK app settings.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding & Appearance</CardTitle>
          <CardDescription>
            Customize PM LYNK's look and feel for your company
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ColorPicker
            label="Primary Brand Color"
            value={primaryColor}
            onChange={setPrimaryColor}
          />

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dark Mode Default</Label>
              <p className="text-sm text-muted-foreground">
                New PM LYNK users will default to dark mode
              </p>
            </div>
            <Switch checked={darkModeDefault} onCheckedChange={setDarkModeDefault} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Background Image</CardTitle>
          <CardDescription>
            Upload a background image for the PM LYNK mobile app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !currentCompany?.id) return;
                setUploadingBg(true);
                try {
                  const fileExt = file.name.split('.').pop();
                  const filePath = `${currentCompany.id}/pm-mobile-bg.${fileExt}`;
                  const { error: uploadError } = await supabase.storage
                    .from('company-logos')
                    .upload(filePath, file, { upsert: true });
                  if (uploadError) throw uploadError;
                  const { data } = supabase.storage.from('company-logos').getPublicUrl(filePath);
                  setBackgroundImageUrl(data.publicUrl);
                  toast({ title: 'Background uploaded', description: 'Background image has been updated.' });
                } catch (error) {
                  console.error('Background upload error:', error);
                  toast({ title: 'Upload failed', description: 'Failed to upload background image.', variant: 'destructive' });
                } finally {
                  setUploadingBg(false);
                }
              }}
              className="flex-1"
              disabled={uploadingBg}
            />
            {backgroundImageUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBackgroundImageUrl(null)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {backgroundImageUrl && (
            <img
              src={backgroundImageUrl}
              alt="Background preview"
              className="max-h-24 w-full object-cover rounded border"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Card Transparency</CardTitle>
          <CardDescription>
            Control how opaque the content cards appear over the background image
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Opacity ({containerOpacity.toFixed(2)})</Label>
            <Slider
              value={[containerOpacity]}
              onValueChange={([val]) => setContainerOpacity(val)}
              min={0.1}
              max={1.0}
              step={0.05}
            />
            <p className="text-sm text-muted-foreground">
              1.0 = fully opaque cards, lower values let the background image show through
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
