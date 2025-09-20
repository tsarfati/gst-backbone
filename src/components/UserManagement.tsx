import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, XCircle, User, Settings, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
}

interface Job {
  id: string;
  name: string;
  client: string;
  status: string;
}

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userJobAccess, setUserJobAccess] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchJobs();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
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
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, client, status')
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Approve users and manage permissions</p>
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
                <div key={user.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{user.display_name || `${user.first_name} ${user.last_name}`}</h3>
                    <p className="text-sm text-muted-foreground">Role: {user.role}</p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Global Job Access</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((userProfile) => (
                <TableRow key={userProfile.user_id}>
                  <TableCell>
                    {userProfile.display_name || `${userProfile.first_name} ${userProfile.last_name}`}
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={userProfile.role} 
                      onValueChange={(value) => updateUserRole(userProfile.user_id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="controller">Controller</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{getStatusBadge(userProfile.status)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={userProfile.has_global_job_access}
                      onCheckedChange={(checked) => toggleGlobalJobAccess(userProfile.user_id, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(userProfile);
                        fetchUserJobAccess(userProfile.user_id);
                      }}
                    >
                      <Briefcase className="h-4 w-4 mr-2" />
                      Job Access
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Job Access Modal */}
      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle>Job Access for {selectedUser.display_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <Button onClick={() => setSelectedUser(null)}>Close</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}