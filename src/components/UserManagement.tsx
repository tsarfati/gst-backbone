import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, XCircle, User, Settings, Briefcase, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

interface UserProfile {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  has_global_job_access: boolean;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  avatar_url?: string;
}

interface Job {
  id: string;
  name: string;
  client: string;
  status: string;
}

export default function UserManagement() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userJobAccess, setUserJobAccess] = useState<string[]>([]);

  const roleColors = {
    admin: 'bg-red-500',
    controller: 'bg-blue-500', 
    employee: 'bg-gray-500'
  };

  useEffect(() => {
    if (currentCompany) {
      fetchUsers();
      fetchJobs();
    }
  }, [currentCompany]);

  const fetchUsers = async () => {
    if (!currentCompany) {
      setLoading(false);
      return;
    }

    try {
      // Fetch users that have access to the current company
      const { data: userAccessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id, role, is_active, granted_at')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (accessError) throw accessError;

      let allUsers: UserProfile[] = [];
      let companyUserIds: string[] = [];

      // Fetch profiles for users with company access
      if (userAccessData && userAccessData.length > 0) {
        const userIds = userAccessData.map(access => access.user_id);
        companyUserIds = userIds; // Store for PIN employee filtering
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', userIds)
          .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        // Combine profile data with company access data
        const companyUsers = profilesData?.map(profile => {
          const access = userAccessData.find(access => access.user_id === profile.user_id);
          return {
            ...profile,
            role: access?.role || profile.role, // Use company role if available
            granted_at: access?.granted_at
          };
        }) || [];

        allUsers = [...companyUsers];
      }

      // Fetch PIN employees for this company (they are company-wide)
      // PIN employees are associated with companies through their creator's company access
      const { data: pinEmployeesData, error: pinError } = await supabase
        .from('pin_employees')
        .select('id as user_id, first_name, last_name, display_name, created_at, is_active, phone, department, notes')
        .eq('is_active', true)
        .in('created_by', companyUserIds)
        .order('created_at', { ascending: false });

      if (pinError) {
        console.error('Error fetching PIN employees:', pinError);
      } else if (pinEmployeesData) {
        const pinEmployees = pinEmployeesData.map((emp: any) => ({
          ...emp,
          role: 'employee',
          status: 'approved',
          has_global_job_access: false,
          isPinEmployee: true
        }));

        allUsers = [...allUsers, ...pinEmployees];
      }

      setUsers(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
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

  const fetchUserJobAccess = async (userId: string) => {
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

  const approveUser = async (userId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "User Approved",
        description: "User has been approved successfully",
      });
      fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      });
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'rejected' })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "User Rejected",
        description: "User has been rejected",
        variant: "destructive",
      });
      fetchUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: "Error",
        description: "Failed to reject user",
        variant: "destructive",
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole as any })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Role Updated",
        description: "User role has been updated successfully",
      });
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const toggleGlobalJobAccess = async (userId: string, hasAccess: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ has_global_job_access: hasAccess })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Job Access Updated",
        description: `Global job access ${hasAccess ? 'granted' : 'revoked'}`,
      });
      fetchUsers();
    } catch (error) {
      console.error('Error updating job access:', error);
      toast({
        title: "Error",
        description: "Failed to update job access",
        variant: "destructive",
      });
    }
  };

  const toggleJobAccess = async (userId: string, jobId: string, hasAccess: boolean) => {
    if (!user) return;

    try {
      if (hasAccess) {
        const { error } = await supabase
          .from('user_job_access')
          .insert({
            user_id: userId,
            job_id: jobId,
            granted_by: user.id
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

      fetchUserJobAccess(userId);
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

  const updateUser = async (userProfile: UserProfile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          display_name: userProfile.display_name,
          role: userProfile.role as any,
          status: userProfile.status,
          has_global_job_access: userProfile.has_global_job_access
        })
        .eq('user_id', userProfile.user_id);

      if (error) throw error;

      toast({
        title: "User Updated",
        description: "User details have been updated successfully",
      });
      fetchUsers();
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-red-500',
      controller: 'bg-blue-500',
      employee: 'bg-gray-500'
    };
    return <Badge className={colors[role as keyof typeof colors] || 'bg-gray-500'}>{role}</Badge>;
  };

  if (loading) {
    return <div className="p-6 text-center">Loading users...</div>;
  }

  if (!currentCompany) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Please select a company to view its users.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage users for {currentCompany.display_name || currentCompany.name}
          </p>
        </div>
      </div>

      {/* Pending Approvals */}
      {users.filter(u => u.status === 'pending').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Pending Approvals ({users.filter(u => u.status === 'pending').length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.filter(u => u.status === 'pending').map((user) => (
                <div key={user.user_id} className="flex items-center justify-between p-6 bg-gradient-to-r from-background to-muted/20 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <span className="text-lg font-semibold text-primary">
                          {user.display_name?.[0]?.toUpperCase() || user.first_name?.[0]?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unnamed User'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={roleColors[user.role] || 'bg-gray-500'}>
                          {user.role}
                        </Badge>
                        <span className="text-sm text-muted-foreground">Created: {new Date(user.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveUser(user.user_id)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectUser(user.user_id)}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Users */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {users.map((user) => (
              <div key={user.user_id} className="flex items-center justify-between p-6 bg-gradient-to-r from-background to-muted/20 rounded-lg border">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold text-primary">
                        {user.display_name?.[0]?.toUpperCase() || user.first_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unnamed User'}</h3>
                      <Badge variant={user.status === 'approved' ? 'default' : user.status === 'pending' ? 'secondary' : 'destructive'}>
                        {user.status || 'pending'}
                      </Badge>
                      <Badge variant="outline" className={roleColors[user.role] || 'bg-gray-500'}>
                        {user.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.user_id}
                      </span>
                      <span>Created: {new Date(user.created_at).toLocaleDateString()}</span>
                      {user.approved_at && (
                        <span>Approved: {new Date(user.approved_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>Global Job Access: {user.has_global_job_access ? 'Yes' : 'No'}</span>
                      {user.status === 'approved' && (
                        <span className="text-green-600">✓ Active</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingUser(user)}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Manage
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Edit Dialog */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Manage User</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={editingUser?.first_name || ''}
                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, first_name: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={editingUser?.last_name || ''}
                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, last_name: e.target.value } : null)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={editingUser?.display_name || ''}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, display_name: e.target.value } : null)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={editingUser?.role || 'employee'}
                    onValueChange={(value) => setEditingUser(prev => prev ? { ...prev, role: value as any } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="controller">Controller</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editingUser?.status || 'pending'}
                    onValueChange={(value) => setEditingUser(prev => prev ? { ...prev, status: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="global_access"
                  checked={editingUser?.has_global_job_access || false}
                  onCheckedChange={(checked) => setEditingUser(prev => prev ? { ...prev, has_global_job_access: checked } : null)}
                />
                <Label htmlFor="global_access" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Global Job Access
                </Label>
              </div>

              <div>
                <Label className="text-sm font-medium">User Information</Label>
                <div className="text-sm text-muted-foreground space-y-1 mt-2">
                  <p>User ID: {editingUser?.user_id}</p>
                  <p>Created: {editingUser?.created_at && new Date(editingUser.created_at).toLocaleString()}</p>
                  {editingUser?.approved_at && (
                    <p>Approved: {new Date(editingUser.approved_at).toLocaleString()}</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedUser(editingUser);
                    fetchUserJobAccess(editingUser.user_id);
                  }}
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Job Access
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button onClick={() => updateUser(editingUser)}>
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Job Access Modal */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Job Access for {selectedUser.display_name}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <Switch
                  checked={selectedUser.has_global_job_access}
                  onCheckedChange={(checked) => {
                    toggleGlobalJobAccess(selectedUser.user_id, checked);
                    setSelectedUser({ ...selectedUser, has_global_job_access: checked });
                  }}
                />
                <span className="font-medium">Global Job Access</span>
                <span className="text-sm text-muted-foreground">
                  (Access to all jobs automatically)
                </span>
              </div>

              {!selectedUser.has_global_job_access && (
                <div className="space-y-2">
                  <h4 className="font-medium">Specific Job Access</h4>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                    {jobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <span className="font-medium">{job.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({job.client})</span>
                        </div>
                        <Switch
                          checked={userJobAccess.includes(job.id)}
                          onCheckedChange={(checked) => toggleJobAccess(selectedUser.user_id, job.id, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setSelectedUser(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}