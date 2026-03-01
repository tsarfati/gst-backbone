import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import ColorPicker from '@/components/ColorPicker';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';

export default function PMMobileSettings() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: appSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const autoSaveReadyRef = useRef(false);

  const [mobileLogoUrl, setMobileLogoUrl] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [defaultDashboardStyle, setDefaultDashboardStyle] = useState('grid');
  const [primaryColor, setPrimaryColor] = useState('#E88A2D');
  const [highlightColor, setHighlightColor] = useState('#FFD166');
  const [darkModeDefault, setDarkModeDefault] = useState(true);
  const [containerOpacity, setContainerOpacity] = useState<number>(1);
  const [dailyMessageType, setDailyMessageType] = useState('none');
  const [customDailyMessage, setCustomDailyMessage] = useState('');

  const previewMessage = (() => {
    switch (dailyMessageType) {
      case 'joke':
        return 'Daily Joke: Why did the contractor bring a ladder? To raise the standards.';
      case 'riddle':
        return 'Daily Riddle: What has many keys but can’t open a door?';
      case 'quote':
        return 'Daily Quote: Quality means doing it right when no one is looking.';
      case 'horoscope':
        return 'Daily Horoscope: Focus on planning and communication today.';
      case 'fortune':
        return 'Fortune Cookie: A well-organized site leads to a successful day.';
      case 'custom':
        return customDailyMessage || 'Have a blessed day';
      default:
        return 'No daily message';
    }
  })();

  useEffect(() => {
    if (!currentCompany?.id) return;
    loadSettings();
  }, [currentCompany?.id]);

  const loadSettings = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const { data } = await (supabase.from('pm_mobile_settings' as any) as any)
      .select('*')
      .eq('company_id', currentCompany.id)
      .maybeSingle();

    if (data) {
      setMobileLogoUrl((data as any).mobile_logo_url ?? null);
      setBackgroundImageUrl((data as any).background_image_url ?? null);
      setDefaultDashboardStyle((data as any).default_dashboard_style || 'grid');
      setPrimaryColor((data as any).primary_color || '#E88A2D');
      setHighlightColor((data as any).highlight_color || '#FFD166');
      setDarkModeDefault((data as any).dark_mode_default ?? true);
      setContainerOpacity(Number((data as any).container_opacity ?? 1));
      setDailyMessageType((data as any).daily_message_type || 'none');
      setCustomDailyMessage((data as any).custom_daily_message || '');
    }
    autoSaveReadyRef.current = true;
    setLoading(false);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentCompany?.id || !user) return;

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

      toast({
        title: 'Logo uploaded',
        description: 'PM Lynk mobile logo has been updated.',
      });
    } catch (error) {
      console.error('PM Lynk logo upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload PM Lynk logo.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (showToast: boolean = true) => {
    if (!currentCompany?.id) return;

    setSaving(true);
    const payload = {
      company_id: currentCompany.id,
      mobile_logo_url: mobileLogoUrl,
      background_image_url: backgroundImageUrl,
      default_dashboard_style: defaultDashboardStyle,
      primary_color: primaryColor,
      highlight_color: highlightColor,
      dark_mode_default: darkModeDefault,
      container_opacity: containerOpacity,
      daily_message_type: dailyMessageType,
      custom_daily_message: customDailyMessage || null,
    };

    const { error } = await (supabase.from('pm_mobile_settings' as any) as any).upsert(payload, {
      onConflict: 'company_id',
    });

    if (error) {
      console.error('PM Lynk settings save error:', error);
      if (showToast) {
        toast({
          title: 'Save failed',
          description: error.message.includes('column') && (error.message.includes('daily_message_type') || error.message.includes('highlight_color') || error.message.includes('custom_daily_message'))
            ? 'Some PM Lynk settings columns are not in the database yet. Ask me for the SQL migration and then save again.'
            : error.message,
          variant: 'destructive',
        });
      }
    } else {
      if (showToast) {
        toast({
          title: 'Settings saved',
          description: 'PM Lynk mobile settings updated successfully.',
        });
      }
    }

    setSaving(false);
  };

  useEffect(() => {
    if (!appSettings.autoSave || loading || saving || !currentCompany?.id || !autoSaveReadyRef.current) return;

    const timer = setTimeout(() => {
      void handleSave(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [
    appSettings.autoSave,
    loading,
    saving,
    currentCompany?.id,
    mobileLogoUrl,
    backgroundImageUrl,
    defaultDashboardStyle,
    primaryColor,
    highlightColor,
    darkModeDefault,
    containerOpacity,
    dailyMessageType,
    customDailyMessage,
  ]);

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentCompany?.id || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${currentCompany.id}/pm-mobile-background.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('company-logos').getPublicUrl(filePath);
      setBackgroundImageUrl(data.publicUrl);

      toast({
        title: 'Background uploaded',
        description: 'PM Lynk background image has been updated.',
      });
    } catch (error) {
      console.error('PM Lynk background upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload PM Lynk background image.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading PM Lynk settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        {!appSettings.autoSave && (
          <Button onClick={() => void handleSave()} disabled={saving} className="shrink-0">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">PM Lynk Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PM Lynk Preview</CardTitle>
          <CardDescription>Live preview of branding, colors, and dashboard message styling.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="relative overflow-hidden rounded-xl border min-h-[260px] p-4"
            style={{
              backgroundColor: '#0b1220',
              backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative mx-auto max-w-md rounded-xl border p-4 space-y-4"
              style={{
                backgroundColor: `rgba(9, 18, 36, ${Math.max(0.2, Math.min(1, containerOpacity))})`,
                borderColor: `${primaryColor}55`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {mobileLogoUrl ? (
                    <img src={mobileLogoUrl} alt="PM Lynk logo preview" className="h-10 w-10 rounded border object-contain bg-white/90" />
                  ) : (
                    <div className="h-10 w-10 rounded border bg-white/10 flex items-center justify-center text-white text-xs">
                      PM
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-white font-semibold leading-tight truncate">
                      {currentCompany?.display_name || currentCompany?.name || 'Company'}
                    </div>
                    <div className="text-xs text-white/70">PM Lynk</div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-0 text-black"
                  style={{ backgroundColor: highlightColor }}
                >
                  {defaultDashboardStyle === 'grid' ? 'Grid' : 'List'}
                </Badge>
              </div>

              <div
                className="rounded-lg p-3 text-sm"
                style={{
                  backgroundColor: `${primaryColor}22`,
                  border: `1px solid ${primaryColor}55`,
                  color: '#fff',
                }}
              >
                <div className="text-xs uppercase tracking-wide opacity-80 mb-1">Daily Message</div>
                <div className="leading-snug">{previewMessage}</div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['Tasks', 'Receipts', 'Tickets'].map((label) => (
                  <div
                    key={label}
                    className="rounded-md p-2 text-center text-xs"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      border: `1px solid ${highlightColor}44`,
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding & Appearance</CardTitle>
          <CardDescription>Customize PM Lynk look and feel for your company.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>Background Image</Label>
            <div className="flex items-center gap-4">
              {backgroundImageUrl && (
                <div className="flex items-center gap-2">
                  <img
                    src={backgroundImageUrl}
                    alt="PM Lynk Background"
                    className="h-12 w-20 rounded border object-cover"
                  />
                  <Button variant="outline" size="sm" onClick={() => setBackgroundImageUrl(null)}>
                    Remove
                  </Button>
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={handleBackgroundUpload}
                className="w-auto"
                disabled={uploading}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Upload a PM Lynk dashboard background image (Sigma already appears to have one set).
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label>Mobile App Logo</Label>
            <p className="text-sm text-muted-foreground">Upload a logo shown at the top of the PM Lynk dashboard.</p>
          </div>

          <div className="flex items-center gap-4">
            {mobileLogoUrl && (
              <div className="flex items-center gap-2">
                <img
                  src={mobileLogoUrl}
                  alt="PM Lynk Mobile Logo"
                  className="h-10 w-10 rounded border object-contain"
                />
                <Button variant="outline" size="sm" onClick={() => setMobileLogoUrl(null)}>
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
          <p className="text-sm text-muted-foreground">Recommended: square image, at least 192x192px</p>
          <ColorPicker label="Primary Brand Color" value={primaryColor} onChange={setPrimaryColor} />
          <ColorPicker label="Highlight Color" value={highlightColor} onChange={setHighlightColor} />

          <Separator />

          <div className="space-y-2">
            <Label>Card / Container Opacity ({Math.round(containerOpacity * 100)}%)</Label>
            <Input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(containerOpacity * 100)}
              onChange={(e) => setContainerOpacity(Number(e.target.value) / 100)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dark Mode Default</Label>
              <p className="text-sm text-muted-foreground">New PM Lynk users will default to dark mode.</p>
            </div>
            <Switch checked={darkModeDefault} onCheckedChange={setDarkModeDefault} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard Layout & Messages</CardTitle>
          <CardDescription>Set PM Lynk dashboard defaults and daily message behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Dashboard Style</Label>
            <Select value={defaultDashboardStyle} onValueChange={setDefaultDashboardStyle}>
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid (Icon Grid)</SelectItem>
                <SelectItem value="list">List (Compact Sidebar)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Default Daily Message</Label>
            <Select value={dailyMessageType} onValueChange={setDailyMessageType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="joke">Joke</SelectItem>
                <SelectItem value="riddle">Riddle</SelectItem>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="horoscope">Horoscope</SelectItem>
                <SelectItem value="fortune">Fortune Cookie</SelectItem>
                <SelectItem value="custom">Custom Message</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Select the default PM Lynk dashboard message type shown to users.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Custom Message (used when Daily Message = Custom)</Label>
            <Input
              value={customDailyMessage}
              onChange={(e) => setCustomDailyMessage(e.target.value)}
              placeholder="Have a blessed day"
            />
            <p className="text-sm text-muted-foreground">
              If you choose Custom Message above, this text will be shown in PM Lynk.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
