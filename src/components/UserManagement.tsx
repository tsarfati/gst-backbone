import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, User, Mail, UserPlus, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useActiveCompanyRole } from "@/hooks/useActiveCompanyRole";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AddSystemUserDialog from "@/components/AddSystemUserDialog";

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
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemUsersOpen, setSystemUsersOpen] = useState(true);
  const [pinEmployeesOpen, setPinEmployeesOpen] = useState(true);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);

  // Use company-specific role for permission checks
  const activeCompanyRole = useActiveCompanyRole();
  const isAdmin = activeCompanyRole === 'admin' || activeCompanyRole === 'company_admin' || activeCompanyRole === 'owner';

  const roleColors = {
    admin: 'bg-red-500',
    controller: 'bg-blue-500', 
    project_manager: 'bg-green-500',
    employee: 'bg-gray-500',
    view_only: 'bg-gray-400',
    company_admin: 'bg-red-500',
    vendor: 'bg-purple-500'
  };

  useEffect(() => {
    if (currentCompany) {
      fetchUsers();
      fetchJobs();
    }
  }, [currentCompany, location.key]);

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
        {isAdmin && (
            <Button onClick={() => setShowAddUserDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
              Add System User
          </Button>
        )}
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

      {/* System Users */}
      <Collapsible open={systemUsersOpen} onOpenChange={setSystemUsersOpen}>
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setSystemUsersOpen(!systemUsersOpen)}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between w-full">
                <CardTitle className="flex items-center gap-2">
                  {systemUsersOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  System Users ({users.filter(u => !(u as any).isPinEmployee).length})
                </CardTitle>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid gap-4">
                {users.filter(u => !(u as any).isPinEmployee).map((user) => (
                  <div 
                    key={user.user_id} 
                    onClick={() => navigate(`/settings/users/${user.user_id}`, { state: { fromCompanyManagement: false } })}
                    className="flex items-center gap-4 p-6 bg-gradient-to-r from-background to-muted/20 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20"
                  >
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
                ))}
                {users.filter(u => !(u as any).isPinEmployee).length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No system users found</p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* PIN Employees */}
      <Collapsible open={pinEmployeesOpen} onOpenChange={setPinEmployeesOpen}>
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setPinEmployeesOpen(!pinEmployeesOpen)}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between w-full">
                <CardTitle className="flex items-center gap-2">
                  {pinEmployeesOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  PIN Employees ({users.filter(u => (u as any).isPinEmployee).length})
                </CardTitle>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid gap-4">
                {users.filter(u => (u as any).isPinEmployee).map((user) => (
                  <div 
                    key={user.user_id} 
                    onClick={() => navigate(`/pin-employees/${user.user_id}/edit`)}
                    className="flex items-center gap-4 p-6 bg-gradient-to-r from-background to-muted/20 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20"
                  >
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-semibold text-primary">
                        {user.display_name?.[0]?.toUpperCase() || user.first_name?.[0]?.toUpperCase() || 'P'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unnamed Employee'}</h3>
                        <Badge variant="outline" className="bg-purple-500 text-white">
                          PIN Employee
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>Created: {new Date(user.created_at).toLocaleDateString()}</span>
                        {user.status === 'approved' && (
                          <span className="text-green-600">✓ Active</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {users.filter(u => (u as any).isPinEmployee).length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No PIN employees found</p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AddSystemUserDialog
        open={showAddUserDialog}
        onOpenChange={setShowAddUserDialog}
        onUserAdded={fetchUsers}
      />
    </div>
  );
}