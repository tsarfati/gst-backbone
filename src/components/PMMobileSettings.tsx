import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import ColorPicker from '@/components/ColorPicker';
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
    </div>
  );
}
