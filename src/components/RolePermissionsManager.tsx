import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface RolePermission {
  role: string;
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
  { key: 'jobs-budget', label: 'Job Budgets', description: 'Manage project budgeting', category: 'Projects' },
  { key: 'jobs-reports', label: 'Job Reports', description: 'Generate job performance reports', category: 'Projects' },
  { key: 'cost-codes', label: 'Cost Codes', description: 'Manage job cost codes', category: 'Projects' },
  
  // Vendor Management
  { key: 'vendors', label: 'Vendors', description: 'View vendor directory', category: 'Vendors' },
  { key: 'vendors-add', label: 'Add Vendors', description: 'Register new vendors', category: 'Vendors' },
  { key: 'vendors-edit', label: 'Edit Vendors', description: 'Modify vendor information', category: 'Vendors' },
  
  // Employee Management
  { key: 'employees', label: 'Employees', description: 'View employee directory', category: 'HR' },
  { key: 'employees-add', label: 'Add Employees', description: 'Register new employees', category: 'HR' },
  
  // Time Tracking & Punch Clock
  { key: 'time-tracking', label: 'Punch Clock', description: 'Employee time clock system', category: 'Time Tracking' },
  { key: 'punch-clock-settings', label: 'Punch Clock Settings', description: 'Configure punch clock rules and settings', category: 'Time Tracking' },
  { key: 'timecard-reports', label: 'Timecard Reports', description: 'Generate detailed timecard reports', category: 'Time Tracking' },
  { key: 'employee-timecard-settings', label: 'Employee Time Settings', description: 'Individual employee time tracking settings', category: 'Time Tracking' },
  { key: 'time-corrections', label: 'Time Corrections', description: 'Review and approve time corrections', category: 'Time Tracking' },
  { key: 'punch-records', label: 'Punch Records', description: 'View punch in/out records', category: 'Time Tracking' },
  { key: 'timesheets', label: 'Timesheets', description: 'Review employee timesheets', category: 'Time Tracking' },
  
  // Financial Management
  { key: 'bills', label: 'Bills & Invoices', description: 'Manage bills and invoices', category: 'Finance' },
  { key: 'bills-add', label: 'Add Bills', description: 'Create new bills/invoices', category: 'Finance' },
  { key: 'bill-status', label: 'Bill Status', description: 'Track bill payment status', category: 'Finance' },
  { key: 'payment-history', label: 'Payment History', description: 'View payment records', category: 'Finance' },
  { key: 'payment-reports', label: 'Payment Reports', description: 'Generate payment reports', category: 'Finance' },
  
  // Receipt Management
  { key: 'receipts-upload', label: 'Upload Receipts', description: 'Upload receipt images', category: 'Receipts' },
  { key: 'receipts-uncoded', label: 'Uncoded Receipts', description: 'Process uncoded receipts', category: 'Receipts' },
  { key: 'receipts-coded', label: 'Coded Receipts', description: 'View processed receipts', category: 'Receipts' },
  { key: 'receipt-reports', label: 'Receipt Reports', description: 'Generate receipt reports', category: 'Receipts' },
  
  // Banking
  { key: 'banking-accounts', label: 'Bank Accounts', description: 'Manage bank accounts', category: 'Banking' },
  { key: 'banking-credit-cards', label: 'Credit Cards', description: 'Manage credit cards', category: 'Banking' },
  { key: 'banking-reports', label: 'Banking Reports', description: 'Generate banking reports', category: 'Banking' },
  { key: 'journal-entries', label: 'Journal Entries', description: 'Manage accounting entries', category: 'Banking' },
  { key: 'deposits', label: 'Deposits', description: 'Record bank deposits', category: 'Banking' },
  { key: 'print-checks', label: 'Print Checks', description: 'Print payment checks', category: 'Banking' },
  { key: 'make-payment', label: 'Make Payments', description: 'Process payments', category: 'Banking' },
  { key: 'reconcile', label: 'Bank Reconciliation', description: 'Reconcile bank statements', category: 'Banking' },
  
  // Communication
  { key: 'messages', label: 'Messages', description: 'Internal messaging system', category: 'Communication' },
  { key: 'team-chat', label: 'Team Chat', description: 'Team communication', category: 'Communication' },
  { key: 'announcements', label: 'Announcements', description: 'Company announcements', category: 'Communication' },
  
  // Company Management
  { key: 'company-files', label: 'Company Files', description: 'Manage company documents', category: 'Company' },
  { key: 'company-contracts', label: 'Contracts', description: 'Manage company contracts', category: 'Company' },
  { key: 'company-permits', label: 'Permits', description: 'Track company permits', category: 'Company' },
  { key: 'company-insurance', label: 'Insurance', description: 'Manage insurance policies', category: 'Company' },
  
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
  { key: 'project_manager', label: 'Project Manager', color: 'bg-green-100 text-green-800', description: 'Project management' },
  { key: 'employee', label: 'Employee', color: 'bg-gray-100 text-gray-800', description: 'Basic employee access' },
  { key: 'view_only', label: 'View Only', color: 'bg-purple-100 text-purple-800', description: 'Read-only access' },
];

export default function RolePermissionsManager() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openRoles, setOpenRoles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPermissions();
  }, []);

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Role Permissions</h2>
          <p className="text-muted-foreground">Configure menu access for each user role. Click to expand each role.</p>
        </div>
      </div>

      <div className="space-y-4">
        {roles.map((role) => (
          <Collapsible 
            key={role.key}
            open={openRoles[role.key]}
            onOpenChange={(open) => setOpenRoles(prev => ({ ...prev, [role.key]: open }))}
          >
            <Card className="overflow-hidden">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors">
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
                              <div key={menuItem.key} className="flex items-center space-x-2 p-2 rounded border bg-card hover:bg-accent/50 transition-colors">
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
    </div>
  );
}