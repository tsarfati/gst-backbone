import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Save, User, Shield, Eye, Camera, Briefcase, Calendar, Code, Key } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPinSettings } from '@/components/UserPinSettings';

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin' | 'vendor';
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
  company_admin: 'destructive',
  vendor: 'secondary'
} as const;

const roleLabels = {
  admin: 'Administrator',
  controller: 'Controller',
  project_manager: 'Project Manager',
  employee: 'Employee',
  view_only: 'View Only',
  company_admin: 'Company Admin',
  vendor: 'Vendor'
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
  const [jobs, setJobs] = useState<any[]>([]);
  const [userJobAccess, setUserJobAccess] = useState<string[]>([]);
  const [costCodes, setCostCodes] = useState<any[]>([]);
  const [assignedCostCodes, setAssignedCostCodes] = useState<string[]>([]); // For current job only
  const [allAssignedCostCodes, setAllAssignedCostCodes] = useState<string[]>([]); // All codes across all jobs
  const [assignedJobs, setAssignedJobs] = useState<string[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [costCodeSearch, setCostCodeSearch] = useState('');
  const [loginHistory, setLoginHistory] = useState<any[]>([]);

  const isAdmin = profile?.role === 'admin';
  const isController = profile?.role === 'controller';
  const canManageUsers = isAdmin || isController;
  const { currentCompany } = useCompany();

  useEffect(() => {
    if (userId && currentCompany) {
      fetchUser();
      fetchJobs();
      fetchUserJobAccess();
      fetchLoginHistory();
      fetchTimecardSettings();
    }
  }, [userId, currentCompany]);

  useEffect(() => {
    if (selectedJobId) {
      fetchCostCodes();
      fetchAssignedCostCodesForJob();
    } else {
      setCostCodes([]);
      setAssignedCostCodes([]);
    }
  }, [selectedJobId]);

  const fetchUser = async () => {
    if (!userId) return;

    try {
      const [profileData, accessData] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('user_company_access')
          .select('role')
          .eq('user_id', userId)
          .eq('company_id', currentCompany?.id || '')
          .eq('is_active', true)
          .maybeSingle()
      ]);

      if (profileData.error) throw profileData.error;
      
      // Use company-specific role if available, otherwise use profile role
      const companyRole = accessData.data?.role || profileData.data.role;
      
      setUser({
        ...profileData.data,
        role: companyRole
      });
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

  const fetchJobs = async () => {
    if (!currentCompany) return;

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, client, status')
        .eq('company_id', currentCompany.id)
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchUserJobAccess = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_job_access')
        .select('job_id')
        .eq('user_id', userId);

      if (error) throw error;
      setUserJobAccess(data?.map(item => item.job_id) || []);
    } catch (error) {
      console.error('Error fetching user job access:', error);
    }
  };

  const fetchCostCodes = async () => {
    if (!currentCompany || !selectedJobId) {
      setCostCodes([]);
      return;
    }
    
    try {
      // Fetch job-specific labor cost codes
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('company_id', currentCompany.id)
        .eq('job_id', selectedJobId)
        .eq('type', 'labor')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error fetching cost codes:', error);
    }
  };

  const fetchTimecardSettings = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_jobs, assigned_cost_codes')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      setAssignedJobs(data?.assigned_jobs || []);
      setAllAssignedCostCodes(data?.assigned_cost_codes || []);
    } catch (error) {
      console.error('Error fetching timecard settings:', error);
    }
  };

  const fetchAssignedCostCodesForJob = async () => {
    if (!selectedJobId) return;
    
    // Filter to show only codes from the current job
    const jobCodes = costCodes
      .filter(cc => allAssignedCostCodes.includes(cc.id))
      .map(cc => cc.id);
    
    setAssignedCostCodes(jobCodes);
  };

  const fetchLoginHistory = async () => {
    if (!userId) return;

    try {
      // For now, just show account creation
      // In a production system, you would query auth audit logs
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('created_at, updated_at')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      if (profileData) {
        const history = [
          {
            timestamp: profileData.created_at,
            event_type: 'user_created'
          }
        ];
        setLoginHistory(history);
      }
    } catch (error) {
      console.error('Error fetching login history:', error);
      setLoginHistory([]);
    }
  };

  const handleSave = async () => {
    if (!user || !canManageUsers || !currentCompany) return;

    try {
      setSaving(true);
      
      // Update user profile
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

      // Update job and cost code assignments
      const { error: settingsError } = await supabase
        .from('employee_timecard_settings')
        .upsert({
          user_id: user.user_id,
          company_id: currentCompany.id,
          assigned_jobs: assignedJobs,
          assigned_cost_codes: allAssignedCostCodes,
          created_by: profile?.user_id
        }, {
          onConflict: 'user_id,company_id'
        });

      if (settingsError) throw settingsError;

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

  const toggleCostCodeAssignment = (costCodeId: string) => {
    // Update both current job codes and all codes
    setAssignedCostCodes(prev => 
      prev.includes(costCodeId) 
        ? prev.filter(id => id !== costCodeId)
        : [...prev, costCodeId]
    );
    
    setAllAssignedCostCodes(prev =>
      prev.includes(costCodeId)
        ? prev.filter(id => id !== costCodeId)
        : [...prev, costCodeId]
    );
  };

  const toggleJobAssignment = (jobId: string) => {
    setAssignedJobs(prev =>
      prev.includes(jobId)
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
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

  const toggleJobAccess = async (jobId: string, hasAccess: boolean) => {
    if (!userId || !profile) return;

    try {
      if (hasAccess) {
        const { error } = await supabase
          .from('user_job_access')
          .insert({
            user_id: userId,
            job_id: jobId,
            granted_by: profile.user_id
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_job_access')
          .delete()
          .eq('user_id', userId)
          .eq('job_id', jobId);
        if (error) throw error;
      }

      fetchUserJobAccess();
      toast({
        title: "Job Access Updated",
        description: `Job access ${hasAccess ? 'granted' : 'revoked'}`,
      });
    } catch (error) {
      console.error('Error updating job access:', error);
      toast({
        title: "Error",
        description: "Failed to update job access",
        variant: "destructive",
      });
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

              <Separator className="my-4" />

              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900 p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      PM Mobile Access
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {['project_manager', 'admin', 'controller'].includes(user.role) ? (
                        <>✓ This user has access to the PM Mobile App</>
                      ) : (
                        <>This user does not have PM Mobile access. Set role to Project Manager, Admin, or Controller to grant access.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {['admin', 'controller', 'project_manager', 'employee'].includes(user.role) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  PIN Settings for Mobile Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['admin', 'controller', 'project_manager'].includes(user.role) && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900 p-3 mb-4">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <Shield className="h-4 w-4 inline mr-2" />
                        Set a PIN to enable access to the PM Mobile App
                      </p>
                    </div>
                  )}
                  <UserPinSettings
                    userId={user.user_id}
                    currentPin={user.pin_code}
                    userName={user.display_name}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Job Access Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Job Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
                <Switch
                  id="global_job_access"
                  checked={user.has_global_job_access}
                  onCheckedChange={(checked) => setUser(prev => prev ? { ...prev, has_global_job_access: !!checked } : null)}
                />
                <div className="flex-1">
                  <Label htmlFor="global_job_access" className="font-medium">Global Job Access</Label>
                  <p className="text-sm text-muted-foreground">Access to all jobs automatically</p>
                </div>
              </div>

              {!user.has_global_job_access && jobs.length > 0 && (
                <div className="space-y-4">
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Job Assignments (for Timecard/Punch Clock)</Label>
                    <p className="text-sm text-muted-foreground">Select which jobs this employee can punch in/out from</p>
                    <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                      {jobs.map((job) => (
                        <div key={job.id} className="flex items-center justify-between p-3 hover:bg-primary/10 hover:border-primary">
                          <div className="flex-1">
                            <div className="font-medium">{job.name}</div>
                            <div className="text-sm text-muted-foreground">{job.client}</div>
                          </div>
                          <Switch
                            checked={assignedJobs.includes(job.id)}
                            onCheckedChange={() => toggleJobAssignment(job.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Specific Job Access (Full System Access)</Label>
                    <p className="text-sm text-muted-foreground">Jobs this employee can view/manage in the system</p>
                    <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                      {jobs.map((job) => (
                        <div key={job.id} className="flex items-center justify-between p-3 hover:bg-primary/10 hover:border-primary">
                          <div className="flex-1">
                            <div className="font-medium">{job.name}</div>
                            <div className="text-sm text-muted-foreground">{job.client}</div>
                          </div>
                          <Switch
                            checked={userJobAccess.includes(job.id)}
                            onCheckedChange={(checked) => toggleJobAccess(job.id, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Code Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Cost Code Assignments (Job-Specific Labor Codes)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Job First</Label>
                <Select value={selectedJobId} onValueChange={(value) => {
                  setSelectedJobId(value);
                  setAssignedCostCodes([]);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job to view cost codes" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                        {job.client && <span className="text-muted-foreground ml-2">({job.client})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {selectedJobId && (
                <>
                  <div className="space-y-2">
                    <Label>Search Cost Codes</Label>
                    <Input
                      placeholder="Search by code or description..."
                      value={costCodeSearch}
                      onChange={(e) => setCostCodeSearch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Showing labor cost codes for selected job
                    </Label>
                    {costCodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No labor cost codes available for this job</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg divide-y">
                        {costCodes
                          .filter(costCode => 
                            costCodeSearch === '' ||
                            costCode.code.toLowerCase().includes(costCodeSearch.toLowerCase()) ||
                            costCode.description.toLowerCase().includes(costCodeSearch.toLowerCase())
                          )
                          .map((costCode) => (
                            <div key={costCode.id} className="flex items-center justify-between p-3 hover:bg-primary/10 hover:border-primary">
                              <div className="flex-1">
                                <div className="font-mono font-medium">{costCode.code}</div>
                                <div className="text-sm text-muted-foreground">{costCode.description}</div>
                              </div>
                              <Switch
                                checked={assignedCostCodes.includes(costCode.id)}
                                onCheckedChange={() => toggleCostCodeAssignment(costCode.id)}
                              />
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Login History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Login History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loginHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Event</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginHistory.slice(0, 10).map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {entry.event_type === 'sign_in' ? 'Sign In' : 'Account Created'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  No login history available
                </div>
              )}
            </CardContent>
          </Card>
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