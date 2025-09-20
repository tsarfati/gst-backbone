import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Receipt, ChevronDown } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarInset, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { LayoutDashboard, Upload, Clock, Eye, BarChart3, Building2, Plus, FileBarChart, FolderOpen, Building, FileText, FileCheck, CreditCard, DollarSign, FolderArchive, FileKey, Shield, Users, UserPlus, Briefcase, Award, Timer, Calendar, TrendingUp, MessageSquare, Megaphone, MessageCircle, CheckSquare, Target, AlarmClock, Settings, UserCog, LogOut } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';

const navigationCategories = [
  {
    title: "Dashboard",
    items: [
      { name: "Overview", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    title: "Receipts",
    items: [
      { name: "Upload Receipts", href: "/upload", icon: Upload },
      { name: "Uncoded Receipts", href: "/uncoded", icon: Clock },
      { name: "View All Receipts", href: "/receipts", icon: Eye },
      { name: "Receipt Reports", href: "/receipts/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Vendors",
    items: [
      { name: "All Vendors", href: "/vendors", icon: Building2 },
      { name: "Add Vendor", href: "/vendors/add", icon: Plus },
      { name: "Vendor Reports", href: "/vendors/reports", icon: FileBarChart },
    ],
  },
  {
    title: "Jobs",
    items: [
      { name: "All Jobs", href: "/jobs", icon: FolderOpen },
      { name: "Add Job", href: "/jobs/add", icon: Building },
      { name: "Cost Codes", href: "/jobs/cost-codes", icon: FileText },
      { name: "Job Reports", href: "/jobs/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Invoices",
    items: [
      { name: "All Invoices", href: "/invoices", icon: FileText },
      { name: "Add Invoice", href: "/invoices/add", icon: FileCheck },
      { name: "Invoice Status", href: "/invoice-status", icon: BarChart3 },
      { name: "Payment History", href: "/invoices/payments", icon: CreditCard },
      { name: "Payment Reports", href: "/invoices/payment-reports", icon: DollarSign },
    ],
  },
  {
    title: "Company Files",
    items: [
      { name: "All Documents", href: "/company-files", icon: FolderArchive },
      { name: "Contracts", href: "/company-files/contracts", icon: FileKey },
      { name: "Permits", href: "/company-files/permits", icon: FileCheck },
      { name: "Insurance", href: "/company-files/insurance", icon: Shield },
    ],
  },
  {
    title: "Employees",
    items: [
      { name: "All Employees", href: "/employees", icon: Users },
      { name: "Add Employee", href: "/employees/add", icon: UserPlus },
      { name: "Payroll", href: "/employees/payroll", icon: DollarSign },
      { name: "Performance", href: "/employees/performance", icon: Award },
    ],
  },
  {
    title: "Punch Clock",
    items: [
      { name: "Time Tracking", href: "/time-tracking", icon: Timer },
      { name: "Timesheets", href: "/time-sheets", icon: Calendar },
      { name: "Overtime Reports", href: "/punch-clock/overtime", icon: TrendingUp },
    ],
  },
  {
    title: "Messaging",
    items: [
      { name: "All Messages", href: "/messages", icon: MessageSquare },
      { name: "Announcements", href: "/messaging/announcements", icon: Megaphone },
      { name: "Team Chat", href: "/messaging/chat", icon: MessageCircle },
    ],
  },
  {
    title: "Tasks",
    items: [
      { name: "All Tasks", href: "/tasks", icon: CheckSquare },
      { name: "Project Tasks", href: "/tasks/projects", icon: Target },
      { name: "Deadlines", href: "/tasks/deadlines", icon: AlarmClock },
    ],
  },
  {
    title: "Settings",
    items: [
      { name: "App Settings", href: "/settings", icon: Settings },
      { name: "User Management", href: "/settings/users", icon: UserCog },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { settings } = useSettings();
  const { signOut, profile } = useAuth();
  const [openGroups, setOpenGroups] = useState<string[]>(["Dashboard"]);

  const toggleGroup = (groupTitle: string) => {
    if (settings.navigationMode === 'single') {
      const activeGroups = navigationCategories
        .filter(category => 
          category.items.some(item => item.href === location.pathname)
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
      category.items.some(item => item.href === location.pathname)
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
        <div className="flex items-center gap-2 px-2 py-1">
          {settings.customLogo ? (
            <img 
              src={settings.customLogo} 
              alt="Custom Logo" 
              className="h-6 w-6 object-contain" 
            />
          ) : (
            <Receipt className="h-6 w-6 text-primary" />
          )}
          <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">
            Green Star TEAM
          </span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="gap-0">
        {navigationCategories.map((category) => (
          <SidebarGroup key={category.title}>
            <Collapsible 
              open={allOpenGroups.includes(category.title)} 
              onOpenChange={() => toggleGroup(category.title)}
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between p-2 h-8 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
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
                    {category.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton 
                            asChild 
                            isActive={isActive}
                            tooltip={state === "collapsed" ? item.name : undefined}
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
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium">{profile?.display_name || 'User'}</p>
              <p className="text-muted-foreground capitalize">{profile?.role}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={signOut}
              className="h-8 w-8 p-0"
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
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}