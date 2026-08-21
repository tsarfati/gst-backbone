import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ReceiptProvider } from "@/contexts/ReceiptContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AccessControl } from "@/components/AccessControl";
import { RoleGuard } from "@/components/RoleGuard";
import Layout from "@/components/AppLayout";
import CompanyRequest from "@/pages/CompanyRequest";
import ProfileCompletion from "@/pages/ProfileCompletion";
import TenantRequest from "@/pages/TenantRequest";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import SubscriptionTierEditor from "@/pages/SubscriptionTierEditor";
import TenantDetails from "@/pages/TenantDetails";
import LandingPage from "@/pages/LandingPage";
import ContactPage from "@/pages/ContactPage";
import PunchClockLynkLanding from "@/pages/PunchClockLynkLanding";
import PMLynkLanding from "@/pages/PMLynkLanding";
import DesignProLynkLanding from "@/pages/DesignProLynkLanding";
import VisitorLynkLanding from "@/pages/VisitorLynkLanding";
import VisitorLynkStart from "@/pages/VisitorLynkStart";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import DemoRequest from "@/pages/DemoRequest";
import TaskDetails from "@/pages/TaskDetails";

import UploadReceipts from "./pages/UploadReceipts";
import UncodedReceipts from "./pages/UncodedReceipts";
import JobEdit from "./pages/JobEdit";
import JobBudget from "./pages/JobBudget";
import DeliveryTickets from "./pages/DeliveryTickets";
import VendorDetails from "./pages/VendorDetails";
import VendorEdit from "./pages/VendorEdit";
import VendorReports from "./pages/VendorReports";
import UserEdit from "./pages/UserEdit";
import UserDetails from "./pages/UserDetails";
import AppSettings from "./pages/AppSettings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AllEmployees from "./pages/AllEmployees";
import AddEmployee from "./pages/AddEmployee";
import EmployeePayroll from "./pages/EmployeePayroll";
import EmployeePerformance from "./pages/EmployeePerformance";
import EmployeeReports from "./pages/EmployeeReports";
import PinEmployeeListReport from "./pages/reports/PinEmployeeListReport";
import EmployeeQRCardsReport from "./pages/reports/EmployeeQRCardsReport";
import PunchClockAttemptAuditReport from "./pages/reports/PunchClockAttemptAuditReport";

import TimeSheets from "./pages/TimeSheets";
import PunchClockSettings from "./pages/PunchClockSettings";
import AllMessages from "./pages/AllMessages";
import TeamChat from "./pages/TeamChat";
import Announcements from "./pages/Announcements";
import AllTasks from "./pages/AllTasks";
import CalendarPage from "./pages/CalendarPage";
import BillEdit from "./pages/BillEdit";
import PaymentHistory from "./pages/PaymentHistory";
import PaymentDetails from "./pages/PaymentDetails";
import PaymentEdit from "./pages/PaymentEdit";
import PaymentReports from "./pages/PaymentReports";
import GeneralLedger from "./pages/GeneralLedger";
import AddBill from "./pages/AddBill";
import AddJob from "./pages/AddJob";
import BankingChartOfAccounts from "./pages/BankingChartOfAccounts";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import CostCodes from "./pages/CostCodes";
import JobCostManagement from "./pages/JobCostManagement";
import JobCostSetup from "./pages/JobCostSetup";
import JobCostSetupStandalone from "./pages/JobCostSetupStandalone";
import JobCostBudget from "./pages/JobCostBudget";
import CompanySettingsPage from "./pages/CompanySettingsPage";
import SecuritySettings from "./pages/SecuritySettings";
import ProfileSettings from "./pages/ProfileSettings";
import ThemeSettings from "./pages/ThemeSettings";
import PMLynkSettings from "./pages/PMLynkSettings";
import SettingsHelpDatabase from "./pages/SettingsHelpDatabase";
import CodedReceipts from "./pages/CodedReceipts";
import NotificationSettings from "./pages/NotificationSettings";
import EmailTemplateEdit from "./pages/EmailTemplateEdit";
import EmailTemplatePreview from "./pages/EmailTemplatePreview";
import ReceiptReports from "./pages/ReceiptReports";
import AddSubcontract from "./pages/AddSubcontract";
import AddPurchaseOrder from "./pages/AddPurchaseOrder";
import Subcontracts from "./pages/Subcontracts";
import PurchaseOrders from "./pages/PurchaseOrders";
import SubcontractDetails from "./pages/SubcontractDetails";
import SubcontractEdit from "./pages/SubcontractEdit";
import AddChangeOrder from "./pages/AddChangeOrder";
import JobReports from "./pages/JobReports";
import CompanyContracts from "./pages/CompanyContracts";
import CompanyPermits from "./pages/CompanyPermits";
import CompanyInsurance from "./pages/CompanyInsurance";
import CompanyVault from "./pages/CompanyVault";
import CompanyManagement from "./pages/CompanyManagement";
import BankAccounts from "./pages/BankAccounts";
import BankAccountDetails from "./pages/BankAccountDetails";
import CreditCards from "./pages/CreditCards";
import CreditCardDetails from "./pages/CreditCardDetails";
import CreditCardEdit from "./pages/CreditCardEdit";
import CreditCardTransactions from "./pages/CreditCardTransactions";
import CreditCardMakePayment from "./pages/CreditCardMakePayment";
import BalanceSheet from "./pages/BalanceSheet";
import JournalEntries from "./pages/JournalEntries";
import JournalEntryDetails from "./pages/JournalEntryDetails";
import JournalEntryEdit from "./pages/JournalEntryEdit";
import ReconciliationReport from "./pages/ReconciliationReport";
import Deposits from "./pages/Deposits";
import PrintChecks from "./pages/PrintChecks";
import MakePayment from "./pages/MakePayment";
import Reconcile from "./pages/Reconcile";
import PunchClockDashboard from "./pages/PunchClockDashboard";
import PayablesDashboard from "./pages/PayablesDashboard";
import AddBankAccount from "./pages/AddBankAccount";
import AddCreditCard from "./pages/AddCreditCard";
import NewJournalEntry from "./pages/NewJournalEntry";
import ConstructionDashboard from "./pages/ConstructionDashboard";
import ConstructionSchedule from "./pages/ConstructionSchedule";
import AddRFP from "./pages/AddRFP";
import BidComparison from "./pages/BidComparison";
import AddBid from "./pages/AddBid";
import ConstructionSubmittals from "./pages/ConstructionSubmittals";
import AddScoringCriterion from "./pages/AddScoringCriterion";
import ProjectCostTransactionHistory from "./pages/reports/ProjectCostTransactionHistory";
import ProjectTransactionReport from "./pages/reports/ProjectTransactionReport";
import SubcontractSummaryReport from "./pages/reports/SubcontractSummaryReport";
import SubcontractDetailsByVendor from "./pages/reports/SubcontractDetailsByVendor";
import ProjectCostBudgetStatus from "./pages/reports/ProjectCostBudgetStatus";
import CommittedCostDetails from "./pages/reports/CommittedCostDetails";

import ManualPunchOut from "./pages/ManualPunchOut";
import ManualTimeEntry from "./pages/ManualTimeEntry";
import Customers from "./pages/Customers";
import CustomerDetails from "./pages/CustomerDetails";
import CustomerEdit from "./pages/CustomerEdit";
import ARInvoices from "./pages/ARInvoices";
import ARPayments from "./pages/ARPayments";
import ReceivablesDashboard from "./pages/ReceivablesDashboard";
import AddARInvoice from "./pages/AddARInvoice";
import ARInvoiceDetails from "./pages/ARInvoiceDetails";
import VisitorLogin from "./pages/VisitorLogin";
import VisitorCheckout from "./pages/VisitorCheckout";
import JobVisitorLogs from "./pages/JobVisitorLogs";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import VendorPortalDashboard from "./pages/VendorPortalDashboard";
import VendorPortalJobs from "./pages/VendorPortalJobs";
import VendorPortalBills from "./pages/VendorPortalBills";
import VendorPortalInvoiceDetails from "./pages/VendorPortalInvoiceDetails";
import VendorPortalRfps from "./pages/VendorPortalRfps";
import VendorPortalCompliance from "./pages/VendorPortalCompliance";
import VendorPortalSettings from "./pages/VendorPortalSettings";
import VendorPortalMessages from "./pages/VendorPortalMessages";
import VendorPortalChooser from "./pages/VendorPortalChooser";
import DesignProfessionalDashboard from "./pages/DesignProfessionalDashboard";
import DesignProfessionalJobs from "./pages/DesignProfessionalJobs";
import DesignProfessionalCompanySettings from "./pages/DesignProfessionalCompanySettings";
import DesignProfessionalProjectAccess from "./pages/DesignProfessionalProjectAccess";
import DesignProfessionalRFIs from "./pages/DesignProfessionalRFIs";
import DesignProfessionalSubmittals from "./pages/DesignProfessionalSubmittals";
import DesignProfessionalPermitting from "./pages/DesignProfessionalPermitting";
import VendorRegister from "./pages/VendorRegister";
import VendorSignup from "./pages/VendorSignup";
import VendorLogin from "./pages/VendorLogin";
import DesignProfessionalSignup from "./pages/DesignProfessionalSignup";
import SubscriptionPortal from "./pages/SubscriptionPortal";
import { useCompanyFeatureAccess } from "@/hooks/useCompanyFeatureAccess";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAuthEntryContext } from "@/utils/authEntryContext";
import { getVendorPortalCompanyId } from "@/utils/vendorPortalSession";

const LazyTimecardReports = React.lazy(() => import("./pages/TimecardReports"));
const LazyPlanViewer = React.lazy(() => import("./pages/PlanViewer"));
const LazyBillDetails = React.lazy(() => import("./pages/BillDetails"));
const LazyCreditCardTransactionReport = React.lazy(() => import("./pages/CreditCardTransactionReport"));
const LazyCompanyFiles = React.lazy(() => import("./pages/CompanyFiles"));
const LazyBankingReports = React.lazy(() => import("./pages/BankingReports"));
const LazyConstructionReports = React.lazy(() => import("./pages/ConstructionReports"));
const LazyRFPDetails = React.lazy(() => import("./pages/RFPDetails"));
const LazyBidDetails = React.lazy(() => import("./pages/BidDetails"));
const LazyAPAgingByJobReport = React.lazy(() => import("./pages/reports/APAgingByJobReport"));
const LazyReceivablesReports = React.lazy(() => import("./pages/ReceivablesReports"));
const LazyDashboard = React.lazy(() => import("./pages/Dashboard"));
const LazyConstructionDashboard = React.lazy(() => import("./pages/ConstructionDashboard"));
const LazyJobs = React.lazy(() => import("./pages/Jobs"));
const LazyJobDetails = React.lazy(() => import("./pages/JobDetails"));
const LazyVendors = React.lazy(() => import("./pages/Vendors"));
const LazyBills = React.lazy(() => import("./pages/Bills"));
const LazyUserSettings = React.lazy(() => import("./pages/UserSettings"));
const LazyCompanySettingsPage = React.lazy(() => import("./pages/CompanySettingsPage"));
const LazyRFPs = React.lazy(() => import("./pages/RFPs"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

function RouteSuspense({ children, text = "Loading page..." }: { children: React.ReactNode; text?: string }) {
  return (
    <React.Suspense fallback={<PremiumLoadingScreen text={text} />}>
      {children}
    </React.Suspense>
  );
}

// Protected Route Component that must be inside AuthProvider
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <PremiumLoadingScreen text="Authenticating your session..." />;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function DashboardEntryRoute() {
  const { user, profile } = useAuth();
  const { currentCompany, userCompanies, loading: companyLoading } = useCompany();
  const location = useLocation();
  const [resolvedExternalRole, setResolvedExternalRole] = React.useState<'vendor' | 'design_professional' | null>(null);
  const [resolvingExternalRole, setResolvingExternalRole] = React.useState(false);
  const role = String(profile?.role || '').toLowerCase();
  const authMetadata = (user?.user_metadata || {}) as Record<string, any>;
  const currentCompanyType = String(currentCompany?.company_type || '').toLowerCase();
  const currentCompanyIsInternal =
    !!currentCompany &&
    currentCompanyType !== 'vendor' &&
    currentCompanyType !== 'design_professional';
  const hasVendorIdentity =
    !!(profile as any)?.vendor_id ||
    !!authMetadata.vendor_id ||
    authMetadata.is_vendor === true ||
    authMetadata.is_vendor === 'true';
  const authEntryContext = getAuthEntryContext();
  const pinnedVendorPortalCompanyId = getVendorPortalCompanyId();
  const onExternalPortalPath =
    location.pathname.startsWith('/vendor') ||
    location.pathname.startsWith('/design-professional');
  const companyAccessRole = userCompanies.length === 1 ? String(userCompanies[0]?.role || '').toLowerCase() : '';
  const hasInternalWorkspace = userCompanies.some((company) => {
    const companyRole = String(company.role || '').toLowerCase();
    return companyRole !== 'vendor' && companyRole !== 'design_professional';
  });
  const hasOnlyExternalWorkspace =
    !hasInternalWorkspace &&
    userCompanies.length > 0 &&
    userCompanies.every((company) => {
      const companyRole = String(company.role || '').toLowerCase();
      return companyRole === 'vendor' || companyRole === 'design_professional';
    });
  const shouldPreferVendorPortal =
    authEntryContext === 'vendor' &&
    (!!pinnedVendorPortalCompanyId || onExternalPortalPath || !hasInternalWorkspace);
  const shouldBlockOnCompanyLoading =
    companyLoading &&
    !currentCompany &&
    userCompanies.length === 0;

  React.useEffect(() => {
    let cancelled = false;

    const resolveExternalRole = async () => {
      if (!user?.id) {
        setResolvedExternalRole(null);
        setResolvingExternalRole(false);
        return;
      }

      if (authEntryContext === 'builder') {
        setResolvedExternalRole(null);
        setResolvingExternalRole(false);
        return;
      }

      const directRole =
        (role === 'vendor' || role === 'design_professional') && shouldPreferVendorPortal
          ? (role as 'vendor' | 'design_professional')
          : null;
      if (directRole) {
        setResolvedExternalRole(directRole);
        setResolvingExternalRole(false);
        return;
      }

      if (currentCompanyType === 'vendor' && shouldPreferVendorPortal) {
        setResolvedExternalRole('vendor');
        setResolvingExternalRole(false);
        return;
      }

      if (currentCompanyType === 'design_professional' && shouldPreferVendorPortal) {
        setResolvedExternalRole('design_professional');
        setResolvingExternalRole(false);
        return;
      }

      if ((companyAccessRole === 'vendor' || companyAccessRole === 'design_professional') && shouldPreferVendorPortal) {
        setResolvedExternalRole(companyAccessRole as 'vendor' | 'design_professional');
        setResolvingExternalRole(false);
        return;
      }

      if (hasVendorIdentity && shouldPreferVendorPortal) {
        setResolvedExternalRole('vendor');
        setResolvingExternalRole(false);
        return;
      }

      if (authEntryContext === 'builder' && hasInternalWorkspace) {
        setResolvedExternalRole(null);
        setResolvingExternalRole(false);
        return;
      }

      setResolvingExternalRole(true);
      try {
        const { data, error } = await supabase
          .from('company_access_requests')
          .select('notes, requested_at')
          .eq('user_id', user.id)
          .order('requested_at', { ascending: false })
          .limit(10);

        if (cancelled) return;
        if (error) {
          console.warn('DashboardEntryRoute external role lookup failed:', error);
          setResolvedExternalRole(null);
          return;
        }

        const matchedRow = (data || []).find((row: any) => {
          try {
            const parsed = row?.notes ? JSON.parse(row.notes) : null;
            return String(parsed?.requestType || '').toLowerCase() === 'external_access_signup';
          } catch {
            return false;
          }
        }) as { notes?: string | null } | undefined;

        if (!matchedRow?.notes) {
          setResolvedExternalRole(null);
          return;
        }

        try {
          const parsed = JSON.parse(matchedRow.notes);
          const requestedRole = String(parsed?.requestedRole || '').toLowerCase();
          setResolvedExternalRole(
            requestedRole === 'vendor' || requestedRole === 'design_professional'
              ? requestedRole
              : null,
          );
        } catch {
          setResolvedExternalRole(null);
        }
      } finally {
        if (!cancelled) {
          setResolvingExternalRole(false);
        }
      }
    };

    resolveExternalRole();

    return () => {
      cancelled = true;
    };
  }, [user?.id, role, currentCompanyType, companyAccessRole, hasVendorIdentity, hasInternalWorkspace, authEntryContext, shouldPreferVendorPortal, pinnedVendorPortalCompanyId]);

  if (shouldBlockOnCompanyLoading || resolvingExternalRole) {
    return <PremiumLoadingScreen text="Loading your workspace..." />;
  }

  if (authEntryContext === 'builder' && currentCompanyIsInternal) {
    return (
      <RouteSuspense text="Loading dashboard...">
        <LazyDashboard />
      </RouteSuspense>
    );
  }

  if (
    authEntryContext === 'builder' &&
    !hasInternalWorkspace &&
    userCompanies.length === 1 &&
    (companyAccessRole === 'vendor' || companyAccessRole === 'design_professional')
  ) {
    return <Navigate to={companyAccessRole === 'design_professional' ? "/design-professional/dashboard" : "/vendor/dashboard"} replace />;
  }

  if (authEntryContext === 'builder' && !currentCompanyIsInternal && !hasInternalWorkspace && userCompanies.length > 1) {
    return <Navigate to="/workspace/select" replace />;
  }

  if (resolvedExternalRole === 'design_professional') {
    return <Navigate to="/design-professional/dashboard" replace />;
  }
  if (resolvedExternalRole === 'vendor') {
    return <Navigate to={authEntryContext === 'vendor' ? "/vendor/dashboard" : "/workspace/select"} replace />;
  }

  return (
    <RouteSuspense text="Loading dashboard...">
      <LazyDashboard />
    </RouteSuspense>
  );
}

function OrganizationOwnerRoute({ children }: { children: React.ReactNode }) {
  const { tenantMember, isSuperAdmin, loading } = useTenant();
  const { hasFeature, loading: featureLoading } = useCompanyFeatureAccess(['organization_management']);
  const tenantRole = String(tenantMember?.role || '').trim().toLowerCase();
  const hasOrganizationAdminAccess =
    isSuperAdmin || tenantRole === 'owner' || tenantRole === 'admin';

  if (loading || featureLoading) {
    return <PremiumLoadingScreen text="Loading organization access..." />;
  }

  if (!hasOrganizationAdminAccess) {
    return <Navigate to="/settings/company" replace />;
  }

  if (!hasFeature('organization_management') && !hasOrganizationAdminAccess) {
    return <Navigate to="/settings/company" replace />;
  }

  return <>{children}</>;
}

function CompanyOwnerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { tenantMember, isSuperAdmin, loading } = useTenant();

  if (loading) {
    return <PremiumLoadingScreen text="Loading company ownership..." />;
  }

  if (!isSuperAdmin && tenantMember?.role !== 'owner') {
    return <Navigate to="/design-professional/settings/company" replace />;
  }

  return <>{children}</>;
}

function PunchClockFeatureRoute({ children }: { children: React.ReactNode }) {
  const { hasFeature, loading } = useCompanyFeatureAccess(['punch_clock_app']);

  if (loading) {
    return <PremiumLoadingScreen text="Loading Punch Clock access..." />;
  }

  if (!hasFeature('punch_clock_app')) {
    return <Navigate to="/settings/company" replace />;
  }

  return <>{children}</>;
}

function PMLynkFeatureRoute({ children }: { children: React.ReactNode }) {
  const { hasFeature, loading } = useCompanyFeatureAccess(['pm_lynk']);

  if (loading) {
    return <PremiumLoadingScreen text="Loading PM LYNK access..." />;
  }

  if (!hasFeature('pm_lynk')) {
    return <Navigate to="/settings/company" replace />;
  }

  return <>{children}</>;
}

function MenuPermissionRoute({
  menuKey,
  fallbackMenuKeys = [],
  children,
  redirectTo = '/',
}: {
  menuKey: string;
  fallbackMenuKeys?: string[];
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const { hasAccess, loading } = useMenuPermissions();

  if (loading) {
    return <PremiumLoadingScreen text="Loading menu access..." />;
  }

  if (!hasAccess(menuKey) && !fallbackMenuKeys.some((key) => hasAccess(key))) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

function CompanyTypeRoute({
  allowedTypes,
  redirectTo = '/',
}: {
  allowedTypes: Array<'construction' | 'design_professional' | 'vendor'>;
  redirectTo?: string;
}) {
  const { currentCompany, loading } = useCompany();
  const { isSuperAdmin } = useTenant();

  if (loading) {
    return <PremiumLoadingScreen text="Loading company type..." />;
  }

  if (isSuperAdmin) {
    return <Outlet />;
  }

  const companyType: 'construction' | 'design_professional' | 'vendor' =
    currentCompany?.company_type === 'design_professional'
      ? 'design_professional'
      : currentCompany?.company_type === 'vendor'
      ? 'vendor'
      : 'construction';

  if (!allowedTypes.includes(companyType)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}

function PublicRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/punch-clock-lynk" element={<PunchClockLynkLanding />} />
      <Route path="/pm-lynk" element={<PMLynkLanding />} />
      <Route path="/design-pro-lynk" element={<DesignProLynkLanding />} />
      <Route path="/visitor-lynk" element={<VisitorLynkLanding />} />
      <Route path="/visitor-lynk/start" element={<Navigate to="/visitor-lynk" replace />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/demo" element={<DemoRequest />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
      <Route path="/visitor/:qrCode" element={<VisitorLogin />} />
      <Route path="/visitor/checkout/:token" element={<VisitorCheckout />} />
      <Route path="/vendor-register" element={<VendorRegister />} />
      <Route path="/vendor-signup" element={<VendorSignup />} />
      <Route path="/vendor-login" element={<VendorLogin />} />
      <Route path="/design-professional-signup" element={<DesignProfessionalSignup />} />
      <Route path="/jobs/:id/visitor-logs/*" element={<JobVisitorLogs />} />
    </Routes>
  );
}

function AuthenticatedRoutes() {
  return (
              <Routes>
              <Route path="/profile-completion" element={
                <ProtectedRoute>
                  <ProfileCompletion />
                </ProtectedRoute>
              } />
              <Route path="/tenant-request" element={
                <ProtectedRoute>
                  <TenantRequest />
                </ProtectedRoute>
              } />
              <Route path="/super-admin" element={
                <ProtectedRoute>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/super-admin/tenant/:tenantId" element={
                <ProtectedRoute>
                  <TenantDetails />
                </ProtectedRoute>
              } />
              <Route path="/super-admin/tiers/new" element={
                <ProtectedRoute>
                  <SubscriptionTierEditor />
                </ProtectedRoute>
              } />
              <Route path="/super-admin/tiers/:tierId/edit" element={
                <ProtectedRoute>
                  <SubscriptionTierEditor />
                </ProtectedRoute>
              } />
              <Route path="/company-request" element={
                <ProtectedRoute>
                  <AccessControl>
                    <CompanyRequest />
                  </AccessControl>
                </ProtectedRoute>
              } />
              <Route path="/contact" element={<ContactPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <AccessControl>
                  <RoleGuard allowedRoles={['admin', 'controller', 'project_manager', 'manager', 'employee', 'view_only', 'company_admin', 'vendor', 'design_professional']}>
                    <Layout />
                  </RoleGuard>
                </AccessControl>
              </ProtectedRoute>
            }>
              <Route index element={<DashboardEntryRoute />} />
              <Route path="dashboard" element={<DashboardEntryRoute />} />
              <Route path="design-professional-dashboard" element={<Navigate to="/design-professional/dashboard" replace />} />
              <Route path="vendor-dashboard" element={<Navigate to="/vendor/dashboard" replace />} />
              <Route path="vendor/select" element={<Navigate to="/workspace/select" replace />} />
              <Route path="vendor/dashboard" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalDashboard />
                </RoleGuard>
              } />
              <Route path="vendor/jobs" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalJobs />
                </RoleGuard>
              } />
              <Route path="vendor/jobs/:id" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <RouteSuspense text="Loading job...">
                    <LazyJobDetails />
                  </RouteSuspense>
                </RoleGuard>
              } />
              <Route path="vendor/subcontracts/:id" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <SubcontractDetails />
                </RoleGuard>
              } />
              <Route path="vendor/plans/:planId" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <RouteSuspense text="Loading plan viewer...">
                    <LazyPlanViewer />
                  </RouteSuspense>
                </RoleGuard>
              } />
              <Route path="vendor/bills" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalBills />
                </RoleGuard>
              } />
              <Route path="vendor/bills/:id" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalInvoiceDetails />
                </RoleGuard>
              } />
              <Route path="vendor/rfps" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalRfps />
                </RoleGuard>
              } />
              <Route path="vendor/rfps/:id" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalRfps />
                </RoleGuard>
              } />
              <Route path="vendor/rfps/:id/sheets/:sheetId" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalRfps />
                </RoleGuard>
              } />
              <Route path="vendor/compliance" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalCompliance />
                </RoleGuard>
              } />
              <Route path="vendor/messages" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalMessages />
                </RoleGuard>
              } />
              <Route path="vendor/settings" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalSettings />
                </RoleGuard>
              } />
              <Route path="vendor/profile-settings" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <ProfileSettings />
                </RoleGuard>
              } />
              <Route path="vendor/legacy" element={
                <RoleGuard allowedRoles={['vendor', 'design_professional']}>
                  <VendorDashboard />
                </RoleGuard>
              } />
              <Route path="vendor/compliance-legacy" element={
                <RoleGuard allowedRoles={['vendor', 'design_professional']}>
                  <VendorDashboard />
                </RoleGuard>
              } />
              <Route path="design-professional/dashboard" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <DesignProfessionalDashboard />
                </RoleGuard>
              } />
              <Route path="design-professional/jobs" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <DesignProfessionalJobs />
                </RoleGuard>
              } />
              <Route path="design-professional/tasks" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <AllTasks />
                </RoleGuard>
              } />
              <Route path="design-professional/messages" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <AllMessages />
                </RoleGuard>
              } />
              <Route path="design-professional/team-chat" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <TeamChat />
                </RoleGuard>
              } />
              <Route path="design-professional/announcements" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <Announcements />
                </RoleGuard>
              } />
              <Route path="design-professional/jobs/:id" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <RouteSuspense text="Loading job...">
                    <LazyJobDetails />
                  </RouteSuspense>
                </RoleGuard>
              } />
              <Route path="design-professional/subcontracts/:id" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <SubcontractDetails />
                </RoleGuard>
              } />
              <Route path="design-professional/plans/:planId" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <RouteSuspense text="Loading plan viewer...">
                    <LazyPlanViewer />
                  </RouteSuspense>
                </RoleGuard>
              } />
              <Route path="design-professional/jobs/rfis" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <DesignProfessionalRFIs />
                </RoleGuard>
              } />
              <Route path="design-professional/jobs/submittals" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <DesignProfessionalSubmittals />
                </RoleGuard>
              } />
              <Route path="design-professional/permitting" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <DesignProfessionalPermitting />
                </RoleGuard>
              } />
              <Route path="design-professional/calendar" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <CalendarPage />
                </RoleGuard>
              } />
              <Route path="design-professional/settings/company" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <DesignProfessionalCompanySettings />
                </RoleGuard>
              } />
              <Route path="design-professional/profile-settings" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <ProfileSettings />
                </RoleGuard>
              } />
              <Route path="design-professional/settings/users" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <DesignProfessionalProjectAccess />
                </RoleGuard>
              } />
              <Route path="design-professional/subscription" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <CompanyOwnerOnlyRoute>
                    <SubscriptionPortal />
                  </CompanyOwnerOnlyRoute>
                </RoleGuard>
              } />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="upload" element={<UploadReceipts />} />
                <Route path="uncoded" element={<UncodedReceipts />} />
                <Route path="receipts" element={<CodedReceipts />} />
                <Route path="receipts/reports" element={
                  <MenuPermissionRoute menuKey="receipt-reports-view">
                    <ReceiptReports />
                  </MenuPermissionRoute>
                } />
              </Route>
              <Route path="construction/dashboard" element={
                <RouteSuspense text="Loading dashboard...">
                  <LazyConstructionDashboard />
                </RouteSuspense>
              } />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="construction/schedule" element={
                  <MenuPermissionRoute menuKey="jobs" redirectTo="/construction/dashboard">
                    <ConstructionSchedule />
                  </MenuPermissionRoute>
                } />
                <Route path="construction/reports" element={
                  <MenuPermissionRoute menuKey="construction-reports-view">
                    <RouteSuspense text="Loading report center...">
                      <LazyConstructionReports />
                    </RouteSuspense>
                  </MenuPermissionRoute>
                } />
                <Route path="construction/reports/cost-history" element={
                  <MenuPermissionRoute menuKey="construction-reports-cost-history-view" fallbackMenuKeys={["construction-reports-view"]}>
                    <ProjectCostTransactionHistory />
                  </MenuPermissionRoute>
                } />
                <Route path="construction/reports/committed-details" element={
                  <MenuPermissionRoute menuKey="construction-reports-subcontract-summary-view" fallbackMenuKeys={["construction-reports-view"]}>
                    <CommittedCostDetails />
                  </MenuPermissionRoute>
                } />
                <Route path="construction/reports/transactions" element={
                  <MenuPermissionRoute menuKey="construction-reports-transactions-view" fallbackMenuKeys={["construction-reports-view"]}>
                    <ProjectTransactionReport />
                  </MenuPermissionRoute>
                } />
                <Route path="construction/reports/subcontract-summary" element={
                  <MenuPermissionRoute menuKey="construction-reports-subcontract-summary-view" fallbackMenuKeys={["construction-reports-view"]}>
                    <SubcontractSummaryReport />
                  </MenuPermissionRoute>
                } />
                <Route path="construction/reports/subcontract-details" element={
                  <MenuPermissionRoute menuKey="construction-reports-subcontract-details-view" fallbackMenuKeys={["construction-reports-view"]}>
                    <SubcontractDetailsByVendor />
                  </MenuPermissionRoute>
                } />
                <Route path="construction/reports/budget-status" element={
                  <MenuPermissionRoute menuKey="construction-reports-budget-status-view" fallbackMenuKeys={["construction-reports-view"]}>
                    <ProjectCostBudgetStatus />
                  </MenuPermissionRoute>
                } />
                <Route path="construction/reports/ap-aging-by-job" element={
                  <MenuPermissionRoute menuKey="construction-reports-ap-aging-by-job-view" fallbackMenuKeys={["construction-reports-view"]}>
                    <RouteSuspense text="Loading AP aging report...">
                      <LazyAPAgingByJobReport />
                    </RouteSuspense>
                  </MenuPermissionRoute>
                } />
              </Route>
              <Route path="construction/rfps" element={
                <RouteSuspense text="Loading RFPs...">
                  <LazyRFPs />
                </RouteSuspense>
              } />
              <Route path="construction/submittals" element={<ConstructionSubmittals />} />
              <Route path="construction/rfps/add" element={<AddRFP />} />
              <Route path="construction/rfps/:id" element={
                <RouteSuspense text="Loading RFP...">
                  <LazyRFPDetails />
                </RouteSuspense>
              } />
              <Route path="construction/rfps/:id/edit" element={<AddRFP />} />
              <Route path="construction/rfps/:id/compare" element={<BidComparison />} />
              <Route path="construction/rfps/:rfpId/bids/add" element={<AddBid />} />
              <Route path="construction/bids/:id" element={
                <RouteSuspense text="Loading bid...">
                  <LazyBidDetails />
                </RouteSuspense>
              } />
              <Route path="construction/rfps/:rfpId/criteria/add" element={<AddScoringCriterion />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="reports/project-cost-transaction-history" element={<ProjectCostTransactionHistory />} />
              </Route>
              <Route path="jobs" element={
                <RouteSuspense text="Loading jobs...">
                  <LazyJobs />
                </RouteSuspense>
              } />
              <Route path="jobs/add" element={<AddJob />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="jobs/cost-codes" element={<CostCodes />} />
                <Route path="jobs/cost-management" element={<JobCostManagement />} />
                <Route path="jobs/cost-setup" element={<JobCostSetup />} />
                <Route path="jobs/reports" element={<JobReports />} />
              </Route>
              <Route path="jobs/:id" element={
                <RouteSuspense text="Loading job...">
                  <LazyJobDetails />
                </RouteSuspense>
              } />
              <Route path="jobs/:id/edit" element={<JobEdit />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="jobs/:id/cost-budget" element={<JobCostBudget />} />
                <Route path="jobs/:id/budget" element={<JobBudget />} />
              </Route>
              <Route path="plans/:planId" element={
                <RouteSuspense text="Loading plan viewer...">
                  <LazyPlanViewer />
                </RouteSuspense>
              } />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="delivery-tickets" element={<DeliveryTickets />} />
                <Route path="jobs/:jobId/delivery-tickets" element={<DeliveryTickets />} />
              </Route>
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="vendors" element={
                  <RouteSuspense text="Loading vendors...">
                    <LazyVendors />
                  </RouteSuspense>
                } />
                <Route path="vendors/add" element={<VendorEdit />} />
                <Route path="vendors/reports" element={<VendorReports />} />
                <Route path="vendors/:id" element={<VendorDetails />} />
                <Route path="vendors/:id/edit" element={<VendorEdit />} />
              </Route>
              <Route path="settings" element={<Navigate to="/settings/company?tab=overview" replace />} />
              <Route path="settings/company" element={
                <RouteSuspense text="Loading settings...">
                  <LazyCompanySettingsPage />
                </RouteSuspense>
              } />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/settings/company" />}>
                <Route path="settings/company/chart-of-accounts" element={<ChartOfAccounts />} />
                <Route path="settings/company/job-cost-setup" element={<JobCostSetupStandalone />} />
                <Route path="job-cost-setup" element={<JobCostSetupStandalone />} />
              </Route>
              <Route path="settings/company-management" element={<Navigate to="/settings/organization-management" replace />} />
              <Route path="settings/organization-management" element={
                <OrganizationOwnerRoute>
                  <CompanyManagement />
                </OrganizationOwnerRoute>
              } />
              <Route path="settings/notifications" element={<NotificationSettings />} />
              <Route path="settings/email-templates/:id/edit" element={<EmailTemplateEdit />} />
              <Route path="settings/email-templates/:id/preview" element={<EmailTemplatePreview />} />
              <Route path="settings/security" element={<SecuritySettings />} />
              <Route path="settings/help" element={<SettingsHelpDatabase />} />
              <Route path="settings/pm-lynk" element={
                <PMLynkFeatureRoute>
                  <PMLynkSettings />
                </PMLynkFeatureRoute>
              } />
              <Route path="theme-settings" element={<ThemeSettings />} />
              
              <Route path="profile-settings" element={<ProfileSettings />} />
              <Route path="settings/users" element={
                <RoleGuard allowedRoles={['admin', 'company_admin', 'controller', 'project_manager']}>
                  <RouteSuspense text="Loading users...">
                    <LazyUserSettings />
                  </RouteSuspense>
                </RoleGuard>
              } />
              <Route path="settings/users/:userId" element={
                <RoleGuard allowedRoles={['admin', 'company_admin', 'controller', 'project_manager']}>
                  <UserDetails />
                </RoleGuard>
              } />
              <Route path="settings/users/:userId/edit" element={
                <RoleGuard allowedRoles={['admin', 'company_admin', 'controller', 'project_manager']}>
                  <UserEdit />
                </RoleGuard>
              } />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="employees" element={<AllEmployees />} />
                <Route path="employees/add" element={<AddEmployee />} />
                <Route path="employees/payroll" element={<EmployeePayroll />} />
                <Route path="employees/performance" element={<EmployeePerformance />} />
                <Route path="employees/reports" element={
                  <MenuPermissionRoute menuKey="employees-reports-view">
                    <EmployeeReports />
                  </MenuPermissionRoute>
                } />
                <Route path="employees/reports/pin-list" element={
                  <MenuPermissionRoute menuKey="employees-reports-pin-list-view" fallbackMenuKeys={["employees-reports-view"]}>
                    <PinEmployeeListReport />
                  </MenuPermissionRoute>
                } />
                <Route path="employees/reports/qr-cards" element={
                  <MenuPermissionRoute menuKey="employees-reports-qr-cards-view" fallbackMenuKeys={["employees-reports-view"]}>
                    <EmployeeQRCardsReport />
                  </MenuPermissionRoute>
                } />
                <Route path="employees/reports/punch-clock-attempt-audit" element={
                  <MenuPermissionRoute menuKey="employees-reports-punch-clock-attempt-audit-view" fallbackMenuKeys={["employees-reports-view"]}>
                    <PunchClockAttemptAuditReport />
                  </MenuPermissionRoute>
                } />
                
                <Route path="manual-punch-out" element={<ManualPunchOut />} />
                <Route path="manual-time-entry" element={<ManualTimeEntry />} />
                <Route path="add-employee" element={<AddEmployee />} />
                <Route path="time-sheets" element={
                  <PunchClockFeatureRoute>
                    <TimeSheets />
                  </PunchClockFeatureRoute>
                } />
                <Route path="punch-clock/timesheets" element={
                  <PunchClockFeatureRoute>
                    <TimeSheets />
                  </PunchClockFeatureRoute>
                } />
                <Route path="punch-clock/dashboard" element={
                  <PunchClockFeatureRoute>
                    <MenuPermissionRoute menuKey="punch-clock-dashboard">
                      <PunchClockDashboard />
                    </MenuPermissionRoute>
                  </PunchClockFeatureRoute>
                } />
                <Route path="punch-clock/reports" element={
                  <PunchClockFeatureRoute>
                    <MenuPermissionRoute menuKey="timecard-reports-view">
                      <RouteSuspense text="Loading timecard reports...">
                        <LazyTimecardReports />
                      </RouteSuspense>
                    </MenuPermissionRoute>
                  </PunchClockFeatureRoute>
                } />
                <Route path="punch-clock/settings" element={
                  <PunchClockFeatureRoute>
                    <MenuPermissionRoute menuKey="punch-clock-settings">
                      <PunchClockSettings />
                    </MenuPermissionRoute>
                  </PunchClockFeatureRoute>
                } />
              </Route>
              <Route path="messages" element={<AllMessages />} />
              <Route path="team-chat" element={<TeamChat />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="messaging" element={<AllMessages />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="tasks" element={<AllTasks />} />
              <Route path="tasks/projects" element={<Navigate to="/tasks" replace />} />
              <Route path="tasks/deadlines" element={<Navigate to="/tasks" replace />} />
              <Route path="tasks/:id" element={<TaskDetails />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="bills" element={<Navigate to="/invoices" replace />} />
                <Route path="bills/add" element={<Navigate to="/invoices/add" replace />} />
                <Route path="bills/:id" element={
                  <MenuPermissionRoute menuKey="bills-view" fallbackMenuKeys={['bills']}>
                    <RouteSuspense text="Loading bill...">
                      <LazyBillDetails />
                    </RouteSuspense>
                  </MenuPermissionRoute>
                } />
                <Route path="bills/:id/edit" element={
                  <MenuPermissionRoute menuKey="bills-edit" fallbackMenuKeys={['bills-approve', 'bills']}>
                    <BillEdit />
                  </MenuPermissionRoute>
                } />
                <Route path="payables-dashboard" element={<PayablesDashboard />} />
                <Route path="payables/make-payment" element={<MakePayment />} />
                <Route path="payables/payment-reports" element={
                  <MenuPermissionRoute menuKey="payment-reports-view">
                    <PaymentReports />
                  </MenuPermissionRoute>
                } />
                <Route path="bills/payment-reports" element={
                  <MenuPermissionRoute menuKey="payment-reports-view">
                    <PaymentReports />
                  </MenuPermissionRoute>
                } />
                <Route path="bills/credit-card-transaction-report" element={
                  <RouteSuspense text="Loading credit card report...">
                    <LazyCreditCardTransactionReport />
                  </RouteSuspense>
                } />
                <Route path="payables/payment-history" element={<PaymentHistory />} />
                <Route path="payables/payments/:id" element={<PaymentDetails />} />
                <Route path="payables/payments/:id/edit" element={
                  <RoleGuard allowedRoles={['admin', 'controller']}>
                    <PaymentEdit />
                  </RoleGuard>
                } />
                <Route path="bills/payments" element={<PaymentHistory />} />
                <Route path="bills/payments/:id" element={<PaymentDetails />} />
                <Route path="bills/payments/:id/edit" element={
                  <RoleGuard allowedRoles={['admin', 'controller']}>
                    <PaymentEdit />
                  </RoleGuard>
                } />
                <Route path="bills/payment-reports" element={
                  <MenuPermissionRoute menuKey="payment-reports-view">
                    <PaymentReports />
                  </MenuPermissionRoute>
                } />
                <Route path="subcontracts" element={<Subcontracts />} />
                <Route path="subcontracts/add" element={<AddSubcontract />} />
                <Route path="subcontracts/:id" element={<SubcontractDetails />} />
                <Route path="subcontracts/:id/edit" element={<SubcontractEdit />} />
                <Route path="subcontracts/add-change-order" element={<AddChangeOrder />} />
                <Route path="purchase-orders" element={<PurchaseOrders />} />
                <Route path="purchase-orders/add" element={<AddPurchaseOrder />} />
                {/* Legacy routes for backwards compatibility */}
                <Route path="invoices" element={
                  <RouteSuspense text="Loading bills...">
                    <LazyBills />
                  </RouteSuspense>
                } />
                <Route path="invoices/add" element={<AddBill />} />
                <Route path="invoices/:id" element={
                  <MenuPermissionRoute menuKey="bills-view" fallbackMenuKeys={['bills']}>
                    <RouteSuspense text="Loading bill...">
                      <LazyBillDetails />
                    </RouteSuspense>
                  </MenuPermissionRoute>
                } />
                <Route path="invoices/:id/edit" element={
                  <MenuPermissionRoute menuKey="bills-edit" fallbackMenuKeys={['bills-approve', 'bills']}>
                    <BillEdit />
                  </MenuPermissionRoute>
                } />
                <Route path="invoices/payments" element={<PaymentHistory />} />
                <Route path="invoices/payment-reports" element={
                  <MenuPermissionRoute menuKey="payment-reports-view">
                    <PaymentReports />
                  </MenuPermissionRoute>
                } />
              </Route>
              <Route path="company-files" element={
                <RouteSuspense text="Loading files...">
                  <LazyCompanyFiles />
                </RouteSuspense>
              } />
              <Route path="company-files/jobs" element={
                <RouteSuspense text="Loading files...">
                  <LazyCompanyFiles />
                </RouteSuspense>
              } />
              <Route path="company-files/dropbox" element={
                <RouteSuspense text="Loading files...">
                  <LazyCompanyFiles />
                </RouteSuspense>
              } />
              <Route path="design-professional/company-files" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <RouteSuspense text="Loading files...">
                    <LazyCompanyFiles />
                  </RouteSuspense>
                </RoleGuard>
              } />
              <Route path="design-professional/company-files/jobs" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <RouteSuspense text="Loading files...">
                    <LazyCompanyFiles />
                  </RouteSuspense>
                </RoleGuard>
              } />
              <Route path="design-professional/company-files/dropbox" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <RouteSuspense text="Loading files...">
                    <LazyCompanyFiles />
                  </RouteSuspense>
                </RoleGuard>
              } />
              <Route path="company-files/contracts" element={<CompanyContracts />} />
              <Route path="company-files/permits" element={<CompanyPermits />} />
              <Route path="company-files/insurance" element={<CompanyInsurance />} />
              <Route path="company-files/vault" element={<CompanyVault />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="banking/accounts" element={<BankAccounts />} />
                <Route path="banking/accounts/:id" element={<BankAccountDetails />} />
                <Route path="banking/accounts/add" element={<AddBankAccount />} />
                <Route path="banking/reconciliation/:id" element={<ReconciliationReport />} />
                <Route path="banking/chart-of-accounts" element={<BankingChartOfAccounts />} />
                <Route path="payables/credit-cards" element={<CreditCards />} />
                <Route path="payables/credit-cards/add" element={<AddCreditCard />} />
                <Route path="payables/credit-cards/:id" element={<CreditCardDetails />} />
                <Route path="payables/credit-cards/:id/edit" element={<CreditCardEdit />} />
                <Route path="payables/credit-cards/:id/transactions" element={<CreditCardTransactions />} />
                <Route path="payables/credit-cards/:id/make-payment" element={<CreditCardMakePayment />} />
                <Route path="banking/reports" element={
                  <MenuPermissionRoute menuKey="banking-reports-view">
                    <RouteSuspense text="Loading banking reports...">
                      <LazyBankingReports />
                    </RouteSuspense>
                  </MenuPermissionRoute>
                } />
                <Route path="banking/balance-sheet" element={
                  <MenuPermissionRoute menuKey="banking-reports-balance-sheet-view" fallbackMenuKeys={["banking-reports-view"]}>
                    <BalanceSheet />
                  </MenuPermissionRoute>
                } />
                <Route path="banking/general-ledger" element={
                  <MenuPermissionRoute menuKey="banking-reports-general-ledger-view" fallbackMenuKeys={["banking-reports-view"]}>
                    <GeneralLedger />
                  </MenuPermissionRoute>
                } />
                <Route path="banking/journal-entries" element={<JournalEntries />} />
                <Route path="banking/journal-entries/new" element={<NewJournalEntry />} />
                <Route path="banking/journal-entries/:id" element={<JournalEntryDetails />} />
                <Route path="banking/journal-entries/:id/edit" element={<JournalEntryEdit />} />
                <Route path="banking/deposits" element={<Deposits />} />
                <Route path="banking/print-checks" element={<PrintChecks />} />
                <Route path="banking/make-payment" element={<MakePayment />} />
                <Route path="banking/reconcile" element={<Reconcile />} />
              </Route>
              
              {/* Receivables Routes */}
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="receivables" element={<ReceivablesDashboard />} />
                <Route path="receivables/dashboard" element={<ReceivablesDashboard />} />
                <Route path="receivables/customers" element={<Customers />} />
                <Route path="receivables/customers/:id" element={<CustomerDetails />} />
                <Route path="receivables/customers/:id/edit" element={<CustomerEdit />} />
                <Route path="receivables/customers/add" element={<CustomerEdit />} />
                <Route path="receivables/invoices" element={<ARInvoices />} />
                <Route path="receivables/invoices/add" element={<AddARInvoice />} />
                <Route path="receivables/invoices/:id" element={<ARInvoiceDetails />} />
                <Route path="receivables/invoices/:id/edit" element={<AddARInvoice />} />
                <Route path="receivables/payments" element={<ARPayments />} />
                <Route path="receivables/reports" element={
                  <MenuPermissionRoute menuKey="receivables-reports-view">
                    <RouteSuspense text="Loading receivables reports...">
                      <LazyReceivablesReports />
                    </RouteSuspense>
                  </MenuPermissionRoute>
                } />
              </Route>
              <Route path="subscription" element={<SubscriptionPortal />} />
            </Route>
            <Route path="/workspace/select" element={
              <ProtectedRoute>
                <AccessControl>
                  <VendorPortalChooser />
                </AccessControl>
              </ProtectedRoute>
            } />
              <Route path="*" element={<NotFound />} />
            </Routes>
  );
}

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TenantProvider>
        <CompanyProvider>
          <SettingsProvider>
            <ReceiptProvider>
              {children}
            </ReceiptProvider>
          </SettingsProvider>
        </CompanyProvider>
      </TenantProvider>
    </AuthProvider>
  );
}

function AppRoutes() {
  const location = useLocation();
  const [showMobileWarning, setShowMobileWarning] = React.useState(false);
  const [hasDismissedMobileWarning, setHasDismissedMobileWarning] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("builderlynk_mobile_web_warning_dismissed") === "1";
  });
  
  const handleContinueOnWeb = React.useCallback(() => {
    setShowMobileWarning(false);
    setHasDismissedMobileWarning(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("builderlynk_mobile_web_warning_dismissed", "1");
    }
  }, []);

  // Landing/auth pages are public and should never show the mobile warning modal.
  const publicExactPaths = [
    '/',
    '/contact',
    '/demo',
    '/auth',
    '/privacy',
    '/employee-dashboard',
    '/punch-clock-lynk',
    '/pm-lynk',
    '/design-pro-lynk',
    '/visitor-lynk',
    '/visitor-lynk/start',
    '/vendor-register',
    '/vendor-signup',
    '/vendor-login',
    '/design-professional-signup',
  ];
  const isPublicRoute = publicExactPaths.includes(location.pathname)
    || location.pathname.startsWith('/vendor-signup')
    || location.pathname.startsWith('/vendor-register')
    || location.pathname.startsWith('/vendor-login')
    || location.pathname.startsWith('/design-professional-signup')
    || location.pathname.startsWith('/visitor/')
    || location.pathname.includes('/visitor-logs')
    || /^\/jobs\/[^/]+\/visitor-logs\/?$/.test(location.pathname)
    || /^\/visitor\/checkout\/[^/]+$/.test(location.pathname);

  const dashboardRoutes = new Set([
    '/dashboard',
    '/construction/dashboard',
    '/vendor/dashboard',
    '/design-professional/dashboard',
    '/punch-clock/dashboard',
    '/payables-dashboard',
    '/receivables/dashboard',
  ]);
  const isDashboardRoute = dashboardRoutes.has(location.pathname);

  React.useEffect(() => {
    if (isPublicRoute || !isDashboardRoute || hasDismissedMobileWarning) {
      setShowMobileWarning(false);
      return;
    }

    const evaluate = () => {
      const isPhoneWidth = window.matchMedia("(max-width: 820px)").matches;
      const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isMobileUA = /iphone|android.+mobile|ipod|windows phone|blackberry/i.test(
        navigator.userAgent.toLowerCase()
      );
      const shouldWarn = isPhoneWidth && (hasTouch || isMobileUA);
      setShowMobileWarning(shouldWarn);
    };

    evaluate();
    window.addEventListener("resize", evaluate);
    return () => window.removeEventListener("resize", evaluate);
  }, [isPublicRoute, isDashboardRoute, hasDismissedMobileWarning]);
  
  return (
    <AppProviders>
      {isPublicRoute ? (
        <PublicRoutes />
      ) : (
        <>
          <Dialog open={showMobileWarning} onOpenChange={setShowMobileWarning}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Using BuilderLynk on a Phone</DialogTitle>
                <DialogDescription>
                  This web app is optimized for desktop. For the best phone experience and faster job management, use PM Lynk on iOS or Android.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={handleContinueOnWeb}>
                  Continue on Web
                </Button>
                <Button onClick={() => (window.location.href = "/pm-lynk")}>
                  Go to PM Lynk
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AuthenticatedRoutes />
        </>
      )}
    </AppProviders>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <TooltipProvider>
            <Toaster />
            <AppRoutes />
          </TooltipProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
