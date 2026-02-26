import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';

interface DashboardPermissions {
  [key: string]: boolean;
}

export function useDashboardPermissions() {
  const { profile } = useAuth();
  const { isSuperAdmin } = useTenant();
  const activeCompanyRole = useActiveCompanyRole();
  const [permissions, setPermissions] = useState<DashboardPermissions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardPermissions = async () => {
      // Super admins can view everything
      if (isSuperAdmin) {
        setPermissions({
          'dashboard.stats': true,
          'dashboard.notifications': true,
          'dashboard.messages': true,
          'dashboard.active_jobs': true,
          'dashboard.bills_overview': true,
          'dashboard.payment_status': true,
          'dashboard.invoice_summary': true,
          'dashboard.budget_tracking': true,
          'dashboard.punch_clock': true,
          'dashboard.timesheet_approval': true,
          'dashboard.overtime_alerts': true,
          'dashboard.employee_attendance': true,
          'dashboard.project_progress': true,
          'dashboard.task_deadlines': true,
          'dashboard.resource_allocation': true,
          'dashboard.credit_card_coding': true,
        });
        setLoading(false);
        return;
      }

      const baseRole = activeCompanyRole || profile?.role;

      if (!baseRole && !profile?.custom_role_id) {
        setLoading(false);
        return;
      }

      // Admin has access to everything (unless a custom role is explicitly assigned)
      if (!profile?.custom_role_id && baseRole === 'admin') {
        setPermissions({
          'dashboard.stats': true,
          'dashboard.notifications': true,
          'dashboard.messages': true,
          'dashboard.active_jobs': true,
          'dashboard.bills_overview': true,
          'dashboard.payment_status': true,
          'dashboard.invoice_summary': true,
          'dashboard.budget_tracking': true,
          'dashboard.punch_clock': true,
          'dashboard.timesheet_approval': true,
          'dashboard.overtime_alerts': true,
          'dashboard.employee_attendance': true,
          'dashboard.project_progress': true,
          'dashboard.task_deadlines': true,
          'dashboard.resource_allocation': true,
          'dashboard.credit_card_coding': true,
        });
        setLoading(false);
        return;
      }

      try {
        const query = profile?.custom_role_id
          ? supabase
              .from('custom_role_permissions')
              .select('menu_item, can_access')
              .eq('custom_role_id', profile.custom_role_id)
              .like('menu_item', 'dashboard.%')
          : supabase
              .from('role_permissions')
              .select('menu_item, can_access')
              .eq('role', baseRole as any)
              .like('menu_item', 'dashboard.%');

        const { data, error } = await query;

        if (error) throw error;

        const dashboardPerms: DashboardPermissions = {};
        data?.forEach((perm) => {
          dashboardPerms[perm.menu_item] = perm.can_access;
        });

        setPermissions(dashboardPerms);
      } catch (error) {
        console.error('Error fetching dashboard permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardPermissions();
  }, [profile?.role, profile?.custom_role_id, activeCompanyRole, isSuperAdmin]);

  const canViewSection = (section: string): boolean => {
    if (isSuperAdmin) return true;
    if (!profile?.custom_role_id && (activeCompanyRole === 'admin' || profile?.role === 'admin')) return true;
    return permissions[`dashboard.${section}`] || false;
  };

  return {
    permissions,
    loading,
    canViewSection,
  };
}
