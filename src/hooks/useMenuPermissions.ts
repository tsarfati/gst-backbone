import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";

interface MenuPermissions {
  [key: string]: boolean;
}

export function useMenuPermissions() {
  const { profile } = useAuth();
  const { isSuperAdmin } = useTenant();
  const [permissions, setPermissions] = useState<MenuPermissions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Super admins are always allowed (no per-role menu fetch needed)
    if (isSuperAdmin) {
      setPermissions({});
      setLoading(false);
      return;
    }

    if (profile?.role) {
      fetchMenuPermissions();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role, isSuperAdmin]);

  const fetchMenuPermissions = async () => {
    if (!profile?.role) return;

    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('menu_item, can_access')
        .eq('role', profile.role);

      if (error) throw error;

      const permissionsMap: MenuPermissions = {};
      data?.forEach(permission => {
        permissionsMap[permission.menu_item] = permission.can_access;
      });

      setPermissions(permissionsMap);
    } catch (error) {
      console.error('Error fetching menu permissions:', error);
      // Default to no access if error
      setPermissions({});
    } finally {
      setLoading(false);
    }
  };

  const hasAccess = (menuItem: string): boolean => {
    if (loading) return false;

    // Super admins have access to everything
    if (isSuperAdmin) return true;

    // Admin users have access to everything
    if (profile?.role === 'admin') {
      return true;
    }

    // Always allow managers access to punch clock features
    const isManager = profile?.role === 'controller' || profile?.role === 'project_manager';
    const punchClockItems = ['punch-clock-dashboard', 'timecard-reports', 'punch-clock-settings'];
    if (isManager && punchClockItems.includes(menuItem)) {
      return true;
    }

    if (typeof permissions[menuItem] === 'boolean') {
      return permissions[menuItem];
    }
    return false;
  };

  const canAccessJobs = (jobIds?: string[]): boolean => {
    // Super admins always have access
    if (isSuperAdmin) return true;

    // Global access
    if (profile?.has_global_job_access) return true;

    // Admin always has access
    if (profile?.role === 'admin') return true;

    // If no specific jobs provided, check if user has any job access
    if (!jobIds) return true; // Let the component handle the specific checks

    return false; // This would need to be enhanced with actual job access checks
  };

  return {
    permissions,
    hasAccess,
    canAccessJobs,
    loading
  };
}
