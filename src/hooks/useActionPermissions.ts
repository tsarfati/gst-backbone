import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useMenuPermissions } from './useMenuPermissions';

/**
 * Hook for checking granular action permissions throughout the app.
 * Goes beyond menu visibility to control actual CRUD operations.
 */
export function useActionPermissions() {
  const { profile } = useAuth();
  const { isSuperAdmin } = useTenant();
  const { hasAccess, loading: permissionsLoading } = useMenuPermissions();

  // Normalize role and derive flags
  const normalizedRole = (profile?.role || '').toLowerCase().replace(/-/g, '_').trim();
  const isViewOnly = ['view_only', 'viewer', 'read_only', 'readonly', 'viewonly'].includes(normalizedRole);

  // Super admins behave like admins for app-level permissions
  const isAdmin = isSuperAdmin || normalizedRole === 'admin';

  // Controller and company_admin (and owner) have elevated permissions
  const isController = normalizedRole === 'controller';
  const isCompanyAdmin = normalizedRole === 'company_admin' || normalizedRole === 'owner';
  const hasElevatedAccess = isAdmin || isController || isCompanyAdmin;

  return {
    permissionsLoading,

    // Core CRUD permissions
    canCreate: (resource: string): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess(`${resource}-add`);
    },

    canEdit: (resource: string): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess(`${resource}-edit`);
    },

    canDelete: (resource: string): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      // Most delete operations require admin or controller
      return hasElevatedAccess;
    },

    canView: (resource: string): boolean => {
      // Everyone can view if they have menu access to the resource
      return hasAccess(resource);
    },

    // Specific feature permissions
    canViewReceipts: (): boolean => {
      return hasAccess('receipts-uncoded') || hasAccess('receipts-coded') || hasAccess('receipts-upload');
    },

    canUploadReceipts: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('receipts-upload');
    },

    canCodeReceipts: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('receipts-uncoded') || hasElevatedAccess;
    },

    canViewJobs: (): boolean => {
      if (isAdmin) return true;
      return hasAccess('jobs');
    },

    canCreateJobs: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (hasElevatedAccess) return true;
      return hasAccess('jobs-add');
    },

    canEditJobs: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('jobs-edit');
    },

    canViewJobBudgets: (): boolean => {
      if (isAdmin) return true;
      return hasAccess('jobs-budget') || hasAccess('jobs');
    },

    canEditJobBudgets: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('jobs-budget') && !isViewOnly;
    },

    canViewBills: (): boolean => {
      if (isAdmin) return true;
      return hasAccess('bills');
    },

    canCreateBills: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('bills-add');
    },

    canApproveBills: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      return hasElevatedAccess;
    },

    canViewVendors: (): boolean => {
      if (isAdmin) return true;
      return hasAccess('vendors');
    },

    canCreateVendors: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('vendors-add');
    },

    canEditVendors: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('vendors-edit');
    },

    canViewEmployees: (): boolean => {
      if (isAdmin) return true;
      return hasAccess('employees');
    },

    canCreateEmployees: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (hasElevatedAccess) return true;
      return hasAccess('employees-add');
    },

    canViewTimeTracking: (): boolean => {
      if (isAdmin) return true;
      return hasAccess('time-tracking') || hasAccess('timesheets') || hasAccess('punch-clock-dashboard');
    },

    canEditTimeTracking: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('time-corrections') || hasElevatedAccess;
    },

    canViewBanking: (): boolean => {
      if (isAdmin) return true;
      return hasAccess('banking-accounts') || hasAccess('banking-credit-cards');
    },

    canMakePayments: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('make-payment') && hasElevatedAccess;
    },

    canReconcileAccounts: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('reconcile') && (isController || isAdmin);
    },

    canManageSettings: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('settings') || hasAccess('company-settings');
    },

    canManageUsers: (): boolean => {
      if (!isSuperAdmin && isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess('user-settings') && (isAdmin || isCompanyAdmin);
    },

    // General utility checks
    isReadOnly: (): boolean => {
      return !isSuperAdmin && isViewOnly;
    },

    hasElevatedAccess: (): boolean => {
      return hasElevatedAccess;
    },

    isAdmin: (): boolean => {
      return isAdmin;
    },
  };
}

