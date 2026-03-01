import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import DragDropUpload from '@/components/DragDropUpload';
import { ArrowLeft, User, Bell, Save, Camera, Upload, X, Mail, SendHorizonal, Loader2, FileSignature } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProfileData {
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url?: string;
}

interface NotificationSettings {
  id?: string;
  user_id: string;
  company_id: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  overdue_bills: boolean;
  overdue_bills_interval?: string;
  bills_paid: boolean;
  vendor_invitations: boolean;
  job_assignments: boolean;
  receipt_uploaded: boolean;
  financial_overview_enabled?: boolean;
  financial_overview_interval?: string;
  bill_approval_requests?: boolean;
  credit_card_coding_requests?: boolean;
}

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { currentCompany } = useCompany();
  const activeCompanyRole = useActiveCompanyRole();
  const { toast } = useToast();
  
  // Use company-specific role, fallback to profile role
  const displayRole = activeCompanyRole || profile?.role || '';
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    display_name: '',
    avatar_url: ''
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    user_id: user?.id || '',
    company_id: currentCompany?.id || '',
    email_enabled: true,
    in_app_enabled: true,
    overdue_bills: true,
    overdue_bills_interval: 'daily',
    bills_paid: true,
    vendor_invitations: true,
    job_assignments: true,
    receipt_uploaded: true,
    financial_overview_enabled: false,
    financial_overview_interval: 'weekly',
    bill_approval_requests: false,
    credit_card_coding_requests: false,
  });

  useEffect(() => {
    if (profile) {
      setProfileData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        display_name: profile.display_name || '',
        avatar_url: profile.avatar_url || ''
      });
    }
    
    if (user) {
      loadNotificationSettings();
    }
  }, [profile, user]);

  const loadNotificationSettings = async () => {
    if (!user || !currentCompany) return;

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Map database fields to interface fields
        setNotificationSettings({
          ...data,
          overdue_bills: data.overdue_invoices,
          bills_paid: data.invoices_paid,
        });
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    
    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      
      // Delete existing avatar if it exists
      if (profile?.avatar_url) {
        const existingPath = profile.avatar_url.split('/').pop();
        if (existingPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${existingPath}`]);
        }
      }
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = data.publicUrl;

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfileData(prev => ({ ...prev, avatar_url: avatarUrl }));
      await refreshProfile();
      
      toast({
        title: 'Success',
        description: 'Avatar updated successfully',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload avatar',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      uploadAvatar(file);
    } else {
      toast({
        title: 'Error',
        description: 'Please select a valid image file',
        variant: 'destructive',
      });
    }
    event.target.value = '';
  };

  const handleAvatarFile = (file?: File | null) => {
    if (file && file.type.startsWith('image/')) {
      void uploadAvatar(file);
      return;
    }
    toast({
      title: 'Error',
      description: 'Please select a valid image file',
      variant: 'destructive',
    });
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      setShowCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Error',
        description: 'Unable to access camera',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
        uploadAvatar(file);
        stopCamera();
      }
    }, 'image/jpeg', 0.8);
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const saveProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          display_name: profileData.display_name,
          avatar_url: profileData.avatar_url
        })
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshProfile();

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationSettings = async () => {
    if (!user || !currentCompany) return;

    setLoading(true);
    try {
      // Map interface fields back to database fields
      const dbSettings = {
        ...notificationSettings,
        user_id: user.id,
        company_id: currentCompany.id,
        overdue_invoices: notificationSettings.overdue_bills,
        invoices_paid: notificationSettings.bills_paid,
      };
      
      const { error } = await supabase
        .from('notification_settings')
        .upsert(dbSettings, { onConflict: 'user_id,company_id' });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Notification settings updated successfully',
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateNotificationSetting = (key: keyof NotificationSettings, value: boolean) => {
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger 
            value="profile" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger 
            value="notifications" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger 
            value="email" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                General Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avatar Section */}
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {profileData.avatar_url ? (
                      <img 
                        src={profileData.avatar_url} 
                        alt="Avatar" 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startCamera}
                    disabled={uploadingAvatar}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-full max-w-xs">
                  <DragDropUpload
                    onFileSelect={handleAvatarFile}
                    accept=".png,.jpg,.jpeg,.webp,.gif"
                    maxSize={10}
                    size="compact"
                    disabled={uploadingAvatar}
                    title="Drag profile photo here"
                    dropTitle="Drop profile photo here"
                    helperText="Image file up to 10MB"
                  />
                </div>
              </div>

              {/* Camera Modal */}
              {showCamera && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                  <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Take a Photo</h3>
                      <Button variant="ghost" size="sm" onClick={stopCamera}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full rounded-lg"
                        style={{ maxHeight: '300px' }}
                      />
                      
                      <div className="flex justify-center gap-2">
                        <Button onClick={capturePhoto} disabled={uploadingAvatar}>
                          <Camera className="h-4 w-4 mr-2" />
                          Capture
                        </Button>
                        <Button variant="outline" onClick={stopCamera}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <canvas ref={canvasRef} className="hidden" />
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    value={profileData.first_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    value={profileData.last_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={profileData.display_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, display_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed from this page
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role (for {currentCompany?.display_name || currentCompany?.name || 'current company'})</Label>
                <Input
                  id="role"
                  value={displayRole}
                  disabled
                  className="bg-muted capitalize"
                />
                <p className="text-xs text-muted-foreground">
                  Role is managed by administrators for each company
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* General Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">General</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-enabled">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    id="email-enabled"
                    checked={notificationSettings.email_enabled}
                    onCheckedChange={(checked) => updateNotificationSetting('email_enabled', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="in-app-enabled">In-App Notifications</Label>
                    <p className="text-sm text-muted-foreground">Show notifications in the application</p>
                  </div>
                  <Switch
                    id="in-app-enabled"
                    checked={notificationSettings.in_app_enabled}
                    onCheckedChange={(checked) => updateNotificationSetting('in_app_enabled', checked)}
                  />
                </div>
              </div>

              <Separator />

              {/* Specific Notifications */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Notification Types</h3>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="overdue-bills">Overdue Bills</Label>
                        <p className="text-sm text-muted-foreground">Get notified about overdue bills</p>
                      </div>
                      <Switch
                        id="overdue-bills"
                        checked={notificationSettings.overdue_bills}
                        onCheckedChange={(checked) => updateNotificationSetting('overdue_bills', checked)}
                      />
                    </div>
                    {notificationSettings.overdue_bills && (
                      <div className="pl-6">
                        <Label htmlFor="overdue-bills-interval">Notification Frequency</Label>
                        <Select
                          value={notificationSettings.overdue_bills_interval || 'daily'}
                          onValueChange={(value) => setNotificationSettings(prev => ({ ...prev, overdue_bills_interval: value }))}
                        >
                          <SelectTrigger id="overdue-bills-interval" className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="bills-paid">Bill Payments</Label>
                      <p className="text-sm text-muted-foreground">Get notified when bills are paid</p>
                    </div>
                    <Switch
                      id="bills-paid"
                      checked={notificationSettings.bills_paid}
                      onCheckedChange={(checked) => updateNotificationSetting('bills_paid', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="vendor-invitations">Vendor Invitations</Label>
                      <p className="text-sm text-muted-foreground">Get notified about vendor invitations</p>
                    </div>
                    <Switch
                      id="vendor-invitations"
                      checked={notificationSettings.vendor_invitations}
                      onCheckedChange={(checked) => updateNotificationSetting('vendor_invitations', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="job-assignments">Job Assignments</Label>
                      <p className="text-sm text-muted-foreground">Get notified about new job assignments</p>
                    </div>
                    <Switch
                      id="job-assignments"
                      checked={notificationSettings.job_assignments}
                      onCheckedChange={(checked) => updateNotificationSetting('job_assignments', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="receipt-uploaded">Receipt Uploads</Label>
                      <p className="text-sm text-muted-foreground">Get notified when receipts are uploaded</p>
                    </div>
                    <Switch
                      id="receipt-uploaded"
                      checked={notificationSettings.receipt_uploaded}
                      onCheckedChange={(checked) => updateNotificationSetting('receipt_uploaded', checked)}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="financial-overview">Financial Overview Reports</Label>
                        <p className="text-sm text-muted-foreground">Summary of approved bills, overdue payments, and outstanding invoices</p>
                      </div>
                      <Switch
                        id="financial-overview"
                        checked={notificationSettings.financial_overview_enabled || false}
                        onCheckedChange={(checked) => updateNotificationSetting('financial_overview_enabled', checked)}
                      />
                    </div>
                    {notificationSettings.financial_overview_enabled && (
                      <div className="pl-6">
                        <Label htmlFor="financial-overview-interval">Report Frequency</Label>
                        <Select
                          value={notificationSettings.financial_overview_interval || 'weekly'}
                          onValueChange={(value) => setNotificationSettings(prev => ({ ...prev, financial_overview_interval: value }))}
                        >
                          <SelectTrigger id="financial-overview-interval" className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="bill-approval">Bill Approval & Coding Requests</Label>
                      <p className="text-sm text-muted-foreground">Get notified when you're asked to approve or code a bill</p>
                    </div>
                    <Switch
                      id="bill-approval"
                      checked={notificationSettings.bill_approval_requests || false}
                      onCheckedChange={(checked) => updateNotificationSetting('bill_approval_requests', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="credit-card-coding">Credit Card Coding Requests</Label>
                      <p className="text-sm text-muted-foreground">Get notified when you're requested to code a credit card transaction</p>
                    </div>
                    <Switch
                      id="credit-card-coding"
                      checked={notificationSettings.credit_card_coding_requests || false}
                      onCheckedChange={(checked) => updateNotificationSetting('credit_card_coding_requests', checked)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveNotificationSettings} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Notifications'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="email">
          <EmailSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmailSettingsTab() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [settings, setSettings] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    imap_host: '',
    imap_port: 993,
    imap_username: '',
    imap_password: '',
    from_email: '',
    from_name: '',
    use_ssl: true,
    is_configured: false,
    email_signature: '',
  });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('user_email_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setSettings({
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || 587,
          smtp_username: data.smtp_username || '',
          smtp_password: '',
          imap_host: data.imap_host || '',
          imap_port: data.imap_port || 993,
          imap_username: data.imap_username || '',
          imap_password: '',
          from_email: data.from_email || '',
          from_name: data.from_name || '',
          use_ssl: data.use_ssl ?? true,
          is_configured: data.is_configured || false,
          email_signature: data.email_signature || '',
        });
      }
    };
    load();
  }, [user]);

  const saveEmailSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const payload: any = {
        user_id: user.id,
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_username: settings.smtp_username,
        imap_host: settings.imap_host,
        imap_port: settings.imap_port,
        imap_username: settings.imap_username,
        from_email: settings.from_email,
        from_name: settings.from_name,
        use_ssl: settings.use_ssl,
        email_signature: settings.email_signature,
        is_configured: !!(settings.smtp_host && settings.smtp_username && settings.from_email),
      };

      if (settings.smtp_password) {
        payload.smtp_password_encrypted = settings.smtp_password;
      }
      if (settings.imap_password) {
        payload.imap_password_encrypted = settings.imap_password;
      }

      const { error } = await supabase
        .from('user_email_settings')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      toast({ title: 'Success', description: 'Email settings saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const sendTestEmail = async () => {
    const recipient = testEmail || user?.email;
    if (!recipient) {
      toast({ title: 'Error', description: 'Please enter a recipient email address', variant: 'destructive' });
      return;
    }
    if (!settings.is_configured && !settings.smtp_host) {
      toast({ title: 'Error', description: 'Please configure and save your SMTP settings first', variant: 'destructive' });
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          email: recipient,
          companyId: currentCompany?.id || '',
          companyName: currentCompany?.display_name || currentCompany?.name || 'Your Company',
        },
      });

      if (error) throw error;

      toast({ title: 'Test email sent!', description: `A test email was sent to ${recipient}` });
    } catch (err: any) {
      toast({ title: 'Failed to send test email', description: err.message, variant: 'destructive' });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SMTP / IMAP Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure your email settings to send files and messages from your company email address.
          </p>

          {/* From Identity */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Sender Identity</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Name</Label>
                <Input value={settings.from_name} onChange={e => setSettings(p => ({ ...p, from_name: e.target.value }))} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>From Email</Label>
                <Input value={settings.from_email} onChange={e => setSettings(p => ({ ...p, from_email: e.target.value }))} placeholder="john@company.com" />
              </div>
            </div>
          </div>

          <Separator />

          {/* SMTP */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Outgoing Mail (SMTP)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input value={settings.smtp_host} onChange={e => setSettings(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-2">
                <Label>SMTP Port</Label>
                <Input type="number" value={settings.smtp_port} onChange={e => setSettings(p => ({ ...p, smtp_port: parseInt(e.target.value) || 587 }))} />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={settings.smtp_username} onChange={e => setSettings(p => ({ ...p, smtp_username: e.target.value }))} placeholder="your-email@company.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={settings.smtp_password} onChange={e => setSettings(p => ({ ...p, smtp_password: e.target.value }))} placeholder="••••••••" />
              </div>
            </div>
          </div>

          <Separator />

          {/* IMAP */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Incoming Mail (IMAP)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IMAP Host</Label>
                <Input value={settings.imap_host} onChange={e => setSettings(p => ({ ...p, imap_host: e.target.value }))} placeholder="imap.gmail.com" />
              </div>
              <div className="space-y-2">
                <Label>IMAP Port</Label>
                <Input type="number" value={settings.imap_port} onChange={e => setSettings(p => ({ ...p, imap_port: parseInt(e.target.value) || 993 }))} />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={settings.imap_username} onChange={e => setSettings(p => ({ ...p, imap_username: e.target.value }))} placeholder="your-email@company.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={settings.imap_password} onChange={e => setSettings(p => ({ ...p, imap_password: e.target.value }))} placeholder="••••••••" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={settings.use_ssl} onCheckedChange={v => setSettings(p => ({ ...p, use_ssl: v }))} />
            <Label>Use SSL/TLS</Label>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveEmailSettings} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Email Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SendHorizonal className="h-5 w-5" />
            Test Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Send a test email to verify your email configuration is working correctly.
          </p>
          <div className="flex gap-3">
            <Input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder={user?.email || 'recipient@example.com'}
              className="flex-1"
            />
            <Button onClick={sendTestEmail} disabled={sendingTest} variant="outline">
              {sendingTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SendHorizonal className="h-4 w-4 mr-2" />}
              {sendingTest ? 'Sending...' : 'Send Test'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave blank to send to your account email ({user?.email})
          </p>
        </CardContent>
      </Card>

      {/* Email Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Email Signature
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set your email signature that will be automatically appended to all outgoing emails.
          </p>
          <Textarea
            value={settings.email_signature}
            onChange={e => setSettings(p => ({ ...p, email_signature: e.target.value }))}
            placeholder={"Best regards,\nJohn Doe\nProject Manager\nABC Construction Co.\n(555) 123-4567"}
            rows={6}
          />
          {settings.email_signature && (
            <div className="border rounded-md p-4 bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
              <div className="text-sm whitespace-pre-wrap">{settings.email_signature}</div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={saveEmailSettings} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Signature'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
