import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserCheck, Edit3, Trash2 } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only';
  created_at: string;
}

const roleColors = {
  admin: 'destructive',
  controller: 'secondary',
  project_manager: 'default',
  employee: 'outline',
  view_only: 'outline'
} as const;

const roleLabels = {
  admin: 'Administrator',
  controller: 'Controller',
  project_manager: 'Project Manager',
  employee: 'Employee',
  view_only: 'View Only'
};

export default function UserSettings() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const { profile } = useAuth();
  const { toast } = useToast();

  const isAdmin = profile?.role === 'admin';
  const isController = profile?.role === 'controller';
  const canManageUsers = isAdmin || isController;

  useEffect(() => {
    fetchUsers();
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
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only') => {
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
          Manage user roles and permissions
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
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => updateUserRole(user.user_id, editRole as 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only')}
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEdit(user)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(roleLabels).map(([role, label]) => (
              <Card key={role}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant={roleColors[role as keyof typeof roleColors]}>
                      {label}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {role === 'admin' && (
                      <>
                        <p>• Full system access</p>
                        <p>• Manage all users and roles</p>
                        <p>• Access all data and settings</p>
                        <p>• Create/edit/delete all records</p>
                      </>
                    )}
                    {role === 'controller' && (
                      <>
                        <p>• Financial oversight</p>
                        <p>• Manage user roles (except admin)</p>
                        <p>• Access all financial data</p>
                        <p>• Approve invoices and payments</p>
                      </>
                    )}
                    {role === 'project_manager' && (
                      <>
                        <p>• Manage assigned projects</p>
                        <p>• Create and edit jobs</p>
                        <p>• Assign vendors to projects</p>
                        <p>• View project financial data</p>
                      </>
                    )}
                    {role === 'employee' && (
                      <>
                        <p>• Upload and code receipts</p>
                        <p>• View assigned jobs</p>
                        <p>• Basic vendor information</p>
                        <p>• Limited financial access</p>
                      </>
                    )}
                    {role === 'view_only' && (
                      <>
                        <p>• Read-only access</p>
                        <p>• View reports and dashboards</p>
                        <p>• No editing capabilities</p>
                        <p>• Basic system navigation</p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}