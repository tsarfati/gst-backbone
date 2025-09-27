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
import { Users, UserCheck, Edit3, Trash2 } from 'lucide-react';
import RolePermissionsManager from "@/components/RolePermissionsManager";
import UserMenuPermissions from "@/components/UserMenuPermissions";
import UserJobAccess from "@/components/UserJobAccess";
import { UserPinSettings } from "@/components/UserPinSettings";

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin';
  created_at: string;
  pin_code?: string;
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
      // Get users that have access to the current company
      const { data: companyUsers, error: companyError } = await supabase
        .from('user_company_access')
        .select('user_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (companyError) throw companyError;

      if (!companyUsers || companyUsers.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const userIds = companyUsers.map(u => u.user_id);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, display_name, role, created_at, pin_code')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
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
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('user_id', userId);

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
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles">
            <UserCheck className="h-4 w-4 mr-2" />
            Role Definitions
          </TabsTrigger>
          <TabsTrigger value="menu-access">
            Menu Access
          </TabsTrigger>
          <TabsTrigger value="job-access">
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
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <h3 className="font-semibold">
                              {user.display_name || `${user.first_name} ${user.last_name}`}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Created: {new Date(user.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {editingUser === user.user_id ? (
                          <div className="flex items-center gap-2">
                            <Select value={editRole} onValueChange={setEditRole}>
                              <SelectTrigger className="w-40">
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
                            <Button
                              size="sm"
                              onClick={() => updateUserRole(user.user_id, editRole as 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin')}
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Badge 
                              variant={roleColors[user.role as keyof typeof roleColors]}
                            >
                              {roleLabels[user.role as keyof typeof roleLabels]}
                            </Badge>
                            {isAdmin && user.user_id !== profile?.user_id && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.location.href = `/settings/users/${user.user_id}/edit`}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setSelectedUserForPermissions(user.user_id)}
                                >
                                  Permissions
                                </Button>
                                {user.role === 'employee' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingUser(user.user_id)}
                                  >
                                    Set PIN
                                  </Button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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