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
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import DemoRequest from "@/pages/DemoRequest";
import TaskDetails from "@/pages/TaskDetails";

import Dashboard from "./pages/Dashboard";
import UploadReceipts from "./pages/UploadReceipts";
import UncodedReceipts from "./pages/UncodedReceipts";
import Jobs from "./pages/Jobs";
import JobDetails from "./pages/JobDetails";
import JobEdit from "./pages/JobEdit";
import JobBudget from "./pages/JobBudget";
import DeliveryTickets from "./pages/DeliveryTickets";
import Vendors from "./pages/Vendors";
import VendorDetails from "./pages/VendorDetails";
import VendorEdit from "./pages/VendorEdit";
import VendorReports from "./pages/VendorReports";
import UserEdit from "./pages/UserEdit";
import UserDetails from "./pages/UserDetails";
import AppSettings from "./pages/AppSettings";
import UserSettings from "./pages/UserSettings";
import Bills from "./pages/Bills";
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
import TimecardReports from "./pages/TimecardReports";
import PunchClockSettings from "./pages/PunchClockSettings";
import AllMessages from "./pages/AllMessages";
import PlanViewer from "./pages/PlanViewer";
import TeamChat from "./pages/TeamChat";
import Announcements from "./pages/Announcements";
import AllTasks from "./pages/AllTasks";
import CalendarPage from "./pages/CalendarPage";
import BillDetails from "./pages/BillDetails";
import BillEdit from "./pages/BillEdit";
import PaymentHistory from "./pages/PaymentHistory";
import PaymentDetails from "./pages/PaymentDetails";
import PaymentEdit from "./pages/PaymentEdit";
import PaymentReports from "./pages/PaymentReports";
import CreditCardTransactionReport from "./pages/CreditCardTransactionReport";
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
import CompanyFiles from "./pages/CompanyFiles";
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
import BankingReports from "./pages/BankingReports";
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
import ConstructionReports from "./pages/ConstructionReports";
import RFPs from "./pages/RFPs";
import AddRFP from "./pages/AddRFP";
import RFPDetails from "./pages/RFPDetails";
import BidComparison from "./pages/BidComparison";
import AddBid from "./pages/AddBid";
import BidDetails from "./pages/BidDetails";
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
import ReceivablesReports from "./pages/ReceivablesReports";
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
import VendorPortalCompliance from "./pages/VendorPortalCompliance";
import VendorPortalSettings from "./pages/VendorPortalSettings";
import DesignProfessionalDashboard from "./pages/DesignProfessionalDashboard";
import DesignProfessionalJobs from "./pages/DesignProfessionalJobs";
import DesignProfessionalCompanySettings from "./pages/DesignProfessionalCompanySettings";
import DesignProfessionalRFIs from "./pages/DesignProfessionalRFIs";
import DesignProfessionalSubmittals from "./pages/DesignProfessionalSubmittals";
import DesignProfessionalPermitting from "./pages/DesignProfessionalPermitting";
import VendorRegister from "./pages/VendorRegister";
import VendorSignup from "./pages/VendorSignup";
import DesignProfessionalSignup from "./pages/DesignProfessionalSignup";
import SubscriptionPortal from "./pages/SubscriptionPortal";
import { useCompanyFeatureAccess } from "@/hooks/useCompanyFeatureAccess";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

// Protected Route Component that must be inside AuthProvider
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <PremiumLoadingScreen />;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function DashboardEntryRoute() {
  const { profile } = useAuth();
  const role = String(profile?.role || '').toLowerCase();

  if (role === 'design_professional') {
    return <Navigate to="/design-professional/dashboard" replace />;
  }
  if (role === 'vendor') {
    return <Navigate to="/vendor/dashboard" replace />;
  }

  return <Dashboard />;
}

function OrganizationOwnerRoute({ children }: { children: React.ReactNode }) {
  const { tenantMember, isSuperAdmin, loading } = useTenant();
  const { hasFeature, loading: featureLoading } = useCompanyFeatureAccess(['organization_management']);

  if (loading || featureLoading) {
    return <PremiumLoadingScreen />;
  }

  if (!isSuperAdmin && tenantMember?.role !== 'owner') {
    return <Navigate to="/settings/company" replace />;
  }

  if (!hasFeature('organization_management')) {
    return <Navigate to="/settings/company" replace />;
  }

  return <>{children}</>;
}

function CompanyOwnerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { tenantMember, isSuperAdmin, loading } = useTenant();

  if (loading) {
    return <PremiumLoadingScreen />;
  }

  if (!isSuperAdmin && tenantMember?.role !== 'owner') {
    return <Navigate to="/design-professional/settings/company" replace />;
  }

  return <>{children}</>;
}

function PunchClockFeatureRoute({ children }: { children: React.ReactNode }) {
  const { hasFeature, loading } = useCompanyFeatureAccess(['punch_clock_app']);

  if (loading) {
    return <PremiumLoadingScreen />;
  }

  if (!hasFeature('punch_clock_app')) {
    return <Navigate to="/settings/company" replace />;
  }

  return <>{children}</>;
}

function PMLynkFeatureRoute({ children }: { children: React.ReactNode }) {
  const { hasFeature, loading } = useCompanyFeatureAccess(['pm_lynk']);

  if (loading) {
    return <PremiumLoadingScreen />;
  }

  if (!hasFeature('pm_lynk')) {
    return <Navigate to="/settings/company" replace />;
  }

  return <>{children}</>;
}

function MenuPermissionRoute({
  menuKey,
  children,
  redirectTo = '/',
}: {
  menuKey: string;
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const { hasAccess, loading } = useMenuPermissions();

  if (loading) {
    return <PremiumLoadingScreen />;
  }

  if (!hasAccess(menuKey)) {
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
    return <PremiumLoadingScreen />;
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
    <AuthProvider>
      <TenantProvider>
        <CompanyProvider>
          <SettingsProvider>
            <ReceiptProvider>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/punch-clock-lynk" element={<PunchClockLynkLanding />} />
                <Route path="/pm-lynk" element={<PMLynkLanding />} />
                <Route path="/design-pro-lynk" element={<DesignProLynkLanding />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/demo" element={<DemoRequest />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
                <Route path="/visitor/:qrCode" element={<VisitorLogin />} />
                <Route path="/visitor/checkout/:token" element={<VisitorCheckout />} />
                <Route path="/vendor-register" element={<VendorRegister />} />
                <Route path="/vendor-signup" element={<VendorSignup />} />
                <Route path="/design-professional-signup" element={<DesignProfessionalSignup />} />
                <Route path="/jobs/:id/visitor-logs/*" element={<JobVisitorLogs />} />
              </Routes>
            </ReceiptProvider>
          </SettingsProvider>
        </CompanyProvider>
      </TenantProvider>
    </AuthProvider>
  );
}

function AuthenticatedRoutes() {
  return (
    <AuthProvider>
      <TenantProvider>
        <CompanyProvider>
          <SettingsProvider>
            <ReceiptProvider>
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
                  <JobDetails />
                </RoleGuard>
              } />
              <Route path="vendor/bills" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalBills />
                </RoleGuard>
              } />
              <Route path="vendor/compliance" element={
                <RoleGuard allowedRoles={['vendor']}>
                  <VendorPortalCompliance />
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
              <Route path="design-professional/jobs/:id" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <JobDetails />
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
                  <UserSettings />
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
                <Route path="receipts/reports" element={<ReceiptReports />} />
              </Route>
              <Route path="construction/dashboard" element={<ConstructionDashboard />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="construction/reports" element={<ConstructionReports />} />
                <Route path="construction/reports/cost-history" element={<ProjectCostTransactionHistory />} />
                <Route path="construction/reports/committed-details" element={<CommittedCostDetails />} />
                <Route path="construction/reports/transactions" element={<ProjectTransactionReport />} />
                <Route path="construction/reports/subcontract-summary" element={<SubcontractSummaryReport />} />
                <Route path="construction/reports/subcontract-details" element={<SubcontractDetailsByVendor />} />
                <Route path="construction/reports/budget-status" element={<ProjectCostBudgetStatus />} />
              </Route>
              <Route path="construction/rfps" element={<RFPs />} />
              <Route path="construction/submittals" element={<ConstructionSubmittals />} />
              <Route path="construction/rfps/add" element={<AddRFP />} />
              <Route path="construction/rfps/:id" element={<RFPDetails />} />
              <Route path="construction/rfps/:id/edit" element={<AddRFP />} />
              <Route path="construction/rfps/:id/compare" element={<BidComparison />} />
              <Route path="construction/rfps/:rfpId/bids/add" element={<AddBid />} />
              <Route path="construction/bids/:id" element={<BidDetails />} />
              <Route path="construction/rfps/:rfpId/criteria/add" element={<AddScoringCriterion />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="reports/project-cost-transaction-history" element={<ProjectCostTransactionHistory />} />
              </Route>
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/add" element={<AddJob />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="jobs/cost-codes" element={<CostCodes />} />
                <Route path="jobs/cost-management" element={<JobCostManagement />} />
                <Route path="jobs/cost-setup" element={<JobCostSetup />} />
                <Route path="jobs/reports" element={<JobReports />} />
              </Route>
              <Route path="jobs/:id" element={<JobDetails />} />
              <Route path="jobs/:id/edit" element={<JobEdit />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="jobs/:id/cost-budget" element={<JobCostBudget />} />
                <Route path="jobs/:id/budget" element={<JobBudget />} />
              </Route>
              <Route path="plans/:planId" element={<PlanViewer />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="delivery-tickets" element={<DeliveryTickets />} />
                <Route path="jobs/:jobId/delivery-tickets" element={<DeliveryTickets />} />
              </Route>
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="vendors" element={<Vendors />} />
                <Route path="vendors/add" element={<VendorEdit />} />
                <Route path="vendors/reports" element={<VendorReports />} />
                <Route path="vendors/:id" element={<VendorDetails />} />
                <Route path="vendors/:id/edit" element={<VendorEdit />} />
              </Route>
              <Route path="settings" element={<Navigate to="/settings/company?tab=overview" replace />} />
              <Route path="settings/company" element={<CompanySettingsPage />} />
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
              <Route path="settings/users" element={<UserSettings />} />
              <Route path="settings/users/:userId" element={<UserDetails />} />
              <Route path="settings/users/:userId/edit" element={<UserEdit />} />
              <Route element={<CompanyTypeRoute allowedTypes={['construction']} redirectTo="/construction/dashboard" />}>
                <Route path="employees" element={<AllEmployees />} />
                <Route path="employees/add" element={<AddEmployee />} />
                <Route path="employees/payroll" element={<EmployeePayroll />} />
                <Route path="employees/performance" element={<EmployeePerformance />} />
                <Route path="employees/reports" element={<EmployeeReports />} />
                <Route path="employees/reports/pin-list" element={<PinEmployeeListReport />} />
                <Route path="employees/reports/qr-cards" element={<EmployeeQRCardsReport />} />
                <Route path="employees/reports/punch-clock-attempt-audit" element={<PunchClockAttemptAuditReport />} />
                
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
                    <MenuPermissionRoute menuKey="timecard-reports">
                      <TimecardReports />
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
                  <RoleGuard allowedRoles={['admin', 'controller', 'project_manager', 'manager']}>
                    <BillDetails />
                  </RoleGuard>
                } />
                <Route path="bills/:id/edit" element={
                  <RoleGuard allowedRoles={['admin', 'controller', 'project_manager', 'manager']}>
                    <BillEdit />
                  </RoleGuard>
                } />
                <Route path="payables-dashboard" element={<PayablesDashboard />} />
                <Route path="payables/make-payment" element={<MakePayment />} />
                <Route path="payables/payment-reports" element={<PaymentReports />} />
                <Route path="bills/payment-reports" element={<PaymentReports />} />
                <Route path="bills/credit-card-transaction-report" element={<CreditCardTransactionReport />} />
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
                <Route path="bills/payment-reports" element={<PaymentReports />} />
                <Route path="subcontracts" element={<Subcontracts />} />
                <Route path="subcontracts/add" element={<AddSubcontract />} />
                <Route path="subcontracts/:id" element={<SubcontractDetails />} />
                <Route path="subcontracts/:id/edit" element={<SubcontractEdit />} />
                <Route path="subcontracts/add-change-order" element={<AddChangeOrder />} />
                <Route path="purchase-orders" element={<PurchaseOrders />} />
                <Route path="purchase-orders/add" element={<AddPurchaseOrder />} />
                {/* Legacy routes for backwards compatibility */}
                <Route path="invoices" element={<Bills />} />
                <Route path="invoices/add" element={<AddBill />} />
                <Route path="invoices/:id" element={
                  <RoleGuard allowedRoles={['admin', 'controller', 'project_manager', 'manager']}>
                    <BillDetails />
                  </RoleGuard>
                } />
                <Route path="invoices/:id/edit" element={
                  <RoleGuard allowedRoles={['admin', 'controller', 'project_manager', 'manager']}>
                    <BillEdit />
                  </RoleGuard>
                } />
                <Route path="invoices/payments" element={<PaymentHistory />} />
                <Route path="invoices/payment-reports" element={<PaymentReports />} />
              </Route>
              <Route path="company-files" element={<CompanyFiles />} />
              <Route path="company-files/jobs" element={<CompanyFiles />} />
              <Route path="company-files/dropbox" element={<CompanyFiles />} />
              <Route path="design-professional/company-files" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <CompanyFiles />
                </RoleGuard>
              } />
              <Route path="design-professional/company-files/jobs" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <CompanyFiles />
                </RoleGuard>
              } />
              <Route path="design-professional/company-files/dropbox" element={
                <RoleGuard allowedRoles={['design_professional']}>
                  <CompanyFiles />
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
                <Route path="banking/reports" element={<BankingReports />} />
                <Route path="banking/balance-sheet" element={<BalanceSheet />} />
                <Route path="banking/general-ledger" element={<GeneralLedger />} />
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
                <Route path="receivables/reports" element={<ReceivablesReports />} />
              </Route>
              <Route path="subscription" element={<SubscriptionPortal />} />
            </Route>
            <Route path="*" element={<NotFound />} />
            </Routes>
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
    '/auth',
    '/privacy',
    '/employee-dashboard',
    '/punch-clock-lynk',
    '/pm-lynk',
    '/design-pro-lynk',
    '/vendor-register',
    '/vendor-signup',
    '/design-professional-signup',
  ];
  const isPublicRoute = publicExactPaths.includes(location.pathname)
    || location.pathname.startsWith('/vendor-signup')
    || location.pathname.startsWith('/vendor-register')
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
  
  if (isPublicRoute) {
    return <PublicRoutes />;
  }
  
  return (
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
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
