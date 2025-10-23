import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Settings, ChevronDown, ChevronRight, Shield, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import RoleDefaultPageSettings from './RoleDefaultPageSettings';

interface RolePermission {
  role: string;
  menu_item: string;
  can_access: boolean;
}

interface CustomRole {
  id: string;
  company_id: string;
  role_key: string;
  role_name: string;
  description: string;
  color: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CustomRolePermission {
  id: string;
  custom_role_id: string;
  menu_item: string;
  can_access: boolean;
}

interface MenuItem {
  key: string;
  label: string;
  description: string;
  category: string;
}

const menuItems = [
  // Core Application
  { key: 'dashboard', label: 'Dashboard', description: 'Main dashboard overview', category: 'Core' },
  
  // Project Management
  { key: 'jobs', label: 'Jobs', description: 'View and manage construction jobs', category: 'Projects' },
  { key: 'jobs-add', label: 'Add Jobs', description: 'Create new construction projects', category: 'Projects' },
  { key: 'jobs-edit', label: 'Edit Jobs', description: 'Modify existing job details', category: 'Projects' },
  { key: 'jobs-budget', label: 'Job Budgets', description: 'View and manage project budgeting', category: 'Projects' },
  { key: 'jobs-reports', label: 'Job Reports', description: 'Generate job performance reports', category: 'Projects' },
  { key: 'cost-codes', label: 'Cost Codes', description: 'Manage job cost codes', category: 'Projects' },
  { key: 'delivery-tickets', label: 'Delivery Tickets', description: 'Manage delivery tickets for jobs', category: 'Projects' },
  
  // Vendor Management
  { key: 'vendors', label: 'Vendors', description: 'View vendor directory', category: 'Vendors' },
  { key: 'vendors-add', label: 'Add Vendors', description: 'Register new vendors', category: 'Vendors' },
  { key: 'vendors-edit', label: 'Edit Vendors', description: 'Modify vendor information', category: 'Vendors' },
  
  // Employee Management
  { key: 'employees', label: 'Employees', description: 'View employee directory', category: 'HR' },
  { key: 'employees-add', label: 'Add Employees', description: 'Register new employees', category: 'HR' },
  
  // Time Tracking & Punch Clock
  { key: 'time-tracking', label: 'Punch Clock', description: 'Employee time clock system', category: 'Time Tracking' },
  { key: 'punch-clock-dashboard', label: 'Punch Clock Dashboard', description: 'Time tracking dashboard overview', category: 'Time Tracking' },
  { key: 'punch-clock-settings', label: 'Punch Clock Settings', description: 'Configure punch clock rules and settings', category: 'Time Tracking' },
  { key: 'timecard-reports', label: 'Timecard Reports', description: 'Generate detailed timecard reports', category: 'Time Tracking' },
  { key: 'employee-timecard-settings', label: 'Employee Time Settings', description: 'Individual employee time tracking settings', category: 'Time Tracking' },
  { key: 'time-corrections', label: 'Time Corrections', description: 'Review and approve time corrections', category: 'Time Tracking' },
  { key: 'punch-records', label: 'Punch Records', description: 'View punch in/out records', category: 'Time Tracking' },
  { key: 'timesheets', label: 'Timesheets', description: 'Review employee timesheets', category: 'Time Tracking' },
  
  // Financial Management
  { key: 'bills', label: 'Bills & Invoices', description: 'View bills and invoices', category: 'Finance' },
  { key: 'bills-add', label: 'Add Bills', description: 'Create new bills/invoices', category: 'Finance' },
  { key: 'bill-status', label: 'Bill Status', description: 'Track bill payment status', category: 'Finance' },
  { key: 'payment-history', label: 'Payment History', description: 'View payment records', category: 'Finance' },
  { key: 'payment-reports', label: 'Payment Reports', description: 'Generate payment reports', category: 'Finance' },
  { key: 'payables-dashboard', label: 'Payables Dashboard', description: 'Payables overview and analytics', category: 'Finance' },
  
  // Receipt Management
  { key: 'receipts-upload', label: 'Upload Receipts', description: 'Upload receipt images', category: 'Receipts' },
  { key: 'receipts-uncoded', label: 'Uncoded Receipts', description: 'Process uncoded receipts', category: 'Receipts' },
  { key: 'receipts-coded', label: 'Coded Receipts', description: 'View processed receipts', category: 'Receipts' },
  { key: 'receipt-reports', label: 'Receipt Reports', description: 'Generate receipt reports', category: 'Receipts' },
  
  // Banking
  { key: 'banking-accounts', label: 'Bank Accounts', description: 'View bank accounts', category: 'Banking' },
  { key: 'banking-credit-cards', label: 'Credit Cards', description: 'View credit cards', category: 'Banking' },
  { key: 'banking-reports', label: 'Banking Reports', description: 'Generate banking reports', category: 'Banking' },
  { key: 'journal-entries', label: 'Journal Entries', description: 'View accounting entries', category: 'Banking' },
  { key: 'deposits', label: 'Deposits', description: 'Record bank deposits', category: 'Banking' },
  { key: 'print-checks', label: 'Print Checks', description: 'Print payment checks', category: 'Banking' },
  { key: 'make-payment', label: 'Make Payments', description: 'Process payments', category: 'Banking' },
  { key: 'reconcile', label: 'Bank Reconciliation', description: 'Reconcile bank statements', category: 'Banking' },
  
  // Communication
  { key: 'messages', label: 'Messages', description: 'Internal messaging system', category: 'Communication' },
  { key: 'team-chat', label: 'Team Chat', description: 'Team communication', category: 'Communication' },
  { key: 'announcements', label: 'Announcements', description: 'Company announcements', category: 'Communication' },
  
  // Company Management
  { key: 'company-files', label: 'Company Files', description: 'View company documents', category: 'Company' },
  { key: 'company-contracts', label: 'Contracts', description: 'View company contracts', category: 'Company' },
  { key: 'company-permits', label: 'Permits', description: 'View company permits', category: 'Company' },
  { key: 'company-insurance', label: 'Insurance', description: 'View insurance policies', category: 'Company' },
  
  // Administration
  { key: 'settings', label: 'App Settings', description: 'Application configuration', category: 'Admin' },
  { key: 'company-settings', label: 'Company Settings', description: 'Company configuration', category: 'Admin' },
  { key: 'company-management', label: 'Company Management', description: 'Company user management', category: 'Admin' },
  { key: 'user-settings', label: 'User Management', description: 'User roles and permissions', category: 'Admin' },
  { key: 'theme-settings', label: 'Theme Settings', description: 'Customize app appearance', category: 'Admin' },
  { key: 'notification-settings', label: 'Notifications', description: 'Configure notifications', category: 'Admin' },
  { key: 'security-settings', label: 'Security Settings', description: 'Security configuration', category: 'Admin' },
  { key: 'email-templates', label: 'Email Templates', description: 'Manage email templates', category: 'Admin' },
  { key: 'profile-settings', label: 'Profile Settings', description: 'Personal profile settings', category: 'Personal' },
];

const roles = [
  { key: 'admin', label: 'Admin', color: 'bg-red-100 text-red-800', description: 'Full system access' },
  { key: 'controller', label: 'Controller', color: 'bg-blue-100 text-blue-800', description: 'Financial oversight' },
  { key: 'company_admin', label: 'Company Admin', color: 'bg-orange-100 text-orange-800', description: 'Company-wide management' },
  { key: 'project_manager', label: 'Project Manager', color: 'bg-green-100 text-green-800', description: 'Project management' },
  { key: 'employee', label: 'Employee', color: 'bg-gray-100 text-gray-800', description: 'Basic employee access' },
  { key: 'view_only', label: 'View Only', color: 'bg-purple-100 text-purple-800', description: 'Read-only access - Cannot create, edit, or delete' },
];

export default function RolePermissionsManager() {
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customPermissions, setCustomPermissions] = useState<CustomRolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openRoles, setOpenRoles] = useState<Record<string, boolean>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState({
    role_key: '',
    role_name: '',
    description: '',
    color: 'bg-indigo-100 text-indigo-800'
  });

  useEffect(() => {
    fetchPermissions();
    if (currentCompany) {
      fetchCustomRoles();
    }
  }, [currentCompany]);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role')
        .order('menu_item');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch role permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomRoles = async () => {
    if (!currentCompany) return;
    
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('custom_roles')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('role_name');

      if (rolesError) throw rolesError;
      setCustomRoles(rolesData || []);

      // Fetch permissions for all custom roles
      if (rolesData && rolesData.length > 0) {
        const { data: permsData, error: permsError } = await supabase
          .from('custom_role_permissions')
          .select('*')
          .in('custom_role_id', rolesData.map(r => r.id));

        if (permsError) throw permsError;
        setCustomPermissions(permsData || []);
      }
    } catch (error) {
      console.error('Error fetching custom roles:', error);
    }
  };

  const updatePermission = async (role: string, menuItem: string, canAccess: boolean) => {
    // Only allow admins to make changes
    if (profile?.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "Only administrators can modify role permissions.",
        variant: "destructive",
      });
      return;
    }

    // Don't allow changing admin permissions (they're always true)
    if (role === 'admin') {
      toast({
        title: "Cannot Modify",
        description: "Admin role automatically has full system access.",
        variant: "default",
      });
      return;
    }

    try {
      const { error } = await supabase
        .rpc('set_role_permission', {
          p_role: role as any,
          p_menu_item: menuItem,
          p_can_access: canAccess,
        });

      if (error) throw error;

      // Update local state
      setPermissions(prev => {
        const existing = prev.find(p => p.role === role && p.menu_item === menuItem);
        if (existing) {
          return prev.map(p => 
            p.role === role && p.menu_item === menuItem 
              ? { ...p, can_access: canAccess }
              : p
          );
        } else {
          return [...prev, { role, menu_item: menuItem, can_access: canAccess }];
        }
      });

      toast({
        title: "Permission Updated",
        description: `${role} access to ${menuItems.find(m => m.key === menuItem)?.label || menuItem} has been ${canAccess ? 'granted' : 'revoked'}.`,
      });

    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: "Error",
        description: (error as any)?.message || "Failed to update permission. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getPermission = (role: string, menuItem: string): boolean => {
    // Admin role automatically has access to everything
    if (role === 'admin') {
      return true;
    }
    
    const permission = permissions.find(p => p.role === role && p.menu_item === menuItem);
    return permission?.can_access || false;
  };

  const getCustomRolePermission = (customRoleId: string, menuItem: string): boolean => {
    const permission = customPermissions.find(p => p.custom_role_id === customRoleId && p.menu_item === menuItem);
    return permission?.can_access || false;
  };

  const updateCustomRolePermission = async (customRoleId: string, menuItem: string, canAccess: boolean) => {
    try {
      const { error } = await supabase
        .from('custom_role_permissions')
        .upsert({
          custom_role_id: customRoleId,
          menu_item: menuItem,
          can_access: canAccess,
        }, {
          onConflict: 'custom_role_id,menu_item'
        });

      if (error) throw error;

      // Update local state
      setCustomPermissions(prev => {
        const existing = prev.find(p => p.custom_role_id === customRoleId && p.menu_item === menuItem);
        if (existing) {
          return prev.map(p => 
            p.custom_role_id === customRoleId && p.menu_item === menuItem 
              ? { ...p, can_access: canAccess }
              : p
          );
        } else {
          return [...prev, { 
            id: crypto.randomUUID(), 
            custom_role_id: customRoleId, 
            menu_item: menuItem, 
            can_access: canAccess 
          }];
        }
      });

      toast({
        title: "Permission Updated",
        description: `Permission for ${menuItems.find(m => m.key === menuItem)?.label || menuItem} has been ${canAccess ? 'granted' : 'revoked'}.`,
      });

    } catch (error) {
      console.error('Error updating custom role permission:', error);
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive",
      });
    }
  };

  const createCustomRole = async () => {
    if (!currentCompany || !user) return;

    // Validation
    if (!newRole.role_key || !newRole.role_name) {
      toast({
        title: "Validation Error",
        description: "Role key and name are required",
        variant: "destructive",
      });
      return;
    }

    // Sanitize role key (lowercase, no spaces)
    const sanitizedKey = newRole.role_key.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .insert({
          company_id: currentCompany.id,
          role_key: sanitizedKey,
          role_name: newRole.role_name,
          description: newRole.description,
          color: newRole.color,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCustomRoles(prev => [...prev, data]);
      setCreateDialogOpen(false);
      setNewRole({
        role_key: '',
        role_name: '',
        description: '',
        color: 'bg-indigo-100 text-indigo-800'
      });

      toast({
        title: "Role Created",
        description: `Custom role "${newRole.role_name}" has been created successfully`,
      });
    } catch (error: any) {
      console.error('Error creating custom role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create custom role",
        variant: "destructive",
      });
    }
  };

  const deleteCustomRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"? This will remove all permissions and user assignments for this role.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      setCustomRoles(prev => prev.filter(r => r.id !== roleId));
      setCustomPermissions(prev => prev.filter(p => p.custom_role_id !== roleId));

      toast({
        title: "Role Deleted",
        description: `Custom role "${roleName}" has been deleted`,
      });
    } catch (error) {
      console.error('Error deleting custom role:', error);
      toast({
        title: "Error",
        description: "Failed to delete custom role",
        variant: "destructive",
      });
    }
  };

  const saveAllPermissions = async () => {
    toast({
      title: "Permissions Saved",
      description: "All role permissions have been updated successfully",
    });
  };

  if (loading) {
    return <div className="p-6 text-center">Loading permissions...</div>;
  }

  // Show access denied if not admin
  if (profile?.role !== 'admin') {
    return (
      <div className="p-6 text-center">
        <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">Only administrators can manage role permissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="permissions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="permissions">Menu Permissions</TabsTrigger>
          <TabsTrigger value="default-pages">Default Pages</TabsTrigger>
        </TabsList>
        
        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role-Based Menu Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-muted-foreground">Configure menu access for each user role. Click to expand each role.</p>
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Custom Role
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Custom Role</DialogTitle>
                      <DialogDescription>
                        Create a new custom role for your company with specific menu permissions
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="role-key">Role Key *</Label>
                        <Input
                          id="role-key"
                          placeholder="e.g., site_supervisor"
                          value={newRole.role_key}
                          onChange={(e) => setNewRole(prev => ({ ...prev, role_key: e.target.value }))}
                          maxLength={50}
                        />
                        <p className="text-xs text-muted-foreground">
                          Lowercase letters, numbers, and underscores only. This will be auto-formatted.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role-name">Role Name *</Label>
                        <Input
                          id="role-name"
                          placeholder="e.g., Site Supervisor"
                          value={newRole.role_name}
                          onChange={(e) => setNewRole(prev => ({ ...prev, role_name: e.target.value }))}
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role-description">Description</Label>
                        <Textarea
                          id="role-description"
                          placeholder="Describe this role's responsibilities..."
                          value={newRole.description}
                          onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                          maxLength={500}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role-color">Badge Color</Label>
                        <select
                          id="role-color"
                          value={newRole.color}
                          onChange={(e) => setNewRole(prev => ({ ...prev, color: e.target.value }))}
                          className="w-full p-2 border rounded"
                        >
                          <option value="bg-indigo-100 text-indigo-800">Indigo</option>
                          <option value="bg-purple-100 text-purple-800">Purple</option>
                          <option value="bg-pink-100 text-pink-800">Pink</option>
                          <option value="bg-orange-100 text-orange-800">Orange</option>
                          <option value="bg-yellow-100 text-yellow-800">Yellow</option>
                          <option value="bg-teal-100 text-teal-800">Teal</option>
                          <option value="bg-cyan-100 text-cyan-800">Cyan</option>
                        </select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={createCustomRole}>
                        Create Role
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

      <div className="space-y-4">
        {/* System Roles */}
        {roles.map((role) => (
          <Collapsible 
            key={role.key}
            open={openRoles[role.key]}
            onOpenChange={(open) => setOpenRoles(prev => ({ ...prev, [role.key]: open }))}
          >
            <Card className="overflow-hidden">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className={`${role.color} border-0`}>{role.label}</Badge>
                      <span className="text-xs text-muted-foreground">({role.description})</span>
                      {role.key === 'admin' && (
                        <Badge variant="outline" className="text-xs">Full Access</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      {openRoles[role.key] ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {/* Group permissions by category */}
                    {['Core', 'Projects', 'Vendors', 'HR', 'Time Tracking', 'Finance', 'Receipts', 'Banking', 'Communication', 'Company', 'Admin', 'Personal'].map((category) => {
                      const categoryItems = menuItems.filter(item => item.category === category);
                      if (categoryItems.length === 0) return null;
                      
                      return (
                        <div key={category} className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{category}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {categoryItems.map((menuItem) => (
                              <div key={menuItem.key} className="flex items-center space-x-2 p-2 rounded border bg-card hover:bg-primary/10 hover:border-primary transition-colors">
                                <Switch
                                  id={`${role.key}-${menuItem.key}`}
                                  checked={getPermission(role.key, menuItem.key)}
                                  onCheckedChange={(checked) => updatePermission(role.key, menuItem.key, checked)}
                                  disabled={role.key === 'admin'}
                                  className="scale-75"
                                />
                                <div className="flex-1 min-w-0">
                                  <Label 
                                    htmlFor={`${role.key}-${menuItem.key}`} 
                                    className="text-xs font-medium cursor-pointer block truncate"
                                  >
                                    {menuItem.label}
                                  </Label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
        
        {/* Custom Roles */}
        {customRoles.map((role) => (
          <Collapsible 
            key={role.id}
            open={openRoles[role.id]}
            onOpenChange={(open) => setOpenRoles(prev => ({ ...prev, [role.id]: open }))}
          >
            <Card className="overflow-hidden border-2 border-primary/20">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className={`${role.color} border-0`}>{role.role_name}</Badge>
                      <span className="text-xs text-muted-foreground">({role.description || 'Custom role'})</span>
                      <Badge variant="outline" className="text-xs">Custom</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomRole(role.id, role.role_name);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      {openRoles[role.id] ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {['Core', 'Projects', 'Vendors', 'HR', 'Time Tracking', 'Finance', 'Receipts', 'Banking', 'Communication', 'Company', 'Admin', 'Personal'].map((category) => {
                      const categoryItems = menuItems.filter(item => item.category === category);
                      if (categoryItems.length === 0) return null;
                      
                      return (
                        <div key={category} className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{category}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {categoryItems.map((menuItem) => (
                              <div key={menuItem.key} className="flex items-center space-x-2 p-2 rounded border bg-card hover:bg-primary/10 hover:border-primary transition-colors">
                                <Switch
                                  id={`${role.id}-${menuItem.key}`}
                                  checked={getCustomRolePermission(role.id, menuItem.key)}
                                  onCheckedChange={(checked) => updateCustomRolePermission(role.id, menuItem.key, checked)}
                                  className="scale-75"
                                />
                                <div className="flex-1 min-w-0">
                                  <Label 
                                    htmlFor={`${role.id}-${menuItem.key}`} 
                                    className="text-xs font-medium cursor-pointer block truncate"
                                  >
                                    {menuItem.label}
                                  </Label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <h3 className="text-sm font-medium mb-2">Permission Guidelines:</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Changes are automatically saved when toggled</li>
                  <li>• Click on role headers to expand/collapse settings</li>
                  <li>• Admin role automatically has full system access</li>
                  <li>• Users need to refresh their browser to see menu changes</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="default-pages">
          <RoleDefaultPageSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}