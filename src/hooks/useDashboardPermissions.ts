import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';

interface DashboardPermissions {
  [key: string]: boolean;
}

export function useDashboardPermissions() {
  const { profile } = useAuth();
  const { isSuperAdmin } = useTenant();
  const activeCompanyRole = useActiveCompanyRole();
  const { hasAccess: hasMenuAccess, loading: menuPermissionsLoading } = useMenuPermissions();
  const [permissions, setPermissions] = useState<DashboardPermissions>({});
  const [loading, setLoading] = useState(true);
  const effectiveCustomRoleId = activeCompanyRole === 'employee' ? profile?.custom_role_id ?? null : null;

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

      if (!baseRole && !effectiveCustomRoleId) {
        setLoading(false);
        return;
      }

      // Admin has access to everything (unless a custom role is explicitly assigned)
      if (!effectiveCustomRoleId && baseRole === 'admin') {
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
        const query = effectiveCustomRoleId
          ? supabase
              .from('custom_role_permissions')
              .select('menu_item, can_access')
              .eq('custom_role_id', effectiveCustomRoleId)
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
  }, [profile?.role, effectiveCustomRoleId, activeCompanyRole, isSuperAdmin]);

  const canViewSection = (section: string): boolean => {
    if (isSuperAdmin) return true;
    if (!effectiveCustomRoleId && (activeCompanyRole === 'admin' || profile?.role === 'admin')) return true;

    const explicitPermission = permissions[`dashboard.${section}`];
    if (typeof explicitPermission === 'boolean') return explicitPermission;

    const menuFallbacks: Record<string, string[]> = {
      stats: ['dashboard', 'receipts', 'jobs', 'bills'],
      notifications: ['dashboard'],
      messages: ['messaging'],
      active_jobs: ['jobs'],
      bills_overview: ['bills', 'bills-view', 'payables-dashboard'],
      credit_card_coding: ['banking-credit-cards', 'credit-cards-transactions', 'credit-cards-code'],
      payment_status: ['make-payment', 'payment-history', 'payables-dashboard', 'bills'],
      invoice_summary: ['receivables', 'ar-invoices', 'ar-invoices-view'],
      budget_tracking: ['jobs', 'job-cost-management', 'job-cost-budget'],
      punch_clock: ['punch-clock-dashboard'],
      timesheet_approval: ['time-sheets', 'timesheets', 'timesheets-approve'],
      overtime_alerts: ['timecard-reports', 'timecard-reports-view'],
      employee_attendance: ['punch-clock-dashboard', 'employees'],
      project_progress: ['jobs', 'construction-reports-view'],
      task_deadlines: ['tasks'],
      resource_allocation: ['jobs', 'employees'],
    };

    return (menuFallbacks[section] || []).some((permission) => hasMenuAccess(permission));
  };

  return {
    permissions,
    loading: loading || menuPermissionsLoading,
    canViewSection,
  };
}
