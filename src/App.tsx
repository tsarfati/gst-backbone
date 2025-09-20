import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ReceiptProvider } from "@/contexts/ReceiptContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";

import Dashboard from "./pages/Dashboard";
import UploadReceipts from "./pages/UploadReceipts";
import UncodedReceipts from "./pages/UncodedReceipts";
import Jobs from "./pages/Jobs";
import JobDetails from "./pages/JobDetails";
import JobEdit from "./pages/JobEdit";
import Vendors from "./pages/Vendors";
import VendorDetails from "./pages/VendorDetails";
import VendorEdit from "./pages/VendorEdit";
import AppSettings from "./pages/AppSettings";
import UserSettings from "./pages/UserSettings";
import Invoices from "./pages/Invoices";
import InvoiceStatus from "./pages/InvoiceStatus";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AllEmployees from "./pages/AllEmployees";
import AddEmployee from "./pages/AddEmployee";
import TimeTracking from "./pages/TimeTracking";
import TimeSheets from "./pages/TimeSheets";
import AllMessages from "./pages/AllMessages";
import InvoiceDetails from "./pages/InvoiceDetails";
import PaymentHistory from "./pages/PaymentHistory";
import PaymentReports from "./pages/PaymentReports";
import AddInvoice from "./pages/AddInvoice";
import AddJob from "./pages/AddJob";
import CostCodes from "./pages/CostCodes";

const queryClient = new QueryClient();

// Protected Route Component
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AuthProvider>
          <SettingsProvider>
            <ReceiptProvider>
              <TooltipProvider>
                <Toaster />
                <BrowserRouter>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/" element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Dashboard />} />
                      <Route path="upload" element={<UploadReceipts />} />
                      <Route path="uncoded" element={<UncodedReceipts />} />
                      <Route path="receipts" element={<UncodedReceipts />} />
                      <Route path="jobs" element={<Jobs />} />
                      <Route path="jobs/add" element={<AddJob />} />
                      <Route path="jobs/cost-codes" element={<CostCodes />} />
                      <Route path="jobs/:id" element={<JobDetails />} />
                      <Route path="jobs/:id/edit" element={<JobEdit />} />
                      <Route path="vendors" element={<Vendors />} />
                      <Route path="vendors/add" element={<VendorEdit />} />
                      <Route path="vendors/:id" element={<VendorDetails />} />
                      <Route path="vendors/:id/edit" element={<VendorEdit />} />
                      <Route path="settings" element={<AppSettings />} />
                      <Route path="settings/users" element={<UserSettings />} />
                      <Route path="employees" element={<AllEmployees />} />
                      <Route path="employees/add" element={<AddEmployee />} />
                      <Route path="add-employee" element={<AddEmployee />} />
                      <Route path="time-tracking" element={<TimeTracking />} />
                      <Route path="punch-clock" element={<TimeTracking />} />
                      <Route path="time-sheets" element={<TimeSheets />} />
                      <Route path="punch-clock/timesheets" element={<TimeSheets />} />
                      <Route path="messages" element={<AllMessages />} />
                      <Route path="messaging" element={<AllMessages />} />
                      <Route path="invoices" element={<Invoices />} />
                      <Route path="invoices/add" element={<AddInvoice />} />
                      <Route path="invoices/:id" element={<InvoiceDetails />} />
                      <Route path="invoice-status" element={<InvoiceStatus />} />
                      <Route path="invoices/payments" element={<PaymentHistory />} />
                      <Route path="invoices/payment-reports" element={<PaymentReports />} />
                      <Route path="invoices/status" element={<InvoiceStatus />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </ReceiptProvider>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;