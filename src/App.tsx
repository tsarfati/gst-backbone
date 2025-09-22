import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ReceiptProvider } from "@/contexts/ReceiptContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AccessControl } from "@/components/AccessControl";
import Layout from "@/components/AppLayout";
import CompanyRequest from "@/pages/CompanyRequest";

import Dashboard from "./pages/Dashboard";
import UploadReceipts from "./pages/UploadReceipts";
import UncodedReceipts from "./pages/UncodedReceipts";
import Jobs from "./pages/Jobs";
import JobDetails from "./pages/JobDetails";
import JobEdit from "./pages/JobEdit";
import JobBudget from "./pages/JobBudget";
import Vendors from "./pages/Vendors";
import VendorDetails from "./pages/VendorDetails";
import VendorEdit from "./pages/VendorEdit";
import AppSettings from "./pages/AppSettings";
import UserSettings from "./pages/UserSettings";
import Bills from "./pages/Bills";
import BillDashboard from "./pages/BillDashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AllEmployees from "./pages/AllEmployees";
import AddEmployee from "./pages/AddEmployee";
import TimeTracking from "./pages/TimeTracking";
import TimeSheets from "./pages/TimeSheets";
import AllMessages from "./pages/AllMessages";
import TeamChat from "./pages/TeamChat";
import Announcements from "./pages/Announcements";
import BillDetails from "./pages/BillDetails";
import PaymentHistory from "./pages/PaymentHistory";
import PaymentReports from "./pages/PaymentReports";
import AddBill from "./pages/AddBill";
import AddJob from "./pages/AddJob";
import CostCodes from "./pages/CostCodes";
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
import JobReports from "./pages/JobReports";
import CompanyFiles from "./pages/CompanyFiles";
import CompanyContracts from "./pages/CompanyContracts";
import CompanyPermits from "./pages/CompanyPermits";
import CompanyInsurance from "./pages/CompanyInsurance";
import CompanyManagement from "./pages/CompanyManagement";
import BankAccounts from "./pages/BankAccounts";
import CreditCards from "./pages/CreditCards";
import BankingReports from "./pages/BankingReports";
import JournalEntries from "./pages/JournalEntries";
import Deposits from "./pages/Deposits";
import PrintChecks from "./pages/PrintChecks";
import MakePayment from "./pages/MakePayment";
import Reconcile from "./pages/Reconcile";

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

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/company-request" element={
          <ProtectedRoute>
            <CompanyRequest />
          </ProtectedRoute>
        } />
        <Route path="/" element={
          <ProtectedRoute>
            <AccessControl>
              <Layout />
            </AccessControl>
          </ProtectedRoute>
        }>
                      <Route index element={<Dashboard />} />
                      <Route path="upload" element={<UploadReceipts />} />
                      <Route path="uncoded" element={<UncodedReceipts />} />
                      <Route path="receipts" element={<CodedReceipts />} />
                      <Route path="receipts/reports" element={<ReceiptReports />} />
                      <Route path="jobs" element={<Jobs />} />
                      <Route path="jobs/add" element={<AddJob />} />
                      <Route path="jobs/cost-codes" element={<CostCodes />} />
                      <Route path="jobs/reports" element={<JobReports />} />
                      <Route path="jobs/:id" element={<JobDetails />} />
                      <Route path="jobs/:id/edit" element={<JobEdit />} />
                      <Route path="jobs/:id/budget" element={<JobBudget />} />
                      <Route path="vendors" element={<Vendors />} />
                      <Route path="vendors/add" element={<VendorEdit />} />
                      <Route path="vendors/:id" element={<VendorDetails />} />
                      <Route path="vendors/:id/edit" element={<VendorEdit />} />
                      <Route path="settings" element={<AppSettings />} />
                      <Route path="settings/theme" element={<ThemeSettings />} />
                      <Route path="settings/company" element={<CompanySettingsPage />} />
                      <Route path="settings/company-management" element={<CompanyManagement />} />
                      <Route path="settings/notifications" element={<NotificationSettings />} />
                      <Route path="settings/email-templates/:id/edit" element={<EmailTemplateEdit />} />
                      <Route path="settings/security" element={<SecuritySettings />} />
                      <Route path="profile-settings" element={<ProfileSettings />} />
                      <Route path="settings/users" element={<UserSettings />} />
                      <Route path="employees" element={<AllEmployees />} />
                      <Route path="employees/add" element={<AddEmployee />} />
                      <Route path="add-employee" element={<AddEmployee />} />
                      <Route path="time-tracking" element={<TimeTracking />} />
                      <Route path="punch-clock" element={<TimeTracking />} />
                      <Route path="time-sheets" element={<TimeSheets />} />
                      <Route path="punch-clock/timesheets" element={<TimeSheets />} />
                      <Route path="messages" element={<AllMessages />} />
                      <Route path="team-chat" element={<TeamChat />} />
                      <Route path="announcements" element={<Announcements />} />
                      <Route path="messaging" element={<AllMessages />} />
                      <Route path="bills" element={<Bills />} />
                      <Route path="bills/add" element={<AddBill />} />
                      <Route path="bills/:id" element={<BillDetails />} />
                      <Route path="bill-status" element={<BillDashboard />} />
                      <Route path="bills/payments" element={<PaymentHistory />} />
                      <Route path="bills/payment-reports" element={<PaymentReports />} />
                      <Route path="bills/status" element={<BillDashboard />} />
                      <Route path="subcontracts/add" element={<AddSubcontract />} />
                      <Route path="purchase-orders/add" element={<AddPurchaseOrder />} />
                      {/* Legacy routes for backwards compatibility */}
                      <Route path="invoices" element={<Bills />} />
                      <Route path="invoices/add" element={<AddBill />} />
                      <Route path="invoices/:id" element={<BillDetails />} />
                      <Route path="invoice-status" element={<BillDashboard />} />
                      <Route path="invoices/payments" element={<PaymentHistory />} />
                      <Route path="invoices/payment-reports" element={<PaymentReports />} />
                      <Route path="invoices/status" element={<BillDashboard />} />
                      <Route path="company-files" element={<CompanyFiles />} />
                      <Route path="company-files/contracts" element={<CompanyContracts />} />
                      <Route path="company-files/permits" element={<CompanyPermits />} />
                      <Route path="company-files/insurance" element={<CompanyInsurance />} />
                      <Route path="banking/accounts" element={<BankAccounts />} />
                      <Route path="banking/credit-cards" element={<CreditCards />} />
                      <Route path="banking/reports" element={<BankingReports />} />
                      <Route path="banking/reports" element={<BankingReports />} />
                      <Route path="banking/journal-entries" element={<JournalEntries />} />
                      <Route path="banking/deposits" element={<Deposits />} />
                      <Route path="banking/print-checks" element={<PrintChecks />} />
                      <Route path="banking/make-payment" element={<MakePayment />} />
                      <Route path="banking/reconcile" element={<Reconcile />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <SettingsProvider>
            <CompanyProvider>
              <ReceiptProvider>
                <TooltipProvider>
                  <Toaster />
                  <AppRoutes />
                </TooltipProvider>
              </ReceiptProvider>
            </CompanyProvider>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;