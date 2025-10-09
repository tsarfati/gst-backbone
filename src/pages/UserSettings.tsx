import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserCheck, UserPlus } from 'lucide-react';
import RolePermissionsManager from "@/components/RolePermissionsManager";
import UserMenuPermissions from "@/components/UserMenuPermissions";
import UserJobAccess from "@/components/UserJobAccess";
import { UserPinSettings } from "@/components/UserPinSettings";
import CompanyAccessRequests from "@/components/CompanyAccessRequests";
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin';
  created_at: string;
  pin_code?: string;
  jobs?: { id: string; name: string; }[];
  has_global_job_access?: boolean;
  is_pin_employee?: boolean;
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

export default function UserSettings() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<string | null>(null);
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();

  const isAdmin = profile?.role === 'admin';
  const isController = profile?.role === 'controller';
  const canManageUsers = isAdmin || isController;

  useEffect(() => {
    if (currentCompany) {
      fetchUsers();
    }
  }, [currentCompany]);

  const fetchUsers = async () => {
    if (!currentCompany) {
      setLoading(false);
      return;
    }

    try {
      // Get users that have access to the current company WITH their roles
      const { data: companyUsers, error: companyError } = await supabase
        .from('user_company_access')
        .select('user_id, role')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (companyError) throw companyError;

      const userIds = companyUsers?.map(u => u.user_id) || [];
      const roleMap = new Map(companyUsers?.map(u => [u.user_id, u.role]) || []);

      // Fetch regular users
      const { data: regularUsers, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, display_name, created_at, pin_code, has_global_job_access')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch PIN employees that match the company user IDs
      // Note: pin_employees table doesn't have company_id, so we filter by the IDs we got from user_company_access
      const { data: pinEmployees, error: pinError } = await (supabase as any)
        .from('pin_employees')
        .select('id, first_name, last_name, display_name, created_at, is_active')
        .in('id', userIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (pinError) throw pinError;

      // Convert PIN employees to UserProfile format
      const pinEmployeeProfiles: UserProfile[] = (pinEmployees || []).map(emp => ({
        id: emp.id,
        user_id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        display_name: emp.display_name || `${emp.first_name} ${emp.last_name}`,
        role: 'employee' as const,
        created_at: emp.created_at,
        jobs: [],
        has_global_job_access: false,
        is_pin_employee: true
      }));
      
      // Fetch jobs for regular users
      const regularUsersWithJobs = await Promise.all((regularUsers || []).map(async (user) => {
        if (user.has_global_job_access) {
          return { ...user, role: roleMap.get(user.user_id) || 'employee', jobs: [], is_pin_employee: false };
        }
        
        const { data: userJobs } = await supabase
          .from('user_job_access')
          .select('job_id, jobs(id, name)')
          .eq('user_id', user.user_id);
        
        const jobs = userJobs?.map((item: any) => item.jobs).filter(Boolean) || [];
        return { ...user, role: roleMap.get(user.user_id) || 'employee', jobs, is_pin_employee: false };
      }));

      // Combine regular users and PIN employees
      const allUsers = [...regularUsersWithJobs, ...pinEmployeeProfiles];
      
      // Sort by name
      allUsers.sort((a, b) => {
        const nameA = a.display_name || `${a.first_name} ${a.last_name}`;
        const nameB = b.display_name || `${b.first_name} ${b.last_name}`;
        return nameA.localeCompare(nameB);
      });
      
      setUsers(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin') => {
    try {
      // Update the role in user_company_access for this specific company
      const { error } = await supabase
        .from('user_company_access')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('company_id', currentCompany.id);

      if (error) throw error;

      await fetchUsers();
      setEditingUser(null);
      toast({
        title: 'Success',
        description: 'User role updated successfully',
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user role',
        variant: 'destructive',
      });
    }
  };

  const startEdit = (user: UserProfile) => {
    setEditingUser(user.user_id);
    setEditRole(user.role);
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditRole('');
  };

  if (!canManageUsers) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access user settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground">
          Manage user roles and permissions for {currentCompany?.display_name || currentCompany?.name || 'your company'}
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger 
            value="users" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger 
            value="access-requests" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Access Requests
          </TabsTrigger>
          <TabsTrigger 
            value="roles" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Role Definitions
          </TabsTrigger>
          <TabsTrigger 
            value="menu-access" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            Menu Access
          </TabsTrigger>
          <TabsTrigger 
            value="job-access" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            Job Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>System Users</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading users...</div>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => navigate(`/settings/users/${user.user_id}`)}
                      className="flex items-center justify-between p-6 bg-gradient-to-r from-background to-muted/20 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <h3 className="font-semibold">
                              {user.display_name || `${user.first_name} ${user.last_name}`}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Created: {new Date(user.created_at).toLocaleDateString()}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge 
                                variant={roleColors[user.role as keyof typeof roleColors]}
                              >
                                {roleLabels[user.role as keyof typeof roleLabels]}
                              </Badge>
                              {user.is_pin_employee && (
                                <Badge variant="outline">PIN Employee</Badge>
                              )}
                              {user.has_global_job_access && (
                                <Badge variant="outline">All Jobs Access</Badge>
                              )}
                              {!user.has_global_job_access && user.jobs && user.jobs.length > 0 && (
                                <Badge variant="secondary">{user.jobs.length} Job{user.jobs.length !== 1 ? 's' : ''}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access-requests">
          <CompanyAccessRequests />
        </TabsContent>

        <TabsContent value="roles">
          <RolePermissionsManager />
        </TabsContent>

        <TabsContent value="menu-access">
          <div className="space-y-6">
            <div className="text-center">
              {selectedUserForPermissions ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Menu Access for {users.find(u => u.user_id === selectedUserForPermissions)?.display_name}
                  </h3>
                  <UserMenuPermissions 
                    userId={selectedUserForPermissions}
                    userRole={users.find(u => u.user_id === selectedUserForPermissions)?.role || 'employee'}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Select a user from the Users tab to manage their menu access permissions.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="job-access">
          <div className="space-y-6">
            <div className="text-center">
              {selectedUserForPermissions ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Job Access for {users.find(u => u.user_id === selectedUserForPermissions)?.display_name}
                  </h3>
                  <UserJobAccess 
                    userId={selectedUserForPermissions}
                    userRole={users.find(u => u.user_id === selectedUserForPermissions)?.role || 'employee'}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Select a user from the Users tab to manage their job access permissions.
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* PIN Settings Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Set Employee PIN</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditingUser(null)}>
                ×
              </Button>
            </div>
            {(() => {
              const user = users.find(u => u.user_id === editingUser);
              return user ? (
                <UserPinSettings
                  userId={user.user_id}
                  currentPin={user.pin_code}
                  userName={user.display_name || `${user.first_name} ${user.last_name}`}
                />
              ) : null;
            })()}
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}