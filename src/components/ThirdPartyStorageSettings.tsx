import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, XCircle, Loader2, Save, HardDrive, ChevronDown, ChevronRight } from 'lucide-react';
import GoogleDriveFolderPicker from '@/components/GoogleDriveFolderPicker';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SyncSettings {
  sync_photos: boolean;
  sync_filing_cabinet: boolean;
  sync_subcontracts: boolean;
  sync_permits: boolean;
  sync_delivery_tickets: boolean;
  sync_receipts: boolean;
  sync_bills: boolean;
}

interface CompanySyncSettings {
  sync_company_permits: boolean;
  sync_company_contracts: boolean;
  sync_company_insurance: boolean;
  sync_company_files: boolean;
}

interface JobWithSync {
  id: string;
  name: string;
  settings: SyncSettings;
  isOpen: boolean;
}

export default function ThirdPartyStorageSettings() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [checkingDrive, setCheckingDrive] = useState(true);
  const [enableGoogleDrive, setEnableGoogleDrive] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [companySyncSettings, setCompanySyncSettings] = useState<CompanySyncSettings>({
    sync_company_permits: false,
    sync_company_contracts: false,
    sync_company_insurance: false,
    sync_company_files: false,
  });
  const [jobs, setJobs] = useState<JobWithSync[]>([]);

  // OneDrive / FTP settings
  const [enableOnedrive, setEnableOnedrive] = useState(false);
  const [onedriveFolderId, setOnedriveFolderId] = useState('');
  const [enableFtp, setEnableFtp] = useState(false);
  const [ftpHost, setFtpHost] = useState('');
  const [ftpPort, setFtpPort] = useState(21);
  const [ftpUsername, setFtpUsername] = useState('');
  const [ftpPassword, setFtpPassword] = useState('');
  const [ftpFolderPath, setFtpFolderPath] = useState('/');

  useEffect(() => {
    if (currentCompany) {
      checkDriveConnection();
      fetchJobs();
      fetchSyncSettings();
      fetchFileUploadSettings();
    }
  }, [currentCompany]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-drive-auth') {
        if (event.data.status === 'success') {
          setDriveConnected(true);
          setEnableGoogleDrive(true);
          toast({ title: 'Google Drive Connected', description: event.data.message });
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
        setDriveFolderId(data.folder_id || '');
        setEnableGoogleDrive(true);
      }
    } catch {
      setDriveConnected(false);
    } finally {
      setCheckingDrive(false);
    }
  };

  const fetchJobs = async () => {
    if (!currentCompany) return;
    const { data } = await supabase
      .from('jobs')
      .select('id, name')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true)
      .order('name');
    if (data) {
      setJobs(data.map(j => ({
        id: j.id,
        name: j.name,
        settings: {
          sync_photos: false,
          sync_filing_cabinet: false,
          sync_subcontracts: false,
          sync_permits: false,
          sync_delivery_tickets: false,
          sync_receipts: false,
          sync_bills: false,
        },
        isOpen: false,
      })));
    }
  };

  const fetchSyncSettings = async () => {
    if (!currentCompany) return;
    const { data } = await supabase
      .from('google_drive_sync_settings' as any)
      .select('*')
      .eq('company_id', currentCompany.id);
    
    if (data && Array.isArray(data)) {
      data.forEach((setting: any) => {
        if (!setting.job_id) {
          setCompanySyncSettings({
            sync_company_permits: setting.sync_company_permits || false,
            sync_company_contracts: setting.sync_company_contracts || false,
            sync_company_insurance: setting.sync_company_insurance || false,
            sync_company_files: setting.sync_company_files || false,
          });
        } else {
          setJobs(prev => prev.map(j => 
            j.id === setting.job_id ? {
              ...j,
              settings: {
                sync_photos: setting.sync_photos || false,
                sync_filing_cabinet: setting.sync_filing_cabinet || false,
                sync_subcontracts: setting.sync_subcontracts || false,
                sync_permits: setting.sync_permits || false,
                sync_delivery_tickets: setting.sync_delivery_tickets || false,
                sync_receipts: setting.sync_receipts || false,
                sync_bills: setting.sync_bills || false,
              }
            } : j
          ));
        }
      });
    }
  };

  const fetchFileUploadSettings = async () => {
    if (!currentCompany) return;
    const { data } = await supabase
      .from('file_upload_settings')
      .select('*')
      .eq('company_id', currentCompany.id)
      .maybeSingle();
    if (data) {
      setEnableOnedrive(data.enable_onedrive || false);
      setOnedriveFolderId(data.onedrive_folder_id || '');
      setEnableFtp(data.enable_ftp || false);
      setFtpHost(data.ftp_host || '');
      setFtpPort(data.ftp_port || 21);
      setFtpUsername(data.ftp_username || '');
      setFtpPassword(data.ftp_password || '');
      setFtpFolderPath(data.ftp_folder_path || '/');
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
      setEnableGoogleDrive(false);
      toast({ title: 'Disconnected', description: 'Google Drive has been disconnected.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setDriveLoading(false);
    }
  };

  const toggleJobOpen = (jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, isOpen: !j.isOpen } : j));
  };

  const updateJobSyncSetting = (jobId: string, key: keyof SyncSettings, value: boolean) => {
    setJobs(prev => prev.map(j => 
      j.id === jobId ? { ...j, settings: { ...j.settings, [key]: value } } : j
    ));
  };

  const handleSave = async () => {
    if (!currentCompany || !user) return;
    setLoading(true);
    try {
      // Save company-level sync settings
      await supabase
        .from('google_drive_sync_settings' as any)
        .upsert({
          company_id: currentCompany.id,
          job_id: null,
          ...companySyncSettings,
        } as any, { onConflict: 'company_id,job_id' });

      // Save per-job sync settings
      for (const job of jobs) {
        const hasAnySyncEnabled = Object.values(job.settings).some(v => v);
        if (hasAnySyncEnabled) {
          await supabase
            .from('google_drive_sync_settings' as any)
            .upsert({
              company_id: currentCompany.id,
              job_id: job.id,
              ...job.settings,
            } as any, { onConflict: 'company_id,job_id' });
        }
      }

      // Save file upload settings (OneDrive/FTP)
      await supabase
        .from('file_upload_settings')
        .upsert({
          company_id: currentCompany.id,
          created_by: user.id,
          enable_google_drive: enableGoogleDrive,
          google_drive_folder_id: driveFolderId,
          enable_onedrive: enableOnedrive,
          onedrive_folder_id: onedriveFolderId,
          enable_ftp: enableFtp,
          ftp_host: ftpHost,
          ftp_port: ftpPort,
          ftp_username: ftpUsername,
          ftp_password: ftpPassword,
          ftp_folder_path: ftpFolderPath,
        } as any, { onConflict: 'company_id' });

      toast({ title: 'Settings saved', description: 'Third-party storage settings updated.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const syncCheckboxItems: { key: keyof SyncSettings; label: string }[] = [
    { key: 'sync_photos', label: 'Photos' },
    { key: 'sync_filing_cabinet', label: 'Filing Cabinet' },
    { key: 'sync_subcontracts', label: 'Subcontracts' },
    { key: 'sync_permits', label: 'Permits' },
    { key: 'sync_delivery_tickets', label: 'Delivery Tickets' },
    { key: 'sync_receipts', label: 'Receipts' },
    { key: 'sync_bills', label: 'Bills' },
  ];

  return (
    <div className="space-y-6">
      {/* Google Drive */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
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
              ? 'Google Drive is connected. Configure what data to sync below.'
              : 'Connect your Google Drive to automatically sync files.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!checkingDrive && !driveConnected && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-muted-foreground text-center">
                Connect your Google account to enable automatic file syncing.
              </p>
              <Button size="lg" onClick={connectGoogleDrive} disabled={driveLoading}>
                {driveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect Google Drive
              </Button>
            </div>
          )}
          {checkingDrive && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Checking connection...</span>
            </div>
          )}
          {driveConnected && (
            <>
              <div className="flex items-center justify-between">
                <Label>Enable Google Drive Sync</Label>
                <Switch checked={enableGoogleDrive} onCheckedChange={setEnableGoogleDrive} />
              </div>
              {enableGoogleDrive && currentCompany && (
                <>
                  <div className="space-y-2">
                    <Label>Root Sync Folder</Label>
                    <GoogleDriveFolderPicker
                      companyId={currentCompany.id}
                      selectedFolderId={driveFolderId}
                      selectedFolderName=""
                      onSelect={(folderId, folderName) => {
                        setDriveFolderId(folderId);
                        supabase
                          .from('google_drive_tokens')
                          .update({ folder_id: folderId, folder_name: folderName } as any)
                          .eq('company_id', currentCompany.id)
                          .then(() => {});
                        toast({ title: 'Folder selected', description: `Files will sync to "${folderName}"` });
                      }}
                    />
                  </div>

                  <Separator />

                  {/* Company-level sync */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Company Data Sync</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { key: 'sync_company_permits' as const, label: 'Company Permits' },
                        { key: 'sync_company_contracts' as const, label: 'Company Contracts' },
                        { key: 'sync_company_insurance' as const, label: 'Company Insurance' },
                        { key: 'sync_company_files' as const, label: 'Company Files' },
                      ]).map(item => (
                        <div key={item.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={item.key}
                            checked={companySyncSettings[item.key]}
                            onCheckedChange={(checked) =>
                              setCompanySyncSettings(prev => ({ ...prev, [item.key]: !!checked }))
                            }
                          />
                          <Label htmlFor={item.key} className="text-sm">{item.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Per-job sync */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Job Data Sync</Label>
                    <p className="text-sm text-muted-foreground">Choose what to sync for each job.</p>
                    {jobs.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No active jobs found.</p>
                    ) : (
                      <div className="space-y-2">
                        {jobs.map(job => (
                          <Collapsible key={job.id} open={job.isOpen} onOpenChange={() => toggleJobOpen(job.id)}>
                            <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left">
                              {job.isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span className="font-medium text-sm">{job.name}</span>
                              {Object.values(job.settings).some(v => v) && (
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {Object.values(job.settings).filter(v => v).length} synced
                                </span>
                              )}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="grid grid-cols-2 gap-3 p-3 ml-6 mt-1 border-l-2 border-primary/20">
                                {syncCheckboxItems.map(item => (
                                  <div key={item.key} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`${job.id}-${item.key}`}
                                      checked={job.settings[item.key]}
                                      onCheckedChange={(checked) =>
                                        updateJobSyncSetting(job.id, item.key, !!checked)
                                      }
                                    />
                                    <Label htmlFor={`${job.id}-${item.key}`} className="text-sm">{item.label}</Label>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              <Button variant="destructive" size="sm" onClick={disconnectGoogleDrive} disabled={driveLoading}>
                {driveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disconnect Google Drive
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* OneDrive */}
      <Card>
        <CardHeader>
          <CardTitle>OneDrive Integration</CardTitle>
          <CardDescription>Automatically sync uploaded files to Microsoft OneDrive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-onedrive">Enable OneDrive Sync</Label>
            <Switch id="enable-onedrive" checked={enableOnedrive} onCheckedChange={setEnableOnedrive} />
          </div>
          {enableOnedrive && (
            <div className="space-y-2">
              <Label htmlFor="onedrive-folder-id">OneDrive Folder ID</Label>
              <Input
                id="onedrive-folder-id"
                value={onedriveFolderId}
                onChange={(e) => setOnedriveFolderId(e.target.value)}
                placeholder="Enter OneDrive folder ID"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* FTP */}
      <Card>
        <CardHeader>
          <CardTitle>FTP Server Integration</CardTitle>
          <CardDescription>Automatically sync uploaded files to an FTP server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-ftp">Enable FTP Sync</Label>
            <Switch id="enable-ftp" checked={enableFtp} onCheckedChange={setEnableFtp} />
          </div>
          {enableFtp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ftp-host">FTP Host</Label>
                  <Input id="ftp-host" value={ftpHost} onChange={(e) => setFtpHost(e.target.value)} placeholder="ftp.example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ftp-port">Port</Label>
                  <Input id="ftp-port" type="number" value={ftpPort} onChange={(e) => setFtpPort(parseInt(e.target.value) || 21)} placeholder="21" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ftp-username">Username</Label>
                <Input id="ftp-username" value={ftpUsername} onChange={(e) => setFtpUsername(e.target.value)} placeholder="FTP username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ftp-password">Password</Label>
                <Input id="ftp-password" type="password" value={ftpPassword} onChange={(e) => setFtpPassword(e.target.value)} placeholder="FTP password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ftp-folder">Remote Folder Path</Label>
                <Input id="ftp-folder" value={ftpFolderPath} onChange={(e) => setFtpFolderPath(e.target.value)} placeholder="/uploads" />
              </div>
            </div>
          )}
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
