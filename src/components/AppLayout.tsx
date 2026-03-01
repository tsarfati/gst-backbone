import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Receipt, ChevronDown } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarInset, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { LayoutDashboard, Upload, Clock, Eye, BarChart3, Building2, Plus, FileBarChart, HardHat, Building, FileText, FileCheck, CreditCard, DollarSign, FolderArchive, FileKey, Users, UserPlus, Briefcase, Award, Timer, Calendar, TrendingUp, MessageSquare, Megaphone, MessageCircle, CheckSquare, Target, AlarmClock, Settings, UserCog, LogOut, Bell, User, Package, Search, HandCoins, Shield } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useCompany } from '@/contexts/CompanyContext';
import GlobalSearch from '@/components/GlobalSearch';
import { DateTimeDisplay } from '@/components/DateTimeDisplay';
import { useNavigate } from 'react-router-dom';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { CompanySwitcher } from '@/components/CompanySwitcher';
// useDynamicManifest is only used in Punch Clock and PM Mobile pages, not in main app
import { supabase } from '@/integrations/supabase/client';

const navigationCategories = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { name: "Dashboard", href: "/", menuKey: "dashboard", employeeHidden: true },
    ],
    collapsible: false,
  },
  {
    title: "Construction",
    icon: HardHat,
      items: [
        { name: "Dashboard", href: "/construction/dashboard", menuKey: "jobs" },
        { name: "Jobs", href: "/jobs", menuKey: "jobs" },
        { name: "Subcontracts", href: "/subcontracts", menuKey: "vendors" },
        { name: "RFPs & Bids", href: "/construction/rfps", menuKey: "jobs" },
        { name: "Purchase Orders", href: "/purchase-orders", menuKey: "vendors" },
        { name: "Reports", href: "/construction/reports", menuKey: "jobs" },
      ],
    collapsible: true,
  },
  {
    title: "Receipts",
    icon: Receipt,
    items: [
      { name: "Upload Receipts", href: "/upload", menuKey: "receipts" },
      { name: "Uncoded Receipts", href: "/uncoded", menuKey: "receipts" },
      { name: "Coded Receipts", href: "/receipts", menuKey: "receipts" },
      { name: "Receipt Reports", href: "/receipts/reports", menuKey: "reports" },
    ],
    collapsible: true,
  },
  {
    title: "Receivables",
    icon: HandCoins,
    items: [
      { name: "Dashboard", href: "/receivables", menuKey: "receivables" },
      { name: "Customers", href: "/receivables/customers", menuKey: "receivables" },
      { name: "Invoices", href: "/receivables/invoices", menuKey: "receivables" },
      { name: "Payments", href: "/receivables/payments", menuKey: "receivables" },
      { name: "Reports", href: "/receivables/reports", menuKey: "reports" },
    ],
    collapsible: true,
  },
  {
    title: "Payables",
    icon: CreditCard,
    items: [
      { name: "Payables Dashboard", href: "/payables-dashboard", menuKey: "payables-dashboard" },
      { name: "Vendors", href: "/vendors", menuKey: "vendors" },
      { name: "Bills", href: "/invoices", menuKey: "bills" },
      { name: "Credit Cards", href: "/payables/credit-cards", menuKey: "banking-credit-cards" },
      { name: "Make Payment", href: "/payables/make-payment", menuKey: "make-payment" },
      { name: "Payment History", href: "/bills/payments", menuKey: "payment-history" },
      { name: "Bill Reports", href: "/bills/payment-reports", menuKey: "payment-reports" },
    ],
    collapsible: true,
  },
  {
    title: "Company Files",
    icon: FolderArchive,
    items: [
      { name: "All Documents", href: "/company-files", menuKey: "company-files" },
      { name: "Contracts", href: "/company-files/contracts", menuKey: "company-contracts" },
      { name: "Permits", href: "/company-files/permits", menuKey: "company-permits" },
      { name: "Insurance", href: "/company-files/insurance", menuKey: "company-insurance" },
    ],
    collapsible: true,
  },
  {
    title: "Employees",
    icon: Users,
    items: [
      { name: "All Employees", href: "/employees", menuKey: "employees" },
      { name: "Punch Clock", href: "/punch-clock/dashboard", menuKey: "punch-clock-dashboard" },
      { name: "Payroll", href: "/employees/payroll", menuKey: "employees" },
      { name: "Performance", href: "/employees/performance", menuKey: "employees" },
      { name: "Reports", href: "/employees/reports", menuKey: "employees" },
    ],
    collapsible: true,
  },
  {
    title: "Messaging",
    icon: MessageSquare,
    items: [
      { name: "All Messages", href: "/messages", menuKey: "messages" },
      { name: "Team Chat", href: "/team-chat", menuKey: "messages" },
      { name: "Announcements", href: "/announcements", menuKey: "announcements" },
    ],
    collapsible: true,
  },
  {
    title: "Tasks",
    icon: CheckSquare,
    items: [
      { name: "All Tasks", href: "/tasks", menuKey: "jobs" },
      { name: "Project Tasks", href: "/tasks/projects", menuKey: "jobs" },
      { name: "Deadlines", href: "/tasks/deadlines", menuKey: "jobs" },
    ],
    collapsible: true,
  },
  {
    title: "Banking",
    icon: Building,
    items: [
      { name: "Bank Accounts", href: "/banking/accounts", menuKey: "banking-accounts" },
      { name: "Reporting", href: "/banking/reports", menuKey: "banking-reports" },
      { name: "Journal Entries", href: "/banking/journal-entries", menuKey: "journal-entries" },
      { name: "Deposits", href: "/banking/deposits", menuKey: "deposits" },
      { name: "Print Checks", href: "/banking/print-checks", menuKey: "print-checks" },
    ],
    collapsible: true,
  },
  {
    title: "Settings",
    icon: Settings,
    items: [
      { name: "Super Admin Dashboard", href: "/super-admin", menuKey: "settings", superAdminOnly: true },
      { name: "Company Settings", href: "/settings/company", menuKey: "company-settings" },
      
      
      { name: "Company Management", href: "/settings/company-management", menuKey: "company-management" },
      { name: "Notifications & Email", href: "/settings/notifications", menuKey: "notification-settings" },
      { name: "Data & Security", href: "/settings/security", menuKey: "security-settings" },
      { name: "User Management", href: "/settings/users", menuKey: "user-settings" },
      { name: "Punch Clock", href: "/punch-clock/settings", menuKey: "punch-clock-settings" },
      { name: "PM Lynk", href: "/settings/pm-lynk", menuKey: "settings" },
      { name: "Subscription", href: "/subscription", menuKey: "settings", ownerOnly: true },
    ],
    collapsible: true,
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const { settings } = useSettings();
  const { signOut, profile } = useAuth();
  const { isSuperAdmin } = useTenant();
  const { currentCompany } = useCompany();
  const activeCompanyRole = useActiveCompanyRole();
  const effectiveRole = activeCompanyRole ?? profile?.role ?? null;
  const showRoleLabel =
    !!isSuperAdmin ||
    effectiveRole === 'admin' ||
    effectiveRole === 'company_admin';
  const { hasAccess, loading } = useMenuPermissions();
  const [openGroups, setOpenGroups] = useState<string[]>(["Dashboard"]);
  const [fallbackAvatar, setFallbackAvatar] = useState<string | null>(null);

  useEffect(() => {
    const fetchFallback = async () => {
      try {
        if (!profile?.avatar_url && profile?.user_id) {
          const { data } = await supabase
            .from('current_punch_status')
            .select('punch_in_photo_url, punch_in_time')
            .eq('user_id', profile.user_id)
            .eq('is_active', true)
            .order('punch_in_time', { ascending: false })
            .limit(1)
            .maybeSingle();
          setFallbackAvatar(data?.punch_in_photo_url || null);
        }
      } catch (e) {
        console.error('Failed to load fallback avatar:', e);
      }
    };
    fetchFallback();
  }, [profile?.avatar_url, profile?.user_id]);

  const toggleGroup = (groupTitle: string) => {
    // Dashboard doesn't expand - just navigate
    const dashboardCategory = navigationCategories.find(cat => cat.title === "Dashboard");
    if (dashboardCategory && groupTitle === "Dashboard") {
      return; // Don't toggle dashboard
    }

    if (settings.navigationMode === 'single') {
      setOpenGroups(prev => {
        const isCurrentlyOpen = prev.includes(groupTitle);
        if (isCurrentlyOpen) {
          // Allow collapsing any group, even if it contains the active page
          return prev.filter(g => g !== groupTitle);
        } else {
          // Close other groups and open this one
          return [groupTitle];
        }
      });
    } else {
      setOpenGroups(prev => 
        prev.includes(groupTitle) 
          ? prev.filter(g => g !== groupTitle) 
          : [...prev, groupTitle]
      );
    }
  };

  const activeGroups = navigationCategories
    .filter(category => 
      category.items.some(item => 
        location.pathname === item.href || 
        location.pathname.startsWith(item.href + '/') ||
        // Keep Construction open when on job/subcontract/PO pages
        (category.title === 'Construction' && (
          location.pathname.startsWith('/jobs/') ||
          location.pathname.startsWith('/subcontracts/') ||
          location.pathname.startsWith('/purchase-orders/')
        )) ||
        // Keep Payables open when on vendor/bill pages
        (category.title === 'Payables' && (
          location.pathname.startsWith('/vendors/')
        ))
      )
    )
    .map(category => category.title);

  useEffect(() => {
    if (settings.navigationMode === 'single') {
      // Only auto-open groups if no groups are currently open
      if (openGroups.length === 0) {
        setOpenGroups(activeGroups.length > 0 ? activeGroups : ["Dashboard"]);
      }
    }
  }, [settings.navigationMode, location.pathname]);

  // Use only manually controlled open groups, don't force active groups to stay open
  const allOpenGroups = openGroups;

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader>
        <div className="flex items-center justify-center p-2 min-h-[60px] w-full">
          {currentCompany?.logo_url ? (
            <img 
              src={currentCompany.logo_url.includes('http') 
                ? currentCompany.logo_url 
                : `https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/${currentCompany.logo_url.replace('company-logos/', '')}`
              } 
              alt="Company Logo" 
              className="h-full w-full object-contain max-h-12" 
              onError={(e) => {
                console.error('Logo failed to load:', currentCompany.logo_url);
                e.currentTarget.style.display = 'none';
                (e.currentTarget.nextElementSibling as HTMLElement | null)?.classList.remove('hidden');
              }}
            />
          ) : null}
          {!currentCompany?.logo_url && (
            <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          )}
          {currentCompany?.logo_url && (
            <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center hidden">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="gap-0">
        {!loading && navigationCategories.map((category) => {
          const isDashboard = category.title === "Dashboard";
          const isDirectLink = !category.collapsible;
          
           // Filter items based on permissions and role
           const allowedItems = category.items.filter((item) => {
             const superAdminOnly = 'superAdminOnly' in item && !!(item as any).superAdminOnly;
             if (superAdminOnly && !isSuperAdmin) return false;

              const ownerOnly = 'ownerOnly' in item && !!(item as any).ownerOnly;
              if (ownerOnly && profile?.user_id !== currentCompany?.created_by) return false;

              const employeeHidden = 'employeeHidden' in item && !!(item as any).employeeHidden;
              if (employeeHidden && effectiveRole === 'employee') return false;

             const menuKey = ('menuKey' in item ? (item as any).menuKey : undefined) as string | undefined;
             return !menuKey || hasAccess(menuKey);
           });
          
          // Don't show category if no items are allowed
          if (allowedItems.length === 0) return null;
          
          return (
            <SidebarGroup key={category.title}>
              {isDirectLink ? (
                // Direct links (Dashboard, Vendors, Jobs) render without collapsible
                <SidebarGroupContent>
                  <SidebarMenu>
                    {allowedItems.map((item) => {
                      const isActive = location.pathname === item.href || 
                        location.pathname.startsWith(item.href + '/');
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton 
                            asChild 
                            isActive={isActive}
                            tooltip={state === "collapsed" ? category.title : undefined}
                            style={isActive ? { backgroundColor: `hsl(${settings.customColors.primary})`, color: 'white', fontWeight: 'bold' } : {}}
                            className={isActive ? "hover:opacity-95" : `hover:bg-primary/10 transition-colors duration-150`}
                          >
                            <Link to={item.href}>
                              <category.icon className="h-4 w-4" />
                              <span>{category.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              ) : (
                // Other categories use collapsible behavior
                <Collapsible 
                  open={allOpenGroups.includes(category.title)} 
                  onOpenChange={() => toggleGroup(category.title)}
                >
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger asChild>
                       <Button 
                         variant="ghost" 
                         className="w-full justify-between p-2 h-8 text-xs font-medium text-sidebar-foreground/70 hover:bg-primary/10 hover:text-sidebar-foreground transition-colors duration-150 group-data-[collapsible=icon]:justify-center"
                       >
                        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
                          <category.icon className={`h-4 w-4 transition-colors ${allOpenGroups.includes(category.title) ? 'text-primary' : ''}`} />
                          <span className="group-data-[collapsible=icon]:hidden">
                            {category.title}
                          </span>
                        </div>
                        <ChevronDown className={`h-3 w-3 transition-transform group-data-[collapsible=icon]:hidden ${!allOpenGroups.includes(category.title) ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  
                  <CollapsibleContent>
                        <SidebarGroupContent>
                          <SidebarMenu className={allOpenGroups.includes(category.title) ? "bg-primary/5 rounded-md p-1" : ""}>
                            {(() => {
                              // Determine the single most specific active item within this category
                              const matches = allowedItems.filter((itm) => {
                                if (location.pathname === itm.href) return true;
                                if (location.pathname.startsWith(itm.href + "/")) return true;
                                if (category.title === "Construction") {
                                  if (itm.href === "/jobs" && location.pathname.startsWith("/jobs/")) return true;
                                  if (itm.href === "/subcontracts" && location.pathname.startsWith("/subcontracts/")) return true;
                                  if (itm.href === "/purchase-orders" && location.pathname.startsWith("/purchase-orders/")) return true;
                                }
                                if (category.title === "Payables") {
                                  if (itm.href === "/vendors" && location.pathname.startsWith("/vendors/")) return true;
                                }
                                return false;
                              });
                              const activeItemHref = matches.length
                                ? matches.reduce((longest, curr) => (curr.href.length > longest.length ? curr.href : longest), matches[0].href)
                                : "";

                              return allowedItems.map((item) => {
                                const isActive = item.href === activeItemHref;
                                return (
                                  <SidebarMenuItem key={item.name}>
                                    <SidebarMenuButton
                                      asChild
                                      isActive={isActive}
                                      tooltip={state === "collapsed" ? item.name : undefined}
                                      style={isActive ? { backgroundColor: `hsl(${settings.customColors.primary})`, color: 'white', fontWeight: 'bold' } : {}}
                                      className={isActive ? "hover:opacity-95" : `hover:bg-primary/10 transition-colors duration-150`}
                                    >
                                      <Link to={item.href}>
                                        <span className="ml-2">{item.name}</span>
                                      </Link>
                                    </SidebarMenuButton>
                                  </SidebarMenuItem>
                                );
                              });
                            })()}
                          </SidebarMenu>
                        </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </SidebarGroup>
          );
        }).filter(Boolean)}
      </SidebarContent>
      <SidebarFooter>
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              className="flex items-center gap-3 h-auto p-2 justify-start flex-1"
              onClick={() => navigate('/profile-settings')}
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {(profile?.avatar_url || fallbackAvatar) ? (
                  <img 
                    src={(profile?.avatar_url || fallbackAvatar) as string}
                    alt="Profile" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="text-left group-data-[collapsible=icon]:hidden">
                <p className="font-medium text-sm">{profile?.display_name || 'User'}</p>
                {showRoleLabel && (
                  <p className="text-muted-foreground text-xs capitalize">
                    {isSuperAdmin ? 'Super Admin' : (effectiveRole || '')}
                  </p>
                )}
              </div>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={signOut}
              className="h-8 w-8 p-0 group-data-[collapsible=icon]:hidden"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function Layout() {
  const location = useLocation();
  const { isSuperAdmin } = useTenant();
  const isPunchClockPage = location.pathname === '/time-tracking';

  // NOTE: Super admins can access both the Super Admin Dashboard and company dashboards.
  // No automatic redirect – they navigate manually via Settings > Super Admin Dashboard.
  // Note: useDynamicManifest is NOT used here - it only runs on Punch Clock/PM Mobile routes
  // to prevent the main app favicon from being replaced

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="animate-fade-in">
          {!isPunchClockPage && (
            <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
              <div className="flex items-center gap-2 flex-1">
                <SidebarTrigger className="-ml-1" />
                <div className="flex-1 max-w-lg">
                  <GlobalSearch />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <CompanySwitcher />
                <DateTimeDisplay />
              </div>
            </header>
          )}
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
