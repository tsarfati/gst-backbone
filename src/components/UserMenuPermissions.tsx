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

const MENU_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'employees', label: 'Employees' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'messages', label: 'Messages' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'settings', label: 'Settings' },
  { key: 'reports', label: 'Reports' },
];

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
      const { data: rolePerms, error: roleError } = await supabase
        .from('role_permissions')
        .select('menu_item, can_access')
        .eq('role', userRole);

      if (roleError) throw roleError;

      const rolePermissionsMap: Record<string, boolean> = {};
      rolePerms?.forEach(perm => {
        rolePermissionsMap[perm.menu_item] = perm.can_access;
      });
      setRolePermissions(rolePermissionsMap);

      // Load user-specific permissions
      const { data: userPerms, error: userError } = await supabase
        .from('user_menu_permissions')
        .select('menu_item, can_access')
        .eq('user_id', userId);

      if (userError) throw userError;

      const userPermissionsMap: Record<string, boolean> = {};
      userPerms?.forEach(perm => {
        userPermissionsMap[perm.menu_item] = perm.can_access;
      });
      setUserPermissions(userPermissionsMap);

    } catch (error) {
      console.error('Error loading permissions:', error);
      toast({
        title: "Error",
        description: "Failed to load menu permissions",
        variant: "destructive",
      });
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
      // Delete existing user permissions
      await supabase
        .from('user_menu_permissions')
        .delete()
        .eq('user_id', userId);

      // Insert new permissions
      const permissions = Object.entries(userPermissions).map(([menuItem, canAccess]) => ({
        user_id: userId,
        menu_item: menuItem,
        can_access: canAccess
      }));

      if (permissions.length > 0) {
        const { error } = await supabase
          .from('user_menu_permissions')
          .insert(permissions);

        if (error) throw error;
      }

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
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Control which menu items this user can access. User-specific permissions override role-based permissions.
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MENU_ITEMS.map((item) => {
            const rolePermission = rolePermissions[item.key] || false;
            const userPermission = userPermissions[item.key];
            const effectivePermission = getEffectivePermission(item.key);
            const hasUserOverride = userPermissions.hasOwnProperty(item.key);

            return (
              <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor={`menu-${item.key}`} className="text-sm font-medium">
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
      </CardContent>
    </Card>
  );
}