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
import { Settings, ChevronDown, ChevronRight, Shield, Plus, Trash2, LayoutDashboard, HardHat, Receipt, HandCoins, CreditCard, FolderArchive, Users, MessageSquare, CheckSquare, Building, Cog, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useActiveCompanyRole } from "@/hooks/useActiveCompanyRole";
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
                  { key: 'jobs-photos-create-albums', label: 'Create Albums', description: 'Create photo albums' },
                  { key: 'jobs-photos-edit-albums', label: 'Edit Albums', description: 'Rename/reorganize albums' },
                  { key: 'jobs-photos-delete-albums', label: 'Delete Albums', description: 'Delete photo albums' },
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
      { 
        key: 'punch-clock-settings', 
        label: 'Punch Clock Settings', 
        description: 'Configure punch clock',
        actions: [
          { key: 'punch-clock-settings-view', label: 'View Settings', description: 'Access punch clock settings' },
          { key: 'punch-clock-settings-edit', label: 'Edit Settings', description: 'Modify punch clock settings' },
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
        key: 'settings', 
        label: 'General Settings', 
        description: 'Application configuration',
        actions: [
          { key: 'settings-view', label: 'View Settings', description: 'Access general settings' },
          { key: 'settings-edit', label: 'Edit Settings', description: 'Modify general settings' },
        ]
      },
      { 
        key: 'company-settings', 
        label: 'Company Settings', 
        description: 'Company configuration',
        actions: [
          { key: 'company-settings-view', label: 'View Settings', description: 'Access company settings' },
          { key: 'company-settings-edit', label: 'Edit Settings', description: 'Modify company settings' },
        ]
      },
      { 
        key: 'company-management', 
        label: 'Company Management', 
        description: 'Company user management',
        actions: [
          { key: 'company-management-access', label: 'Access Management', description: 'Manage company' },
        ]
      },
      { 
        key: 'user-settings', 
        label: 'User Management', 
        description: 'User roles and permissions',
        actions: [
          { key: 'user-settings-view', label: 'View Users', description: 'Access user list' },
          { key: 'user-settings-edit', label: 'Edit Users', description: 'Modify user roles' },
          { key: 'user-settings-permissions', label: 'Manage Permissions', description: 'Configure role permissions' },
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

const roles = [
  { key: 'admin', label: 'Admin', color: 'bg-red-100 text-red-800', description: 'Full system access' },
  { key: 'controller', label: 'Controller', color: 'bg-blue-100 text-blue-800', description: 'Financial oversight' },
  { key: 'company_admin', label: 'Company Admin', color: 'bg-orange-100 text-orange-800', description: 'Company-wide management' },
  { key: 'project_manager', label: 'Project Manager', color: 'bg-green-100 text-green-800', description: 'Project management' },
  { key: 'employee', label: 'Employee', color: 'bg-gray-100 text-gray-800', description: 'Basic employee access' },
  { key: 'view_only', label: 'View Only', color: 'bg-purple-100 text-purple-800', description: 'Read-only access - Cannot create, edit, or delete' },
  { key: 'vendor', label: 'Vendor', color: 'bg-amber-100 text-amber-800', description: 'External vendor access' },
];

// Get all permission keys for migration/seeding
export function getAllPermissionKeys(): string[] {
  const keys: string[] = [];
  menuCategories.forEach(category => {
    keys.push(category.key);
    category.items.forEach(item => {
      keys.push(item.key);
      item.actions?.forEach(action => {
        keys.push(action.key);
      });
    });
  });
  return keys;
}

export default function RolePermissionsManager() {
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const activeCompanyRole = useActiveCompanyRole();
  const { toast } = useToast();
  
  // Use company-specific role for admin check
  const effectiveRole = activeCompanyRole || profile?.role;
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'company_admin' || effectiveRole === 'owner';
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customPermissions, setCustomPermissions] = useState<CustomRolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openRoles, setOpenRoles] = useState<Record<string, boolean>>({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [openMenuItems, setOpenMenuItems] = useState<Record<string, boolean>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState({
    role_key: '',
    role_name: '',
    description: '',
    color: 'bg-indigo-100 text-indigo-800'
  });

  useEffect(() => {
    fetchPermissions();
    if (currentCompany) {
      fetchCustomRoles();
    }
  }, [currentCompany]);

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
        .eq('is_active', true)
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

  const updatePermission = async (role: string, menuItem: string, canAccess: boolean) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators can modify role permissions.",
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

    try {
      const { error } = await supabase
        .rpc('set_role_permission', {
          p_role: role as any,
          p_menu_item: menuItem,
          p_can_access: canAccess,
        });

      if (error) throw error;

      setPermissions(prev => {
        const existing = prev.find(p => p.role === role && p.menu_item === menuItem);
        if (existing) {
          return prev.map(p => 
            p.role === role && p.menu_item === menuItem 
              ? { ...p, can_access: canAccess }
              : p
          );
        } else {
          return [...prev, { role, menu_item: menuItem, can_access: canAccess }];
        }
      });

      toast({
        title: "Permission Updated",
        description: `Permission has been ${canAccess ? 'granted' : 'revoked'}.`,
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

  const updateCustomRolePermission = async (customRoleId: string, menuItem: string, canAccess: boolean) => {
    try {
      const { error } = await supabase
        .from('custom_role_permissions')
        .upsert({
          custom_role_id: customRoleId,
          menu_item: menuItem,
          can_access: canAccess,
        }, {
          onConflict: 'custom_role_id,menu_item'
        });

      if (error) throw error;

      setCustomPermissions(prev => {
        const existing = prev.find(p => p.custom_role_id === customRoleId && p.menu_item === menuItem);
        if (existing) {
          return prev.map(p => 
            p.custom_role_id === customRoleId && p.menu_item === menuItem 
              ? { ...p, can_access: canAccess }
              : p
          );
        } else {
          return [...prev, { 
            id: crypto.randomUUID(), 
            custom_role_id: customRoleId, 
            menu_item: menuItem, 
            can_access: canAccess 
          }];
        }
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
    if (!currentCompany || !user) return;

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

  const deleteCustomRole = async (roleId: string, roleName: string) => {
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading permissions...</p>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Access Denied</h3>
          <p className="text-muted-foreground">Only administrators can manage role permissions.</p>
        </CardContent>
      </Card>
    );
  }

  const renderPermissionSwitch = (
    roleKey: string, 
    permissionKey: string, 
    label: string, 
    isCustomRole: boolean = false,
    customRoleId?: string
  ) => {
    const isAdmin = roleKey === 'admin';
    const hasPermission = isCustomRole && customRoleId
      ? getCustomRolePermission(customRoleId, permissionKey)
      : getPermission(roleKey, permissionKey);

    return (
      <div key={permissionKey} className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded">
        <Label htmlFor={`${roleKey}-${permissionKey}`} className="text-sm cursor-pointer">
          {label}
        </Label>
        <Switch
          id={`${roleKey}-${permissionKey}`}
          checked={hasPermission}
          onCheckedChange={(checked) => {
            if (isCustomRole && customRoleId) {
              updateCustomRolePermission(customRoleId, permissionKey, checked);
            } else {
              updatePermission(roleKey, permissionKey, checked);
            }
          }}
          disabled={isAdmin}
        />
      </div>
    );
  };

  const renderRoleSection = (role: typeof roles[0], isCustomRole: boolean = false, customRoleData?: CustomRole) => {
    const roleKey = isCustomRole && customRoleData ? customRoleData.id : role.key;
    const isOpen = openRoles[roleKey] || false;
    
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
                </div>
                {isCustomRole && customRoleData && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCustomRole(customRoleData.id, customRoleData.role_name);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
                          <span className="text-xs text-muted-foreground ml-2">({category.items.length} items)</span>
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
                            customRoleData?.id
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
                                ? getCustomRolePermission(customRoleData.id, item.key)
                                : getPermission(role.key, item.key);

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
                                            <span className="text-sm font-medium">{item.label}</span>
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
                                            updateCustomRolePermission(customRoleData.id, item.key, checked);
                                          } else {
                                            updatePermission(role.key, item.key, checked);
                                          }
                                        }}
                                        disabled={role.key === 'admin'}
                                      />
                                    </div>

                                    <CollapsibleContent>
                                      <div className="ml-5 mt-1 space-y-0.5 border-l border-muted/50 pl-3">
                                        {item.actions?.map((action) => (
                                          <div key={action.key} className="flex items-center justify-between py-1 px-2 hover:bg-muted/30 rounded text-xs">
                                            <div className="flex flex-col">
                                              <span>{action.label}</span>
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
                                              disabled={role.key === 'admin'}
                                              className="scale-75"
                                            />
                                          </div>
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
                  Configure what each role can access in the application. Permissions are organized by menu section.
                </p>
              </div>
              
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
              {customRoles.length > 0 && (
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="default-pages">
        <RoleDefaultPageSettings />
      </TabsContent>
    </Tabs>
  );
}
