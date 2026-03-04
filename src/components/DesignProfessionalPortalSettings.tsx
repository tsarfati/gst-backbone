import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Copy, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

type DesignProfessionalPortalSettingsData = {
  design_professional_portal_enabled: boolean;
  design_professional_signup_background_image_url: string;
  design_professional_signup_logo_url: string;
  design_professional_signup_header_title: string;
  design_professional_signup_header_subtitle: string;
};

const defaults: DesignProfessionalPortalSettingsData = {
  design_professional_portal_enabled: true,
  design_professional_signup_background_image_url: '',
  design_professional_signup_logo_url: '',
  design_professional_signup_header_title: 'Design Professional Signup',
  design_professional_signup_header_subtitle: 'Create your design professional account and request company approval.',
};

function AssetDropzone({
  label,
  value,
  onUpload,
  imageClassName,
}: {
  label: string;
  value: string;
  onUpload: (file: File) => void;
  imageClassName: string;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop: React.DragEventHandler<HTMLLabelElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <label
        onDrop={handleDrop}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
        }}
        className={cn(
          'group relative block cursor-pointer overflow-hidden rounded-lg border border-dashed bg-muted/20 transition-colors',
          isDragging ? 'border-primary bg-primary/10' : 'border-border/80 hover:border-primary/60 hover:bg-muted/40',
        )}
      >
        <div className="aspect-[16/8] w-full">
          {value ? (
            <img src={value} alt={`${label} preview`} className={cn('h-full w-full', imageClassName)} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-xs text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
              <span>No image uploaded</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/45 px-4 text-center text-xs font-medium text-white transition-opacity',
            isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          Click to upload or drag and drop to replace
        </div>
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

export default function DesignProfessionalPortalSettings() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<DesignProfessionalPortalSettingsData>(defaults);

  useEffect(() => {
    if (!currentCompany?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('payables_settings')
          .select('*')
          .eq('company_id', currentCompany.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        const row = (data || {}) as any;
        setSettings({
          design_professional_portal_enabled: row.design_professional_portal_enabled ?? true,
          design_professional_signup_background_image_url: row.design_professional_signup_background_image_url ?? '',
          design_professional_signup_logo_url: row.design_professional_signup_logo_url ?? '',
          design_professional_signup_header_title: row.design_professional_signup_header_title ?? defaults.design_professional_signup_header_title,
          design_professional_signup_header_subtitle: row.design_professional_signup_header_subtitle ?? defaults.design_professional_signup_header_subtitle,
        });
      } catch (error) {
        console.error('Failed loading design professional portal settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load design professional portal settings.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [currentCompany?.id, toast]);

  const save = async (partial?: Partial<DesignProfessionalPortalSettingsData>) => {
    if (!currentCompany?.id) return;
    const payload = { ...settings, ...(partial || {}) };
    setSettings(payload);

    try {
      setSaving(true);
      const { data: updatedRows, error: updateError } = await supabase
        .from('payables_settings')
        .update(payload as any)
        .eq('company_id', currentCompany.id)
        .select('id');

      if (updateError) throw updateError;

      if (!updatedRows || updatedRows.length === 0) {
        if (!profile?.user_id) {
          throw new Error('Missing user context to create company payables settings.');
        }

        const { error: insertError } = await supabase
          .from('payables_settings')
          .insert({
            company_id: currentCompany.id,
            created_by: profile.user_id,
            ...defaults,
            ...payload,
          } as any);

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Failed saving design professional portal settings:', error);
      toast({
        title: 'Error',
        description: (error as any)?.message || 'Could not save design professional portal settings.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (
    file: File,
    field: 'design_professional_signup_background_image_url' | 'design_professional_signup_logo_url',
  ) => {
    if (!currentCompany?.id) return;

    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const filePath = `${currentCompany.id}/design-professional-portal/${field}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('company-logos').getPublicUrl(filePath);
      const saved = await save({ [field]: data.publicUrl } as Partial<DesignProfessionalPortalSettingsData>);
      if (saved) {
        toast({
          title: 'Upload complete',
          description: 'Design professional portal image updated.',
        });
      }
    } catch (error) {
      console.error('Failed uploading design professional portal asset:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload image.',
        variant: 'destructive',
      });
    }
  };

  const publicSignupUrl = currentCompany?.id
    ? `${window.location.origin}/design-professional-signup?company=${encodeURIComponent(currentCompany.id)}`
    : '';

  if (loading) {
    return <div className="text-sm text-muted-foreground"><span className="loading-dots">Loading design professional portal settings</span></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Design Professional Portal</CardTitle>
        <CardDescription>
          Configure design professional signup branding and enable/disable portal access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Enable Design Professional Portal</Label>
            <p className="text-sm text-muted-foreground">Allow design professionals to sign up and access their portal.</p>
          </div>
          <Switch
            checked={settings.design_professional_portal_enabled}
            onCheckedChange={(checked) => void save({ design_professional_portal_enabled: checked })}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Public Signup Link</Label>
          <Input value={publicSignupUrl} readOnly />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(publicSignupUrl);
                toast({ title: 'Link copied', description: 'Design professional signup link copied.' });
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button variant="outline" type="button" asChild>
              <a href={publicSignupUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Signup Page
              </a>
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AssetDropzone
            label="Background Image"
            value={settings.design_professional_signup_background_image_url}
            onUpload={(file) => { void uploadAsset(file, 'design_professional_signup_background_image_url'); }}
            imageClassName="object-cover"
          />
          <AssetDropzone
            label="Company / Header Logo"
            value={settings.design_professional_signup_logo_url}
            onUpload={(file) => { void uploadAsset(file, 'design_professional_signup_logo_url'); }}
            imageClassName="object-contain bg-white/90 p-2"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Signup Header</Label>
            <Input
              value={settings.design_professional_signup_header_title}
              onChange={(e) => setSettings((prev) => ({ ...prev, design_professional_signup_header_title: e.target.value }))}
              onBlur={() => void save()}
            />
          </div>
          <div className="space-y-2">
            <Label>Signup Subheader</Label>
            <Input
              value={settings.design_professional_signup_header_subtitle}
              onChange={(e) => setSettings((prev) => ({ ...prev, design_professional_signup_header_subtitle: e.target.value }))}
              onBlur={() => void save()}
            />
          </div>
        </div>

        {saving && <p className="text-xs text-muted-foreground">Saving...</p>}
      </CardContent>
    </Card>
  );
}
