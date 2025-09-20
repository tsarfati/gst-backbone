import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface RolePermission {
  role: string;
  menu_item: string;
  can_access: boolean;
}

const menuItems = [
  { key: 'dashboard', label: 'Dashboard', description: 'Main dashboard overview' },
  { key: 'jobs', label: 'Jobs', description: 'Manage construction jobs and projects' },
  { key: 'vendors', label: 'Vendors', description: 'Manage vendor relationships' },
  { key: 'employees', label: 'Employees', description: 'Employee management and profiles' },
  { key: 'receipts', label: 'Receipts', description: 'Upload and manage receipts' },
  { key: 'messages', label: 'Messages', description: 'Internal messaging system' },
  { key: 'announcements', label: 'Announcements', description: 'Company announcements' },
  { key: 'settings', label: 'Settings', description: 'Application settings and configuration' },
  { key: 'reports', label: 'Reports', description: 'Analytics and reporting features' },
];

const roles = [
  { key: 'admin', label: 'Admin', color: 'bg-red-500' },
  { key: 'controller', label: 'Controller', color: 'bg-blue-500' },
  { key: 'employee', label: 'Employee', color: 'bg-gray-500' },
];

export default function RolePermissionsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    try {
      const { error } = await supabase
        .from('role_permissions')
        .upsert({
          role: role as any,
          menu_item: menuItem,
          can_access: canAccess
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

    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive",
      });
    }
  };

  const getPermission = (role: string, menuItem: string): boolean => {
    const permission = permissions.find(p => p.role === role && p.menu_item === menuItem);
    return permission?.can_access || false;
  };

  const saveAllPermissions = async () => {
    setSaving(true);
    try {
      toast({
        title: "Permissions Saved",
        description: "All role permissions have been updated successfully",
      });
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: "Error",
        description: "Failed to save permissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading permissions...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Permissions</h1>
          <p className="text-muted-foreground">Configure menu access for each user role</p>
        </div>
        <Button onClick={saveAllPermissions} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>

      <div className="grid gap-6">
        {roles.map((role) => (
          <Card key={role.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge className={role.color}>{role.label}</Badge>
                <Settings className="h-5 w-5" />
                Menu Access Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {menuItems.map((menuItem) => (
                  <div key={menuItem.key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor={`${role.key}-${menuItem.key}`} className="font-medium">
                        {menuItem.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {menuItem.description}
                      </p>
                    </div>
                    <Switch
                      id={`${role.key}-${menuItem.key}`}
                      checked={getPermission(role.key, menuItem.key)}
                      onCheckedChange={(checked) => updatePermission(role.key, menuItem.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-muted p-4 rounded-lg">
        <h3 className="font-medium mb-2">Permission Notes:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Menu items will be hidden for roles that don't have access</li>
          <li>• Changes take effect immediately after saving</li>
          <li>• Users may need to refresh their browser to see menu changes</li>
          <li>• Admin role should typically have access to all features</li>
        </ul>
      </div>
    </div>
  );
}