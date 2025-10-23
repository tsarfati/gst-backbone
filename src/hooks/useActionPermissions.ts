import { useAuth } from '@/contexts/AuthContext';
import { useMenuPermissions } from './useMenuPermissions';

/**
 * Hook for checking granular action permissions throughout the app.
 * Goes beyond menu visibility to control actual CRUD operations.
 */
export function useActionPermissions() {
  const { profile } = useAuth();
  const { hasAccess } = useMenuPermissions();

  // View_only users can never create, update, or delete anything
  const isViewOnly = profile?.role === 'view_only';
  
  // Admin users can do everything
  const isAdmin = profile?.role === 'admin';
  
  // Controller and company_admin have elevated permissions
  const isController = profile?.role === 'controller';
  const isCompanyAdmin = profile?.role === 'company_admin';
  const hasElevatedAccess = isAdmin || isController || isCompanyAdmin;

  return {
    // Core CRUD permissions
    canCreate: (resource: string): boolean => {
      if (isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess(`${resource}-add`);
    },
    
    canEdit: (resource: string): boolean => {
      if (isViewOnly) return false;
      if (isAdmin) return true;
      return hasAccess(`${resource}-edit`);
    },
    
    canDelete: (resource: string): boolean => {
      if (isViewOnly) return false;
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
      if (isViewOnly) return false;
      return hasAccess('receipts-upload');
    },

    canCodeReceipts: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('receipts-uncoded') || hasElevatedAccess;
    },

    canViewJobs: (): boolean => {
      return hasAccess('jobs');
    },

    canCreateJobs: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('jobs-add');
    },

    canEditJobs: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('jobs-edit');
    },

    canViewJobBudgets: (): boolean => {
      return hasAccess('jobs-budget') || hasAccess('jobs');
    },

    canEditJobBudgets: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('jobs-budget') && !isViewOnly;
    },

    canViewBills: (): boolean => {
      return hasAccess('bills');
    },

    canCreateBills: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('bills-add');
    },

    canApproveBills: (): boolean => {
      if (isViewOnly) return false;
      return hasElevatedAccess;
    },

    canViewVendors: (): boolean => {
      return hasAccess('vendors');
    },

    canCreateVendors: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('vendors-add');
    },

    canEditVendors: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('vendors-edit');
    },

    canViewEmployees: (): boolean => {
      return hasAccess('employees');
    },

    canCreateEmployees: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('employees-add');
    },

    canViewTimeTracking: (): boolean => {
      return hasAccess('time-tracking') || hasAccess('timesheets') || hasAccess('punch-clock-dashboard');
    },

    canEditTimeTracking: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('time-corrections') || hasElevatedAccess;
    },

    canViewBanking: (): boolean => {
      return hasAccess('banking-accounts') || hasAccess('banking-credit-cards');
    },

    canMakePayments: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('make-payment') && hasElevatedAccess;
    },

    canReconcileAccounts: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('reconcile') && (isController || isAdmin);
    },

    canManageSettings: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('settings') || hasAccess('company-settings');
    },

    canManageUsers: (): boolean => {
      if (isViewOnly) return false;
      return hasAccess('user-settings') && (isAdmin || isCompanyAdmin);
    },

    // General utility checks
    isReadOnly: (): boolean => {
      return isViewOnly;
    },

    hasElevatedAccess: (): boolean => {
      return hasElevatedAccess;
    },

    isAdmin: (): boolean => {
      return isAdmin;
    },
  };
}
