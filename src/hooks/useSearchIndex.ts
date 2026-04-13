import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  type: 'receipt' | 'job' | 'vendor' | 'employee' | 'announcement' | 'page' | 'action' | 'report' | 'task' | 'bill' | 'ar_invoice' | 'customer' | 'payment' | 'credit_card_transaction' | 'subcontract' | 'purchase_order';
  path: string;
  content?: string;
  tags?: string[];
  updatedAt: string;
}

const formatCurrencyVariants = (value: number | string | null | undefined) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return [] as string[];

  const fixed = numeric.toFixed(2);
  const whole = Math.round(numeric).toString();
  const localized = numeric.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const localizedWhole = numeric.toLocaleString('en-US', { maximumFractionDigits: 0 });

  return Array.from(new Set([
    fixed,
    whole,
    localized,
    localizedWhole,
    `$${fixed}`,
    `$${localized}`,
  ]));
};

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/[^a-z0-9.\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
  const hydratedIndexKeyRef = useRef<string | null>(null);

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

      if (hasAccess('bills')) {
        const { data: bills, error: billsError } = await supabase
          .from('invoices')
          .select('id, invoice_number, amount, due_date, status, job_id, vendor_id, vendors(name)')
          .eq('company_id', currentCompany.id)
          .order('created_at', { ascending: false })
          .limit(500);

        if (billsError) {
          console.error('Error fetching bills for search:', billsError);
        } else {
          ((bills || []) as any[])
            .filter((bill) => !hasScopedJobAccess || allowedJobIds.has(String(bill.job_id || '')))
            .forEach((bill) => {
              const amountTokens = formatCurrencyVariants(bill.amount);
              const vendorName = String((bill.vendors as any)?.name || '').trim();
              newIndex.push({
                id: `bill-${bill.id}`,
                title: bill.invoice_number || `Bill ${bill.id}`,
                description: [vendorName, bill.status ? `• ${String(bill.status).replace(/_/g, ' ')}` : '', amountTokens[amountTokens.length - 1] ? `• ${amountTokens[amountTokens.length - 1]}` : '']
                  .filter(Boolean)
                  .join(' '),
                type: 'bill',
                path: `/invoices/${bill.id}`,
                content: [
                  bill.invoice_number,
                  vendorName,
                  bill.status,
                  bill.due_date,
                  ...amountTokens,
                ].filter(Boolean).join(' '),
                tags: ['bill', 'invoice', 'payable', ...(vendorName ? ['vendor'] : [])],
                updatedAt: bill.due_date || new Date().toISOString(),
              });
            });
        }
      }

      if (hasAccess('receivables')) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('id, name, contact_person, email, phone, city, state, updated_at')
          .eq('company_id', currentCompany.id)
          .order('name');

        if (customersError) {
          console.error('Error fetching customers for search:', customersError);
        } else {
          ((customers || []) as any[]).forEach((customer) => {
            newIndex.push({
              id: `customer-${customer.id}`,
              title: customer.name,
              description: [customer.contact_person ? `Contact: ${customer.contact_person}` : '', customer.city ? `• ${customer.city}` : '', customer.state ? `, ${customer.state}` : '']
                .join(' ')
                .trim(),
              type: 'customer',
              path: `/receivables/customers/${customer.id}`,
              content: [
                customer.name,
                customer.contact_person,
                customer.email,
                customer.phone,
                customer.city,
                customer.state,
              ].filter(Boolean).join(' '),
              tags: ['customer', 'receivables'],
              updatedAt: customer.updated_at || new Date().toISOString(),
            });
          });
        }

        const { data: arInvoices, error: arInvoicesError } = await supabase
          .from('ar_invoices')
          .select('id, invoice_number, total_amount, balance_due, status, due_date, issue_date, job_id, customer:customers(name)')
          .eq('company_id', currentCompany.id)
          .order('issue_date', { ascending: false })
          .limit(500);

        if (arInvoicesError) {
          console.error('Error fetching AR invoices for search:', arInvoicesError);
        } else {
          ((arInvoices || []) as any[])
            .filter((invoice) => !hasScopedJobAccess || allowedJobIds.has(String(invoice.job_id || '')))
            .forEach((invoice) => {
              const totalTokens = formatCurrencyVariants(invoice.total_amount);
              const balanceTokens = formatCurrencyVariants(invoice.balance_due);
              const customerName = String((invoice.customer as any)?.name || '').trim();
              newIndex.push({
                id: `ar-invoice-${invoice.id}`,
                title: invoice.invoice_number || `AR Invoice ${invoice.id}`,
                description: [customerName, invoice.status ? `• ${String(invoice.status).replace(/_/g, ' ')}` : '', totalTokens[totalTokens.length - 1] ? `• ${totalTokens[totalTokens.length - 1]}` : '']
                  .filter(Boolean)
                  .join(' '),
                type: 'ar_invoice',
                path: `/receivables/invoices/${invoice.id}`,
                content: [
                  invoice.invoice_number,
                  customerName,
                  invoice.status,
                  invoice.due_date,
                  invoice.issue_date,
                  ...totalTokens,
                  ...balanceTokens.map((token) => `balance ${token}`),
                ].filter(Boolean).join(' '),
                tags: ['receivables', 'invoice', 'ar', ...(customerName ? ['customer'] : [])],
                updatedAt: invoice.issue_date || new Date().toISOString(),
              });
            });
        }
      }

      if (hasAccess('payment-history')) {
        const { data: vendorRows, error: vendorRowsError } = await supabase
          .from('vendors')
          .select('id, name')
          .eq('company_id', currentCompany.id);

        if (vendorRowsError) {
          console.error('Error fetching vendors for payment search:', vendorRowsError);
        }

        const vendorNameById = new Map<string, string>(
          ((vendorRows || []) as any[]).map((vendor) => [String(vendor.id), String(vendor.name || '')]),
        );
        const vendorIds = Array.from(vendorNameById.keys());

        if (vendorIds.length > 0) {
          const { data: paymentRows, error: paymentRowsError } = await supabase
            .from('payments')
            .select('id, payment_number, amount, payment_date, payment_method, status, memo, reference_number, vendor_id')
            .in('vendor_id', vendorIds)
            .order('payment_date', { ascending: false })
            .limit(500);

          if (paymentRowsError) {
            console.error('Error fetching payments for search:', paymentRowsError);
          } else {
            ((paymentRows || []) as any[]).forEach((payment) => {
              const amountTokens = formatCurrencyVariants(payment.amount);
              const vendorName = vendorNameById.get(String(payment.vendor_id || '')) || '';
              newIndex.push({
                id: `payment-${payment.id}`,
                title: payment.payment_number || payment.reference_number || `Payment ${payment.id}`,
                description: [vendorName, payment.status ? `• ${String(payment.status).replace(/_/g, ' ')}` : '', amountTokens[amountTokens.length - 1] ? `• ${amountTokens[amountTokens.length - 1]}` : '']
                  .filter(Boolean)
                  .join(' '),
                type: 'payment',
                path: `/receivables/payments/${payment.id}`,
                content: [
                  payment.payment_number,
                  payment.reference_number,
                  payment.memo,
                  payment.payment_method,
                  payment.status,
                  payment.payment_date,
                  vendorName,
                  ...amountTokens,
                ].filter(Boolean).join(' '),
                tags: ['payment', 'receivables', 'cash'],
                updatedAt: payment.payment_date || new Date().toISOString(),
              });
            });
          }
        }
      }

      if (hasAccess('banking-credit-cards')) {
        const { data: cardRows, error: cardRowsError } = await supabase
          .from('credit_cards')
          .select('id, card_name, company_id')
          .eq('company_id', currentCompany.id);

        if (cardRowsError) {
          console.error('Error fetching credit cards for search:', cardRowsError);
        }

        const cardNameById = new Map<string, string>(
          ((cardRows || []) as any[]).map((card) => [String(card.id), String(card.card_name || '')]),
        );
        const cardIds = Array.from(cardNameById.keys());

        if (cardIds.length > 0) {
          const { data: ccRows, error: ccRowsError } = await supabase
            .from('credit_card_transactions')
            .select('id, credit_card_id, transaction_date, description, merchant_name, amount, status, reference_number, job_id')
            .in('credit_card_id', cardIds)
            .order('transaction_date', { ascending: false })
            .limit(500);

          if (ccRowsError) {
            console.error('Error fetching credit card transactions for search:', ccRowsError);
          } else {
            ((ccRows || []) as any[])
              .filter((transaction) => !hasScopedJobAccess || !transaction.job_id || allowedJobIds.has(String(transaction.job_id)))
              .forEach((transaction) => {
                const amountTokens = formatCurrencyVariants(transaction.amount);
                const cardName = cardNameById.get(String(transaction.credit_card_id || '')) || '';
                newIndex.push({
                  id: `credit-card-transaction-${transaction.id}`,
                  title: transaction.merchant_name || transaction.description || `Transaction ${transaction.id}`,
                  description: [cardName, transaction.status ? `• ${String(transaction.status).replace(/_/g, ' ')}` : '', amountTokens[amountTokens.length - 1] ? `• ${amountTokens[amountTokens.length - 1]}` : '']
                    .filter(Boolean)
                    .join(' '),
                  type: 'credit_card_transaction',
                  path: `/payables/credit-cards/${transaction.credit_card_id}/transactions?transactionId=${encodeURIComponent(String(transaction.id))}`,
                  content: [
                    transaction.description,
                    transaction.merchant_name,
                    transaction.reference_number,
                    transaction.status,
                    transaction.transaction_date,
                    cardName,
                    ...amountTokens,
                  ].filter(Boolean).join(' '),
                  tags: ['credit card', 'transaction', 'expense'],
                  updatedAt: transaction.transaction_date || new Date().toISOString(),
                });
              });
          }
        }
      }

      if (hasAccess('vendors')) {
        const { data: subcontracts, error: subcontractsError } = await supabase
          .from('subcontracts')
          .select('id, subcontract_number, title, contract_amount, status, vendor_id, job_id, vendors(name)')
          .eq('company_id', currentCompany.id)
          .order('created_at', { ascending: false })
          .limit(500);

        if (subcontractsError) {
          console.error('Error fetching subcontracts for search:', subcontractsError);
        } else {
          ((subcontracts || []) as any[])
            .filter((subcontract) => !hasScopedJobAccess || !subcontract.job_id || allowedJobIds.has(String(subcontract.job_id)))
            .forEach((subcontract) => {
              const amountTokens = formatCurrencyVariants(subcontract.contract_amount);
              const vendorName = String((subcontract.vendors as any)?.name || '').trim();
              newIndex.push({
                id: `subcontract-${subcontract.id}`,
                title: subcontract.subcontract_number || subcontract.title || `Subcontract ${subcontract.id}`,
                description: [vendorName, subcontract.status ? `• ${String(subcontract.status).replace(/_/g, ' ')}` : '', amountTokens[amountTokens.length - 1] ? `• ${amountTokens[amountTokens.length - 1]}` : '']
                  .filter(Boolean)
                  .join(' '),
                type: 'subcontract',
                path: `/subcontracts/${subcontract.id}`,
                content: [
                  subcontract.subcontract_number,
                  subcontract.title,
                  subcontract.status,
                  vendorName,
                  ...amountTokens,
                ].filter(Boolean).join(' '),
                tags: ['subcontract', 'contract', 'committed cost'],
                updatedAt: new Date().toISOString(),
              });
            });
        }

        const { data: poRows, error: poRowsError } = await supabase
          .from('purchase_orders')
          .select('id, po_number, title, total_amount, status, vendor_id, job_id, vendors(name)')
          .eq('company_id', currentCompany.id)
          .order('created_at', { ascending: false })
          .limit(500);

        if (poRowsError) {
          console.error('Error fetching purchase orders for search:', poRowsError);
        } else {
          ((poRows || []) as any[])
            .filter((po) => !hasScopedJobAccess || !po.job_id || allowedJobIds.has(String(po.job_id)))
            .forEach((po) => {
              const amountTokens = formatCurrencyVariants(po.total_amount);
              const vendorName = String((po.vendors as any)?.name || '').trim();
              newIndex.push({
                id: `purchase-order-${po.id}`,
                title: po.po_number || po.title || `Purchase Order ${po.id}`,
                description: [vendorName, po.status ? `• ${String(po.status).replace(/_/g, ' ')}` : '', amountTokens[amountTokens.length - 1] ? `• ${amountTokens[amountTokens.length - 1]}` : '']
                  .filter(Boolean)
                  .join(' '),
                type: 'purchase_order',
                path: `/purchase-orders/${po.id}`,
                content: [
                  po.po_number,
                  po.title,
                  po.status,
                  vendorName,
                  ...amountTokens,
                ].filter(Boolean).join(' '),
                tags: ['purchase order', 'po', 'committed cost'],
                updatedAt: new Date().toISOString(),
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

      if (hasAccess('jobs')) {
        const { data: taskRows, error: taskError } = await supabase
          .from('tasks')
          .select('id, title, description, updated_at, job_id')
          .eq('company_id', currentCompany.id)
          .order('updated_at', { ascending: false });

        if (taskError) {
          console.error('Error fetching tasks for search:', taskError);
        } else {
          const visibleTasks = ((taskRows || []) as any[]).filter((task) =>
            !hasScopedJobAccess || allowedJobIds.has(String(task.job_id || '')),
          );

          const taskIds = visibleTasks.map((task) => String(task.id));
          const { data: taskTagRows, error: taskTagError } = taskIds.length > 0
            ? await supabase
                .from('task_comment_tags' as any)
                .select('task_id, tag')
                .in('task_id', taskIds)
            : { data: [] as any[], error: null };

          if (taskTagError) {
            console.error('Error fetching task tags for search:', taskTagError);
          }

          const taskTagMap = new Map<string, string[]>();
          ((taskTagRows || []) as any[]).forEach((row) => {
            const taskId = String(row.task_id || '');
            const tag = String(row.tag || '').trim().toLowerCase();
            if (!taskId || !tag) return;
            const existing = taskTagMap.get(taskId) || [];
            if (!existing.includes(tag)) existing.push(tag);
            taskTagMap.set(taskId, existing);
          });

          visibleTasks.forEach((task: any) => {
            const tags = taskTagMap.get(String(task.id)) || [];
            newIndex.push({
              id: `task-${task.id}`,
              title: task.title,
              description: task.description || 'Task',
              type: 'task',
              path: `/tasks/${task.id}`,
              content: [task.title, task.description, ...tags.map((tag) => `#${tag}`)].filter(Boolean).join(' '),
              tags: ['task', ...tags],
              updatedAt: task.updated_at || new Date().toISOString(),
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
    const normalizedLooseQuery = normalizeSearchValue(query);
    return indexedItems
      .filter(item => 
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.content?.toLowerCase().includes(normalizedQuery) ||
        item.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery)) ||
        (normalizedLooseQuery.length > 0 && (
          normalizeSearchValue(item.title).includes(normalizedLooseQuery) ||
          normalizeSearchValue(item.description).includes(normalizedLooseQuery) ||
          normalizeSearchValue(item.content || '').includes(normalizedLooseQuery) ||
          item.tags?.some(tag => normalizeSearchValue(tag).includes(normalizedLooseQuery))
        ))
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
    if (hydratedIndexKeyRef.current === indexKey) return;

    hydratedIndexKeyRef.current = indexKey;
    const saved = localStorage.getItem(indexKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SearchIndexItem[];
        setIndexedItems(parsed);
        return;
      } catch {}
    }

    buildSearchIndex();
  }, [user, permissionsLoading, indexKey, buildSearchIndex]);

  return {
    isIndexing,
    indexedItems,
    buildSearchIndex,
    searchItems
  };
}
