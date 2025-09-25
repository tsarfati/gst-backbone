import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Save, User, Key, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PinEmployee {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  pin_code: string;
  phone?: string;
  department?: string;
  avatar_url?: string;
  group_id?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

interface EmployeeGroup {
  id: string;
  name: string;
  color: string;
}

export default function PinEmployeeEdit() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [employee, setEmployee] = useState<PinEmployee | null>(null);
  const [groups, setGroups] = useState<EmployeeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const canManageEmployees = profile?.role === 'admin' || profile?.role === 'controller';

  useEffect(() => {
    if (employeeId) {
      fetchEmployee();
      fetchGroups();
    }
  }, [employeeId]);

  const fetchEmployee = async () => {
    if (!employeeId) return;

    try {
      const { data, error } = await supabase
        .from('pin_employees')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (error) throw error;
      setEmployee(data);
    } catch (error) {
      console.error('Error fetching PIN employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employee details',
        variant: 'destructive',
      });
      navigate('/employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_groups')
        .select('*')
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleSave = async () => {
    if (!employee || !canManageEmployees) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('pin_employees')
        .update({
          first_name: employee.first_name,
          last_name: employee.last_name,
          display_name: employee.display_name,
          pin_code: employee.pin_code,
          phone: employee.phone || null,
          department: employee.department || null,
          group_id: employee.group_id || null,
          notes: employee.notes || null,
          is_active: employee.is_active
        })
        .eq('id', employee.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'PIN employee updated successfully',
      });
      
      navigate('/employees');
    } catch (error) {
      console.error('Error updating PIN employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to update employee',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !employee) return;

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
      const fileName = `pin-employees/${employee.id}/avatar.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('pin_employees')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', employee.id);

      if (updateError) throw updateError;

      setEmployee(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null);
      
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

  const generateRandomPin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setEmployee(prev => prev ? { ...prev, pin_code: pin } : null);
  };

  if (!canManageEmployees) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to edit employees.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading employee details...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Employee Not Found</h1>
          <Button onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Employees
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate('/employees')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Employees
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit PIN Employee</h1>
          <p className="text-muted-foreground">
            Manage PIN employee profile and settings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Profile */}
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
                    <AvatarImage src={employee.avatar_url} alt={employee.display_name} />
                    <AvatarFallback className="text-lg">
                      {`${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`}
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
                        value={employee.first_name}
                        onChange={(e) => setEmployee(prev => prev ? { ...prev, first_name: e.target.value } : null)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={employee.last_name}
                        onChange={(e) => setEmployee(prev => prev ? { ...prev, last_name: e.target.value } : null)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="display_name">Display Name</Label>
                    <Input
                      id="display_name"
                      value={employee.display_name}
                      onChange={(e) => setEmployee(prev => prev ? { ...prev, display_name: e.target.value } : null)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                PIN & Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pin_code">PIN Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pin_code"
                      value={employee.pin_code}
                      onChange={(e) => setEmployee(prev => prev ? { ...prev, pin_code: e.target.value } : null)}
                      maxLength={6}
                      pattern="[0-9]{6}"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateRandomPin}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={employee.phone || ''}
                    onChange={(e) => setEmployee(prev => prev ? { ...prev, phone: e.target.value } : null)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={employee.department || ''}
                    onChange={(e) => setEmployee(prev => prev ? { ...prev, department: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="group_id">Employee Group</Label>
                  <Select 
                    value={employee.group_id || 'no-group'} 
                    onValueChange={(value) => setEmployee(prev => prev ? { ...prev, group_id: value === 'no-group' ? null : value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-group">No Group</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={employee.notes || ''}
                  onChange={(e) => setEmployee(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employee Info & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Employee Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                  <Key className="h-3 w-3" />
                  PIN Only Employee
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Employee ID:</strong> {employee.id}</p>
                <p><strong>Created:</strong> {new Date(employee.created_at).toLocaleDateString()}</p>
                <p><strong>Status:</strong> {employee.is_active ? 'Active' : 'Inactive'}</p>
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
                onClick={() => navigate('/employees')}
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