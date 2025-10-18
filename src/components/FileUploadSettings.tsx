import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Info, Save } from 'lucide-react';

interface FileUploadSettings {
  receipt_naming_pattern: string;
  bill_naming_pattern: string;
  subcontract_naming_pattern: string;
  enable_google_drive: boolean;
  google_drive_folder_id: string;
  enable_onedrive: boolean;
  onedrive_folder_id: string;
  enable_ftp: boolean;
  ftp_host: string;
  ftp_port: number;
  ftp_username: string;
  ftp_password: string;
  ftp_folder_path: string;
}

export default function FileUploadSettings() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<FileUploadSettings>({
    receipt_naming_pattern: '{vendor}_{date}_{amount}',
    bill_naming_pattern: '{vendor}_{invoice_number}_{date}',
    subcontract_naming_pattern: '{vendor}_{contract_number}_{date}',
    enable_google_drive: false,
    google_drive_folder_id: '',
    enable_onedrive: false,
    onedrive_folder_id: '',
    enable_ftp: false,
    ftp_host: '',
    ftp_port: 21,
    ftp_username: '',
    ftp_password: '',
    ftp_folder_path: '/',
  });

  useEffect(() => {
    if (currentCompany) {
      fetchSettings();
    }
  }, [currentCompany]);

  const fetchSettings = async () => {
    if (!currentCompany) return;

    const { data, error } = await supabase
      .from('file_upload_settings')
      .select('*')
      .eq('company_id', currentCompany.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      return;
    }

    if (data) {
      setSettings({
        receipt_naming_pattern: data.receipt_naming_pattern || '{vendor}_{date}_{amount}',
        bill_naming_pattern: data.bill_naming_pattern || '{vendor}_{invoice_number}_{date}',
        subcontract_naming_pattern: data.subcontract_naming_pattern || '{vendor}_{contract_number}_{date}',
        enable_google_drive: data.enable_google_drive || false,
        google_drive_folder_id: data.google_drive_folder_id || '',
        enable_onedrive: data.enable_onedrive || false,
        onedrive_folder_id: data.onedrive_folder_id || '',
        enable_ftp: data.enable_ftp || false,
        ftp_host: data.ftp_host || '',
        ftp_port: data.ftp_port || 21,
        ftp_username: data.ftp_username || '',
        ftp_password: data.ftp_password || '',
        ftp_folder_path: data.ftp_folder_path || '/',
      });
    }
  };

  const handleSave = async () => {
    if (!currentCompany) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('file_upload_settings')
        .upsert({
          company_id: currentCompany.id,
          created_by: user.id,
          receipt_naming_pattern: settings.receipt_naming_pattern,
          bill_naming_pattern: settings.bill_naming_pattern,
          subcontract_naming_pattern: settings.subcontract_naming_pattern,
          enable_google_drive: settings.enable_google_drive,
          google_drive_folder_id: settings.google_drive_folder_id,
          enable_onedrive: settings.enable_onedrive,
          onedrive_folder_id: settings.onedrive_folder_id,
          enable_ftp: settings.enable_ftp,
          ftp_host: settings.ftp_host,
          ftp_port: settings.ftp_port,
          ftp_username: settings.ftp_username,
          ftp_password: settings.ftp_password,
          ftp_folder_path: settings.ftp_folder_path,
        } as any, {
          onConflict: 'company_id'
        });

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'File upload settings have been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="naming" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="naming">File Naming</TabsTrigger>
          <TabsTrigger value="storage">3rd Party Storage</TabsTrigger>
        </TabsList>

        <TabsContent value="naming" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Receipt File Naming</CardTitle>
              <CardDescription>
                Configure how receipt files are automatically renamed on upload
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Available variables: {'{vendor}'}, {'{date}'}, {'{amount}'}, {'{job}'}, {'{cost_code}'}, {'{original_filename}'}
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="receipt-pattern">Naming Pattern</Label>
                <Input
                  id="receipt-pattern"
                  value={settings.receipt_naming_pattern}
                  onChange={(e) => setSettings({ ...settings, receipt_naming_pattern: e.target.value })}
                  placeholder="{vendor}_{date}_{amount}"
                />
                <p className="text-xs text-muted-foreground">
                  Example: Home_Depot_2025-01-15_150.00.pdf
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bill File Naming</CardTitle>
              <CardDescription>
                Configure how bill files are automatically renamed on upload
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Available variables: {'{vendor}'}, {'{invoice_number}'}, {'{date}'}, {'{amount}'}, {'{job}'}, {'{original_filename}'}
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="bill-pattern">Naming Pattern</Label>
                <Input
                  id="bill-pattern"
                  value={settings.bill_naming_pattern}
                  onChange={(e) => setSettings({ ...settings, bill_naming_pattern: e.target.value })}
                  placeholder="{vendor}_{invoice_number}_{date}"
                />
                <p className="text-xs text-muted-foreground">
                  Example: ABC_Supply_INV-12345_2025-01-15.pdf
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subcontract File Naming</CardTitle>
              <CardDescription>
                Configure how subcontract files are automatically renamed on upload
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Available variables: {'{vendor}'}, {'{contract_number}'}, {'{date}'}, {'{amount}'}, {'{job}'}, {'{original_filename}'}
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="subcontract-pattern">Naming Pattern</Label>
                <Input
                  id="subcontract-pattern"
                  value={settings.subcontract_naming_pattern}
                  onChange={(e) => setSettings({ ...settings, subcontract_naming_pattern: e.target.value })}
                  placeholder="{vendor}_{contract_number}_{date}"
                />
                <p className="text-xs text-muted-foreground">
                  Example: Plumbing_Co_SC-001_2025-01-15.pdf
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Google Drive Integration</CardTitle>
              <CardDescription>
                Automatically sync uploaded files to Google Drive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-google-drive">Enable Google Drive Sync</Label>
                <Switch
                  id="enable-google-drive"
                  checked={settings.enable_google_drive}
                  onCheckedChange={(checked) => setSettings({ ...settings, enable_google_drive: checked })}
                />
              </div>
              {settings.enable_google_drive && (
                <div className="space-y-2">
                  <Label htmlFor="google-folder-id">Google Drive Folder ID</Label>
                  <Input
                    id="google-folder-id"
                    value={settings.google_drive_folder_id}
                    onChange={(e) => setSettings({ ...settings, google_drive_folder_id: e.target.value })}
                    placeholder="Enter folder ID from Google Drive URL"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OneDrive Integration</CardTitle>
              <CardDescription>
                Automatically sync uploaded files to Microsoft OneDrive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-onedrive">Enable OneDrive Sync</Label>
                <Switch
                  id="enable-onedrive"
                  checked={settings.enable_onedrive}
                  onCheckedChange={(checked) => setSettings({ ...settings, enable_onedrive: checked })}
                />
              </div>
              {settings.enable_onedrive && (
                <div className="space-y-2">
                  <Label htmlFor="onedrive-folder-id">OneDrive Folder ID</Label>
                  <Input
                    id="onedrive-folder-id"
                    value={settings.onedrive_folder_id}
                    onChange={(e) => setSettings({ ...settings, onedrive_folder_id: e.target.value })}
                    placeholder="Enter OneDrive folder ID"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FTP Server Integration</CardTitle>
              <CardDescription>
                Automatically sync uploaded files to an FTP server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-ftp">Enable FTP Sync</Label>
                <Switch
                  id="enable-ftp"
                  checked={settings.enable_ftp}
                  onCheckedChange={(checked) => setSettings({ ...settings, enable_ftp: checked })}
                />
              </div>
              {settings.enable_ftp && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ftp-host">FTP Host</Label>
                      <Input
                        id="ftp-host"
                        value={settings.ftp_host}
                        onChange={(e) => setSettings({ ...settings, ftp_host: e.target.value })}
                        placeholder="ftp.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ftp-port">Port</Label>
                      <Input
                        id="ftp-port"
                        type="number"
                        value={settings.ftp_port}
                        onChange={(e) => setSettings({ ...settings, ftp_port: parseInt(e.target.value) || 21 })}
                        placeholder="21"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ftp-username">Username</Label>
                    <Input
                      id="ftp-username"
                      value={settings.ftp_username}
                      onChange={(e) => setSettings({ ...settings, ftp_username: e.target.value })}
                      placeholder="FTP username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ftp-password">Password</Label>
                    <Input
                      id="ftp-password"
                      type="password"
                      value={settings.ftp_password}
                      onChange={(e) => setSettings({ ...settings, ftp_password: e.target.value })}
                      placeholder="FTP password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ftp-folder">Remote Folder Path</Label>
                    <Input
                      id="ftp-folder"
                      value={settings.ftp_folder_path}
                      onChange={(e) => setSettings({ ...settings, ftp_folder_path: e.target.value })}
                      placeholder="/uploads"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
