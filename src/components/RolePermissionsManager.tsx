import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Settings, ChevronDown, ChevronRight, Shield, Plus, Trash2, Copy, Pencil, LayoutDashboard, HardHat, Receipt, HandCoins, CreditCard, FolderArchive, Users, MessageSquare, CheckSquare, Building, Cog, Smartphone, SlidersHorizontal, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useTenant } from "@/contexts/TenantContext";
import { useActiveCompanyRole } from "@/hooks/useActiveCompanyRole";
import { useCompanyFeatureAccess } from "@/hooks/useCompanyFeatureAccess";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import { getRequiredFeaturesForPermission } from "@/utils/subscriptionFeatureGate";
import RoleDefaultPageSettings from './RoleDefaultPageSettings';

interface RolePermission {
  role: string;
  menu_item: string;
  can_access: boolean;
}

interface CustomRole {
  id: string;
  company_id: string;
  role_key: string;
  role_name: string;
  description: string;
  color: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CustomRolePermission {
  id: string;
  custom_role_id: string;
  menu_item: string;
  can_access: boolean;
}

interface ActionItem {
  key: string;
  label: string;
  description: string;
}

interface MenuItem {
  key: string;
  label: string;
  description: string;
  actions?: ActionItem[];
  children?: MenuItem[];
}

interface MenuCategory {
  key: string;
  label: string;
  icon: React.ElementType;
  description: string;
  items: MenuItem[];
}

interface PermissionHierarchy {
  descendantsByKey: Record<string, string[]>;
  ancestorsByKey: Record<string, string[]>;
}

type ToggleVisualState = 'off' | 'partial' | 'on';

// Comprehensive menu structure matching the sidebar exactly
const menuCategories: MenuCategory[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Main application dashboard',
    items: [
      { 
        key: 'dashboard', 
        label: 'Dashboard', 
        description: 'Main dashboard overview',
        actions: [
          { key: 'dashboard-view', label: 'View Dashboard', description: 'Access main dashboard' },
        ]
      },
    ],
  },
  {
    key: 'construction',
    label: 'Construction',
    icon: HardHat,
    description: 'Construction project management',
    items: [
      { 
        key: 'construction-dashboard', 
        label: 'Dashboard', 
        description: 'Construction dashboard overview',
        actions: [
          { key: 'construction-dashboard-view', label: 'View Dashboard', description: 'Access construction dashboard' },
        ]
      },
      { 
        key: 'jobs', 
        label: 'Jobs', 
        description: 'View and manage construction jobs',
        actions: [
          { key: 'jobs-view', label: 'View Jobs', description: 'Access job list' },
          { key: 'jobs-add', label: 'Add Jobs', description: 'Create new jobs' },
          { key: 'jobs-edit', label: 'Edit Jobs', description: 'Modify job details' },
          { key: 'jobs-delete', label: 'Delete Jobs', description: 'Remove jobs' },
        ]
        ,
        children: [
          {
            key: 'jobs-tab-details',
            label: 'Job Details Tab',
            description: 'Job information and overview tab',
            actions: [
              { key: 'jobs-view-details', label: 'View', description: 'Open job details and read overview information' },
              { key: 'jobs-edit-details', label: 'Edit', description: 'Edit job information and metadata' },
            ]
          },
          {
            key: 'jobs-tab-committed-costs',
            label: 'Committed Costs Tab',
            description: 'Committed costs and commitments',
            actions: [
              { key: 'jobs-view-committed-costs', label: 'View', description: 'See committed costs tab and totals' },
              { key: 'jobs-edit-committed-costs', label: 'Edit', description: 'Create/edit commitments and related entries' },
            ]
          },
          {
            key: 'jobs-tab-budget',
            label: 'Cost Codes & Budget Tab',
            description: 'Budget and cost code management',
            actions: [
              { key: 'jobs-view-budget', label: 'View', description: 'Read cost codes and budget tab' },
              { key: 'jobs-edit-budget', label: 'Edit', description: 'Edit cost codes, budget values, and setup' },
            ]
          },
          {
            key: 'jobs-tab-forecasting',
            label: 'Forecasting Tab',
            description: 'Forecasting and projections',
            actions: [
              { key: 'jobs-view-forecasting', label: 'View', description: 'Read forecasting tab and projections' },
              { key: 'jobs-edit-forecasting', label: 'Edit', description: 'Modify forecasting values and assumptions' },
            ]
          },
          {
            key: 'jobs-tab-plans',
            label: 'Plans Tab',
            description: 'Plans and sheets',
            actions: [
              { key: 'jobs-view-plans', label: 'View Plans', description: 'Open plans tab and plan viewer' },
              { key: 'jobs-upload-plans', label: 'Upload Plans', description: 'Upload plan sheets and plan documents' },
              { key: 'jobs-delete-plans', label: 'Delete Plans', description: 'Delete uploaded plans' },
            ]
          },
          {
            key: 'jobs-tab-rfis',
            label: 'RFIs Tab',
            description: 'RFIs and responses',
            actions: [
              { key: 'jobs-view-rfis', label: 'View RFIs', description: 'Read RFIs and attachments' },
              { key: 'jobs-create-rfis', label: 'Create RFIs', description: 'Create new RFIs' },
              { key: 'jobs-edit-rfis', label: 'Edit RFIs', description: 'Edit RFIs, statuses, and responses' },
              { key: 'jobs-delete-rfis', label: 'Delete RFIs', description: 'Delete RFIs' },
            ]
          },
          {
            key: 'jobs-tab-billing',
            label: 'Billing Tab',
            description: 'SOV and draw billing workflow',
            actions: [
              { key: 'jobs-view-billing', label: 'View Billing', description: 'View SOV, draws, and billing tab' },
              { key: 'jobs-edit-billing', label: 'Edit Billing', description: 'Edit SOV and draft draws' },
              { key: 'jobs-approve-sov', label: 'Approve SOV', description: 'Approve and lock schedule of values' },
              { key: 'jobs-create-draws', label: 'Create Draws', description: 'Create and update draw invoices from job billing' },
              { key: 'jobs-send-draws', label: 'Send Draws', description: 'Submit draws for review/approval' },
            ]
          },
          {
            key: 'jobs-tab-photos',
            label: 'Photos Tab',
            description: 'Job photo albums and photos',
            children: [
              {
                key: 'jobs-tab-photos-albums',
                label: 'Albums',
                description: 'Photo album controls',
                actions: [
                  { key: 'jobs-photos-view-albums', label: 'View Albums', description: 'View photo albums and album list' },
                  { key: 'jobs-photos-create-albums', label: 'Create Albums', description: 'Create photo albums' },
                  { key: 'jobs-photos-edit-albums', label: 'Edit Albums', description: 'Rename/reorganize albums' },
                  { key: 'jobs-photos-delete-albums', label: 'Delete Albums', description: 'Delete photo albums' },
                  { key: 'jobs-photos-access-jobsitelynk', label: 'Access JobSiteLYNK', description: 'Open linked JobSiteLYNK access from photo albums when connected' },
                ]
              },
              {
                key: 'jobs-tab-photos-photos',
                label: 'Photos',
                description: 'Photo item controls',
                actions: [
                  { key: 'jobs-view-photo-album', label: 'View Photos', description: 'Open job photos tab' },
                  { key: 'jobs-upload-photos', label: 'Upload Photos', description: 'Add photos to job photo album' },
                  { key: 'jobs-delete-photos', label: 'Delete Photos', description: 'Delete job photos' },
                  { key: 'jobs-markup-photos', label: 'Markup Photos', description: 'Annotate/markup job photos' },
                ]
              }
            ]
          },
          {
            key: 'jobs-tab-files',
            label: 'Filing Cabinet Tab',
            description: 'Job documents and file management',
            actions: [
              { key: 'jobs-view-filing-cabinet', label: 'View Files', description: 'Open job filing cabinet/documents' },
              { key: 'jobs-upload-files', label: 'Upload Files', description: 'Upload job documents and files' },
              { key: 'jobs-download-files', label: 'Download Files', description: 'Download job documents/files' },
              { key: 'jobs-share-files', label: 'Share/Email Files', description: 'Share or email job documents/files' },
              { key: 'jobs-delete-files', label: 'Delete Files', description: 'Delete job documents/files' },
            ]
          },
        ]
      },
      { 
        key: 'subcontracts', 
        label: 'Subcontracts', 
        description: 'Manage subcontractor agreements',
        actions: [
          { key: 'subcontracts-view', label: 'View Subcontracts', description: 'Access subcontract list' },
          { key: 'subcontracts-add', label: 'Add Subcontracts', description: 'Create new subcontracts' },
          { key: 'subcontracts-edit', label: 'Edit Subcontracts', description: 'Modify subcontract details' },
          { key: 'subcontracts-delete', label: 'Delete Subcontracts', description: 'Remove subcontracts' },
        ]
      },
      { 
        key: 'purchase-orders', 
        label: 'Purchase Orders', 
        description: 'Manage purchase orders',
        actions: [
          { key: 'purchase-orders-view', label: 'View POs', description: 'Access purchase order list' },
          { key: 'purchase-orders-add', label: 'Add POs', description: 'Create new purchase orders' },
          { key: 'purchase-orders-edit', label: 'Edit POs', description: 'Modify purchase orders' },
          { key: 'purchase-orders-delete', label: 'Delete POs', description: 'Remove purchase orders' },
        ]
      },
      { 
        key: 'construction-reports', 
        label: 'Reports', 
        description: 'Construction reports',
        actions: [
          { key: 'construction-reports-view', label: 'View Reports', description: 'Access construction reports' },
        ]
      },
      { 
        key: 'cost-codes', 
        label: 'Cost Codes', 
        description: 'Manage cost codes',
        actions: [
          { key: 'cost-codes-view', label: 'View Cost Codes', description: 'Access cost code list' },
          { key: 'cost-codes-add', label: 'Add Cost Codes', description: 'Create new cost codes' },
          { key: 'cost-codes-edit', label: 'Edit Cost Codes', description: 'Modify cost codes' },
          { key: 'cost-codes-delete', label: 'Delete Cost Codes', description: 'Remove cost codes' },
        ]
      },
      { 
        key: 'delivery-tickets', 
        label: 'Delivery Tickets', 
        description: 'Manage delivery tickets',
        actions: [
          { key: 'delivery-tickets-view', label: 'View Tickets', description: 'Access delivery tickets' },
          { key: 'delivery-tickets-add', label: 'Add Tickets', description: 'Create new tickets' },
          { key: 'delivery-tickets-edit', label: 'Edit Tickets', description: 'Modify tickets' },
        ]
      },
    ],
  },
  {
    key: 'receipts',
    label: 'Receipts',
    icon: Receipt,
    description: 'Receipt management',
    items: [
      { 
        key: 'receipts-upload', 
        label: 'Upload Receipts', 
        description: 'Upload receipt images',
        actions: [
          { key: 'receipts-upload-access', label: 'Upload Receipts', description: 'Upload receipt images' },
        ]
      },
      { 
        key: 'receipts-uncoded', 
        label: 'Uncoded Receipts', 
        description: 'Process uncoded receipts',
        actions: [
          { key: 'receipts-uncoded-view', label: 'View Uncoded', description: 'Access uncoded receipts' },
          { key: 'receipts-code', label: 'Code Receipts', description: 'Assign codes to receipts' },
        ]
      },
      { 
        key: 'receipts-coded', 
        label: 'Coded Receipts', 
        description: 'View processed receipts',
        actions: [
          { key: 'receipts-coded-view', label: 'View Coded', description: 'Access coded receipts' },
          { key: 'receipts-edit', label: 'Edit Receipts', description: 'Modify receipt details' },
          { key: 'receipts-delete', label: 'Delete Receipts', description: 'Remove receipts' },
        ]
      },
      { 
        key: 'receipt-reports', 
        label: 'Receipt Reports', 
        description: 'Generate receipt reports',
        actions: [
          { key: 'receipt-reports-view', label: 'View Reports', description: 'Access receipt reports' },
        ]
      },
    ],
  },
  {
    key: 'receivables',
    label: 'Receivables',
    icon: HandCoins,
    description: 'Accounts receivable management',
    items: [
      { 
        key: 'receivables-dashboard', 
        label: 'Dashboard', 
        description: 'Receivables dashboard overview',
        actions: [
          { key: 'receivables-dashboard-view', label: 'View Dashboard', description: 'Access receivables dashboard' },
        ]
      },
      { 
        key: 'customers', 
        label: 'Customers', 
        description: 'Manage customers',
        actions: [
          { key: 'customers-view', label: 'View Customers', description: 'Access customer list' },
          { key: 'customers-add', label: 'Add Customers', description: 'Create new customers' },
          { key: 'customers-edit', label: 'Edit Customers', description: 'Modify customer details' },
          { key: 'customers-delete', label: 'Delete Customers', description: 'Remove customers' },
        ]
      },
      { 
        key: 'ar-invoices', 
        label: 'Invoices', 
        description: 'Manage AR invoices',
        actions: [
          { key: 'ar-invoices-view', label: 'View Invoices', description: 'Access invoice list' },
          { key: 'ar-invoices-add', label: 'Add Invoices', description: 'Create new invoices' },
          { key: 'ar-invoices-edit', label: 'Edit Invoices', description: 'Modify invoice details' },
          { key: 'ar-invoices-delete', label: 'Delete Invoices', description: 'Remove invoices' },
        ],
        children: [
          {
            key: 'ar-invoices-tab-overview',
            label: 'Invoice Detail / Overview',
            description: 'General invoice fields and summary',
            actions: [
              { key: 'ar-invoices-view-details', label: 'View', description: 'View invoice details' },
              { key: 'ar-invoices-edit-details', label: 'Edit', description: 'Edit invoice header/details' },
            ]
          },
          {
            key: 'ar-invoices-tab-line-items',
            label: 'Line Items',
            description: 'Invoice line item controls',
            actions: [
              { key: 'ar-invoices-view-line-items', label: 'View Line Items', description: 'View invoice line items' },
              { key: 'ar-invoices-edit-line-items', label: 'Edit Line Items', description: 'Add/edit/remove invoice line items' },
            ]
          },
          {
            key: 'ar-invoices-tab-aia',
            label: 'AIA / Draw Billing',
            description: 'AIA/G702/G703 and draw actions',
            actions: [
              { key: 'ar-invoices-view-aia', label: 'View AIA', description: 'View AIA draw forms' },
              { key: 'ar-invoices-edit-aia', label: 'Edit AIA', description: 'Edit AIA draw values' },
              { key: 'ar-invoices-export-aia', label: 'Export AIA', description: 'Export AIA templates/PDFs' },
              { key: 'ar-invoices-send-review', label: 'Send for Review', description: 'Send invoice/draw for review' },
            ]
          }
        ]
      },
      { 
        key: 'ar-payments', 
        label: 'Payments', 
        description: 'Manage AR payments',
        actions: [
          { key: 'ar-payments-view', label: 'View Payments', description: 'Access payment list' },
          { key: 'ar-payments-add', label: 'Record Payments', description: 'Record new payments' },
          { key: 'ar-payments-edit', label: 'Edit Payments', description: 'Modify payment details' },
        ]
      },
      { 
        key: 'receivables-reports', 
        label: 'Reports', 
        description: 'Receivables reports',
        actions: [
          { key: 'receivables-reports-view', label: 'View Reports', description: 'Access receivables reports' },
        ]
      },
    ],
  },
  {
    key: 'payables',
    label: 'Payables',
    icon: CreditCard,
    description: 'Accounts payable management',
    items: [
      { 
        key: 'payables-dashboard', 
        label: 'Payables Dashboard', 
        description: 'Payables overview and analytics',
        actions: [
          { key: 'payables-dashboard-view', label: 'View Dashboard', description: 'Access payables dashboard' },
        ]
      },
      { 
        key: 'vendors', 
        label: 'Vendors', 
        description: 'Manage vendors',
        actions: [
          { key: 'vendors-view', label: 'View Vendors', description: 'Access vendor list' },
          { key: 'vendors-add', label: 'Add Vendors', description: 'Create new vendors' },
          { key: 'vendors-edit', label: 'Edit Vendors', description: 'Modify vendor details' },
          { key: 'vendors-delete', label: 'Delete Vendors', description: 'Remove vendors' },
        ]
      },
      { 
        key: 'bills', 
        label: 'Bills', 
        description: 'Manage bills',
        actions: [
          { key: 'bills-view', label: 'View Bills', description: 'Access bill list' },
          { key: 'bills-add', label: 'Add Bills', description: 'Create new bills' },
          { key: 'bills-edit', label: 'Edit Bills', description: 'Modify bill details' },
          { key: 'bills-delete', label: 'Delete Bills', description: 'Remove bills' },
          { key: 'bills-approve', label: 'Approve Bills', description: 'Approve bills for payment' },
          { key: 'financial-view-unassigned', label: 'View Jobless Financials', description: 'View financial records that are not assigned to any job yet' },
        ]
      },
      { 
        key: 'banking-credit-cards', 
        label: 'Credit Cards', 
        description: 'Credit card management',
        actions: [
          { key: 'credit-cards-view', label: 'View Credit Cards', description: 'Access credit card list' },
          { key: 'credit-cards-add', label: 'Add Credit Cards', description: 'Add new credit cards' },
          { key: 'credit-cards-edit', label: 'Edit Credit Cards', description: 'Modify credit card details' },
          { key: 'credit-cards-transactions', label: 'View Transactions', description: 'View credit card transactions' },
          { key: 'credit-cards-code', label: 'Code Transactions', description: 'Code credit card transactions' },
        ]
      },
      { 
        key: 'make-payment', 
        label: 'Make Payment', 
        description: 'Process payments',
        actions: [
          { key: 'make-payment-access', label: 'Make Payments', description: 'Process vendor payments' },
        ]
      },
      { 
        key: 'payment-history', 
        label: 'Payment History', 
        description: 'View payment records',
        actions: [
          { key: 'payment-history-view', label: 'View History', description: 'Access payment history' },
        ]
      },
      { 
        key: 'payment-reports', 
        label: 'Bill Reports', 
        description: 'Payment and bill reports',
        actions: [
          { key: 'payment-reports-view', label: 'View Reports', description: 'Access bill/payment reports' },
        ]
      },
    ],
  },
  {
    key: 'company-files',
    label: 'Company Files',
    icon: FolderArchive,
    description: 'Company document management',
    items: [
      { 
        key: 'company-files', 
        label: 'All Documents', 
        description: 'View all company documents',
        actions: [
          { key: 'company-files-view', label: 'View Files', description: 'Access company files' },
          { key: 'company-files-upload', label: 'Upload Files', description: 'Upload new files' },
          { key: 'company-files-download', label: 'Download Files', description: 'Download company files' },
          { key: 'company-files-share', label: 'Share/Email Files', description: 'Share or email company files' },
          { key: 'company-files-delete', label: 'Delete Files', description: 'Remove files' },
        ]
      },
      { 
        key: 'company-contracts', 
        label: 'Contracts', 
        description: 'View company contracts',
        actions: [
          { key: 'company-contracts-view', label: 'View Contracts', description: 'Access contracts' },
          { key: 'company-contracts-add', label: 'Add Contracts', description: 'Add new contracts' },
          { key: 'company-contracts-edit', label: 'Edit Contracts', description: 'Modify contracts' },
        ]
      },
      { 
        key: 'company-permits', 
        label: 'Permits', 
        description: 'View company permits',
        actions: [
          { key: 'company-permits-view', label: 'View Permits', description: 'Access permits' },
          { key: 'company-permits-add', label: 'Add Permits', description: 'Add new permits' },
          { key: 'company-permits-edit', label: 'Edit Permits', description: 'Modify permits' },
        ]
      },
      { 
        key: 'company-insurance', 
        label: 'Insurance', 
        description: 'View insurance policies',
        actions: [
          { key: 'company-insurance-view', label: 'View Insurance', description: 'Access insurance policies' },
          { key: 'company-insurance-add', label: 'Add Insurance', description: 'Add new policies' },
          { key: 'company-insurance-edit', label: 'Edit Insurance', description: 'Modify policies' },
        ]
      },
    ],
  },
  {
    key: 'employees',
    label: 'Employees',
    icon: Users,
    description: 'Employee management',
    items: [
      { 
        key: 'employees', 
        label: 'All Employees', 
        description: 'View employee directory',
        actions: [
          { key: 'employees-view', label: 'View Employees', description: 'Access employee list' },
          { key: 'employees-add', label: 'Add Employees', description: 'Create new employees' },
          { key: 'employees-edit', label: 'Edit Employees', description: 'Modify employee details' },
          { key: 'employees-delete', label: 'Delete Employees', description: 'Remove employees' },
        ]
      },
      { 
        key: 'punch-clock-dashboard', 
        label: 'Time Tracking', 
        description: 'Employee time clock system',
        actions: [
          { key: 'punch-clock-dashboard-view', label: 'View Dashboard', description: 'Access time tracking dashboard' },
          { key: 'punch-clock-manage', label: 'Manage Punches', description: 'Edit/approve time entries' },
        ]
      },
      { 
        key: 'timesheets', 
        label: 'Timesheets', 
        description: 'Review employee timesheets',
        actions: [
          { key: 'timesheets-view', label: 'View Timesheets', description: 'Access timesheets' },
          { key: 'timesheets-edit', label: 'Edit Timesheets', description: 'Modify timesheet entries' },
          { key: 'timesheets-approve', label: 'Approve Timesheets', description: 'Approve timesheets' },
        ]
      },
      { 
        key: 'timecard-reports', 
        label: 'Timecard Reports', 
        description: 'Generate timecard reports',
        actions: [
          { key: 'timecard-reports-view', label: 'View Reports', description: 'Access timecard reports' },
        ]
      },
      { 
        key: 'employees-payroll', 
        label: 'Payroll', 
        description: 'Employee payroll',
        actions: [
          { key: 'employees-payroll-view', label: 'View Payroll', description: 'Access payroll data' },
          { key: 'employees-payroll-edit', label: 'Edit Payroll', description: 'Modify payroll settings' },
        ]
      },
      { 
        key: 'employees-performance', 
        label: 'Performance', 
        description: 'Employee performance tracking',
        actions: [
          { key: 'employees-performance-view', label: 'View Performance', description: 'Access performance data' },
        ]
      },
      { 
        key: 'employees-reports', 
        label: 'Reports', 
        description: 'Employee reports',
        actions: [
          { key: 'employees-reports-view', label: 'View Reports', description: 'Access employee reports' },
        ]
      },
    ],
  },
  {
    key: 'messaging',
    label: 'Messaging',
    icon: MessageSquare,
    description: 'Internal communication',
    items: [
      { 
        key: 'messages', 
        label: 'All Messages', 
        description: 'Internal messaging system',
        actions: [
          { key: 'messages-view', label: 'View Messages', description: 'Access messages' },
          { key: 'messages-send', label: 'Send Messages', description: 'Send new messages' },
        ]
      },
      { 
        key: 'team-chat', 
        label: 'Team Chat', 
        description: 'Team communication',
        actions: [
          { key: 'team-chat-access', label: 'Access Team Chat', description: 'Use team chat' },
        ]
      },
      { 
        key: 'announcements', 
        label: 'Announcements', 
        description: 'Company announcements',
        actions: [
          { key: 'announcements-view', label: 'View Announcements', description: 'Access announcements' },
          { key: 'announcements-create', label: 'Create Announcements', description: 'Post new announcements' },
        ]
      },
    ],
  },
  {
    key: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    description: 'Task management',
    items: [
      { 
        key: 'tasks', 
        label: 'All Tasks', 
        description: 'View all tasks',
        actions: [
          { key: 'tasks-view', label: 'View Tasks', description: 'Access task list' },
          { key: 'tasks-add', label: 'Add Tasks', description: 'Create new tasks' },
          { key: 'tasks-edit', label: 'Edit Tasks', description: 'Modify tasks' },
          { key: 'tasks-delete', label: 'Delete Tasks', description: 'Remove tasks' },
        ]
      },
      { 
        key: 'project-tasks', 
        label: 'Project Tasks', 
        description: 'Project-specific tasks',
        actions: [
          { key: 'project-tasks-view', label: 'View Project Tasks', description: 'Access project tasks' },
        ]
      },
      { 
        key: 'task-deadlines', 
        label: 'Deadlines', 
        description: 'Task deadlines',
        actions: [
          { key: 'task-deadlines-view', label: 'View Deadlines', description: 'Access deadline calendar' },
        ]
      },
    ],
  },
  {
    key: 'banking',
    label: 'Banking',
    icon: Building,
    description: 'Banking and accounting',
    items: [
      { 
        key: 'banking-accounts', 
        label: 'Bank Accounts', 
        description: 'View bank accounts',
        actions: [
          { key: 'banking-accounts-view', label: 'View Accounts', description: 'Access bank account list' },
          { key: 'banking-accounts-add', label: 'Add Accounts', description: 'Add new bank accounts' },
          { key: 'banking-accounts-edit', label: 'Edit Accounts', description: 'Modify bank accounts' },
        ]
      },
      { 
        key: 'chart-of-accounts', 
        label: 'Chart of Accounts', 
        description: 'Manage chart of accounts',
        actions: [
          { key: 'chart-of-accounts-view', label: 'View Accounts', description: 'Access chart of accounts' },
          { key: 'chart-of-accounts-add', label: 'Add Accounts', description: 'Create new accounts' },
          { key: 'chart-of-accounts-edit', label: 'Edit Accounts', description: 'Modify accounts' },
        ]
      },
      { 
        key: 'journal-entries', 
        label: 'Journal Entries', 
        description: 'View accounting entries',
        actions: [
          { key: 'journal-entries-view', label: 'View Entries', description: 'Access journal entries' },
          { key: 'journal-entries-add', label: 'Add Entries', description: 'Create new entries' },
          { key: 'journal-entries-edit', label: 'Edit Entries', description: 'Modify entries' },
          { key: 'journal-entries-delete', label: 'Delete Entries', description: 'Remove entries' },
        ]
      },
      { 
        key: 'deposits', 
        label: 'Deposits', 
        description: 'Record bank deposits',
        actions: [
          { key: 'deposits-view', label: 'View Deposits', description: 'Access deposits' },
          { key: 'deposits-add', label: 'Add Deposits', description: 'Record new deposits' },
        ]
      },
      { 
        key: 'print-checks', 
        label: 'Print Checks', 
        description: 'Print payment checks',
        actions: [
          { key: 'print-checks-access', label: 'Print Checks', description: 'Print payment checks' },
        ]
      },
      { 
        key: 'reconcile', 
        label: 'Bank Reconciliation', 
        description: 'Reconcile bank statements',
        actions: [
          { key: 'reconcile-view', label: 'View Reconciliations', description: 'Access reconciliation history' },
          { key: 'reconcile-perform', label: 'Perform Reconciliation', description: 'Reconcile statements' },
        ]
      },
      { 
        key: 'banking-reports', 
        label: 'Banking Reports', 
        description: 'Banking and financial reports',
        actions: [
          { key: 'banking-reports-view', label: 'View Reports', description: 'Access banking reports' },
        ]
      },
    ],
  },
  {
    key: 'pm-lynk',
    label: 'PM Lynk (Mobile App)',
    icon: Smartphone,
    description: 'PM Lynk mobile app feature access',
    items: [
      {
        key: 'pm-lynk-messages',
        label: 'Messages',
        description: 'Messaging in PM Lynk',
        actions: [
          { key: 'pm-lynk-messages-access', label: 'Access Messages', description: 'Use messaging in PM Lynk' },
        ]
      },
      {
        key: 'pm-lynk-delivery-tickets',
        label: 'Delivery Tickets',
        description: 'Delivery tickets in PM Lynk',
        actions: [
          { key: 'pm-lynk-delivery-tickets-access', label: 'Access Delivery Tickets', description: 'View and manage delivery tickets' },
        ]
      },
      {
        key: 'pm-lynk-receipt-scanner',
        label: 'Receipt Scanner',
        description: 'Receipt scanning in PM Lynk',
        actions: [
          { key: 'pm-lynk-receipt-scanner-access', label: 'Access Receipt Scanner', description: 'Scan and upload receipts' },
        ]
      },
      {
        key: 'pm-lynk-tasks',
        label: 'Tasks',
        description: 'Task management in PM Lynk',
        actions: [
          { key: 'pm-lynk-tasks-access', label: 'Access Tasks', description: 'View and manage tasks' },
        ]
      },
      {
        key: 'pm-lynk-safety',
        label: 'Safety',
        description: 'Safety documents in PM Lynk',
        actions: [
          { key: 'pm-lynk-safety-access', label: 'Access Safety', description: 'View safety documents and checklists' },
        ]
      },
      {
        key: 'pm-lynk-directory',
        label: 'Directory',
        description: 'Project team directory in PM Lynk',
        actions: [
          { key: 'pm-lynk-directory-access', label: 'Access Directory', description: 'View project team directory' },
        ]
      },
      {
        key: 'pm-lynk-bill-coding',
        label: 'Bill Coding',
        description: 'Bill coding in PM Lynk (typically PM only)',
        actions: [
          { key: 'pm-lynk-bill-coding-access', label: 'Access Bill Coding', description: 'Code and manage bills in PM Lynk' },
        ]
      },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: Cog,
    description: 'Application settings',
    items: [
      { 
        key: 'company-settings', 
        label: 'Company Settings', 
        description: 'Company configuration',
        children: [
          {
            key: 'company-settings-tab-overview',
            label: 'Overview Tab',
            description: 'Company profile, email setup, and assigned users',
            actions: [
              { key: 'company-settings-tab-overview-view', label: 'View', description: 'Open the Overview tab' },
              { key: 'company-settings-tab-overview-edit', label: 'Edit', description: 'Edit overview tab settings and company details' },
            ]
          },
          {
            key: 'company-settings-tab-payables',
            label: 'Payables Tab',
            description: 'Payables and payment settings tab',
            actions: [
              { key: 'company-settings-tab-payables-view', label: 'View', description: 'Open the Payables tab' },
              { key: 'company-settings-tab-payables-edit', label: 'Edit', description: 'Edit payables settings' },
            ],
            children: [
              {
                key: 'company-settings-tab-payables-approvals',
                label: 'Approvals',
                description: 'Payables approvals sub-tab',
                actions: [
                  { key: 'company-settings-tab-payables-approvals-view', label: 'View', description: 'Open the approvals sub-tab' },
                  { key: 'company-settings-tab-payables-approvals-edit', label: 'Edit', description: 'Edit approvals settings' },
                ]
              },
              {
                key: 'company-settings-tab-payables-defaults',
                label: 'Defaults & Rules',
                description: 'Payables defaults and rules sub-tab',
                actions: [
                  { key: 'company-settings-tab-payables-defaults-view', label: 'View', description: 'Open the defaults and rules sub-tab' },
                  { key: 'company-settings-tab-payables-defaults-edit', label: 'Edit', description: 'Edit defaults and rules settings' },
                ]
              },
              {
                key: 'company-settings-tab-payables-vendor-portal',
                label: 'Vendor Portal',
                description: 'Vendor portal payables settings sub-tab',
                actions: [
                  { key: 'company-settings-tab-payables-vendor-portal-view', label: 'View', description: 'Open the vendor portal sub-tab' },
                  { key: 'company-settings-tab-payables-vendor-portal-edit', label: 'Edit', description: 'Edit vendor portal payables settings' },
                ]
              },
              {
                key: 'company-settings-tab-payables-job-approval',
                label: 'Job Bill Approval',
                description: 'Job bill approval sub-tab',
                actions: [
                  { key: 'company-settings-tab-payables-job-approval-view', label: 'View', description: 'Open the job bill approval sub-tab' },
                  { key: 'company-settings-tab-payables-job-approval-edit', label: 'Edit', description: 'Edit job bill approval settings' },
                ]
              },
            ]
          },
          {
            key: 'company-settings-tab-jobs',
            label: 'Jobs Tab',
            description: 'Jobs settings tab',
            actions: [
              { key: 'company-settings-tab-jobs-view', label: 'View', description: 'Open the Jobs tab' },
              { key: 'company-settings-tab-jobs-edit', label: 'Edit', description: 'Edit jobs settings' },
            ],
            children: [
              {
                key: 'company-settings-tab-jobs-cost-code-setup',
                label: 'Cost Code Setup',
                description: 'Cost code setup sub-tab',
                actions: [
                  { key: 'company-settings-tab-jobs-cost-code-setup-view', label: 'View', description: 'Open the cost code setup sub-tab' },
                  { key: 'company-settings-tab-jobs-cost-code-setup-edit', label: 'Edit', description: 'Edit cost code setup' },
                ]
              },
              {
                key: 'company-settings-tab-jobs-design-professional-portal',
                label: 'Design Professional Portal',
                description: 'Design professional portal sub-tab',
                actions: [
                  { key: 'company-settings-tab-jobs-design-professional-portal-view', label: 'View', description: 'Open the design professional portal sub-tab' },
                  { key: 'company-settings-tab-jobs-design-professional-portal-edit', label: 'Edit', description: 'Edit design professional portal settings' },
                ]
              },
            ]
          },
          {
            key: 'company-settings-tab-integrations',
            label: 'Integrations Tab',
            description: 'Company integrations tab',
            actions: [
              { key: 'company-settings-tab-integrations-view', label: 'View', description: 'Open the Integrations tab' },
              { key: 'company-settings-tab-integrations-edit', label: 'Edit', description: 'Manage integration connections and settings' },
            ]
          },
          {
            key: 'company-settings-tab-receivables',
            label: 'Receivables Tab',
            description: 'Receivables settings tab',
            actions: [
              { key: 'company-settings-tab-receivables-view', label: 'View', description: 'Open the Receivables tab' },
              { key: 'company-settings-tab-receivables-edit', label: 'Edit', description: 'Edit receivables settings' },
            ]
          },
          {
            key: 'company-settings-tab-banking',
            label: 'Banking Tab',
            description: 'Banking settings tab',
            actions: [
              { key: 'company-settings-tab-banking-view', label: 'View', description: 'Open the Banking tab' },
              { key: 'company-settings-tab-banking-edit', label: 'Edit', description: 'Edit banking settings' },
            ]
          },
          {
            key: 'company-settings-tab-credit-cards',
            label: 'Credit Cards Tab',
            description: 'Credit card settings tab',
            actions: [
              { key: 'company-settings-tab-credit-cards-view', label: 'View', description: 'Open the Credit Cards tab' },
              { key: 'company-settings-tab-credit-cards-edit', label: 'Edit', description: 'Edit credit card settings' },
            ]
          },
          {
            key: 'company-settings-tab-theme',
            label: 'Themes & Appearance Tab',
            description: 'Branding and appearance tab',
            actions: [
              { key: 'company-settings-tab-theme-view', label: 'View', description: 'Open the Themes & Appearance tab' },
              { key: 'company-settings-tab-theme-edit', label: 'Edit', description: 'Edit theme and appearance settings' },
            ],
            children: [
              {
                key: 'company-settings-tab-theme-general',
                label: 'General Theme',
                description: 'General theme sub-tab',
                actions: [
                  { key: 'company-settings-tab-theme-general-view', label: 'View', description: 'Open the general theme sub-tab' },
                  { key: 'company-settings-tab-theme-general-edit', label: 'Edit', description: 'Edit general theme settings' },
                ]
              },
              {
                key: 'company-settings-tab-theme-display-operation',
                label: 'Display & Operation',
                description: 'Display and operation sub-tab',
                actions: [
                  { key: 'company-settings-tab-theme-display-operation-view', label: 'View', description: 'Open the display and operation sub-tab' },
                  { key: 'company-settings-tab-theme-display-operation-edit', label: 'Edit', description: 'Edit display and operation settings' },
                ]
              },
              {
                key: 'company-settings-tab-theme-avatars',
                label: 'Avatars',
                description: 'Avatar libraries and avatar settings sub-tab',
                actions: [
                  { key: 'company-settings-tab-theme-avatars-view', label: 'View', description: 'Open the avatars sub-tab' },
                  { key: 'company-settings-tab-theme-avatars-edit', label: 'Edit', description: 'Edit avatar libraries and settings' },
                ]
              },
            ]
          },
          {
            key: 'company-settings-tab-pdf-templates',
            label: 'PDF Templates Tab',
            description: 'PDF templates tab',
            actions: [
              { key: 'company-settings-tab-pdf-templates-view', label: 'View', description: 'Open the PDF Templates tab' },
              { key: 'company-settings-tab-pdf-templates-edit', label: 'Edit', description: 'Edit PDF template settings' },
            ]
          },
          {
            key: 'company-settings-tab-email-templates',
            label: 'Email Templates Tab',
            description: 'Email templates tab',
            actions: [
              { key: 'company-settings-tab-email-templates-view', label: 'View', description: 'Open the Email Templates tab' },
              { key: 'company-settings-tab-email-templates-edit', label: 'Edit', description: 'Edit email template settings' },
            ]
          },
        ]
      },
      { 
        key: 'organization-management', 
        label: 'Organization Management', 
        description: 'Organization and company portfolio management',
        actions: [
          { key: 'organization-management-access', label: 'Access Management', description: 'Manage organization scope and company context' },
        ]
      },
      { 
        key: 'user-settings', 
        label: 'User Management', 
        description: 'User roles and permissions',
        actions: [
          { key: 'user-settings-view', label: 'View Users', description: 'Access user list' },
          { key: 'user-settings-edit', label: 'Edit Users', description: 'Modify user roles' },
          { key: 'user-settings-edit-email', label: 'Edit User Email', description: 'Update another user account email' },
          { key: 'user-settings-change-password', label: 'Change User Password', description: 'Send password reset/change links for users' },
          { key: 'user-settings-permissions', label: 'Manage Permissions', description: 'Configure role permissions' },
        ],
        children: [
          { key: 'user-settings-tab-users', label: 'System Users Tab', description: 'System users tab' },
          { key: 'user-settings-tab-user-roles', label: 'User Roles Tab', description: 'User role assignments tab' },
          { key: 'user-settings-tab-roles', label: 'Role Definitions Tab', description: 'Role definitions and permissions tab' },
          { key: 'user-settings-tab-vendor-access', label: 'Vendor Access Tab', description: 'Vendor access tab' },
          { key: 'user-settings-tab-design-professional-access', label: 'Design Professional Access Tab', description: 'Design professional access tab' },
          { key: 'user-settings-tab-intake-queue', label: 'Intake Queue Tab', description: 'Signup intake queue tab' },
          { key: 'user-settings-tab-groups', label: 'Groups Tab', description: 'Groups tab' },
        ]
      },
      { 
        key: 'punch-clock-settings', 
        label: 'PunchClock Link Settings', 
        description: 'Punch clock mobile app settings',
        actions: [
          { key: 'punch-clock-settings-view', label: 'View Settings', description: 'Access punch clock settings' },
          { key: 'punch-clock-settings-edit', label: 'Edit Settings', description: 'Modify punch clock settings' },
        ]
      },
      { 
        key: 'pm-lynk-settings', 
        label: 'PM Lynk Settings', 
        description: 'PM Lynk mobile app settings',
        actions: [
          { key: 'pm-lynk-settings-view', label: 'View Settings', description: 'Access PM Lynk settings' },
          { key: 'pm-lynk-settings-edit', label: 'Edit Settings', description: 'Modify PM Lynk settings' },
        ]
      },
      { 
        key: 'subscription-settings', 
        label: 'Subscription', 
        description: 'Billing and subscription settings',
        actions: [
          { key: 'subscription-settings-view', label: 'View Subscription', description: 'Access subscription details' },
          { key: 'subscription-settings-edit', label: 'Manage Subscription', description: 'Modify subscription settings' },
        ]
      },
      { 
        key: 'notification-settings', 
        label: 'Notifications & Email', 
        description: 'Configure notifications',
        actions: [
          { key: 'notification-settings-view', label: 'View Settings', description: 'Access notification settings' },
          { key: 'notification-settings-edit', label: 'Edit Settings', description: 'Modify notifications' },
        ]
      },
      { 
        key: 'security-settings', 
        label: 'Data & Security', 
        description: 'Security configuration',
        actions: [
          { key: 'security-settings-view', label: 'View Settings', description: 'Access security settings' },
          { key: 'security-settings-edit', label: 'Edit Settings', description: 'Modify security settings' },
        ]
      },
    ],
  },
];

function buildPermissionHierarchy(categories: MenuCategory[]): PermissionHierarchy {
  const descendantsByKey: Record<string, string[]> = {};
  const ancestorsByKey: Record<string, string[]> = {};

  const collectItemKeys = (item: MenuItem, ancestors: string[]): string[] => {
    const keys: string[] = [item.key];
    ancestorsByKey[item.key] = ancestors;

    item.actions?.forEach((action) => {
      keys.push(action.key);
      ancestorsByKey[action.key] = [...ancestors, item.key];
      descendantsByKey[action.key] = [action.key];
    });

    item.children?.forEach((child) => {
      const childKeys = collectItemKeys(child, [...ancestors, item.key]);
      keys.push(...childKeys);
    });

    descendantsByKey[item.key] = Array.from(new Set(keys));
    return descendantsByKey[item.key];
  };

  categories.forEach((category) => {
    ancestorsByKey[category.key] = [];
    const categoryKeys: string[] = [category.key];
    category.items.forEach((item) => {
      const itemKeys = collectItemKeys(item, [category.key]);
      categoryKeys.push(...itemKeys);
    });
    descendantsByKey[category.key] = Array.from(new Set(categoryKeys));
  });

  return { descendantsByKey, ancestorsByKey };
}

const permissionHierarchy = buildPermissionHierarchy(menuCategories);

const roles = [
  { key: 'admin', label: 'Admin', color: 'bg-red-100 text-red-800', description: 'Full system access' },
  { key: 'controller', label: 'Controller', color: 'bg-blue-100 text-blue-800', description: 'Financial oversight' },
  { key: 'company_admin', label: 'Company Admin', color: 'bg-orange-100 text-orange-800', description: 'Company-wide management' },
  { key: 'project_manager', label: 'Project Manager', color: 'bg-green-100 text-green-800', description: 'Project management' },
  { key: 'employee', label: 'Employee', color: 'bg-gray-100 text-gray-800', description: 'Basic employee access' },
  { key: 'view_only', label: 'View Only', color: 'bg-purple-100 text-purple-800', description: 'Read-only access - Cannot create, edit, or delete' },
];

// Get all permission keys for migration/seeding
export function getAllPermissionKeys(): string[] {
  const keys: string[] = [];
  const collectItemKeys = (item: MenuItem) => {
    keys.push(item.key);
    item.actions?.forEach((action) => {
      keys.push(action.key);
    });
    item.children?.forEach(collectItemKeys);
  };
  menuCategories.forEach(category => {
    keys.push(category.key);
    category.items.forEach(collectItemKeys);
  });
  return keys;
}

type RolePermissionsManagerMode = 'company' | 'super_admin_system';

interface RolePermissionsManagerProps {
  mode?: RolePermissionsManagerMode;
}

export default function RolePermissionsManager({ mode = 'company' }: RolePermissionsManagerProps) {
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { isSuperAdmin } = useTenant();
  const activeCompanyRole = useActiveCompanyRole();
  const { hasAccess } = useMenuPermissions();
  const { hasFeature, loading: featureLoading } = useCompanyFeatureAccess();
  const { toast } = useToast();
  
  // Use company-specific role for admin check
  const effectiveRole = activeCompanyRole || profile?.role;
  const canManageCompanyRoles = effectiveRole === 'admin' || effectiveRole === 'company_admin' || effectiveRole === 'owner';
  const canEditSystemRoles = mode === 'super_admin_system' ? isSuperAdmin : false;
  const canViewRoleManager = mode === 'super_admin_system'
    ? isSuperAdmin
    : canManageCompanyRoles || hasAccess('user-settings-permissions') || hasAccess('user-settings-tab-roles');
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customPermissions, setCustomPermissions] = useState<CustomRolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openRoles, setOpenRoles] = useState<Record<string, boolean>>({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [openMenuItems, setOpenMenuItems] = useState<Record<string, boolean>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTargetRoleId, setRenameTargetRoleId] = useState<string | null>(null);
  const [renameRoleName, setRenameRoleName] = useState('');
  const [renameRoleKey, setRenameRoleKey] = useState('');
  const [renamingRole, setRenamingRole] = useState(false);
  const [duplicatingRoleId, setDuplicatingRoleId] = useState<string | null>(null);
  const [copySystemRoleDialogOpen, setCopySystemRoleDialogOpen] = useState(false);
  const [copySourceRole, setCopySourceRole] = useState<(typeof roles)[0] | null>(null);
  const [copyRoleName, setCopyRoleName] = useState('');
  const [copyingSystemRole, setCopyingSystemRole] = useState(false);
  const [bulkUpdatingRoleId, setBulkUpdatingRoleId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTargetRoleId, setEditTargetRoleId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('bg-indigo-100 text-indigo-800');
  const [editingRole, setEditingRole] = useState(false);
  const [newRole, setNewRole] = useState({
    role_key: '',
    role_name: '',
    description: '',
    color: 'bg-indigo-100 text-indigo-800'
  });

  const isUpgradeRequiredForPermission = (permissionKey: string): boolean => {
    const requiredFeatures = getRequiredFeaturesForPermission(permissionKey);
    if (requiredFeatures.length === 0) return false;
    if (featureLoading) return true;
    return !requiredFeatures.some((feature) => hasFeature(feature));
  };

  useEffect(() => {
    fetchPermissions();
    if (mode === 'company' && currentCompany) {
      fetchCustomRoles();
    }
  }, [currentCompany, mode]);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role')
        .order('menu_item');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch role permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomRoles = async () => {
    if (!currentCompany) return;
    
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('custom_roles')
        .select('*')
        .eq('company_id', currentCompany.id)
        .or('is_active.eq.true,is_active.is.null')
        .order('role_name');

      if (rolesError) throw rolesError;
      setCustomRoles(rolesData || []);

      if (rolesData && rolesData.length > 0) {
        const { data: permsData, error: permsError } = await supabase
          .from('custom_role_permissions')
          .select('*')
          .in('custom_role_id', rolesData.map(r => r.id));

        if (permsError) throw permsError;
        setCustomPermissions(permsData || []);
      }
    } catch (error) {
      console.error('Error fetching custom roles:', error);
    }
  };

  const updatePermission = async (
    role: string,
    menuItem: string,
    canAccess: boolean,
    cascadeChildren: boolean = false,
  ) => {
    if (!canEditSystemRoles) {
      toast({
        title: "Access Denied",
        description: "System roles are managed from the Super Admin dashboard.",
        variant: "destructive",
      });
      return;
    }

    if (role === 'admin') {
      toast({
        title: "Cannot Modify",
        description: "Admin role automatically has full system access.",
        variant: "default",
      });
      return;
    }

    if (isUpgradeRequiredForPermission(menuItem)) {
      toast({
        title: "Upgrade Required",
        description: "This permission is unavailable on the current subscription tier.",
        variant: "destructive",
      });
      return;
    }

    try {
      const updates = new Map<string, boolean>();
      const targetKeys = cascadeChildren
        ? (permissionHierarchy.descendantsByKey[menuItem] || [menuItem])
        : [menuItem];

      targetKeys.forEach((key) => updates.set(key, canAccess));

      const ancestors = permissionHierarchy.ancestorsByKey[menuItem] || [];
      const resolveState = (key: string) => {
        if (updates.has(key)) return updates.get(key) || false;
        return getPermission(role, key);
      };

      if (canAccess) {
        ancestors.forEach((ancestorKey) => updates.set(ancestorKey, true));
      } else {
        for (let index = ancestors.length - 1; index >= 0; index -= 1) {
          const ancestorKey = ancestors[index];
          const descendantKeys = (permissionHierarchy.descendantsByKey[ancestorKey] || [ancestorKey]).filter((key) => key !== ancestorKey);
          const shouldEnableAncestor = descendantKeys.some(resolveState);
          updates.set(ancestorKey, shouldEnableAncestor);
        }
      }

      for (const [permissionKey, allowed] of updates.entries()) {
        const { error } = await supabase.rpc('set_role_permission', {
          p_role: role as any,
          p_menu_item: permissionKey,
          p_can_access: allowed,
        });

        if (error) throw error;
      }

      setPermissions(prev => {
        const merged = new Map(prev.map((permission) => [`${permission.role}:${permission.menu_item}`, permission] as const));

        updates.forEach((allowed, permissionKey) => {
          const compositeKey = `${role}:${permissionKey}`;
          const existing = merged.get(compositeKey);
          if (existing) {
            merged.set(compositeKey, { ...existing, can_access: allowed });
          } else {
            merged.set(compositeKey, {
              role,
              menu_item: permissionKey,
              can_access: allowed,
            });
          }
        });

        return Array.from(merged.values());
      });

      toast({
        title: "Permission Updated",
        description: cascadeChildren
          ? `Parent and child permissions have been ${canAccess ? 'enabled' : 'disabled'}.`
          : `Permission has been ${canAccess ? 'granted' : 'revoked'}.`,
      });

    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: "Error",
        description: (error as any)?.message || "Failed to update permission.",
        variant: "destructive",
      });
    }
  };

  const getPermission = (role: string, menuItem: string): boolean => {
    if (role === 'admin') return true;
    const permission = permissions.find(p => p.role === role && p.menu_item === menuItem);
    return permission?.can_access || false;
  };

  const getCustomRolePermission = (customRoleId: string, menuItem: string): boolean => {
    const permission = customPermissions.find(p => p.custom_role_id === customRoleId && p.menu_item === menuItem);
    return permission?.can_access || false;
  };

  const updateCustomRolePermission = async (
    customRoleId: string,
    menuItem: string,
    canAccess: boolean,
    cascadeChildren: boolean = false
  ) => {
    if (isUpgradeRequiredForPermission(menuItem)) {
      toast({
        title: "Upgrade Required",
        description: "This permission is unavailable on the current subscription tier.",
        variant: "destructive",
      });
      return;
    }

    try {
      const updates = new Map<string, boolean>();
      const targetKeys = cascadeChildren
        ? (permissionHierarchy.descendantsByKey[menuItem] || [menuItem])
        : [menuItem];

      targetKeys.forEach((key) => updates.set(key, canAccess));

      const ancestors = permissionHierarchy.ancestorsByKey[menuItem] || [];
      const resolveState = (key: string) => {
        if (updates.has(key)) return updates.get(key) || false;
        return getCustomRolePermission(customRoleId, key);
      };

      if (canAccess) {
        ancestors.forEach((ancestorKey) => updates.set(ancestorKey, true));
      } else {
        for (let i = ancestors.length - 1; i >= 0; i -= 1) {
          const ancestorKey = ancestors[i];
          const descendantKeys = (permissionHierarchy.descendantsByKey[ancestorKey] || [ancestorKey]).filter((k) => k !== ancestorKey);
          const shouldEnableAncestor = descendantKeys.some(resolveState);
          updates.set(ancestorKey, shouldEnableAncestor);
        }
      }

      const { error } = await supabase
        .from('custom_role_permissions')
        .upsert(Array.from(updates.entries()).map(([permissionKey, allowed]) => ({
          custom_role_id: customRoleId,
          menu_item: permissionKey,
          can_access: allowed,
        })), {
          onConflict: 'custom_role_id,menu_item'
        });

      if (error) throw error;

      setCustomPermissions(prev => {
        const merged = new Map(prev.map((p) => [`${p.custom_role_id}:${p.menu_item}`, p] as const));

        updates.forEach((allowed, permissionKey) => {
          const compositeKey = `${customRoleId}:${permissionKey}` as `${string}:${string}`;
          const existing = merged.get(compositeKey);
          if (existing) {
            merged.set(compositeKey, { ...existing, can_access: allowed });
          } else {
            merged.set(compositeKey, {
              id: crypto.randomUUID(),
              custom_role_id: customRoleId,
              menu_item: permissionKey,
              can_access: allowed,
            });
          }
        });

        return Array.from(merged.values());
      });

      toast({
        title: "Permission Updated",
        description: `Permission has been ${canAccess ? 'granted' : 'revoked'}.`,
      });

    } catch (error) {
      console.error('Error updating custom role permission:', error);
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive",
      });
    }
  };

  const createCustomRole = async () => {
    if (mode !== 'company' || !currentCompany || !user) return;

    if (!newRole.role_key || !newRole.role_name) {
      toast({
        title: "Validation Error",
        description: "Role key and name are required",
        variant: "destructive",
      });
      return;
    }

    const sanitizedKey = newRole.role_key.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .insert({
          company_id: currentCompany.id,
          role_key: sanitizedKey,
          role_name: newRole.role_name,
          description: newRole.description,
          color: newRole.color,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCustomRoles(prev => [...prev, data]);
      setCreateDialogOpen(false);
      setNewRole({
        role_key: '',
        role_name: '',
        description: '',
        color: 'bg-indigo-100 text-indigo-800'
      });

      toast({
        title: "Role Created",
        description: `Custom role "${newRole.role_name}" has been created successfully`,
      });
    } catch (error: any) {
      console.error('Error creating custom role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create custom role",
        variant: "destructive",
      });
    }
  };

  const getUniqueRoleKey = (baseKey: string) => {
    const normalized = baseKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    let candidate = normalized;
    let suffix = 2;
    const existingKeys = new Set(customRoles.map((r) => r.role_key));
    while (existingKeys.has(candidate)) {
      candidate = `${normalized}_${suffix}`;
      suffix += 1;
    }
    return candidate;
  };

  const openRenameDialog = (role: CustomRole) => {
    setRenameTargetRoleId(role.id);
    setRenameRoleName(role.role_name);
    setRenameRoleKey(role.role_key);
    setRenameDialogOpen(true);
  };

  const openEditDialog = (role: CustomRole) => {
    setEditTargetRoleId(role.id);
    setEditDescription(role.description || '');
    setEditColor(role.color || 'bg-indigo-100 text-indigo-800');
    setEditDialogOpen(true);
  };

  const renameCustomRole = async () => {
    if (!renameTargetRoleId) return;
    const trimmedName = renameRoleName.trim();
    const sanitizedKey = renameRoleKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (!trimmedName || !sanitizedKey) {
      toast({
        title: "Validation Error",
        description: "Role name and key are required",
        variant: "destructive",
      });
      return;
    }

    const duplicateKey = customRoles.some((role) => role.id !== renameTargetRoleId && role.role_key === sanitizedKey);
    if (duplicateKey) {
      toast({
        title: "Duplicate Role Key",
        description: "That role key is already in use. Please choose another.",
        variant: "destructive",
      });
      return;
    }

    try {
      setRenamingRole(true);
      const { data, error } = await supabase
        .from('custom_roles')
        .update({
          role_name: trimmedName,
          role_key: sanitizedKey,
          is_active: true,
        })
        .eq('id', renameTargetRoleId)
        .select()
        .single();

      if (error) throw error;

      setCustomRoles((prev) => prev.map((role) => (role.id === renameTargetRoleId ? data : role)));
      setRenameDialogOpen(false);
      setRenameTargetRoleId(null);
      setRenameRoleName('');
      setRenameRoleKey('');

      toast({
        title: "Role Renamed",
        description: `Custom role renamed to "${trimmedName}".`,
      });
    } catch (error: any) {
      console.error('Error renaming custom role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to rename custom role",
        variant: "destructive",
      });
    } finally {
      setRenamingRole(false);
    }
  };

  const duplicateCustomRole = async (sourceRole: CustomRole) => {
    if (mode !== 'company' || !currentCompany || !user) return;
    try {
      setDuplicatingRoleId(sourceRole.id);
      const copiedName = `${sourceRole.role_name} Copy`;
      const copiedKey = getUniqueRoleKey(`${sourceRole.role_key}_copy`);

      const { data: newRoleData, error: createError } = await supabase
        .from('custom_roles')
        .insert({
          company_id: currentCompany.id,
          role_key: copiedKey,
          role_name: copiedName,
          description: sourceRole.description,
          color: sourceRole.color,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      const sourcePerms = customPermissions.filter((perm) => perm.custom_role_id === sourceRole.id);
      if (sourcePerms.length > 0) {
        const { data: insertedPerms, error: permsError } = await supabase
          .from('custom_role_permissions')
          .insert(
            sourcePerms.map((perm) => ({
              custom_role_id: newRoleData.id,
              menu_item: perm.menu_item,
              can_access: perm.can_access,
            }))
          )
          .select();

        if (permsError) throw permsError;
        setCustomPermissions((prev) => [...prev, ...(insertedPerms || [])]);
      }

      setCustomRoles((prev) => [...prev, newRoleData]);

      toast({
        title: "Role Duplicated",
        description: `Created "${copiedName}" with copied permissions.`,
      });
    } catch (error: any) {
      console.error('Error duplicating custom role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate custom role",
        variant: "destructive",
      });
    } finally {
      setDuplicatingRoleId(null);
    }
  };

  const openCopySystemRoleDialog = (sourceRole: typeof roles[0]) => {
    setCopySourceRole(sourceRole);
    setCopyRoleName(`${sourceRole.label} Copy`);
    setCopySystemRoleDialogOpen(true);
  };

  const copySystemRoleToCustomRole = async () => {
    if (mode !== 'company' || !currentCompany || !user || !copySourceRole) return;

    const trimmedName = copyRoleName.trim();
    if (!trimmedName) {
      toast({
        title: "Validation Error",
        description: "Please enter a name for the new custom role.",
        variant: "destructive",
      });
      return;
    }

    const duplicateName = customRoles.some((role) => role.role_name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (duplicateName) {
      toast({
        title: "Duplicate Role Name",
        description: "That custom role name is already in use for this company.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCopyingSystemRole(true);
      setDuplicatingRoleId(copySourceRole.key);
      const copiedKey = getUniqueRoleKey(trimmedName.replace(/\s+/g, '_'));

      const { data: newRoleData, error: createError } = await supabase
        .from('custom_roles')
        .insert({
          company_id: currentCompany.id,
          role_key: copiedKey,
          role_name: trimmedName,
          description: `Copied from system role: ${copySourceRole.label}`,
          color: copySourceRole.color,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      const permissionKeys = getAllPermissionKeysForBulkUpdate();
      const copiedPermissions = permissionKeys.map((menuItem) => ({
        custom_role_id: newRoleData.id,
        menu_item: menuItem,
        can_access: getPermission(copySourceRole.key, menuItem),
      }));

      const { data: insertedPerms, error: permsError } = await supabase
        .from('custom_role_permissions')
        .upsert(copiedPermissions, { onConflict: 'custom_role_id,menu_item' })
        .select();

      if (permsError) throw permsError;

      setCustomRoles((prev) => [...prev, newRoleData]);
      setCustomPermissions((prev) => [...prev, ...(insertedPerms || [])]);
      setCopySystemRoleDialogOpen(false);
      setCopySourceRole(null);
      setCopyRoleName('');

      toast({
        title: "Custom Role Created",
        description: `"${trimmedName}" starts with the current ${copySourceRole.label} system-role permissions.`,
      });
    } catch (error: any) {
      console.error('Error copying system role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to copy system role",
        variant: "destructive",
      });
    } finally {
      setCopyingSystemRole(false);
      setDuplicatingRoleId(null);
    }
  };

  const getAllPermissionKeysForBulkUpdate = (): string[] => {
    const keys = new Set<string>();
    const visitMenuItem = (item: MenuItem) => {
      keys.add(item.key);
      item.actions?.forEach((action) => keys.add(action.key));
      item.children?.forEach(visitMenuItem);
    };

    menuCategories.forEach((category) => {
      keys.add(category.key);
      category.items.forEach(visitMenuItem);
    });

    return Array.from(keys);
  };

  const enableAllCustomRolePermissions = async (role: CustomRole) => {
    if (mode !== 'company') return;
    try {
      setBulkUpdatingRoleId(role.id);
      const permissionKeys = getAllPermissionKeysForBulkUpdate();
      const { data, error } = await supabase
        .from('custom_role_permissions')
        .upsert(
          permissionKeys.map((menuItem) => ({
            custom_role_id: role.id,
            menu_item: menuItem,
            can_access: true,
          })),
          { onConflict: 'custom_role_id,menu_item' }
        )
        .select();

      if (error) throw error;

      setCustomPermissions((prev) => [
        ...prev.filter((perm) => perm.custom_role_id !== role.id),
        ...(data || []),
      ]);

      toast({
        title: "Permissions Updated",
        description: `Enabled all permissions for "${role.role_name}".`,
      });
    } catch (error: any) {
      console.error('Error enabling all custom role permissions:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to enable all permissions",
        variant: "destructive",
      });
    } finally {
      setBulkUpdatingRoleId(null);
    }
  };

  const clearAllCustomRolePermissions = async (role: CustomRole) => {
    if (mode !== 'company') return;
    if (!confirm(`Clear all permissions for "${role.role_name}"?`)) return;

    try {
      setBulkUpdatingRoleId(role.id);
      const { error } = await supabase
        .from('custom_role_permissions')
        .delete()
        .eq('custom_role_id', role.id);

      if (error) throw error;

      setCustomPermissions((prev) => prev.filter((perm) => perm.custom_role_id !== role.id));
      toast({
        title: "Permissions Cleared",
        description: `All permissions removed for "${role.role_name}".`,
      });
    } catch (error: any) {
      console.error('Error clearing all custom role permissions:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to clear permissions",
        variant: "destructive",
      });
    } finally {
      setBulkUpdatingRoleId(null);
    }
  };

  const updateCustomRoleDetails = async () => {
    if (mode !== 'company') return;
    if (!editTargetRoleId) return;

    try {
      setEditingRole(true);
      const { data, error } = await supabase
        .from('custom_roles')
        .update({
          description: editDescription.trim(),
          color: editColor.trim() || 'bg-indigo-100 text-indigo-800',
          is_active: true,
        })
        .eq('id', editTargetRoleId)
        .select()
        .single();

      if (error) throw error;

      setCustomRoles((prev) => prev.map((role) => (role.id === editTargetRoleId ? data : role)));
      setEditDialogOpen(false);
      setEditTargetRoleId(null);
      setEditDescription('');
      setEditColor('bg-indigo-100 text-indigo-800');

      toast({
        title: "Role Updated",
        description: "Custom role details were saved.",
      });
    } catch (error: any) {
      console.error('Error updating custom role details:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update custom role details",
        variant: "destructive",
      });
    } finally {
      setEditingRole(false);
    }
  };

  const deleteCustomRole = async (roleId: string, roleName: string) => {
    if (mode !== 'company') return;
    if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      setCustomRoles(prev => prev.filter(r => r.id !== roleId));
      setCustomPermissions(prev => prev.filter(p => p.custom_role_id !== roleId));

      toast({
        title: "Role Deleted",
        description: `Custom role "${roleName}" has been deleted`,
      });
    } catch (error) {
      console.error('Error deleting custom role:', error);
      toast({
        title: "Error",
        description: "Failed to delete custom role",
        variant: "destructive",
      });
    }
  };

  const toggleRole = (roleKey: string) => {
    setOpenRoles(prev => ({ ...prev, [roleKey]: !prev[roleKey] }));
  };

  const toggleCategory = (roleKey: string, categoryKey: string) => {
    const key = `${roleKey}-${categoryKey}`;
    setOpenCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMenuItem = (roleKey: string, itemKey: string) => {
    const key = `${roleKey}-${itemKey}`;
    setOpenMenuItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading || featureLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground"><span className="loading-dots">Loading permissions</span></p>
        </CardContent>
      </Card>
    );
  }

  if (!canViewRoleManager) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            {mode === 'super_admin_system'
              ? 'Only Super Admin can manage global system roles.'
              : 'You do not have permission to manage role definitions.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderPermissionSwitch = (
    roleKey: string, 
    permissionKey: string, 
    label: string, 
    isCustomRole: boolean = false,
    customRoleId?: string,
    aggregateChildren: boolean = false,
    cascadeChildrenOnToggle: boolean = false,
    showPartialState: boolean = false
  ) => {
    const isAdminRole = roleKey === 'admin';
    const upgradeRequired = isUpgradeRequiredForPermission(permissionKey);
    const isSystemRoleLocked = !isCustomRole && !canEditSystemRoles;
    const readPermission = (key: string) => (
      isCustomRole && customRoleId
        ? getCustomRolePermission(customRoleId, key)
        : getPermission(roleKey, key)
    );

    const getVisualState = (): ToggleVisualState => {
      if (!aggregateChildren) {
        return readPermission(permissionKey) ? 'on' : 'off';
      }

      const scopedKeys = permissionHierarchy.descendantsByKey[permissionKey] || [permissionKey];
      const hasAnyEnabled = scopedKeys.some((key) => readPermission(key));
      if (!hasAnyEnabled) return 'off';

      if (!showPartialState) return 'on';

      const descendantsOnly = scopedKeys.filter((key) => key !== permissionKey);
      if (descendantsOnly.length === 0) return 'on';
      const allDescendantsEnabled = descendantsOnly.every((key) => readPermission(key));
      return allDescendantsEnabled ? 'on' : 'partial';
    };

    const visualState = getVisualState();
    const hasPermission = visualState !== 'off';

    return (
      <div key={permissionKey} className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded">
        <Label htmlFor={`${roleKey}-${permissionKey}`} className={`text-sm ${upgradeRequired ? 'text-muted-foreground' : 'cursor-pointer'}`}>
          <span className="inline-flex items-center gap-2">
            <span>{label}</span>
            {upgradeRequired && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                Upgrade Required
              </Badge>
            )}
            {showPartialState && visualState === 'partial' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                Partial
              </Badge>
            )}
          </span>
        </Label>
        <Switch
          id={`${roleKey}-${permissionKey}`}
          checked={hasPermission}
          onCheckedChange={(checked) => {
            if (isCustomRole && customRoleId) {
              updateCustomRolePermission(customRoleId, permissionKey, checked, cascadeChildrenOnToggle);
            } else {
              updatePermission(roleKey, permissionKey, checked, cascadeChildrenOnToggle);
            }
          }}
          disabled={isAdminRole || upgradeRequired || isSystemRoleLocked}
        />
      </div>
    );
  };

  const renderRoleSection = (role: typeof roles[0], isCustomRole: boolean = false, customRoleData?: CustomRole) => {
    const roleKey = isCustomRole && customRoleData ? customRoleData.id : role.key;
    const isOpen = openRoles[roleKey] || false;
    const showSystemRoleCopyAction = !isCustomRole && mode === 'company';
    
    return (
      <Card key={roleKey} className="mb-4">
        <Collapsible open={isOpen} onOpenChange={() => toggleRole(roleKey)}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Badge className={isCustomRole && customRoleData ? customRoleData.color : role.color}>
                    {isCustomRole && customRoleData ? customRoleData.role_name : role.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {isCustomRole && customRoleData ? customRoleData.description : role.description}
                  </span>
                  {!isCustomRole && mode === 'company' && (
                    <Badge variant="outline" className="text-[10px]">
                      Managed in Super Admin
                    </Badge>
                  )}
                </div>
                {showSystemRoleCopyAction && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Copy to custom role"
                      disabled={duplicatingRoleId === role.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        openCopySystemRoleDialog(role);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {isCustomRole && customRoleData && mode === 'company' && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Enable all permissions"
                      disabled={bulkUpdatingRoleId === customRoleData.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        enableAllCustomRolePermissions(customRoleData);
                      }}
                    >
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Clear all permissions"
                      disabled={bulkUpdatingRoleId === customRoleData.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAllCustomRolePermissions(customRoleData);
                      }}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Duplicate role"
                      disabled={duplicatingRoleId === customRoleData.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateCustomRole(customRoleData);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Rename role"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameDialog(customRoleData);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Edit role details"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(customRoleData);
                      }}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete role"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustomRole(customRoleData.id, customRoleData.role_name);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {menuCategories.map((category) => {
                  const categoryKey = `${roleKey}-${category.key}`;
                  const isCategoryOpen = openCategories[categoryKey] || false;
                  const CategoryIcon = category.icon;
                  const availableItemsCount = category.items.length;
                  const enabledItemsCount = category.items.filter((item) => {
                    const scopedKeys = permissionHierarchy.descendantsByKey[item.key] || [item.key];
                    if (isCustomRole && customRoleData) {
                      return scopedKeys.some((key) => getCustomRolePermission(customRoleData.id, key));
                    }
                    return scopedKeys.some((key) => getPermission(role.key, key));
                  }).length;
                  
                  return (
                    <Collapsible 
                      key={category.key} 
                      open={isCategoryOpen} 
                      onOpenChange={() => toggleCategory(roleKey, category.key)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer border-l-2 border-primary/20">
                          {isCategoryOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <CategoryIcon className="h-4 w-4 text-primary" />
                          <span className="font-medium">{category.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({enabledItemsCount} / {availableItemsCount})
                          </span>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="ml-6 mt-1 space-y-1 border-l border-muted pl-4">
                          {/* Category-level permission */}
                          {renderPermissionSwitch(
                            isCustomRole ? '' : role.key,
                            category.key,
                            `Access ${category.label}`,
                            isCustomRole,
                            customRoleData?.id,
                            true,
                            true,
                            true
                          )}
                          
                          {/* Menu items within category */}
                          {(() => {
                            const renderMenuNode = (item: MenuItem, depth = 0): React.ReactNode => {
                              const itemKey = `${roleKey}-${item.key}`;
                              const isItemOpen = openMenuItems[itemKey] || false;
                              const hasActions = !!item.actions?.length;
                              const hasChildren = !!item.children?.length;
                              const leftMargin = depth === 0 ? 'ml-2' : 'ml-4';

                              const currentChecked = isCustomRole && customRoleData
                                ? (hasActions || hasChildren
                                    ? (permissionHierarchy.descendantsByKey[item.key] || [item.key]).some((k) => getCustomRolePermission(customRoleData.id, k))
                                    : getCustomRolePermission(customRoleData.id, item.key))
                                : getPermission(role.key, item.key);
                              const itemUpgradeRequired = isUpgradeRequiredForPermission(item.key);
                              const hasPartialChildren = (() => {
                                if (!(hasActions || hasChildren) || !(isCustomRole && customRoleData)) return false;
                                const scope = permissionHierarchy.descendantsByKey[item.key] || [item.key];
                                const descendantsOnly = scope.filter((key) => key !== item.key);
                                if (descendantsOnly.length === 0) return false;
                                const someEnabled = descendantsOnly.some((key) => getCustomRolePermission(customRoleData.id, key));
                                const allEnabled = descendantsOnly.every((key) => getCustomRolePermission(customRoleData.id, key));
                                return someEnabled && !allEnabled;
                              })();

                              if (!hasActions && !hasChildren) {
                                return (
                                  <div key={item.key} className={leftMargin}>
                                    {renderPermissionSwitch(
                                      isCustomRole ? '' : role.key,
                                      item.key,
                                      item.label,
                                      isCustomRole,
                                      customRoleData?.id
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <div key={item.key} className={leftMargin}>
                                  <Collapsible
                                    open={isItemOpen}
                                    onOpenChange={() => toggleMenuItem(roleKey, item.key)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <CollapsibleTrigger asChild>
                                        <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded cursor-pointer flex-1">
                                          {isItemOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                          <div className="flex flex-col">
                                            <span className="text-sm font-medium inline-flex items-center gap-2">
                                              <span>{item.label}</span>
                                              {itemUpgradeRequired && (
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                                  Upgrade Required
                                                </Badge>
                                              )}
                                              {hasPartialChildren && (
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                                  Partial
                                                </Badge>
                                              )}
                                            </span>
                                            {item.description && (
                                              <span className="text-[10px] text-muted-foreground">{item.description}</span>
                                            )}
                                          </div>
                                        </div>
                                      </CollapsibleTrigger>
                                      <Switch
                                        checked={currentChecked}
                                        onCheckedChange={(checked) => {
                                          if (isCustomRole && customRoleData) {
                                            updateCustomRolePermission(customRoleData.id, item.key, checked, hasActions || hasChildren);
                                          } else {
                                            updatePermission(role.key, item.key, checked, hasActions || hasChildren);
                                          }
                                        }}
                                        disabled={role.key === 'admin' || itemUpgradeRequired}
                                      />
                                    </div>

                                    <CollapsibleContent>
                                      <div className="ml-5 mt-1 space-y-0.5 border-l border-muted/50 pl-3">
                                        {item.actions?.map((action) => (
                                          (() => {
                                            const actionUpgradeRequired = isUpgradeRequiredForPermission(action.key);
                                            return (
                                          <div key={action.key} className="flex items-center justify-between py-1 px-2 hover:bg-muted/30 rounded text-xs">
                                            <div className="flex flex-col">
                                              <span className="inline-flex items-center gap-2">
                                                <span>{action.label}</span>
                                                {actionUpgradeRequired && (
                                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                                    Upgrade Required
                                                  </Badge>
                                                )}
                                              </span>
                                              <span className="text-muted-foreground text-[10px]">{action.description}</span>
                                            </div>
                                            <Switch
                                              checked={isCustomRole && customRoleData
                                                ? getCustomRolePermission(customRoleData.id, action.key)
                                                : getPermission(role.key, action.key)
                                              }
                                              onCheckedChange={(checked) => {
                                                if (isCustomRole && customRoleData) {
                                                  updateCustomRolePermission(customRoleData.id, action.key, checked);
                                                } else {
                                                  updatePermission(role.key, action.key, checked);
                                                }
                                              }}
                                              disabled={role.key === 'admin' || actionUpgradeRequired}
                                              className="scale-75"
                                            />
                                          </div>
                                            );
                                          })()
                                        ))}

                                        {item.children?.map((child) => renderMenuNode(child, depth + 1))}
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </div>
                              );
                            };

                            return category.items.map((item) => renderMenuNode(item));
                          })()}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <Tabs defaultValue="permissions" className="space-y-4">
      <TabsList>
        <TabsTrigger value="permissions">Menu Permissions</TabsTrigger>
        <TabsTrigger value="default-pages">Default Pages</TabsTrigger>
      </TabsList>

      <TabsContent value="permissions">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Role Permissions Manager
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode === 'super_admin_system'
                    ? 'Configure global system-role permissions. These changes apply across every company and organization.'
                    : 'System roles are managed in Super Admin. Company admins can create custom roles or copy a system role into a company-specific custom role.'}
                </p>
              </div>
              
              {mode === 'company' && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Custom Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Custom Role</DialogTitle>
                    <DialogDescription>
                      Create a new custom role for your company with specific permissions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="role_key">Role Key</Label>
                      <Input
                        id="role_key"
                        placeholder="e.g., field_supervisor"
                        value={newRole.role_key}
                        onChange={(e) => setNewRole(prev => ({ ...prev, role_key: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Unique identifier (lowercase, no spaces)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role_name">Role Name</Label>
                      <Input
                        id="role_name"
                        placeholder="e.g., Field Supervisor"
                        value={newRole.role_name}
                        onChange={(e) => setNewRole(prev => ({ ...prev, role_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe what this role is for..."
                        value={newRole.description}
                        onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createCustomRole}>
                      Create Role
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              )}

              {mode === 'company' && (
              <Dialog
                open={copySystemRoleDialogOpen}
                onOpenChange={(open) => {
                  setCopySystemRoleDialogOpen(open);
                  if (!open) {
                    setCopySourceRole(null);
                    setCopyRoleName('');
                  }
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Copy System Role To Custom Role</DialogTitle>
                    <DialogDescription>
                      {copySourceRole
                        ? `Create a custom role for this company starting with the current ${copySourceRole.label} system-role permissions.`
                        : 'Create a custom role for this company starting with the selected system role permissions.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Source System Role</Label>
                      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        {copySourceRole?.label || 'No system role selected'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="copy_role_name">New Custom Role Name</Label>
                      <Input
                        id="copy_role_name"
                        value={copyRoleName}
                        onChange={(e) => setCopyRoleName(e.target.value)}
                        placeholder="e.g., Customer Coordinator"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCopySystemRoleDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => void copySystemRoleToCustomRole()} disabled={copyingSystemRole || !copyRoleName.trim()}>
                      {copyingSystemRole ? 'Creating...' : 'Create Custom Role'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              )}

              {mode === 'company' && (
              <Dialog
                open={renameDialogOpen}
                onOpenChange={(open) => {
                  setRenameDialogOpen(open);
                  if (!open) {
                    setRenameTargetRoleId(null);
                    setRenameRoleName('');
                    setRenameRoleKey('');
                  }
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rename Custom Role</DialogTitle>
                    <DialogDescription>
                      Update the custom role name and key.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="rename_role_name">Role Name</Label>
                      <Input
                        id="rename_role_name"
                        value={renameRoleName}
                        onChange={(e) => setRenameRoleName(e.target.value)}
                        placeholder="e.g., Senior Estimator"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rename_role_key">Role Key</Label>
                      <Input
                        id="rename_role_key"
                        value={renameRoleKey}
                        onChange={(e) => setRenameRoleKey(e.target.value)}
                        placeholder="e.g., senior_estimator"
                      />
                      <p className="text-xs text-muted-foreground">Lowercase, letters/numbers/underscores only.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={renameCustomRole} disabled={renamingRole}>
                      {renamingRole ? 'Saving...' : 'Save'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              )}

              {mode === 'company' && (
              <Dialog
                open={editDialogOpen}
                onOpenChange={(open) => {
                  setEditDialogOpen(open);
                  if (!open) {
                    setEditTargetRoleId(null);
                    setEditDescription('');
                    setEditColor('bg-indigo-100 text-indigo-800');
                  }
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Custom Role Details</DialogTitle>
                    <DialogDescription>
                      Update role description and badge color classes.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_description">Description</Label>
                      <Textarea
                        id="edit_description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Describe what this role is for..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_color">Badge Color Classes</Label>
                      <Input
                        id="edit_color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        placeholder="e.g., bg-indigo-100 text-indigo-800"
                      />
                      <p className="text-xs text-muted-foreground">Tailwind class pair for badge background and text color.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={updateCustomRoleDetails} disabled={editingRole}>
                      {editingRole ? 'Saving...' : 'Save'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {/* System Roles */}
              <div>
                <h3 className="text-lg font-semibold mb-3">System Roles</h3>
                {roles.map(role => renderRoleSection(role))}
              </div>
              
              {/* Custom Roles */}
              {mode === 'company' && customRoles.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Custom Roles</h3>
                  {customRoles.map(customRole => 
                    renderRoleSection(
                      { key: customRole.id, label: customRole.role_name, color: customRole.color, description: customRole.description },
                      true,
                      customRole
                    )
                  )}
                </div>
              )}

              {mode === 'company' && customRoles.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No custom roles yet. Create one from scratch, or use the copy action on a system role to start from a global template.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="default-pages">
        <RoleDefaultPageSettings mode={mode} />
      </TabsContent>
    </Tabs>
  );
}
