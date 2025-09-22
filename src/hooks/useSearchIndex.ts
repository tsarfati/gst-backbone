import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface SearchIndexItem {
  id: string;
  title: string;
  description: string;
  type: 'receipt' | 'job' | 'vendor' | 'employee' | 'announcement' | 'page';
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

      // Add static pages
      const staticPages = [
        { title: 'Dashboard', description: 'Main dashboard overview', path: '/', tags: ['page', 'dashboard'] },
        { title: 'Upload Receipts', description: 'Upload and manage receipt documents', path: '/upload', tags: ['page', 'receipts'] },
        { title: 'Uncoded Receipts', description: 'Process uncoded receipts', path: '/uncoded-receipts', tags: ['page', 'receipts'] },
        { title: 'Coded Receipts', description: 'View coded receipts', path: '/coded-receipts', tags: ['page', 'receipts'] },
        { title: 'Time Tracking', description: 'Employee time tracking system', path: '/time-tracking', tags: ['page', 'time'] },
        { title: 'Time Sheets', description: 'View employee time sheets', path: '/timesheets', tags: ['page', 'time'] },
        { title: 'Cost Codes', description: 'Manage project cost codes', path: '/cost-codes', tags: ['page', 'codes'] },
        { title: 'Bills', description: 'Manage vendor bills', path: '/bills', tags: ['page', 'bills'] },
        { title: 'Jobs', description: 'Manage construction jobs', path: '/jobs', tags: ['page', 'projects'] },
        { title: 'Vendors', description: 'Manage vendor relationships', path: '/vendors', tags: ['page', 'vendors'] },
        { title: 'All Employees', description: 'Employee management', path: '/employees', tags: ['page', 'employees'] },
        { title: 'Announcements', description: 'Company announcements', path: '/announcements', tags: ['page', 'announcements'] },
        { title: 'All Messages', description: 'Internal messaging system', path: '/messages', tags: ['page', 'messages'] },
        { title: 'Team Chat', description: 'Team communication', path: '/team-chat', tags: ['page', 'chat'] },
        { title: 'Payment History', description: 'Payment transaction history', path: '/payment-history', tags: ['page', 'payments'] },
        { title: 'Payment Reports', description: 'Payment analytics and reports', path: '/payment-reports', tags: ['page', 'reports'] },
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