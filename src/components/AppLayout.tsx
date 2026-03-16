import { useState, useEffect, useRef } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Receipt, ChevronDown } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { LayoutDashboard, Upload, Clock, Eye, BarChart3, Building2, Plus, FileBarChart, HardHat, Building, FileText, FileCheck, CreditCard, DollarSign, FolderArchive, FileKey, Users, UserPlus, Briefcase, Award, Timer, Calendar, TrendingUp, MessageSquare, Megaphone, MessageCircle, CheckSquare, Target, AlarmClock, Settings, UserCog, LogOut, Bell, User, Package, Search, HandCoins, Shield, CircleHelp, AlertTriangle, Ban } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useCompany } from '@/contexts/CompanyContext';
import GlobalSearch from '@/components/GlobalSearch';
import { DateTimeDisplay } from '@/components/DateTimeDisplay';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { CompanySwitcher } from '@/components/CompanySwitcher';
import { useToast } from '@/hooks/use-toast';
import { useTierNavigationSettings } from '@/hooks/useTierNavigationSettings';

type CompanyType = 'construction' | 'design_professional';

const navigationCategories = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    companyTypes: ['construction', 'design_professional'] as CompanyType[],
    items: [
      { name: "Dashboard", href: "/", menuKey: "dashboard", employeeHidden: true },
    ],
    collapsible: false,
  },
  {
    title: "Construction",
    icon: HardHat,
      companyTypes: ['construction'] as CompanyType[],
      items: [
        { name: "Dashboard", href: "/construction/dashboard", menuKey: "jobs" },
        { name: "Jobs", href: "/jobs", menuKey: "jobs" },
        { name: "Subcontracts", href: "/subcontracts", menuKey: "vendors", companyTypes: ['construction'] as CompanyType[] },
        { name: "RFPs & Bids", href: "/construction/rfps", menuKey: "jobs" },
        { name: "Submittals", href: "/construction/submittals", menuKey: "jobs" },
        { name: "Purchase Orders", href: "/purchase-orders", menuKey: "vendors", companyTypes: ['construction'] as CompanyType[] },
        { name: "Reports", href: "/construction/reports", menuKey: "jobs" },
      ],
    collapsible: true,
  },
  {
    title: "Receipts",
    icon: Receipt,
    companyTypes: ['construction'] as CompanyType[],
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
    companyTypes: ['construction'] as CompanyType[],
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
    companyTypes: ['construction'] as CompanyType[],
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
    title: "Employees",
    icon: Users,
    companyTypes: ['construction'] as CompanyType[],
    items: [
      { name: "All Employees", href: "/employees", menuKey: "employees" },
      { name: "Punch Clock", href: "/punch-clock/dashboard", menuKey: "punch-clock-dashboard", featureKey: "punch_clock_app" },
      { name: "Payroll", href: "/employees/payroll", menuKey: "employees" },
      { name: "Performance", href: "/employees/performance", menuKey: "employees" },
      { name: "Reports", href: "/employees/reports", menuKey: "employees" },
    ],
    collapsible: true,
  },
  {
    title: "Messaging",
    icon: MessageSquare,
    companyTypes: ['construction', 'design_professional'] as CompanyType[],
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
    companyTypes: ['construction', 'design_professional'] as CompanyType[],
    items: [
      { name: "All Tasks", href: "/tasks", menuKey: "jobs" },
      { name: "Project Tasks", href: "/tasks/projects", menuKey: "jobs" },
      { name: "Deadlines", href: "/tasks/deadlines", menuKey: "jobs" },
    ],
    collapsible: true,
  },
  {
    title: "Calendar",
    icon: Calendar,
    companyTypes: ['construction', 'design_professional'] as CompanyType[],
    items: [
      { name: "Calendar", href: "/calendar", menuKey: "dashboard" },
    ],
    collapsible: false,
  },
  {
    title: "Banking",
    icon: Building,
    companyTypes: ['construction'] as CompanyType[],
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
    title: "Company Files",
    icon: FolderArchive,
    companyTypes: ['construction', 'design_professional'] as CompanyType[],
    items: [
      { name: "All Documents", href: "/company-files", menuKey: "company-files" },
      { name: "Jobs", href: "/company-files/jobs", menuKey: "company-files" },
      { name: "User Dropbox", href: "/company-files/dropbox", menuKey: "company-files" },
    ],
    collapsible: true,
  },
  {
    title: "Settings",
    icon: Settings,
    companyTypes: ['construction', 'design_professional'] as CompanyType[],
    items: [
      { name: "Super Admin Dashboard", href: "/super-admin", menuKey: "settings", superAdminOnly: true },
      { name: "Organization Management", href: "/settings/organization-management", menuKey: "organization-management", ownerOnly: true, featureKey: "organization_management" },
      { name: "Company Settings", href: "/settings/company", menuKey: "company-settings" },
      { name: "Data & Security", href: "/settings/security", menuKey: "security-settings" },
      { name: "User Management", href: "/settings/users", menuKey: "user-settings" },
      { name: "PunchClock Link", href: "/punch-clock/settings", menuKey: "punch-clock-settings", featureKey: "punch_clock_app", mobileAppBadge: true },
      { name: "PM Lynk", href: "/settings/pm-lynk", menuKey: "pm-lynk-settings", featureKey: "pm_lynk", mobileAppBadge: true },
      { name: "Subscription", href: "/subscription", menuKey: "subscription-settings", ownerOnly: true },
    ],
    collapsible: true,
  },
];

const designProfessionalNavigationCategories = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    companyTypes: ['design_professional'] as CompanyType[],
    items: [
      { name: "Dashboard", href: "/design-professional/dashboard", menuKey: "dashboard" },
    ],
    collapsible: false,
  },
  {
    title: "Jobs",
    icon: Briefcase,
    companyTypes: ['design_professional'] as CompanyType[],
    items: [
      { name: "All Jobs", href: "/design-professional/jobs", menuKey: "jobs" },
      { name: "RFIs", href: "/design-professional/jobs/rfis", menuKey: "jobs" },
      { name: "Submittals", href: "/design-professional/jobs/submittals", menuKey: "jobs" },
    ],
    collapsible: true,
  },
  {
    title: "Company Files",
    icon: FolderArchive,
    companyTypes: ['design_professional'] as CompanyType[],
    items: [
      { name: "All Documents", href: "/design-professional/company-files", menuKey: "company-files" },
      { name: "Jobs", href: "/design-professional/company-files/jobs", menuKey: "company-files" },
      { name: "User Dropbox", href: "/design-professional/company-files/dropbox", menuKey: "company-files" },
    ],
    collapsible: true,
  },
  {
    title: "Settings",
    icon: Settings,
    companyTypes: ['design_professional'] as CompanyType[],
    items: [
      { name: "Company Settings", href: "/design-professional/settings/company", menuKey: "company-settings" },
      { name: "User Management", href: "/design-professional/settings/users", menuKey: "user-settings" },
      { name: "Subscription", href: "/design-professional/subscription", menuKey: "subscription-settings", ownerOnly: true },
    ],
    collapsible: true,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const { tenantMember, isSuperAdmin } = useTenant();
  const { currentCompany, refreshCompanies } = useCompany();
  const { hasAccess, loading } = useMenuPermissions();
  const { toast } = useToast();
  const { showLockedMenuItems, lockedMenuUpgradeMessage } = useTierNavigationSettings();
  const [openGroups, setOpenGroups] = useState<string[]>(["Dashboard"]);
  const [uploadingSidebarLogo, setUploadingSidebarLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const profileRole = String(profile?.role || '').trim().toLowerCase();
  const effectiveRole = String(tenantMember?.role || profile?.role || '').trim().toLowerCase();
  const isExternalUser = profileRole === 'vendor' || profileRole === 'design_professional';
  const companyType: CompanyType = currentCompany?.company_type === 'design_professional' ? 'design_professional' : 'construction';
  const isDesignProfessionalRoute = location.pathname.startsWith('/design-professional');
  const isDesignProfessionalWorkspace =
    isDesignProfessionalRoute ||
    companyType === 'design_professional' ||
    profileRole === 'design_professional';
  const sidebarCategories = isDesignProfessionalWorkspace
    ? designProfessionalNavigationCategories
    : navigationCategories;
  const canUploadDesignProLogo = isDesignProfessionalWorkspace
    && !currentCompany?.logo_url
    && ['owner', 'admin', 'company_admin'].includes(effectiveRole);

  const handleSidebarLogoUpload = async (file?: File | null) => {
    if (!file || !currentCompany?.id || !canUploadDesignProLogo) return;
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please choose an image file for your logo.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploadingSidebarLogo(true);
      const ext = file.name.split('.').pop() || 'png';
      const objectPath = `${currentCompany.id}/design-pro-logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(objectPath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const storagePath = `company-logos/${objectPath}`;
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: storagePath })
        .eq('id', currentCompany.id);
      if (updateError) throw updateError;

      await refreshCompanies();
      toast({
        title: 'Logo updated',
        description: 'Your Design Pro logo has been saved.',
      });
    } catch (error: any) {
      console.error('Failed to upload Design Pro sidebar logo:', error);
      toast({
        title: 'Upload failed',
        description: error?.message || 'Could not upload your logo.',
        variant: 'destructive',
      });
    } finally {
      setUploadingSidebarLogo(false);
    }
  };

  const isItemRouteActive = (item: { href: string }, categoryTitle?: string) => {
    const pathnameMatch =
      location.pathname === item.href ||
      location.pathname.startsWith(item.href + '/');

    // Keep Construction open when on job/subcontract/PO pages
    const constructionDetailMatch =
      categoryTitle === 'Construction' &&
      ((item.href === '/jobs' && location.pathname.startsWith('/jobs/')) ||
        (item.href === '/subcontracts' && location.pathname.startsWith('/subcontracts/')) ||
        (item.href === '/purchase-orders' && location.pathname.startsWith('/purchase-orders/')));

    // Keep Payables open when on vendor pages
    const payablesDetailMatch =
      categoryTitle === 'Payables' &&
      item.href === '/vendors' &&
      location.pathname.startsWith('/vendors/');

    return pathnameMatch || constructionDetailMatch || payablesDetailMatch;
  };

  const toggleGroup = (groupTitle: string) => {
    // Dashboard doesn't expand - just navigate
    const dashboardCategory = sidebarCategories.find(cat => cat.title === "Dashboard");
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

  const activeGroups = sidebarCategories
    .filter(category => 
      category.items.some(item => isItemRouteActive(item, category.title))
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
        <div className="relative flex items-center justify-center p-2 min-h-[60px] w-full">
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
          {!currentCompany?.logo_url && !canUploadDesignProLogo && (
            <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          )}
          {currentCompany?.logo_url && (
            <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center hidden">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          )}
          {canUploadDesignProLogo && (
            <>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleSidebarLogoUpload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="absolute inset-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 transition-colors hover:bg-primary/10"
              >
                {uploadingSidebarLogo ? (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-xs font-medium text-primary">Uploading...</span>
                  </div>
                ) : (
                  <div className="relative flex h-full items-center justify-center">
                    <div className="absolute left-1 top-1/2 -translate-y-1/2">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="-mt-1 text-center">
                      <span className="block text-[11px] font-medium leading-tight text-primary">
                        Click Here To
                      </span>
                      <span className="block text-[11px] font-medium leading-tight text-primary">
                        Upload Your Logo
                      </span>
                    </div>
                  </div>
                )}
              </button>
            </>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="gap-0 sidebar-scroll-area">
        {!loading && sidebarCategories.filter((category) => {
          if (isDesignProfessionalWorkspace) return true;
          if (!isExternalUser) return true;
          if (profileRole === 'vendor') {
            return category.title === 'Dashboard';
          }
          return false;
        }).filter((category: any) => {
          const allowedTypes = (category.companyTypes as CompanyType[] | undefined) || ['construction', 'design_professional'];
          return allowedTypes.includes(companyType);
        }).map((category) => {
          const isDashboard = category.title === "Dashboard";
          const isDirectLink = !category.collapsible;
          
           // Filter items based on permissions and role
           const visibleItems = category.items.flatMap((item) => {
             const itemAllowedTypes = ((item as any).companyTypes as CompanyType[] | undefined) || ['construction', 'design_professional'];
             if (!itemAllowedTypes.includes(companyType)) return [];
             const superAdminOnly = 'superAdminOnly' in item && !!(item as any).superAdminOnly;
             if (superAdminOnly && !isSuperAdmin) return [];

              const ownerOnly = 'ownerOnly' in item && !!(item as any).ownerOnly;
              if (ownerOnly && tenantMember?.role !== 'owner' && !isSuperAdmin) return [];

             const employeeHidden = 'employeeHidden' in item && !!(item as any).employeeHidden;
             if (employeeHidden && effectiveRole === 'employee') return [];

             if (isDesignProfessionalWorkspace) {
               // Design Professional workspace uses its own dedicated nav model.
               return [{ ...(item as any), _locked: false }];
             }

             const menuKey = ('menuKey' in item ? (item as any).menuKey : undefined) as string | undefined;
             const allowed = !menuKey || hasAccess(menuKey);
             if (allowed) return [{ ...(item as any), _locked: false }];
             if (showLockedMenuItems && menuKey && !superAdminOnly && !ownerOnly) {
               return [{ ...(item as any), _locked: true }];
             }
             return [];
           });
          
          // Don't show category if no items are allowed
          if (visibleItems.length === 0) return null;
          
          return (
            <SidebarGroup key={category.title}>
              {isDirectLink ? (
                // Direct links (Dashboard, Vendors, Jobs) render without collapsible
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map((item) => {
                      const isActive = isItemRouteActive(item, category.title);
                      const isLocked = !!(item as any)._locked;
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton 
                            asChild={!isLocked}
                            isActive={isActive}
                            tooltip={state === "collapsed" ? category.title : undefined}
                            style={
                              isLocked
                                ? { opacity: 0.5 }
                                : isActive
                                ? { backgroundColor: `hsl(${settings.customColors.primary})`, color: 'white', fontWeight: 'bold' }
                                : {}
                            }
                            className={isActive ? "hover:opacity-95" : "sidebar-highlight-hover transition-colors duration-150"}
                          >
                            {isLocked ? (
                              <button
                                type="button"
                                className="flex w-full items-center"
                                onClick={() =>
                                  toast({
                                    title: 'Feature locked',
                                    description: lockedMenuUpgradeMessage,
                                  })
                                }
                              >
                                <category.icon className="h-4 w-4" />
                                <span className="flex items-center gap-1">
                                  {category.title}
                                  <Ban className="h-3 w-3" />
                                </span>
                              </button>
                            ) : (
                              <Link to={item.href}>
                                <category.icon className="h-4 w-4" />
                                <span>{category.title}</span>
                              </Link>
                            )}
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
                         className="w-full justify-between p-2 h-8 text-xs font-medium text-sidebar-foreground/70 sidebar-highlight-hover hover:text-sidebar-foreground transition-colors duration-150 group-data-[collapsible=icon]:justify-center"
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
                          <SidebarMenu className={allOpenGroups.includes(category.title) ? "sidebar-highlight-bg rounded-md p-1" : ""}>
                            {(() => {
                              // Determine the single most specific active item within this category
                              const matches = visibleItems.filter((itm: any) => isItemRouteActive(itm, category.title));
                              const activeItemHref = matches.length
                                ? matches.reduce((longest, curr) => (curr.href.length > longest.length ? curr.href : longest), matches[0].href)
                                : "";

                              return visibleItems.map((item: any) => {
                                const isActive = item.href === activeItemHref;
                                const isLocked = !!item._locked;
                                return (
                                  <SidebarMenuItem key={item.name}>
                                    <SidebarMenuButton
                                      asChild={!isLocked}
                                      isActive={isActive}
                                      tooltip={state === "collapsed" ? item.name : undefined}
                                      style={
                                        isLocked
                                          ? { opacity: 0.5 }
                                          : isActive
                                          ? { backgroundColor: `hsl(${settings.customColors.primary})`, color: 'white', fontWeight: 'bold' }
                                          : {}
                                      }
                                      className={isActive ? "hover:opacity-95" : "sidebar-highlight-hover transition-colors duration-150"}
                                    >
                                      {isLocked ? (
                                        <button
                                          type="button"
                                          className="w-full text-left"
                                          onClick={() =>
                                            toast({
                                              title: 'Feature locked',
                                              description: lockedMenuUpgradeMessage,
                                            })
                                          }
                                        >
                                          <span className="ml-2 flex items-center gap-2">
                                            <span>{item.name}</span>
                                            <Ban className="h-3 w-3" />
                                            {('mobileAppBadge' in item && (item as any).mobileAppBadge) && (
                                              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                                                Mobile App
                                              </span>
                                            )}
                                          </span>
                                        </button>
                                      ) : (
                                        <Link to={item.href}>
                                          <span className="ml-2 flex items-center gap-2">
                                            <span>{item.name}</span>
                                            {('mobileAppBadge' in item && (item as any).mobileAppBadge) && (
                                              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                                                Mobile App
                                              </span>
                                            )}
                                          </span>
                                        </Link>
                                      )}
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
    </Sidebar>
  );
}

export default function Layout() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const effectiveRole = String(profile?.role || '').trim().toLowerCase();
  const isExternalUser = effectiveRole === 'vendor' || effectiveRole === 'design_professional';
  const isPunchClockPage = location.pathname === '/time-tracking';
  const [impersonationMode, setImpersonationMode] = useState(false);

  // NOTE: Super admins can access both the Super Admin Dashboard and company dashboards.
  // No automatic redirect – they navigate manually via Settings > Super Admin Dashboard.
  // Note: useDynamicManifest is NOT used here - it only runs on Punch Clock/PM Mobile routes
  // to prevent the main app favicon from being replaced
  useEffect(() => {
    setImpersonationMode(window.sessionStorage.getItem('builderlynk_impersonation_mode') === '1');
  }, [location.pathname]);

  const handleSignOut = async () => {
    window.sessionStorage.removeItem('builderlynk_impersonation_mode');
    await signOut();
  };

  const handleExitImpersonation = async () => {
    window.sessionStorage.removeItem('builderlynk_impersonation_mode');
    await signOut();
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="animate-fade-in h-screen overflow-hidden flex flex-col">
          {!isPunchClockPage && (
            <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
              <div className="flex items-center gap-2 flex-1">
                <SidebarTrigger className="-ml-1" />
                <div className="flex-1 max-w-lg">
                  <GlobalSearch />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link to="/settings/help" className="flex items-center gap-1.5">
                    <CircleHelp className="h-4 w-4" />
                    Help
                  </Link>
                </Button>
                {!isExternalUser && <CompanySwitcher />}
                <DateTimeDisplay />
                <Button asChild variant="ghost" className="flex items-center gap-2 h-8 px-2">
                  <Link to="/profile-settings">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url as string}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                    <span className="text-sm font-medium max-w-[160px] truncate">{profile?.display_name || 'User'}</span>
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSignOut}
                  className="h-8 w-8 p-0"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </header>
          )}
          {impersonationMode && (
            <div className="z-30 border-b border-yellow-800 bg-yellow-300/90 px-4 py-2 text-sm font-medium text-yellow-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Warning: You are in an impersonated troubleshooting session. Changes here affect the live organization.
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={handleExitImpersonation} className="h-7 border-yellow-900 text-yellow-950 hover:bg-yellow-400">
                Exit
              </Button>
            </div>
          )}
          <div className="flex-1 overflow-auto min-h-0">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
