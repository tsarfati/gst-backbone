import { useState, useEffect, useRef } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MessageSquare } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

interface SmsSettings {
  id?: string;
  sms_enabled: boolean;
  provider: string;
  account_sid: string;
  auth_token: string;
  phone_number: string;
}

export default function CompanySmsSettings() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { settings: appSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const autoSaveReadyRef = useRef(false);
  const [settings, setSettings] = useState<SmsSettings>({
    sms_enabled: false,
    provider: 'twilio',
    account_sid: '',
    auth_token: '',
    phone_number: '',
  });

  useEffect(() => {
    if (currentCompany?.id) {
      loadSettings();
    }
  }, [currentCompany?.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_sms_settings')
        .select('*')
        .eq('company_id', currentCompany!.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          id: data.id,
          sms_enabled: data.sms_enabled,
          provider: data.provider,
          account_sid: data.account_sid || '',
          auth_token: data.auth_token || '',
          phone_number: data.phone_number || '',
        });
      }
      autoSaveReadyRef.current = true;
    } catch (error) {
      console.error('Error loading SMS settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load SMS settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (showToast: boolean = true) => {
    try {
      setSaving(true);

      const payload = {
        company_id: currentCompany!.id,
        sms_enabled: settings.sms_enabled,
        provider: settings.provider,
        account_sid: settings.account_sid,
        auth_token: settings.auth_token,
        phone_number: settings.phone_number,
        created_by: (await supabase.auth.getUser()).data.user!.id,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('company_sms_settings')
          .update(payload)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_sms_settings')
          .insert([payload]);

        if (error) throw error;
      }

      if (showToast) {
        toast({
          title: 'Success',
          description: 'SMS settings saved successfully',
        });
      }

      await loadSettings();
    } catch (error) {
      console.error('Error saving SMS settings:', error);
      if (showToast) {
        toast({
          title: 'Error',
          description: 'Failed to save SMS settings',
          variant: 'destructive',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!appSettings.autoSave || loading || saving || !currentCompany?.id || !autoSaveReadyRef.current) return;

    const timer = setTimeout(() => {
      void handleSave(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [settings, appSettings.autoSave, loading, saving, currentCompany?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS/Text Messaging Configuration
          </CardTitle>
          <CardDescription>
            Configure SMS provider settings for sending text messages. Each company can use their own API keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sms-enabled">Enable SMS</Label>
              <p className="text-sm text-muted-foreground">
                Allow this company to send text messages
              </p>
            </div>
            <Switch
              id="sms-enabled"
              checked={settings.sms_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, sms_enabled: checked })
              }
            />
          </div>

          {settings.sms_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="provider">SMS Provider</Label>
                <Select
                  value={settings.provider}
                  onValueChange={(value) =>
                    setSettings({ ...settings, provider: value })
                  }
                >
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">Twilio</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Currently only Twilio is supported
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-sid">Account SID</Label>
                <Input
                  id="account-sid"
                  type="text"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={settings.account_sid}
                  onChange={(e) =>
                    setSettings({ ...settings, account_sid: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Your Twilio Account SID
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-token">Auth Token</Label>
                <Input
                  id="auth-token"
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={settings.auth_token}
                  onChange={(e) =>
                    setSettings({ ...settings, auth_token: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Your Twilio Auth Token (stored securely)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-number">Twilio Phone Number</Label>
                <Input
                  id="phone-number"
                  type="tel"
                  placeholder="+1234567890"
                  value={settings.phone_number}
                  onChange={(e) =>
                    setSettings({ ...settings, phone_number: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Your Twilio phone number with country code (e.g., +1234567890)
                </p>
              </div>
            </>
          )}

          {!appSettings.autoSave && (
            <div className="flex justify-end pt-4">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save SMS Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
