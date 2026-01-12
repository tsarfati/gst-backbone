import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ReceiptProvider } from "@/contexts/ReceiptContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PunchClockAuthProvider } from "@/contexts/PunchClockAuthContext";
import PunchClockLogin from "./pages/PunchClockLogin";
import PunchClockApp from "./pages/PunchClockApp";
import PMobileLogin from "./pages/PMobileLogin";
import PMobileApp from "./pages/PMobileApp";
import MobileMessages from "./pages/MobileMessages";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const appType = import.meta.env.VITE_APP_TYPE || 'main';

interface AppRouterProps {
  queryClient: any;
}

export function AppRouter({ queryClient }: AppRouterProps) {
  // Punch Clock App Routes
  if (appType === 'punchclock') {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <PWAInstallPrompt />
            <AuthProvider>
              <PunchClockAuthProvider>
                <TenantProvider>
                  <CompanyProvider>
                    <ReceiptProvider>
                      <BrowserRouter>
                        <Routes>
                          <Route path="/" element={<Navigate to="/punch-clock-login" replace />} />
                          <Route path="/punch-clock-login" element={<PunchClockLogin />} />
                          <Route path="/punch-clock-app" element={<PunchClockApp />} />
                          <Route path="*" element={<Navigate to="/punch-clock-login" replace />} />
                        </Routes>
                      </BrowserRouter>
                    </ReceiptProvider>
                  </CompanyProvider>
                </TenantProvider>
              </PunchClockAuthProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }
  
  // PM Mobile App Routes
  if (appType === 'pmobile') {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <PWAInstallPrompt />
            <AuthProvider>
              <PunchClockAuthProvider>
                <TenantProvider>
                  <CompanyProvider>
                    <ReceiptProvider>
                      <BrowserRouter>
                        <Routes>
                          <Route path="/" element={<Navigate to="/pm-mobile-login" replace />} />
                          <Route path="/pm-mobile-login" element={<PMobileLogin />} />
                          <Route path="/pm-mobile-app" element={<PMobileApp />} />
                          <Route path="/mobile-messages" element={<MobileMessages />} />
                          <Route path="*" element={<Navigate to="/pm-mobile-login" replace />} />
                        </Routes>
                      </BrowserRouter>
                    </ReceiptProvider>
                  </CompanyProvider>
                </TenantProvider>
              </PunchClockAuthProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }
  
  // Main web app - return null, will be handled by App.tsx
  return null;
}
