import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Save, User, Shield, Eye, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPinSettings } from '@/components/UserPinSettings';

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin';
  status: string;
  avatar_url?: string;
  has_global_job_access: boolean;
  pin_code?: string;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
}

const roleColors = {
  admin: 'destructive',
  controller: 'secondary', 
  project_manager: 'default',
  employee: 'outline',
  view_only: 'outline',
  company_admin: 'destructive'
} as const;

const roleLabels = {
  admin: 'Administrator',
  controller: 'Controller',
  project_manager: 'Project Manager',
  employee: 'Employee',
  view_only: 'View Only',
  company_admin: 'Company Admin'
};

export default function UserEdit() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isController = profile?.role === 'controller';
  const canManageUsers = isAdmin || isController;

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const fetchUser = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error) {
      console.error('Error fetching user:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user details',
        variant: 'destructive',
      });
      navigate('/settings/users');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !canManageUsers) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: user.first_name,
          last_name: user.last_name,
          display_name: user.display_name,
          role: user.role,
          has_global_job_access: user.has_global_job_access,
          status: user.status
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
      
      navigate('/settings/users');
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 2MB",
        variant: "destructive"
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.user_id}/avatar.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('user_id', user.user_id);

      if (updateError) throw updateError;

      setUser(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null);
      
      toast({
        title: "Success", 
        description: "Avatar updated successfully"
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: "Failed to upload avatar",
        variant: "destructive"
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!canManageUsers) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to edit users.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading user details...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">User Not Found</h1>
          <Button onClick={() => navigate('/settings/users')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate('/settings/users')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit User</h1>
          <p className="text-muted-foreground">
            Manage user profile, role, and permissions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Profile */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6 mb-6">
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user.avatar_url} alt={user.display_name} />
                    <AvatarFallback className="text-lg">
                      {(user.display_name || user.first_name || 'U').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingAvatar}
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                  >
                    {uploadingAvatar ? (
                      <>Uploading...</>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Upload Avatar
                      </>
                    )}
                  </Button>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={user.first_name}
                        onChange={(e) => setUser(prev => prev ? { ...prev, first_name: e.target.value } : null)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={user.last_name}
                        onChange={(e) => setUser(prev => prev ? { ...prev, last_name: e.target.value } : null)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="display_name">Display Name</Label>
                    <Input
                      id="display_name"
                      value={user.display_name}
                      onChange={(e) => setUser(prev => prev ? { ...prev, display_name: e.target.value } : null)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={user.role} 
                    onValueChange={(value) => setUser(prev => prev ? { ...prev, role: value as any } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="controller">Controller</SelectItem>
                      <SelectItem value="project_manager">Project Manager</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="view_only">View Only</SelectItem>
                      <SelectItem value="company_admin">Company Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={user.status} 
                    onValueChange={(value) => setUser(prev => prev ? { ...prev, status: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_global_job_access"
                  checked={user.has_global_job_access}
                  onCheckedChange={(checked) => setUser(prev => prev ? { ...prev, has_global_job_access: !!checked } : null)}
                />
                <Label htmlFor="has_global_job_access">Global Job Access</Label>
              </div>
            </CardContent>
          </Card>

          {user.role === 'employee' && (
            <Card>
              <CardHeader>
                <CardTitle>PIN Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <UserPinSettings
                  userId={user.user_id}
                  currentPin={user.pin_code}
                  userName={user.display_name}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* User Info & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                User Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Badge variant={roleColors[user.role as keyof typeof roleColors]}>
                  {roleLabels[user.role as keyof typeof roleLabels]}
                </Badge>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <p><strong>User ID:</strong> {user.user_id}</p>
                <p><strong>Created:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
                {user.approved_at && (
                  <p><strong>Approved:</strong> {new Date(user.approved_at).toLocaleDateString()}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/settings/users')}
                className="w-full"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}