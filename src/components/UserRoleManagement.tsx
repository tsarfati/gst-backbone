import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { User, Shield, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin';
  custom_role_id?: string;
  email?: string;
  avatar_url?: string;
  default_page?: string;
}

interface CustomRole {
  id: string;
  role_key: string;
  role_name: string;
  description: string;
  color: string;
}

const AVAILABLE_PAGES = [
  { value: '/dashboard', label: 'Dashboard', roles: ['admin', 'controller', 'project_manager', 'employee', 'view_only'] },
  { value: '/jobs', label: 'All Jobs', roles: ['admin', 'controller', 'project_manager', 'employee', 'view_only'] },
  { value: '/payables-dashboard', label: 'Payables Dashboard', roles: ['admin', 'controller'] },
  { value: '/punch-clock-dashboard', label: 'Punch Clock Dashboard', roles: ['admin', 'controller', 'project_manager'] },
  { value: '/time-sheets', label: 'Timesheets', roles: ['admin', 'controller', 'project_manager', 'employee'] },
  { value: '/vendors', label: 'All Vendors', roles: ['admin', 'controller', 'project_manager', 'view_only'] },
  { value: '/bills', label: 'All Bills', roles: ['admin', 'controller', 'view_only'] },
  { value: '/upload', label: 'Upload Receipts', roles: ['admin', 'controller', 'project_manager', 'employee'] },
  { value: '/uncoded', label: 'Uncoded Receipts', roles: ['admin', 'controller', 'project_manager'] },
  { value: '/receipts', label: 'Coded Receipts', roles: ['admin', 'controller', 'project_manager', 'view_only'] },
  { value: '/employees', label: 'All Employees', roles: ['admin', 'controller', 'project_manager'] },
  { value: '/messages', label: 'All Messages', roles: ['admin', 'controller', 'project_manager', 'employee'] },
  { value: '/team-chat', label: 'Team Chat', roles: ['admin', 'controller', 'project_manager', 'employee'] },
  { value: '/company-files', label: 'All Documents', roles: ['admin', 'controller', 'project_manager', 'view_only'] },
  { value: '/banking/accounts', label: 'Bank Accounts', roles: ['admin', 'controller'] },
  { value: '/settings', label: 'Settings', roles: ['admin', 'controller'] },
];

export default function UserRoleManagement() {
  const { currentCompany } = useCompany();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [roleDefaultPages, setRoleDefaultPages] = useState<{ [key: string]: string }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchRoleDefaultPages();
    if (currentCompany) {
      fetchCustomRoles();
    }
  }, [currentCompany]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, roleFilter, users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          first_name,
          last_name,
          display_name,
          role,
          custom_role_id,
          avatar_url
        `)
        .order('last_name');

      if (error) throw error;

      // Fetch emails from auth.users (only admins can access this)
      const { data: authData } = await supabase.auth.admin.listUsers();
      
      const usersWithEmail = (data || []).map(user => {
        const authUser = authData?.users?.find((u: any) => u.id === user.user_id);
        return {
          ...user,
          email: authUser?.email
        };
      });

      setUsers(usersWithEmail);
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

  const fetchCustomRoles = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('id, role_key, role_name, description, color')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('role_name');

      if (error) throw error;
      setCustomRoles(data || []);
    } catch (error) {
      console.error('Error fetching custom roles:', error);
    }
  };

  const fetchRoleDefaultPages = async () => {
    try {
      const { data, error } = await supabase
        .from('role_default_pages')
        .select('role, default_page');

      if (error) throw error;
      
      const pagesMap: { [key: string]: string } = {};
      data?.forEach(item => {
        pagesMap[item.role] = item.default_page;
      });
      setRoleDefaultPages(pagesMap);
    } catch (error) {
      console.error('Error fetching role default pages:', error);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  const updateUserRole = async (userId: string, newRole: string, isCustomRole: boolean = false) => {
    try {
      const updates: any = {};
      
      if (isCustomRole) {
        // Assign custom role
        updates.custom_role_id = newRole;
        // Set system role to employee when using custom role
        updates.role = 'employee';
      } else {
        // Assign system role
        updates.role = newRole;
        // Clear custom role when using system role
        updates.custom_role_id = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      // Refresh the user list
      fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'controller':
        return 'default';
      case 'project_manager':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getUserRoleDisplay = (user: UserProfile) => {
    if (user.custom_role_id) {
      const customRole = customRoles.find(r => r.id === user.custom_role_id);
      if (customRole) {
        return {
          label: customRole.role_name,
          value: `custom_${customRole.id}`,
          isCustom: true,
          color: customRole.color
        };
      }
    }
    return {
      label: getRoleLabel(user.role),
      value: user.role,
      isCustom: false
    };
  };

  const getAvailablePagesForRole = (role: string) => {
    return AVAILABLE_PAGES.filter(page => page.roles.includes(role));
  };

  const updateUserDefaultPage = async (userId: string, role: string, defaultPage: string) => {
    try {
      const roleEnum = role as 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin';
      
      // Check if role_default_pages entry exists for this role
      const { data: existing, error: fetchError } = await supabase
        .from('role_default_pages')
        .select('id')
        .eq('role', roleEnum)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('role_default_pages')
          .update({ default_page: defaultPage })
          .eq('role', roleEnum);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('role_default_pages')
          .insert({ 
            role: roleEnum, 
            default_page: defaultPage,
            created_by: userId 
          });
        
        if (error) throw error;
      }

      // Update local state
      setRoleDefaultPages(prev => ({ ...prev, [role]: defaultPage }));

      toast({
        title: "Success",
        description: "Default landing page updated",
      });
    } catch (error) {
      console.error('Error updating default page:', error);
      toast({
        title: "Error",
        description: "Failed to update default page",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Loading users...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          User Role Management
        </h1>
        <p className="text-muted-foreground">
          Manage user roles and permissions
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="controller">Controller</SelectItem>
                <SelectItem value="company_admin">Company Admin</SelectItem>
                <SelectItem value="project_manager">Project Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="view_only">View Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No users found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => {
                const availablePages = getAvailablePagesForRole(user.role);
                const currentDefaultPage = roleDefaultPages[user.role] || '/dashboard';
                
                return (
                  <div 
                    key={user.user_id} 
                    className="flex flex-col gap-3 p-4 border rounded-lg hover:bg-primary/10 hover:border-primary transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback>
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">
                            {user.first_name} {user.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {(() => {
                          const roleDisplay = getUserRoleDisplay(user);
                          return (
                            <>
                              <Badge 
                                variant={roleDisplay.isCustom ? 'secondary' : getRoleBadgeVariant(user.role)}
                                className={roleDisplay.isCustom ? roleDisplay.color : ''}
                              >
                                {roleDisplay.label}
                                {roleDisplay.isCustom && (
                                  <span className="ml-1 text-xs opacity-70">(Custom)</span>
                                )}
                              </Badge>
                              
                              <Select 
                                value={roleDisplay.value}
                                onValueChange={(value: string) => {
                                  if (value.startsWith('custom_')) {
                                    updateUserRole(user.user_id, value.replace('custom_', ''), true);
                                  } else {
                                    updateUserRole(user.user_id, value, false);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background z-50">
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="controller">Controller</SelectItem>
                                  <SelectItem value="company_admin">Company Admin</SelectItem>
                                  <SelectItem value="project_manager">Project Manager</SelectItem>
                                  <SelectItem value="employee">Employee</SelectItem>
                                  <SelectItem value="view_only">View Only</SelectItem>
                                  {customRoles.length > 0 && (
                                    <>
                                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                        Custom Roles
                                      </div>
                                      {customRoles.map(role => (
                                        <SelectItem key={role.id} value={`custom_${role.id}`}>
                                          {role.role_name}
                                        </SelectItem>
                                      ))}
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* Default Landing Page Selector */}
                    <div className="flex items-center gap-3 pl-14">
                      <span className="text-sm text-muted-foreground min-w-[120px]">Default page:</span>
                      <Select
                        value={currentDefaultPage}
                        onValueChange={(value) => updateUserDefaultPage(user.user_id, user.role, value)}
                      >
                        <SelectTrigger className="w-[300px]">
                          <SelectValue placeholder="Select default page" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {availablePages.map((page) => (
                            <SelectItem key={page.value} value={page.value}>
                              {page.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}