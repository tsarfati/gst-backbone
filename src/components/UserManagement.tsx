import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, User, Mail, UserPlus, ChevronDown, ChevronRight, Shield, Briefcase, HardHat, Users } from "lucide-react";
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
  pin_code?: string;
  punch_clock_access?: boolean;
  pm_lynk_access?: boolean;
}

interface RoleGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
  roles: string[];
}

const roleGroups: RoleGroup[] = [
  { key: 'admins', label: 'Administrators', icon: <Shield className="h-5 w-5" />, badgeClass: 'bg-red-500 text-white', roles: ['admin', 'company_admin', 'owner'] },
  { key: 'controllers', label: 'Controllers', icon: <Briefcase className="h-5 w-5" />, badgeClass: 'bg-blue-500 text-white', roles: ['controller'] },
  { key: 'project_managers', label: 'Project Managers', icon: <HardHat className="h-5 w-5" />, badgeClass: 'bg-green-500 text-white', roles: ['project_manager'] },
  { key: 'employees', label: 'Employees', icon: <Users className="h-5 w-5" />, badgeClass: 'bg-gray-500 text-white', roles: ['employee'] },
  { key: 'view_only', label: 'View Only', icon: <User className="h-5 w-5" />, badgeClass: 'bg-gray-400 text-white', roles: ['view_only'] },
  { key: 'vendors', label: 'Vendors', icon: <User className="h-5 w-5" />, badgeClass: 'bg-purple-500 text-white', roles: ['vendor'] },
];

export default function UserManagement() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ admins: true, controllers: true, project_managers: true, employees: true });
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);

  const activeCompanyRole = useActiveCompanyRole();
  const isAdmin = activeCompanyRole === 'admin' || activeCompanyRole === 'company_admin' || activeCompanyRole === 'owner';

  useEffect(() => {
    if (currentCompany) {
      fetchUsers();
    }
  }, [currentCompany, location.key]);

  const fetchUsers = async () => {
    if (!currentCompany) {
      setLoading(false);
      return;
    }

    try {
      const { data: userAccessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id, role, is_active, granted_at')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (accessError) throw accessError;

      let allUsers: UserProfile[] = [];

      if (userAccessData && userAccessData.length > 0) {
        const userIds = userAccessData.map(access => access.user_id);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', userIds)
          .order('last_name', { ascending: true });

        if (profilesError) throw profilesError;

        allUsers = (profilesData || []).map(profile => {
          const access = userAccessData.find(a => a.user_id === profile.user_id);
          return {
            ...profile,
            role: access?.role || profile.role,
          };
        });
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

  const approveUser = async (userId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
      toast({ title: "User Approved", description: "User has been approved successfully" });
      fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast({ title: "Error", description: "Failed to approve user", variant: "destructive" });
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'rejected' })
        .eq('user_id', userId);
      if (error) throw error;
      toast({ title: "User Rejected", description: "User has been rejected", variant: "destructive" });
      fetchUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({ title: "Error", description: "Failed to reject user", variant: "destructive" });
    }
  };

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getUsersForGroup = (group: RoleGroup) => {
    return users.filter(u => u.status !== 'pending' && group.roles.includes(u.role));
  };

  const pendingUsers = users.filter(u => u.status === 'pending');

  const renderUserCard = (u: UserProfile) => (
    <div
      key={u.user_id}
      onClick={() => navigate(`/settings/users/${u.user_id}`, { state: { fromCompanyManagement: false } })}
      className="flex items-center gap-4 p-4 bg-gradient-to-r from-background to-muted/20 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20"
    >
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        {u.avatar_url ? (
          <img src={u.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="text-sm font-semibold text-primary">
            {u.first_name?.[0]?.toUpperCase() || u.display_name?.[0]?.toUpperCase() || 'U'}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold">{u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unnamed User'}</h3>
          <Badge variant={u.status === 'approved' ? 'default' : u.status === 'pending' ? 'secondary' : 'destructive'}>
            {u.status || 'pending'}
          </Badge>
          {u.pin_code && <Badge variant="outline">PIN Set</Badge>}
          {u.punch_clock_access && <Badge variant="outline" className="text-xs">Punch Clock</Badge>}
          {u.pm_lynk_access && <Badge variant="outline" className="text-xs">PM Lynk</Badge>}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
          <span>{u.first_name} {u.last_name}</span>
          <span>Created: {new Date(u.created_at).toLocaleDateString()}</span>
          {u.has_global_job_access && <span className="text-green-600">Global Access</span>}
        </div>
      </div>
    </div>
  );

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
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Pending Approvals ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingUsers.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between p-4 bg-gradient-to-r from-background to-muted/20 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {u.first_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim()}</h3>
                      <span className="text-sm text-muted-foreground">Created: {new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveUser(u.user_id)}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectUser(u.user_id)}>
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role-based collapsible groups */}
      {roleGroups.map(group => {
        const groupUsers = getUsersForGroup(group);
        if (groupUsers.length === 0) return null;

        const isOpen = openGroups[group.key] ?? false;

        return (
          <Collapsible key={group.key} open={isOpen} onOpenChange={() => toggleGroup(group.key)}>
            <Card>
              <CardHeader className="cursor-pointer py-4" onClick={() => toggleGroup(group.key)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between w-full">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      {group.icon}
                      {group.label}
                      <Badge className={group.badgeClass}>{groupUsers.length}</Badge>
                    </CardTitle>
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid gap-3">
                    {groupUsers.map(renderUserCard)}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      <AddSystemUserDialog
        open={showAddUserDialog}
        onOpenChange={setShowAddUserDialog}
        onUserAdded={fetchUsers}
      />
    </div>
  );
}
