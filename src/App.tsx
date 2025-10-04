import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ReceiptProvider } from "@/contexts/ReceiptContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PunchClockAuthProvider } from "@/contexts/PunchClockAuthContext";
import { AccessControl } from "@/components/AccessControl";
import { RoleGuard } from "@/components/RoleGuard";
import Layout from "@/components/AppLayout";
import CompanyRequest from "@/pages/CompanyRequest";
import ProfileCompletion from "@/pages/ProfileCompletion";

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

import TimeSheets from "./pages/TimeSheets";
import TimecardReports from "./pages/TimecardReports";
import PunchClockSettings from "./pages/PunchClockSettings";
import AllMessages from "./pages/AllMessages";
import TeamChat from "./pages/TeamChat";
import Announcements from "./pages/Announcements";
import AllTasks from "./pages/AllTasks";
import ProjectTasks from "./pages/ProjectTasks";
import TaskDeadlines from "./pages/TaskDeadlines";
import BillDetails from "./pages/BillDetails";
import BillEdit from "./pages/BillEdit";
import PaymentHistory from "./pages/PaymentHistory";
import PaymentReports from "./pages/PaymentReports";
import AddBill from "./pages/AddBill";
import AddJob from "./pages/AddJob";
import BankingChartOfAccounts from "./pages/BankingChartOfAccounts";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import CostCodes from "./pages/CostCodes";
import JobCostManagement from "./pages/JobCostManagement";
import JobCostSetup from "./pages/JobCostSetup";
import JobCostSetupStandalone from "./pages/JobCostSetupStandalone";
import JobCostBudget from "./pages/JobCostBudget";
import ThemeSettings from "./pages/ThemeSettings";
import CompanySettingsPage from "./pages/CompanySettingsPage";
import SecuritySettings from "./pages/SecuritySettings";
import ProfileSettings from "./pages/ProfileSettings";
import CodedReceipts from "./pages/CodedReceipts";
import NotificationSettings from "./pages/NotificationSettings";
import EmailTemplateEdit from "./pages/EmailTemplateEdit";
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
import BankingReports from "./pages/BankingReports";
import JournalEntries from "./pages/JournalEntries";
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

import ManualPunchOut from "./pages/ManualPunchOut";
import ManualTimeEntry from "./pages/ManualTimeEntry";
import PunchClockApp from "./pages/PunchClockApp";
import PunchClockLogin from "./pages/PunchClockLogin";
import PinEmployeeEdit from "./pages/PinEmployeeEdit";
import PMobileApp from "./pages/PMobileApp";
import PMobileLogin from "./pages/PMobileLogin";
import MobileMessages from "./pages/MobileMessages";
import VisitorLogin from "./pages/VisitorLogin";
import VisitorCheckout from "./pages/VisitorCheckout";
import JobVisitorLogs from "./pages/JobVisitorLogs";
import EmployeeDashboard from "./pages/EmployeeDashboard";

const queryClient = new QueryClient();

// Protected Route Component that must be inside AuthProvider
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function PublicRoutes() {
  return (
    <AuthProvider>
      <PunchClockAuthProvider>
        <CompanyProvider>
          <ReceiptProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/punch-clock-login" element={<PunchClockLogin />} />
              <Route path="/punch-clock" element={<PunchClockLogin />} />
              <Route path="/punch-clock-app" element={<PunchClockApp />} />
              <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
              <Route path="/pm-mobile-login" element={<PMobileLogin />} />
              <Route path="/pm-mobile-app" element={<PMobileApp />} />
              <Route path="/visitor/:qrCode" element={<VisitorLogin />} />
              <Route path="/visitor/checkout/:token" element={<VisitorCheckout />} />
              <Route path="/jobs/:id/visitor-logs/*" element={<JobVisitorLogs />} />
            </Routes>
          </ReceiptProvider>
        </CompanyProvider>
      </PunchClockAuthProvider>
    </AuthProvider>
  );
}

function AuthenticatedRoutes() {
  return (
    <AuthProvider>
      <PunchClockAuthProvider>
        <CompanyProvider>
          <SettingsProvider>
            <ReceiptProvider>
              <Routes>
              <Route path="/profile-completion" element={
                <ProtectedRoute>
                  <ProfileCompletion />
                </ProtectedRoute>
              } />
              <Route path="/company-request" element={
                <ProtectedRoute>
                  <AccessControl>
                    <CompanyRequest />
                  </AccessControl>
                </ProtectedRoute>
              } />
              <Route path="/" element={
                <ProtectedRoute>
                  <AccessControl>
                    <RoleGuard>
                      <Layout />
                    </RoleGuard>
                  </AccessControl>
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="dashboard" element={<Navigate to="/" replace />} />
                <Route path="upload" element={<UploadReceipts />} />
                <Route path="uncoded" element={<UncodedReceipts />} />
                <Route path="receipts" element={<CodedReceipts />} />
                <Route path="receipts/reports" element={<ReceiptReports />} />
                <Route path="construction/dashboard" element={<ConstructionDashboard />} />
                <Route path="construction/reports" element={<ConstructionReports />} />
                <Route path="jobs" element={<Jobs />} />
                <Route path="jobs/add" element={<AddJob />} />
                <Route path="jobs/cost-codes" element={<CostCodes />} />
                <Route path="jobs/cost-management" element={<JobCostManagement />} />
                <Route path="jobs/cost-setup" element={<JobCostSetup />} />
                <Route path="jobs/reports" element={<JobReports />} />
                <Route path="jobs/:id" element={<JobDetails />} />
                <Route path="jobs/:id/edit" element={<JobEdit />} />
                <Route path="jobs/:id/cost-budget" element={<JobCostBudget />} />
                <Route path="jobs/:id/budget" element={<JobBudget />} />
                <Route path="delivery-tickets" element={<DeliveryTickets />} />
                <Route path="jobs/:jobId/delivery-tickets" element={<DeliveryTickets />} />
                <Route path="vendors" element={<Vendors />} />
                <Route path="vendors/add" element={<VendorEdit />} />
                <Route path="vendors/reports" element={<VendorReports />} />
                <Route path="vendors/:id" element={<VendorDetails />} />
                <Route path="vendors/:id/edit" element={<VendorEdit />} />
                <Route path="settings" element={<AppSettings />} />
                <Route path="settings/theme" element={<ThemeSettings />} />
                <Route path="settings/company" element={<CompanySettingsPage />} />
                <Route path="settings/company/chart-of-accounts" element={<ChartOfAccounts />} />
                <Route path="settings/company/job-cost-setup" element={<JobCostSetupStandalone />} />
                <Route path="job-cost-setup" element={<JobCostSetupStandalone />} />
                <Route path="settings/company-management" element={<CompanyManagement />} />
                <Route path="settings/notifications" element={<NotificationSettings />} />
                <Route path="settings/email-templates/:id/edit" element={<EmailTemplateEdit />} />
                <Route path="settings/security" element={<SecuritySettings />} />
                
                <Route path="profile-settings" element={<ProfileSettings />} />
                <Route path="settings/users" element={<UserSettings />} />
                <Route path="settings/users/:userId" element={<UserDetails />} />
                <Route path="settings/users/:userId/edit" element={<UserEdit />} />
                <Route path="employees" element={<AllEmployees />} />
                <Route path="employees/add" element={<AddEmployee />} />
                <Route path="employees/payroll" element={<EmployeePayroll />} />
                <Route path="employees/performance" element={<EmployeePerformance />} />
                <Route path="pin-employees/:employeeId/edit" element={<PinEmployeeEdit />} />
                <Route path="manual-punch-out" element={<ManualPunchOut />} />
                <Route path="manual-time-entry" element={<ManualTimeEntry />} />
                <Route path="add-employee" element={<AddEmployee />} />
                <Route path="time-tracking" element={<PunchClockApp />} />
                <Route path="punch-clock" element={<PunchClockApp />} />
                <Route path="time-sheets" element={<TimeSheets />} />
                <Route path="punch-clock/timesheets" element={<TimeSheets />} />
                <Route path="punch-clock/dashboard" element={
                  <RoleGuard allowedRoles={['admin', 'controller', 'project_manager', 'manager']}>
                    <PunchClockDashboard />
                  </RoleGuard>
                } />
                <Route path="punch-clock/reports" element={
                  <RoleGuard allowedRoles={['admin', 'controller', 'project_manager', 'manager']}>
                    <TimecardReports />
                  </RoleGuard>
                } />
                <Route path="punch-clock/settings" element={
                  <RoleGuard allowedRoles={['admin', 'controller', 'project_manager', 'manager']}>
                    <PunchClockSettings />
                  </RoleGuard>
                } />
                <Route path="messages" element={<AllMessages />} />
                <Route path="team-chat" element={<TeamChat />} />
                <Route path="announcements" element={<Announcements />} />
                <Route path="messaging" element={<AllMessages />} />
                <Route path="tasks" element={<AllTasks />} />
                <Route path="tasks/projects" element={<ProjectTasks />} />
                <Route path="tasks/deadlines" element={<TaskDeadlines />} />
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
                <Route path="payables/payment-history" element={<PaymentHistory />} />
                <Route path="bills/payments" element={<PaymentHistory />} />
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
                <Route path="invoices/payments" element={<PaymentHistory />} />
                <Route path="invoices/payment-reports" element={<PaymentReports />} />
                <Route path="company-files" element={<CompanyFiles />} />
                <Route path="company-files/contracts" element={<CompanyContracts />} />
                <Route path="company-files/permits" element={<CompanyPermits />} />
                <Route path="company-files/insurance" element={<CompanyInsurance />} />
                <Route path="company-files/vault" element={<CompanyVault />} />
                <Route path="banking/accounts" element={<BankAccounts />} />
                <Route path="banking/accounts/:id" element={<BankAccountDetails />} />
                <Route path="banking/accounts/add" element={<AddBankAccount />} />
                <Route path="banking/credit-cards" element={<CreditCards />} />
                <Route path="banking/credit-cards/add" element={<AddCreditCard />} />
                <Route path="banking/chart-of-accounts" element={<BankingChartOfAccounts />} />
                <Route path="banking/reports" element={<BankingReports />} />
                <Route path="banking/journal-entries" element={<JournalEntries />} />
                <Route path="banking/journal-entries/new" element={<NewJournalEntry />} />
                <Route path="banking/deposits" element={<Deposits />} />
                <Route path="banking/print-checks" element={<PrintChecks />} />
                <Route path="banking/make-payment" element={<MakePayment />} />
                <Route path="banking/reconcile" element={<Reconcile />} />
              </Route>
              <Route path="/pm-mobile" element={<Navigate to="/pm-mobile-app" replace />} />
              <Route path="/pm-mobile-app" element={<Navigate to="/pm-mobile-login" replace />} />
              <Route path="/mobile-messages" element={
                <ProtectedRoute>
                  <MobileMessages />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
              </Routes>
            </ReceiptProvider>
          </SettingsProvider>
        </CompanyProvider>
      </PunchClockAuthProvider>
    </AuthProvider>
  );
}

function AppRoutes() {
  const location = useLocation();
  
  const publicExactPaths = ['/auth', '/punch-clock-login', '/punch-clock-app', '/employee-dashboard', '/punch-clock', '/pm-mobile-login', '/pm-mobile-app'];
  const isPublicRoute = publicExactPaths.includes(location.pathname)
    || location.pathname.startsWith('/visitor/')
    || location.pathname.includes('/visitor-logs')
    || /^\/jobs\/[^/]+\/visitor-logs\/?$/.test(location.pathname)
    || /^\/visitor\/checkout\/[^/]+$/.test(location.pathname);
  
  if (isPublicRoute) {
    return <PublicRoutes />;
  }
  
  return <AuthenticatedRoutes />;
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