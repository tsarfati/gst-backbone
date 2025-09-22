import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, User, Bell, Save } from 'lucide-react';
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
  email_enabled: boolean;
  in_app_enabled: boolean;
  overdue_bills: boolean;
  bills_paid: boolean;
  vendor_invitations: boolean;
  job_assignments: boolean;
  receipt_uploaded: boolean;
}

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    display_name: '',
    avatar_url: ''
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    user_id: user?.id || '',
    email_enabled: true,
    in_app_enabled: true,
    overdue_bills: true,
    bills_paid: true,
    vendor_invitations: true,
    job_assignments: true,
    receipt_uploaded: true,
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
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
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
    if (!user) return;

    setLoading(true);
    try {
      // Map interface fields back to database fields
      const dbSettings = {
        ...notificationSettings,
        overdue_invoices: notificationSettings.overdue_bills,
        invoices_paid: notificationSettings.bills_paid,
      };
      
      const { error } = await supabase
        .from('notification_settings')
        .upsert(dbSettings, { onConflict: 'user_id' });

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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile information and notification preferences
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
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
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={profile?.role || ''}
                  disabled
                  className="bg-muted capitalize"
                />
                <p className="text-xs text-muted-foreground">
                  Role is managed by administrators
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
      </Tabs>
    </div>
  );
}