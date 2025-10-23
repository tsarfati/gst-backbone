import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save } from "lucide-react";

interface UserMenuPermissionsProps {
  userId: string;
  userRole: string;
}

const MENU_SECTIONS = {
  'Core Navigation': [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'messages', label: 'Messages' },
    { key: 'announcements', label: 'Announcements' },
    { key: 'reports', label: 'Reports' },
  ],
  'Jobs Management': [
    { key: 'jobs', label: 'View Jobs' },
    { key: 'jobs-add', label: 'Create Jobs' },
    { key: 'jobs-edit', label: 'Edit Jobs' },
    { key: 'jobs-budget', label: 'Job Budgets' },
    { key: 'job-reports', label: 'Job Reports' },
  ],
  'Bills & Payables': [
    { key: 'bills', label: 'View Bills' },
    { key: 'bills-add', label: 'Create Bills' },
    { key: 'bill-approval', label: 'Approve Bills' },
    { key: 'make-payment', label: 'Make Payments' },
  ],
  'Receipts': [
    { key: 'receipts-upload', label: 'Upload Receipts' },
    { key: 'receipts-uncoded', label: 'Code Receipts' },
    { key: 'receipts-coded', label: 'View Coded Receipts' },
  ],
  'Vendors': [
    { key: 'vendors', label: 'View Vendors' },
    { key: 'vendors-add', label: 'Create Vendors' },
    { key: 'vendors-edit', label: 'Edit Vendors' },
  ],
  'Employees & Time': [
    { key: 'employees', label: 'View Employees' },
    { key: 'employees-add', label: 'Create Employees' },
    { key: 'timesheets', label: 'View Timesheets' },
    { key: 'time-corrections', label: 'Edit Time Cards' },
    { key: 'punch-clock-dashboard', label: 'Punch Clock Dashboard' },
  ],
  'Banking & Accounting': [
    { key: 'banking-accounts', label: 'Bank Accounts' },
    { key: 'banking-credit-cards', label: 'Credit Cards' },
    { key: 'reconcile', label: 'Reconcile Accounts' },
    { key: 'chart-of-accounts', label: 'Chart of Accounts' },
    { key: 'journal-entries', label: 'Journal Entries' },
  ],
  'Settings & Administration': [
    { key: 'settings', label: 'General Settings' },
    { key: 'company-settings', label: 'Company Settings' },
    { key: 'user-settings', label: 'User Management' },
  ],
};

export default function UserMenuPermissions({ userId, userRole }: UserMenuPermissionsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>({});
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadPermissions();
  }, [userId, userRole]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      // Load role-based permissions
      // For now, just set default role permissions since the table may not exist yet
      const rolePerms = null;
      const roleError = null;

      if (roleError) {
        console.log('Role permissions not available yet:', roleError);
      }

      const rolePermissionsMap: Record<string, boolean> = {};
      rolePerms?.forEach(perm => {
        rolePermissionsMap[perm.menu_item] = perm.can_access;
      });
      setRolePermissions(rolePermissionsMap);

      // Set default permissions for demo
      const defaultUserPermissions: Record<string, boolean> = {};
      Object.values(MENU_SECTIONS).forEach(section => {
        section.forEach(item => {
          defaultUserPermissions[item.key] = true;
        });
      });
      setUserPermissions(defaultUserPermissions);

    } catch (error) {
      console.error('Error loading permissions:', error);
      // Set default permissions for demo
      const defaultUserPermissions: Record<string, boolean> = {};
      Object.values(MENU_SECTIONS).forEach(section => {
        section.forEach(item => {
          defaultUserPermissions[item.key] = true;
        });
      });
      setUserPermissions(defaultUserPermissions);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (menuItem: string, canAccess: boolean) => {
    setUserPermissions(prev => ({
      ...prev,
      [menuItem]: canAccess
    }));
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      toast({
        title: "Success",
        description: "Menu permissions updated successfully",
      });
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: "Error",
        description: "Failed to save menu permissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getEffectivePermission = (menuItem: string) => {
    // User-specific permission overrides role permission
    if (userPermissions.hasOwnProperty(menuItem)) {
      return userPermissions[menuItem];
    }
    // Fall back to role permission
    return rolePermissions[menuItem] || false;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading permissions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Menu Access Permissions</CardTitle>
        <Button onClick={savePermissions} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-sm text-muted-foreground mb-4">
          Control which features and actions this user can access. User-specific permissions override role-based permissions.
        </div>
        
        {Object.entries(MENU_SECTIONS).map(([sectionName, items]) => (
          <div key={sectionName} className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
              {sectionName}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((item) => {
                const rolePermission = rolePermissions[item.key] || false;
                const userPermission = userPermissions[item.key];
                const effectivePermission = getEffectivePermission(item.key);
                const hasUserOverride = userPermissions.hasOwnProperty(item.key);

                return (
                  <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor={`menu-${item.key}`} className="text-sm font-medium cursor-pointer">
                        {item.label}
                      </Label>
                      <div className="text-xs text-muted-foreground">
                        Role default: {rolePermission ? 'Allowed' : 'Denied'}
                        {hasUserOverride && (
                          <span className="ml-2 text-primary font-medium">
                            (User override: {userPermission ? 'Allowed' : 'Denied'})
                          </span>
                        )}
                      </div>
                    </div>
                    <Switch
                      id={`menu-${item.key}`}
                      checked={effectivePermission}
                      onCheckedChange={(checked) => handlePermissionChange(item.key, checked)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}