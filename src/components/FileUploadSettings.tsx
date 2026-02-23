import { useState, useEffect, useCallback } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { Info, Save, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import GoogleDriveFolderPicker from '@/components/GoogleDriveFolderPicker';

interface FileUploadSettings {
  receipt_naming_pattern: string;
  bill_naming_pattern: string;
  subcontract_naming_pattern: string;
  bank_statement_naming_pattern: string;
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

export default function FileUploadSettingsComponent() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [checkingDrive, setCheckingDrive] = useState(true);
  const [settings, setSettings] = useState<FileUploadSettings>({
    receipt_naming_pattern: '{vendor}_{date}_{amount}',
    bill_naming_pattern: '{vendor}_{invoice_number}_{date}',
    subcontract_naming_pattern: '{vendor}_{contract_number}_{date}',
    bank_statement_naming_pattern: '{bank_name}_{account_name}_{month}_{year}',
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
      checkDriveConnection();
    }
  }, [currentCompany]);

  // Listen for Google Drive OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-drive-auth') {
        if (event.data.status === 'success') {
          setDriveConnected(true);
          setSettings(prev => ({ ...prev, enable_google_drive: true }));
          toast({ title: 'Google Drive Connected', description: event.data.message });
          // Update connected_by
          if (currentCompany && user) {
            supabase.from('google_drive_tokens')
              .update({ connected_by: user.id })
              .eq('company_id', currentCompany.id)
              .then(() => {});
          }
        } else {
          toast({ title: 'Connection Failed', description: event.data.message, variant: 'destructive' });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentCompany, user]);

  const checkDriveConnection = async () => {
    if (!currentCompany) return;
    setCheckingDrive(true);
    try {
      const { data } = await supabase
        .from('google_drive_tokens')
        .select('id, folder_id, folder_name')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      setDriveConnected(!!data);
      if (data?.folder_id) {
        setSettings(prev => ({
          ...prev,
          google_drive_folder_id: data.folder_id || '',
          enable_google_drive: true,
        }));
      }
    } catch {
      setDriveConnected(false);
    } finally {
      setCheckingDrive(false);
    }
  };

  const connectGoogleDrive = async () => {
    if (!currentCompany) return;
    setDriveLoading(true);
    
    // Open the popup immediately on user click to avoid popup blockers
    const popup = window.open('about:blank', 'google-drive-auth', 'width=600,height=700,popup=true');
    
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { company_id: currentCompany.id },
      });
      if (error) throw error;
      if (data?.url && popup) {
        popup.location.href = data.url;
      } else if (data?.url) {
        // Fallback if popup was blocked
        window.open(data.url, 'google-drive-auth', 'width=600,height=700,popup=true');
      }
    } catch (error: any) {
      popup?.close();
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setDriveLoading(false);
    }
  };

  const disconnectGoogleDrive = async () => {
    if (!currentCompany) return;
    setDriveLoading(true);
    try {
      const { error } = await supabase
        .from('google_drive_tokens')
        .delete()
        .eq('company_id', currentCompany.id);
      if (error) throw error;
      setDriveConnected(false);
      setSettings(prev => ({ ...prev, enable_google_drive: false }));
      toast({ title: 'Disconnected', description: 'Google Drive has been disconnected.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setDriveLoading(false);
    }
  };

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
        bank_statement_naming_pattern: data.bank_statement_naming_pattern || '{bank_name}_{account_name}_{month}_{year}',
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
          bank_statement_naming_pattern: settings.bank_statement_naming_pattern,
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

          <Card>
            <CardHeader>
              <CardTitle>Bank Statement File Naming</CardTitle>
              <CardDescription>
                Configure how bank statement files are automatically renamed on upload
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Available variables: {'{bank_name}'}, {'{account_name}'}, {'{month}'}, {'{year}'}, {'{date}'}, {'{original_filename}'}
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="bank-statement-pattern">Naming Pattern</Label>
                <Input
                  id="bank-statement-pattern"
                  value={settings.bank_statement_naming_pattern}
                  onChange={(e) => setSettings({ ...settings, bank_statement_naming_pattern: e.target.value })}
                  placeholder="{bank_name}_{account_name}_{month}_{year}"
                />
                <p className="text-xs text-muted-foreground">
                  Example: Chase_Operating_Account_02_2025.pdf
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Google Drive Integration
                {checkingDrive ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : driveConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </CardTitle>
              <CardDescription>
                {driveConnected 
                  ? 'Google Drive is connected. Files will sync automatically when enabled.'
                  : 'Connect your Google Drive to automatically sync uploaded files.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {driveConnected ? (
                <>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enable-google-drive">Enable Google Drive Sync</Label>
                    <Switch
                      id="enable-google-drive"
                      checked={settings.enable_google_drive}
                      onCheckedChange={(checked) => setSettings({ ...settings, enable_google_drive: checked })}
                    />
                  </div>
                  {settings.enable_google_drive && currentCompany && (
                    <div className="space-y-2">
                      <Label>Select Sync Folder</Label>
                      <GoogleDriveFolderPicker
                        companyId={currentCompany.id}
                        selectedFolderId={settings.google_drive_folder_id}
                        selectedFolderName=""
                        onSelect={(folderId, folderName) => {
                          setSettings(prev => ({ ...prev, google_drive_folder_id: folderId }));
                          if (currentCompany) {
                            supabase
                              .from('google_drive_tokens')
                              .update({ folder_id: folderId, folder_name: folderName } as any)
                              .eq('company_id', currentCompany.id)
                              .then(() => {});
                          }
                          toast({ title: 'Folder selected', description: `Files will sync to "${folderName}"` });
                        }}
                      />
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={disconnectGoogleDrive}
                    disabled={driveLoading}
                  >
                    {driveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Disconnect Google Drive
                  </Button>
                </>
              ) : (
                <Button
                  onClick={connectGoogleDrive}
                  disabled={driveLoading}
                >
                  {driveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect Google Drive
                </Button>
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
