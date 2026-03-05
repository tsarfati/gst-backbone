import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { useTenant } from '@/contexts/TenantContext';

export interface SearchIndexItem {
  id: string;
  title: string;
  description: string;
  type: 'receipt' | 'job' | 'vendor' | 'employee' | 'announcement' | 'page' | 'action' | 'report';
  path: string;
  content?: string;
  tags?: string[];
  updatedAt: string;
}

export function useSearchIndex() {
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexedItems, setIndexedItems] = useState<SearchIndexItem[]>([]);
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { hasAccess, loading: permissionsLoading } = useMenuPermissions();
  const activeCompanyRole = useActiveCompanyRole();
  const { isSuperAdmin } = useTenant();
  const effectiveRole = String(activeCompanyRole || profile?.role || '').toLowerCase();
  const isExternalUser = effectiveRole === 'vendor' || effectiveRole === 'design_professional';
  const isPrivileged =
    isSuperAdmin ||
    effectiveRole === 'admin' ||
    effectiveRole === 'company_admin' ||
    effectiveRole === 'controller';

  const indexKey = useMemo(
    () => `search-index:${currentCompany?.id || 'default'}:${user?.id || 'anon'}:${effectiveRole || 'none'}`,
    [currentCompany?.id, user?.id, effectiveRole]
  );

  const buildSearchIndex = useCallback(async () => {
    if (!user || !currentCompany || permissionsLoading) return;
    
    setIsIndexing(true);
    const newIndex: SearchIndexItem[] = [];
    const allowedJobIds = new Set<string>();
    const hasScopedJobAccess = !isPrivileged && !isExternalUser && !(profile as any)?.has_global_job_access;

    try {
      if (hasScopedJobAccess) {
        const { data: jobAccessRows, error: jobAccessError } = await supabase
          .from('user_job_access')
          .select('job_id')
          .eq('user_id', user.id);
        if (jobAccessError) {
          console.error('Error fetching user job access for search:', jobAccessError);
        } else {
          (jobAccessRows || []).forEach((row: any) => {
            if (row?.job_id) allowedJobIds.add(String(row.job_id));
          });
        }
      }

      // Vendor/design professional users should only search their portal surface.
      if (isExternalUser) {
        const externalPages = [
          { title: 'Dashboard', description: 'Vendor portal dashboard', path: effectiveRole === 'design_professional' ? '/design-professional/dashboard' : '/vendor/dashboard', tags: ['page', 'dashboard'] },
          { title: 'Compliance', description: 'Compliance and documents', path: '/vendor/compliance', tags: ['page', 'compliance'] },
          { title: 'Profile Settings', description: 'Manage your profile and notifications', path: '/profile-settings', tags: ['page', 'profile', 'settings'] },
        ];

        externalPages.forEach(page => {
          newIndex.push({
            id: `page-${page.path.replace(/\//g, '-')}`,
            title: page.title,
            description: page.description,
            type: 'page',
            path: page.path,
            content: `${page.title} ${page.description}`,
            tags: page.tags,
            updatedAt: new Date().toISOString()
          });
        });

        // Include only the logged-in vendor entity, if linked.
        if ((profile as any)?.vendor_id) {
          const { data: vendor, error: vendorError } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', (profile as any).vendor_id)
            .eq('company_id', currentCompany.id)
            .maybeSingle();
          if (!vendorError && vendor) {
            newIndex.push({
              id: `vendor-${vendor.id}`,
              title: vendor.name,
              description: `${vendor.contact_person ? `Contact: ${vendor.contact_person}` : ''} ${vendor.city ? `• ${vendor.city}` : ''}`,
              type: 'vendor',
              path: `/vendors/${vendor.id}`,
              content: [vendor.name, vendor.contact_person, vendor.email, vendor.phone, vendor.address, vendor.city, vendor.state, vendor.notes].filter(Boolean).join(' '),
              tags: ['vendor', 'company'],
              updatedAt: vendor.updated_at
            });
          }
        }

        setIndexedItems(newIndex);
        localStorage.setItem(indexKey, JSON.stringify(newIndex));
        return;
      }

      // Index vendors
      if (hasAccess('vendors')) {
        const { data: vendors, error: vendorsError } = await supabase
          .from('vendors')
          .select('*')
          .eq('is_active', true)
          .eq('company_id', currentCompany.id);

        if (vendorsError) {
          console.error('Error fetching vendors for search:', vendorsError);
        } else {
          vendors?.forEach(vendor => {
            newIndex.push({
              id: `vendor-${vendor.id}`,
              title: vendor.name,
              description: `${vendor.contact_person ? `Contact: ${vendor.contact_person}` : ''} ${vendor.city ? `• ${vendor.city}` : ''}`,
              type: 'vendor',
              path: `/vendors/${vendor.id}`,
              content: [vendor.name, vendor.contact_person, vendor.email, vendor.phone, vendor.address, vendor.city, vendor.state, vendor.notes].filter(Boolean).join(' '),
              tags: ['vendor', 'company'],
              updatedAt: vendor.updated_at
            });
          });
        }
      }

      // Index jobs
      if (hasAccess('jobs')) {
        const { data: jobs, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true);

        if (jobsError) {
          console.error('Error fetching jobs for search:', jobsError);
        } else {
          jobs
            ?.filter((job: any) => !hasScopedJobAccess || allowedJobIds.has(String(job.id)))
            .forEach(job => {
              newIndex.push({
                id: `job-${job.id}`,
                title: job.name,
                description: `${job.client ? `Client: ${job.client}` : ''} ${job.status ? `• Status: ${job.status}` : ''} ${job.budget ? `• Budget: $${job.budget}` : ''}`,
                type: 'job',
                path: `/jobs/${job.id}`,
                content: [job.name, job.client, job.address, job.description, job.status].filter(Boolean).join(' '),
                tags: ['job', 'project'],
                updatedAt: job.updated_at
              });
            });
        }
      }

      // Index employees/profiles
      if (hasAccess('employees')) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .eq('status', 'approved'); // Only index approved users

        if (profilesError) {
          console.error('Error fetching profiles for search:', profilesError);
        } else {
          profiles?.forEach(profileRow => {
            newIndex.push({
              id: `employee-${profileRow.id}`,
              title: profileRow.display_name || `${profileRow.first_name} ${profileRow.last_name}`,
              description: `Role: ${profileRow.role}`,
              type: 'employee',
              path: `/employees/${profileRow.user_id}`,
              content: [profileRow.display_name, profileRow.first_name, profileRow.last_name, profileRow.role].filter(Boolean).join(' '),
              tags: ['employee', 'user'],
              updatedAt: profileRow.updated_at
            });
          });
        }
      }

      // Add quick actions
      const quickActions = [
        { title: 'Add Bill', description: 'Create a new vendor bill', path: '/invoices/add', tags: ['action', 'add', 'bill', 'invoice', 'create'], menuKey: 'bills' },
        { title: 'Add Job', description: 'Create a new construction job', path: '/jobs/add', tags: ['action', 'add', 'job', 'project', 'create'], menuKey: 'jobs' },
        { title: 'Add Vendor', description: 'Add a new vendor', path: '/vendors/add', tags: ['action', 'add', 'vendor', 'create'], menuKey: 'vendors' },
        { title: 'Add Employee', description: 'Add a new employee', path: '/employees/add', tags: ['action', 'add', 'employee', 'create'], menuKey: 'employees' },
        { title: 'Upload Receipt', description: 'Upload a new receipt', path: '/upload', tags: ['action', 'upload', 'receipt', 'add'], menuKey: 'receipts' },
        { title: 'Make Payment', description: 'Process a payment', path: '/payables/make-payment', tags: ['action', 'payment', 'pay'], menuKey: 'make-payment' },
        { title: 'Add Subcontract', description: 'Create a new subcontract', path: '/subcontracts/add', tags: ['action', 'add', 'subcontract', 'create'], menuKey: 'vendors' },
        { title: 'Add Purchase Order', description: 'Create a new purchase order', path: '/purchase-orders/add', tags: ['action', 'add', 'po', 'purchase order', 'create'], menuKey: 'vendors' },
        { title: 'Print Checks', description: 'Print payment checks', path: '/banking/print-checks', tags: ['action', 'print', 'check', 'payment'], menuKey: 'print-checks' },
        { title: 'Add Bank Account', description: 'Add a new bank account', path: '/banking/accounts/add', tags: ['action', 'add', 'bank', 'account', 'create'], menuKey: 'banking-accounts' },
      ];

      quickActions
        .filter(action => hasAccess(action.menuKey))
        .forEach(action => {
        newIndex.push({
          id: `action-${action.path.replace(/\//g, '-')}`,
          title: action.title,
          description: action.description,
          type: 'action',
          path: action.path,
          content: `${action.title} ${action.description}`,
          tags: action.tags,
          updatedAt: new Date().toISOString()
        });
      });

      // Add reports
      const reports = [
        { title: 'Receipt Reports', description: 'View receipt analytics and reports', path: '/receipts/reports', tags: ['report', 'receipts', 'analytics'], menuKey: 'reports' },
        { title: 'Payment Reports', description: 'View payment analytics and reports', path: '/bills/payment-reports', tags: ['report', 'payment', 'analytics'], menuKey: 'payment-reports' },
        { title: 'Construction Reports', description: 'View construction job reports', path: '/construction/reports', tags: ['report', 'construction', 'jobs'], menuKey: 'jobs' },
        { title: 'Employee Reports', description: 'View employee analytics and reports', path: '/employees/reports', tags: ['report', 'employees', 'hr'], menuKey: 'employees' },
        { title: 'Timecard Reports', description: 'View timecard reports', path: '/timecards/reports', tags: ['report', 'timecard', 'time tracking'], menuKey: 'timecard-reports' },
        { title: 'Banking Reports', description: 'View banking and financial reports', path: '/banking/reports', tags: ['report', 'banking', 'financial'], menuKey: 'banking-reports' },
        { title: 'Job Reports', description: 'View job-specific reports', path: '/jobs/reports', tags: ['report', 'job', 'project'], menuKey: 'jobs' },
        { title: 'Vendor Reports', description: 'View vendor analytics and reports', path: '/vendors/reports', tags: ['report', 'vendor', 'analytics'], menuKey: 'vendors' },
      ];

      reports
        .filter(report => hasAccess(report.menuKey))
        .forEach(report => {
        newIndex.push({
          id: `report-${report.path.replace(/\//g, '-')}`,
          title: report.title,
          description: report.description,
          type: 'report',
          path: report.path,
          content: `${report.title} ${report.description}`,
          tags: report.tags,
          updatedAt: new Date().toISOString()
        });
      });

      // Add static pages
      const staticPages = [
        { title: 'Dashboard', description: 'Main dashboard overview', path: '/', tags: ['page', 'dashboard'], menuKey: 'dashboard' },
        { title: 'Upload Receipts', description: 'Upload and manage receipt documents', path: '/upload', tags: ['page', 'receipts'], menuKey: 'receipts' },
        { title: 'Uncoded Receipts', description: 'Process uncoded receipts', path: '/uncoded', tags: ['page', 'receipts'], menuKey: 'receipts' },
        { title: 'Coded Receipts', description: 'View coded receipts', path: '/receipts', tags: ['page', 'receipts'], menuKey: 'receipts' },
        { title: 'Punch Clock', description: 'Employee time tracking system', path: '/punch-clock/dashboard', tags: ['page', 'time'], menuKey: 'punch-clock-dashboard' },
        { title: 'Bills', description: 'Manage vendor bills', path: '/invoices', tags: ['page', 'bills'], menuKey: 'bills' },
        { title: 'Jobs', description: 'Manage construction jobs', path: '/jobs', tags: ['page', 'projects'], menuKey: 'jobs' },
        { title: 'Vendors', description: 'Manage vendor relationships', path: '/vendors', tags: ['page', 'vendors'], menuKey: 'vendors' },
        { title: 'All Employees', description: 'Employee management', path: '/employees', tags: ['page', 'employees'], menuKey: 'employees' },
        { title: 'Announcements', description: 'Company announcements', path: '/announcements', tags: ['page', 'announcements'], menuKey: 'announcements' },
        { title: 'All Messages', description: 'Internal messaging system', path: '/messages', tags: ['page', 'messages'], menuKey: 'messages' },
        { title: 'Team Chat', description: 'Team communication', path: '/team-chat', tags: ['page', 'chat'], menuKey: 'messages' },
        { title: 'Payment History', description: 'Payment transaction history', path: '/bills/payments', tags: ['page', 'payments'], menuKey: 'payment-history' },
        { title: 'Bank Accounts', description: 'Manage bank accounts', path: '/banking/accounts', tags: ['page', 'banking'], menuKey: 'banking-accounts' },
        { title: 'Settings', description: 'Application settings', path: '/settings', tags: ['page', 'settings'], menuKey: 'settings' },
      ];

      staticPages
        .filter(page => hasAccess(page.menuKey))
        .forEach(page => {
        newIndex.push({
          id: `page-${page.path.replace(/\//g, '-')}`,
          title: page.title,
          description: page.description,
          type: 'page',
          path: page.path,
          content: `${page.title} ${page.description}`,
          tags: page.tags,
          updatedAt: new Date().toISOString()
        });
      });

      setIndexedItems(newIndex);
      localStorage.setItem(indexKey, JSON.stringify(newIndex));
      
      // silent success to avoid noisy toasts when opening search
    } catch (error) {
      console.error('Error building search index:', error);
      toast({
        title: 'Indexing Error',
        description: 'Failed to build search index',
        variant: 'destructive',
      });
    } finally {
      setIsIndexing(false);
    }
  }, [user, currentCompany?.id, permissionsLoading, isExternalUser, isPrivileged, profile, effectiveRole, hasAccess, indexKey, toast]);

  const searchItems = useCallback((query: string): SearchIndexItem[] => {
    if (!query.trim()) return [];
    
    const normalizedQuery = query.toLowerCase();
    return indexedItems
      .filter(item => 
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.content?.toLowerCase().includes(normalizedQuery) ||
        item.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery))
      )
      .sort((a, b) => {
        // Prioritize title matches
        const aTitle = a.title.toLowerCase().includes(normalizedQuery);
        const bTitle = b.title.toLowerCase().includes(normalizedQuery);
        if (aTitle && !bTitle) return -1;
        if (!aTitle && bTitle) return 1;
        
        // Then by updated date
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [indexedItems]);

  // Build index on mount if user is available and index is empty
  useEffect(() => {
    if (!user || permissionsLoading) return;
    const saved = localStorage.getItem(indexKey);
    if (saved) {
      try { setIndexedItems(JSON.parse(saved)); return; } catch {}
    }
    if (indexedItems.length === 0) {
      buildSearchIndex();
    }
  }, [user, permissionsLoading, indexKey, buildSearchIndex, indexedItems.length]);

  return {
    isIndexing,
    indexedItems,
    buildSearchIndex,
    searchItems
  };
}
