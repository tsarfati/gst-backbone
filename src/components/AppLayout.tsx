import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Receipt, ChevronDown } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarInset, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { LayoutDashboard, Upload, Clock, Eye, BarChart3, Building2, Plus, FileBarChart, FolderOpen, Building, FileText, FileCheck, CreditCard, DollarSign, FolderArchive, FileKey, Shield, Users, UserPlus, Briefcase, Award, Timer, Calendar, TrendingUp, MessageSquare, Megaphone, MessageCircle, CheckSquare, Target, AlarmClock, Settings, UserCog, LogOut, Bell, User } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import GlobalSearch from '@/components/GlobalSearch';
import { DateTimeDisplay } from '@/components/DateTimeDisplay';
import { useNavigate } from 'react-router-dom';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { CompanySwitcher } from '@/components/CompanySwitcher';

const navigationCategories = [
  {
    title: "Dashboard",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, menuKey: "dashboard" },
    ],
    collapsible: false,
  },
  {
    title: "Receipts",
    items: [
      { name: "Upload Receipts", href: "/upload", icon: Upload, menuKey: "receipts" },
      { name: "Uncoded Receipts", href: "/uncoded", icon: Clock, menuKey: "receipts" },
      { name: "Coded Receipts", href: "/receipts", icon: Eye, menuKey: "receipts" },
      { name: "Receipt Reports", href: "/receipts/reports", icon: BarChart3, menuKey: "reports" },
    ],
    collapsible: true,
  },
  {
    title: "Vendors",
    items: [
      { name: "All Vendors", href: "/vendors", icon: Building2, menuKey: "vendors" },
      { name: "Add Vendor", href: "/vendors/add", icon: Plus, menuKey: "vendors" },
      { name: "Vendor Reports", href: "/vendors/reports", icon: FileBarChart, menuKey: "reports" },
    ],
    collapsible: true,
  },
  {
    title: "Jobs",
    items: [
      { name: "All Jobs", href: "/jobs", icon: FolderOpen, menuKey: "jobs" },
      { name: "Add Job", href: "/jobs/add", icon: Building, menuKey: "jobs" },
      { name: "Cost Codes", href: "/jobs/cost-codes", icon: FileText, menuKey: "jobs" },
      { name: "Job Reports", href: "/jobs/reports", icon: BarChart3, menuKey: "reports" },
    ],
    collapsible: true,
  },
  {
    title: "Payables",
    items: [
      { name: "Bill Dashboard", href: "/bill-status", icon: BarChart3, menuKey: "reports" },
      { name: "All Bills", href: "/bills", icon: FileText, menuKey: "vendors" },
      { name: "Add Bill", href: "/bills/add", icon: FileCheck, menuKey: "vendors" },
      { name: "Add Sub Contract", href: "/subcontracts/add", icon: FileKey, menuKey: "vendors" },
      { name: "Add PO", href: "/purchase-orders/add", icon: FileText, menuKey: "vendors" },
      { name: "Payment History", href: "/bills/payments", icon: CreditCard, menuKey: "reports" },
      { name: "Bill Reports", href: "/bills/payment-reports", icon: DollarSign, menuKey: "reports" },
    ],
    collapsible: true,
  },
  {
    title: "Company Files",
    items: [
      { name: "All Documents", href: "/company-files", icon: FolderArchive, menuKey: "settings" },
      { name: "Contracts", href: "/company-files/contracts", icon: FileKey, menuKey: "settings" },
      { name: "Permits", href: "/company-files/permits", icon: FileCheck, menuKey: "settings" },
      { name: "Insurance", href: "/company-files/insurance", icon: Shield, menuKey: "settings" },
    ],
    collapsible: true,
  },
  {
    title: "Employees",
    items: [
      { name: "All Employees", href: "/employees", icon: Users, menuKey: "employees" },
      { name: "Add Employee", href: "/employees/add", icon: UserPlus, menuKey: "employees" },
      { name: "Payroll", href: "/employees/payroll", icon: DollarSign, menuKey: "employees" },
      { name: "Performance", href: "/employees/performance", icon: Award, menuKey: "employees" },
    ],
    collapsible: true,
  },
  {
    title: "Punch Clock",
    items: [
      { name: "Time Tracking", href: "/time-tracking", icon: Timer, menuKey: "employees" },
      { name: "Timesheets", href: "/time-sheets", icon: Calendar, menuKey: "employees" },
      { name: "Overtime Reports", href: "/punch-clock/overtime", icon: TrendingUp, menuKey: "reports" },
    ],
    collapsible: true,
  },
  {
    title: "Messaging",
    items: [
      { name: "All Messages", href: "/messages", icon: MessageSquare, menuKey: "messages" },
      { name: "Team Chat", href: "/team-chat", icon: MessageCircle, menuKey: "messages" },
      { name: "Announcements", href: "/announcements", icon: Megaphone, menuKey: "announcements" },
    ],
    collapsible: true,
  },
  {
    title: "Tasks",
    items: [
      { name: "All Tasks", href: "/tasks", icon: CheckSquare, menuKey: "jobs" },
      { name: "Project Tasks", href: "/tasks/projects", icon: Target, menuKey: "jobs" },
      { name: "Deadlines", href: "/tasks/deadlines", icon: AlarmClock, menuKey: "jobs" },
    ],
    collapsible: true,
  },
  {
    title: "Banking",
    items: [
      { name: "Bank Accounts", href: "/banking/accounts", icon: Building, menuKey: "settings" },
      { name: "Credit Cards", href: "/banking/credit-cards", icon: CreditCard, menuKey: "settings" },
      { name: "Reporting", href: "/banking/reports", icon: BarChart3, menuKey: "reports" },
      { name: "Journal Entries", href: "/banking/journal-entries", icon: FileText, menuKey: "settings" },
      { name: "Deposits", href: "/banking/deposits", icon: DollarSign, menuKey: "settings" },
      { name: "Print Checks", href: "/banking/print-checks", icon: FileCheck, menuKey: "settings" },
      { name: "Reconcile", href: "/banking/reconcile", icon: CheckSquare, menuKey: "settings" },
    ],
    collapsible: true,
  },
  {
    title: "Settings",
    items: [
      { name: "General", href: "/settings", icon: Settings, menuKey: "settings" },
      { name: "Theme & Appearance", href: "/settings/theme", icon: Settings, menuKey: "settings" },
      { name: "Company Settings", href: "/settings/company", icon: Building, menuKey: "settings" },
      { name: "Company Management", href: "/settings/company-management", icon: Building2, menuKey: "settings" },
      { name: "Notifications & Email", href: "/settings/notifications", icon: Bell, menuKey: "settings" },
      { name: "Data & Security", href: "/settings/security", icon: Shield, menuKey: "settings" },
      { name: "User Management", href: "/settings/users", icon: UserCog, menuKey: "settings" },
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
  const { currentCompany } = useCompany();
  const { hasAccess, loading } = useMenuPermissions();
  const [openGroups, setOpenGroups] = useState<string[]>(["Dashboard"]);

  const toggleGroup = (groupTitle: string) => {
    // Dashboard doesn't expand - just navigate
    const dashboardCategory = navigationCategories.find(cat => cat.title === "Dashboard");
    if (dashboardCategory && groupTitle === "Dashboard") {
      return; // Don't toggle dashboard
    }

    if (settings.navigationMode === 'single') {
      const activeGroups = navigationCategories
        .filter(category => 
          category.items.some(item => 
            item.href === location.pathname || 
            location.pathname.startsWith(item.href + '/') ||
            // Keep Payables open when on subcontract/PO pages
            (category.title === 'Payables' && (
              location.pathname.startsWith('/subcontracts/') ||
              location.pathname.startsWith('/purchase-orders/')
            ))
          )
        )
        .map(category => category.title);
        
      setOpenGroups(prev => {
        const isCurrentlyOpen = prev.includes(groupTitle);
        if (isCurrentlyOpen) {
          return activeGroups.includes(groupTitle) ? [groupTitle] : [];
        } else {
          return [...new Set([groupTitle, ...activeGroups])];
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
        // Keep Payables open when on subcontract/PO pages
        (category.title === 'Payables' && (
          location.pathname.startsWith('/subcontracts/') ||
          location.pathname.startsWith('/purchase-orders/')
        ))
      )
    )
    .map(category => category.title);

  useEffect(() => {
    if (settings.navigationMode === 'single') {
      setOpenGroups(activeGroups.length > 0 ? activeGroups : ["Dashboard"]);
    }
  }, [settings.navigationMode, location.pathname]);

  const allOpenGroups = [...new Set([...openGroups, ...activeGroups])];

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader>
        <div className="flex items-center justify-center p-2 min-h-[60px] w-full">
          {settings.customLogo ? (
            <img 
              src={settings.customLogo} 
              alt="Company Logo" 
              className="h-full w-full object-contain max-h-12" 
            />
          ) : (
            <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="gap-0">
        {!loading && navigationCategories.map((category) => {
          const isDashboard = category.title === "Dashboard";
          
          // Filter items based on permissions
          const allowedItems = category.items.filter(item => 
            !item.menuKey || hasAccess(item.menuKey)
          );
          
          // Don't show category if no items are allowed
          if (allowedItems.length === 0) return null;
          
          return (
            <SidebarGroup key={category.title}>
              {isDashboard ? (
                // Dashboard renders as a direct link without collapsible
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
                            tooltip={state === "collapsed" ? item.name : undefined}
                            style={isActive ? { backgroundColor: `hsl(${settings.customColors.primary})`, color: 'white' } : {}}
                            className={isActive ? "hover:opacity-95" : "hover:bg-sidebar-accent/30 transition-colors duration-150"}
                          >
                            <Link to={item.href}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.name}</span>
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
                         className="w-full justify-between p-2 h-8 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors duration-150 group-data-[collapsible=icon]:justify-center"
                       >
                        <span className="group-data-[collapsible=icon]:hidden">
                          {category.title}
                        </span>
                        <ChevronDown className="h-3 w-3 transition-transform group-data-[collapsible=icon]:hidden data-[state=open]:rotate-180" />
                      </Button>
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {(() => {
                          // Determine the single most specific active item within this category
                          const matches = allowedItems.filter((itm) => {
                            if (location.pathname === itm.href) return true;
                            if (location.pathname.startsWith(itm.href + "/")) return true;
                            if (category.title === "Payables") {
                              if (itm.href === "/subcontracts/add" && location.pathname.startsWith("/subcontracts/")) return true;
                              if (itm.href === "/purchase-orders/add" && location.pathname.startsWith("/purchase-orders/")) return true;
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
                                  style={isActive ? { backgroundColor: `hsl(${settings.customColors.primary})`, color: 'white' } : {}}
                                  className={isActive ? "hover:opacity-95" : "hover:bg-sidebar-accent/30 transition-colors duration-150"}
                                >
                                  <Link to={item.href}>
                                    <item.icon className="h-4 w-4" />
                                    <span>{item.name}</span>
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
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="text-left group-data-[collapsible=icon]:hidden">
                <p className="font-medium text-sm">{profile?.display_name || 'User'}</p>
                <p className="text-muted-foreground text-xs capitalize">{profile?.role}</p>
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
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-4">
              <CompanySwitcher />
              <DateTimeDisplay />
            </div>
          </header>
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}