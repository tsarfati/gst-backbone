import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ReceiptProvider } from "./contexts/ReceiptContext";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import UploadReceipts from "./pages/UploadReceipts";
import UncodedReceipts from "./pages/UncodedReceipts";
import Jobs from "./pages/Jobs";
import JobDetails from "./pages/JobDetails";
import JobEdit from "./pages/JobEdit";
import Vendors from "./pages/Vendors";
import VendorDetails from "./pages/VendorDetails";
import VendorEdit from "./pages/VendorEdit";
import Invoices from "./pages/Invoices";
import InvoiceStatus from "./pages/InvoiceStatus";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ReceiptProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="upload" element={<UploadReceipts />} />
            <Route path="uncoded" element={<UncodedReceipts />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="jobs/:id" element={<JobDetails />} />
            <Route path="jobs/:id/edit" element={<JobEdit />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="vendors/:id" element={<VendorDetails />} />
            <Route path="vendors/:id/edit" element={<VendorEdit />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoice-status" element={<InvoiceStatus />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ReceiptProvider>
  </QueryClientProvider>
);

export default App;
