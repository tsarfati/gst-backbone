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
    
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { company_id: currentCompany.id },
      });
      if (error) throw error;
      if (data?.url) {
        // Use full-page redirect instead of popup — Google blocks OAuth in popups/iframes
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      <Card>
        <CardHeader>
          <CardTitle>Receipt File Naming</CardTitle>
          <CardDescription>Configure how receipt files are automatically renamed on upload</CardDescription>
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
            <p className="text-xs text-muted-foreground">Example: Home_Depot_2025-01-15_150.00.pdf</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bill File Naming</CardTitle>
          <CardDescription>Configure how bill files are automatically renamed on upload</CardDescription>
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
            <p className="text-xs text-muted-foreground">Example: ABC_Supply_INV-12345_2025-01-15.pdf</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subcontract File Naming</CardTitle>
          <CardDescription>Configure how subcontract files are automatically renamed on upload</CardDescription>
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
            <p className="text-xs text-muted-foreground">Example: Plumbing_Co_SC-001_2025-01-15.pdf</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank Statement File Naming</CardTitle>
          <CardDescription>Configure how bank statement files are automatically renamed on upload</CardDescription>
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
            <p className="text-xs text-muted-foreground">Example: Chase_Operating_Account_02_2025.pdf</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
