import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
  const [indexedItems, setIndexedItems] = useState<SearchIndexItem[]>(() => {
    const saved = localStorage.getItem('search-index');
    return saved ? JSON.parse(saved) : [];
  });
  const { user } = useAuth();
  const { toast } = useToast();

  const buildSearchIndex = useCallback(async () => {
    if (!user) return;
    
    setIsIndexing(true);
    const newIndex: SearchIndexItem[] = [];

    try {
      // Index vendors
      const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .eq('company_id', user.id)
        .eq('is_active', true);

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

      // Index jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('created_by', user.id);

      if (jobsError) {
        console.error('Error fetching jobs for search:', jobsError);
      } else {
        jobs?.forEach(job => {
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

      // Index employees/profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'approved'); // Only index approved users

      if (profilesError) {
        console.error('Error fetching profiles for search:', profilesError);
      } else {
        profiles?.forEach(profile => {
          newIndex.push({
            id: `employee-${profile.id}`,
            title: profile.display_name || `${profile.first_name} ${profile.last_name}`,
            description: `Role: ${profile.role}`,
            type: 'employee',
            path: `/employees/${profile.user_id}`,
            content: [profile.display_name, profile.first_name, profile.last_name, profile.role].filter(Boolean).join(' '),
            tags: ['employee', 'user'],
            updatedAt: profile.updated_at
          });
        });
      }

      // Add quick actions
      const quickActions = [
        { title: 'Add Bill', description: 'Create a new vendor bill', path: '/invoices/add', tags: ['action', 'add', 'bill', 'invoice', 'create'] },
        { title: 'Add Job', description: 'Create a new construction job', path: '/jobs/add', tags: ['action', 'add', 'job', 'project', 'create'] },
        { title: 'Add Vendor', description: 'Add a new vendor', path: '/vendors/add', tags: ['action', 'add', 'vendor', 'create'] },
        { title: 'Add Employee', description: 'Add a new employee', path: '/employees/add', tags: ['action', 'add', 'employee', 'create'] },
        { title: 'Upload Receipt', description: 'Upload a new receipt', path: '/upload', tags: ['action', 'upload', 'receipt', 'add'] },
        { title: 'Make Payment', description: 'Process a payment', path: '/payables/make-payment', tags: ['action', 'payment', 'pay'] },
        { title: 'Reconcile', description: 'Reconcile bank account', path: '/banking/accounts', tags: ['action', 'reconcile', 'banking', 'bank'] },
        { title: 'Add Subcontract', description: 'Create a new subcontract', path: '/subcontracts/add', tags: ['action', 'add', 'subcontract', 'create'] },
        { title: 'Add Purchase Order', description: 'Create a new purchase order', path: '/purchase-orders/add', tags: ['action', 'add', 'po', 'purchase order', 'create'] },
        { title: 'Print Checks', description: 'Print payment checks', path: '/banking/print-checks', tags: ['action', 'print', 'check', 'payment'] },
        { title: 'Add Bank Account', description: 'Add a new bank account', path: '/banking/accounts/add', tags: ['action', 'add', 'bank', 'account', 'create'] },
      ];

      quickActions.forEach(action => {
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
        { title: 'Receipt Reports', description: 'View receipt analytics and reports', path: '/receipts/reports', tags: ['report', 'receipts', 'analytics'] },
        { title: 'Payment Reports', description: 'View payment analytics and reports', path: '/bills/payment-reports', tags: ['report', 'payment', 'analytics'] },
        { title: 'Construction Reports', description: 'View construction job reports', path: '/construction/reports', tags: ['report', 'construction', 'jobs'] },
        { title: 'Employee Reports', description: 'View employee analytics and reports', path: '/employees/reports', tags: ['report', 'employees', 'hr'] },
        { title: 'Timecard Reports', description: 'View timecard reports', path: '/timecards/reports', tags: ['report', 'timecard', 'time tracking'] },
        { title: 'Banking Reports', description: 'View banking and financial reports', path: '/banking/reports', tags: ['report', 'banking', 'financial'] },
        { title: 'Job Reports', description: 'View job-specific reports', path: '/jobs/reports', tags: ['report', 'job', 'project'] },
        { title: 'Vendor Reports', description: 'View vendor analytics and reports', path: '/vendors/reports', tags: ['report', 'vendor', 'analytics'] },
      ];

      reports.forEach(report => {
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
        { title: 'Dashboard', description: 'Main dashboard overview', path: '/', tags: ['page', 'dashboard'] },
        { title: 'Upload Receipts', description: 'Upload and manage receipt documents', path: '/upload', tags: ['page', 'receipts'] },
        { title: 'Uncoded Receipts', description: 'Process uncoded receipts', path: '/uncoded', tags: ['page', 'receipts'] },
        { title: 'Coded Receipts', description: 'View coded receipts', path: '/receipts', tags: ['page', 'receipts'] },
        { title: 'Punch Clock', description: 'Employee time tracking system', path: '/punch-clock/dashboard', tags: ['page', 'time'] },
        { title: 'Time Sheets', description: 'View employee time sheets', path: '/timesheets', tags: ['page', 'time'] },
        { title: 'Cost Codes', description: 'Manage project cost codes', path: '/cost-codes', tags: ['page', 'codes'] },
        { title: 'Bills', description: 'Manage vendor bills', path: '/invoices', tags: ['page', 'bills'] },
        { title: 'Jobs', description: 'Manage construction jobs', path: '/jobs', tags: ['page', 'projects'] },
        { title: 'Vendors', description: 'Manage vendor relationships', path: '/vendors', tags: ['page', 'vendors'] },
        { title: 'All Employees', description: 'Employee management', path: '/employees', tags: ['page', 'employees'] },
        { title: 'Announcements', description: 'Company announcements', path: '/announcements', tags: ['page', 'announcements'] },
        { title: 'All Messages', description: 'Internal messaging system', path: '/messages', tags: ['page', 'messages'] },
        { title: 'Team Chat', description: 'Team communication', path: '/team-chat', tags: ['page', 'chat'] },
        { title: 'Payment History', description: 'Payment transaction history', path: '/bills/payments', tags: ['page', 'payments'] },
        { title: 'Bank Accounts', description: 'Manage bank accounts', path: '/banking/accounts', tags: ['page', 'banking'] },
        { title: 'Settings', description: 'Application settings', path: '/settings', tags: ['page', 'settings'] },
      ];

      staticPages.forEach(page => {
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
      localStorage.setItem('search-index', JSON.stringify(newIndex));
      
      toast({
        title: 'Search Index Updated',
        description: `Indexed ${newIndex.length} items successfully`,
      });
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
  }, [user, toast]);

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

  return {
    isIndexing,
    indexedItems,
    buildSearchIndex,
    searchItems
  };
}