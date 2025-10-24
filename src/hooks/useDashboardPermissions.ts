import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DashboardPermissions {
  [key: string]: boolean;
}

export function useDashboardPermissions() {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<DashboardPermissions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardPermissions = async () => {
      if (!profile?.role) {
        setLoading(false);
        return;
      }

      // Admin has access to everything
      if (profile.role === 'admin') {
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
        // Fetch role permissions from database
        const { data, error } = await supabase
          .from('role_permissions')
          .select('menu_item, can_access')
          .eq('role', profile.role)
          .like('menu_item', 'dashboard.%');

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
  }, [profile?.role]);

  const canViewSection = (section: string): boolean => {
    if (profile?.role === 'admin') return true;
    return permissions[`dashboard.${section}`] || false;
  };

  return {
    permissions,
    loading,
    canViewSection,
  };
}
