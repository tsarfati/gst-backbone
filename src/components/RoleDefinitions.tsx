import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Save, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PermissionItem {
  key: string;
  label: string;
  description: string;
}

interface PermissionCategory {
  category: string;
  permissions: PermissionItem[];
}

interface RolePermissions {
  [key: string]: boolean;
}

interface RoleDefinition {
  role: string;
  label: string;
  color: string;
  permissions: RolePermissions;
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    category: 'Jobs & Projects',
    permissions: [
      { key: 'jobs.view', label: 'View Jobs', description: 'Can view jobs list and basic job information' },
      { key: 'jobs.view_all', label: 'View All Jobs', description: 'Can view all jobs in the company (overrides job access restrictions)' },
      { key: 'jobs.view_details', label: 'View Job Details', description: 'Can view detailed job information and job pages' },
      { key: 'jobs.create', label: 'Create Jobs', description: 'Can create new jobs/projects' },
      { key: 'jobs.edit', label: 'Edit Jobs', description: 'Can edit existing job details' },
      { key: 'jobs.edit_dates', label: 'Edit Job Dates', description: 'Can modify job start and end dates' },
      { key: 'jobs.edit_budget', label: 'Edit Job Budget', description: 'Can modify job budget amounts' },
      { key: 'jobs.edit_status', label: 'Change Job Status', description: 'Can change job status (active, completed, on hold)' },
      { key: 'jobs.delete', label: 'Delete Jobs', description: 'Can delete jobs permanently' },
      { key: 'jobs.manage_budget', label: 'Manage Job Budgets', description: 'Can create and modify detailed job budgets' },
      { key: 'jobs.view_financials', label: 'View Job Financials', description: 'Can view job cost and financial data' },
      { key: 'jobs.view_profitability', label: 'View Job Profitability', description: 'Can view profit margins and cost analysis' },
      { key: 'jobs.assign_users', label: 'Assign Users to Jobs', description: 'Can assign team members to jobs' },
      { key: 'jobs.manage_phases', label: 'Manage Job Phases', description: 'Can create and edit job phases' },
      { key: 'jobs.view_cost_codes', label: 'View Job Cost Codes', description: 'Can view cost code breakdowns' },
      { key: 'jobs.manage_cost_codes', label: 'Manage Job Cost Codes', description: 'Can assign and modify job cost codes' },
      { key: 'jobs.upload_photos', label: 'Upload Job Photos', description: 'Can upload photos to job album' },
      { key: 'jobs.delete_photos', label: 'Delete Job Photos', description: 'Can delete photos from job album' },
      { key: 'jobs.view_location', label: 'View Job Location', description: 'Can view job location and map' },
      { key: 'jobs.edit_location', label: 'Edit Job Location', description: 'Can modify job address and GPS coordinates' },
    ]
  },
  {
    category: 'Bills & Payables',
    permissions: [
      { key: 'bills.view', label: 'View Bills', description: 'Can view bills list' },
      { key: 'bills.view_all', label: 'View All Bills', description: 'Can view all company bills (overrides job restrictions)' },
      { key: 'bills.view_details', label: 'View Bill Details', description: 'Can view detailed bill information' },
      { key: 'bills.view_amounts', label: 'View Bill Amounts', description: 'Can see bill amounts and totals' },
      { key: 'bills.create', label: 'Create Bills', description: 'Can create new bills' },
      { key: 'bills.edit', label: 'Edit Bills', description: 'Can edit bill details and amounts' },
      { key: 'bills.edit_vendor', label: 'Change Bill Vendor', description: 'Can change vendor on bills' },
      { key: 'bills.edit_date', label: 'Edit Bill Dates', description: 'Can modify bill date and due date' },
      { key: 'bills.delete', label: 'Delete Bills', description: 'Can delete bills permanently' },
      { key: 'bills.approve', label: 'Approve Bills', description: 'Can approve bills for payment' },
      { key: 'bills.reject', label: 'Reject Bills', description: 'Can reject bills and send back for revision' },
      { key: 'bills.code', label: 'Code Bills', description: 'Can assign cost codes and job codes to bills' },
      { key: 'bills.split_coding', label: 'Split Bill Coding', description: 'Can split bills across multiple cost codes' },
      { key: 'bills.make_payment', label: 'Make Payments', description: 'Can process bill payments' },
      { key: 'bills.void_payment', label: 'Void Payments', description: 'Can void previously made payments' },
      { key: 'bills.view_payment_history', label: 'View Payment History', description: 'Can view bill payment history' },
      { key: 'bills.upload_attachments', label: 'Upload Bill Attachments', description: 'Can attach documents to bills' },
      { key: 'bills.add_notes', label: 'Add Bill Notes', description: 'Can add internal notes to bills' },
      { key: 'bills.communicate', label: 'Send Bill Messages', description: 'Can send messages about bills to vendors' },
    ]
  },
  {
    category: 'Receipts & Expenses',
    permissions: [
      { key: 'receipts.view', label: 'View Receipts', description: 'Can view receipts list' },
      { key: 'receipts.view_all', label: 'View All Receipts', description: 'Can view all company receipts (overrides restrictions)' },
      { key: 'receipts.view_uncoded', label: 'View Uncoded Receipts', description: 'Can view receipts needing coding' },
      { key: 'receipts.view_coded', label: 'View Coded Receipts', description: 'Can view already coded receipts' },
      { key: 'receipts.upload', label: 'Upload Receipts', description: 'Can upload receipt images and scan receipts' },
      { key: 'receipts.code', label: 'Code Receipts', description: 'Can assign cost codes and job codes to receipts' },
      { key: 'receipts.edit_coding', label: 'Edit Receipt Coding', description: 'Can modify existing receipt coding' },
      { key: 'receipts.split', label: 'Split Receipts', description: 'Can split receipts across multiple codes' },
      { key: 'receipts.approve', label: 'Approve Receipts', description: 'Can approve coded receipts for payment' },
      { key: 'receipts.reject', label: 'Reject Receipts', description: 'Can reject receipts for recoding' },
      { key: 'receipts.delete', label: 'Delete Receipts', description: 'Can delete receipt images' },
      { key: 'receipts.view_amounts', label: 'View Receipt Amounts', description: 'Can see receipt dollar amounts' },
      { key: 'receipts.add_notes', label: 'Add Receipt Notes', description: 'Can add notes to receipts' },
      { key: 'receipts.link_bills', label: 'Link to Bills', description: 'Can link receipts to bills' },
      { key: 'receipts.use_ocr', label: 'Use OCR Enhancement', description: 'Can use AI OCR to extract receipt data' },
    ]
  },
  {
    category: 'Vendors',
    permissions: [
      { key: 'vendors.view', label: 'View Vendors', description: 'Can view vendor list' },
      { key: 'vendors.view_all', label: 'View All Vendors', description: 'Can view all company vendors' },
      { key: 'vendors.view_details', label: 'View Vendor Details', description: 'Can view detailed vendor information' },
      { key: 'vendors.view_contact', label: 'View Vendor Contact Info', description: 'Can see vendor phone, email, address' },
      { key: 'vendors.create', label: 'Create Vendors', description: 'Can create new vendors' },
      { key: 'vendors.edit', label: 'Edit Vendors', description: 'Can edit vendor information' },
      { key: 'vendors.edit_payment_terms', label: 'Edit Payment Terms', description: 'Can modify vendor payment terms' },
      { key: 'vendors.delete', label: 'Delete Vendors', description: 'Can delete vendors permanently' },
      { key: 'vendors.view_compliance', label: 'View Compliance Documents', description: 'Can view insurance, permits, contracts' },
      { key: 'vendors.manage_compliance', label: 'Manage Compliance', description: 'Can upload and manage compliance documents' },
      { key: 'vendors.upload_insurance', label: 'Upload Insurance', description: 'Can upload vendor insurance certificates' },
      { key: 'vendors.upload_permits', label: 'Upload Permits', description: 'Can upload vendor permits and licenses' },
      { key: 'vendors.upload_contracts', label: 'Upload Contracts', description: 'Can upload vendor contracts' },
      { key: 'vendors.view_history', label: 'View Vendor History', description: 'Can view vendor transaction history' },
      { key: 'vendors.add_notes', label: 'Add Vendor Notes', description: 'Can add notes to vendor profiles' },
    ]
  },
  {
    category: 'Banking & Accounting',
    permissions: [
      { key: 'banking.view', label: 'View Banking Section', description: 'Can access banking module' },
      { key: 'banking.view_accounts', label: 'View Bank Accounts', description: 'Can view bank account list and details' },
      { key: 'banking.view_balances', label: 'View Account Balances', description: 'Can see bank account balances' },
      { key: 'banking.view_transactions', label: 'View Transactions', description: 'Can view bank transactions' },
      { key: 'banking.add_account', label: 'Add Bank Accounts', description: 'Can add new bank accounts' },
      { key: 'banking.edit_account', label: 'Edit Bank Accounts', description: 'Can edit bank account information' },
      { key: 'banking.delete_account', label: 'Delete Bank Accounts', description: 'Can delete bank accounts' },
      { key: 'banking.reconcile', label: 'Reconcile Accounts', description: 'Can perform bank reconciliations' },
      { key: 'banking.view_reconciliation', label: 'View Reconciliation Reports', description: 'Can view reconciliation history' },
      { key: 'banking.create_entries', label: 'Create Journal Entries', description: 'Can create manual journal entries' },
      { key: 'banking.edit_entries', label: 'Edit Journal Entries', description: 'Can edit journal entries' },
      { key: 'banking.delete_entries', label: 'Delete Journal Entries', description: 'Can delete journal entries' },
      { key: 'banking.view_ledger', label: 'View General Ledger', description: 'Can view general ledger' },
      { key: 'banking.view_chart', label: 'View Chart of Accounts', description: 'Can view chart of accounts' },
      { key: 'banking.manage_chart', label: 'Manage Chart of Accounts', description: 'Can modify chart of accounts structure' },
      { key: 'banking.create_accounts', label: 'Create GL Accounts', description: 'Can create new general ledger accounts' },
      { key: 'banking.edit_accounts', label: 'Edit GL Accounts', description: 'Can edit general ledger accounts' },
      { key: 'banking.view_reports', label: 'View Financial Reports', description: 'Can view P&L, balance sheet, etc.' },
      { key: 'banking.export_data', label: 'Export Banking Data', description: 'Can export banking and accounting data' },
    ]
  },
  {
    category: 'Credit Cards',
    permissions: [
      { key: 'credit_cards.view', label: 'View Credit Cards', description: 'Can view credit card list' },
      { key: 'credit_cards.view_all', label: 'View All Cards', description: 'Can view all company credit cards' },
      { key: 'credit_cards.view_details', label: 'View Card Details', description: 'Can view card details and balances' },
      { key: 'credit_cards.view_transactions', label: 'View Transactions', description: 'Can view credit card transactions' },
      { key: 'credit_cards.view_statements', label: 'View Statements', description: 'Can view credit card statements' },
      { key: 'credit_cards.add', label: 'Add Credit Cards', description: 'Can add new credit card accounts' },
      { key: 'credit_cards.edit', label: 'Edit Credit Cards', description: 'Can edit credit card information' },
      { key: 'credit_cards.delete', label: 'Delete Credit Cards', description: 'Can delete credit card accounts' },
      { key: 'credit_cards.code_transactions', label: 'Code Transactions', description: 'Can assign job and cost codes to transactions' },
      { key: 'credit_cards.split_transactions', label: 'Split Transactions', description: 'Can split transactions across codes' },
      { key: 'credit_cards.approve_coding', label: 'Approve Coded Transactions', description: 'Can approve coded transactions' },
      { key: 'credit_cards.make_payment', label: 'Make Payments', description: 'Can process credit card payments' },
      { key: 'credit_cards.view_payment_history', label: 'View Payment History', description: 'Can view payment history' },
    ]
  },
  {
    category: 'Employees & Time Tracking',
    permissions: [
      { key: 'employees.view', label: 'View Employees', description: 'Can view employee list' },
      { key: 'employees.view_all', label: 'View All Employees', description: 'Can view all company employees' },
      { key: 'employees.view_details', label: 'View Employee Details', description: 'Can view detailed employee information' },
      { key: 'employees.view_contact', label: 'View Employee Contact', description: 'Can see employee phone and email' },
      { key: 'employees.view_pay_rate', label: 'View Pay Rates', description: 'Can view employee pay rates' },
      { key: 'employees.create', label: 'Create Employees', description: 'Can add new employees' },
      { key: 'employees.edit', label: 'Edit Employees', description: 'Can edit employee basic information' },
      { key: 'employees.edit_pay', label: 'Edit Pay Rates', description: 'Can modify employee pay rates' },
      { key: 'employees.edit_role', label: 'Edit Employee Roles', description: 'Can change employee roles and permissions' },
      { key: 'employees.delete', label: 'Delete Employees', description: 'Can delete employees permanently' },
      { key: 'employees.assign_jobs', label: 'Assign to Jobs', description: 'Can assign employees to jobs' },
      { key: 'employees.manage_pins', label: 'Manage PIN Codes', description: 'Can create and modify employee PIN codes' },
      { key: 'timecards.view', label: 'View Timecards', description: 'Can view employee timecards' },
      { key: 'timecards.view_all', label: 'View All Timecards', description: 'Can view all employee timecards' },
      { key: 'timecards.edit', label: 'Edit Timecards', description: 'Can manually edit timecard entries' },
      { key: 'timecards.create', label: 'Create Manual Time Entry', description: 'Can create manual time entries' },
      { key: 'timecards.delete', label: 'Delete Timecards', description: 'Can delete timecard entries' },
      { key: 'timecards.approve', label: 'Approve Timecards', description: 'Can approve timecards for payroll' },
      { key: 'timecards.reject', label: 'Reject Timecards', description: 'Can reject timecards for correction' },
      { key: 'timecards.export', label: 'Export Timecards', description: 'Can export timecard data' },
      { key: 'punch_clock.view_dashboard', label: 'View Punch Clock Dashboard', description: 'Can access punch clock monitoring' },
      { key: 'punch_clock.manual_punch', label: 'Manual Punch In/Out', description: 'Can manually punch employees in/out' },
    ]
  },
  {
    category: 'Purchase Orders & Subcontracts',
    permissions: [
      { key: 'po.view', label: 'View Purchase Orders', description: 'Can view purchase orders list' },
      { key: 'po.view_all', label: 'View All POs', description: 'Can view all company purchase orders' },
      { key: 'po.view_details', label: 'View PO Details', description: 'Can view detailed PO information' },
      { key: 'po.create', label: 'Create Purchase Orders', description: 'Can create new purchase orders' },
      { key: 'po.edit', label: 'Edit Purchase Orders', description: 'Can edit PO details and amounts' },
      { key: 'po.delete', label: 'Delete Purchase Orders', description: 'Can delete purchase orders' },
      { key: 'po.approve', label: 'Approve Purchase Orders', description: 'Can approve POs for issuing' },
      { key: 'po.reject', label: 'Reject Purchase Orders', description: 'Can reject POs' },
      { key: 'po.issue', label: 'Issue Purchase Orders', description: 'Can send POs to vendors' },
      { key: 'po.close', label: 'Close Purchase Orders', description: 'Can mark POs as complete/closed' },
      { key: 'subcontracts.view', label: 'View Subcontracts', description: 'Can view subcontracts list' },
      { key: 'subcontracts.view_all', label: 'View All Subcontracts', description: 'Can view all company subcontracts' },
      { key: 'subcontracts.view_details', label: 'View Subcontract Details', description: 'Can view detailed subcontract information' },
      { key: 'subcontracts.create', label: 'Create Subcontracts', description: 'Can create new subcontracts' },
      { key: 'subcontracts.edit', label: 'Edit Subcontracts', description: 'Can edit subcontract details' },
      { key: 'subcontracts.delete', label: 'Delete Subcontracts', description: 'Can delete subcontracts' },
      { key: 'subcontracts.approve', label: 'Approve Subcontracts', description: 'Can approve subcontracts' },
      { key: 'subcontracts.upload_docs', label: 'Upload Subcontract Docs', description: 'Can upload signed contracts and documents' },
      { key: 'subcontracts.manage_change_orders', label: 'Manage Change Orders', description: 'Can create and approve change orders' },
    ]
  },
  {
    category: 'Reports & Analytics',
    permissions: [
      { key: 'reports.view', label: 'View Reports Section', description: 'Can access reports module' },
      { key: 'reports.job_costing', label: 'Job Costing Reports', description: 'Can view job cost and budget reports' },
      { key: 'reports.job_profitability', label: 'Job Profitability Reports', description: 'Can view profit margin analysis' },
      { key: 'reports.financial', label: 'Financial Reports', description: 'Can view P&L and financial statements' },
      { key: 'reports.balance_sheet', label: 'Balance Sheet', description: 'Can view balance sheet' },
      { key: 'reports.cash_flow', label: 'Cash Flow Reports', description: 'Can view cash flow statements' },
      { key: 'reports.timecard', label: 'Timecard Reports', description: 'Can view timecard and labor reports' },
      { key: 'reports.payroll', label: 'Payroll Reports', description: 'Can view payroll summary reports' },
      { key: 'reports.vendor', label: 'Vendor Reports', description: 'Can view vendor spending analysis' },
      { key: 'reports.vendor_aging', label: 'Vendor Aging Report', description: 'Can view accounts payable aging' },
      { key: 'reports.receipt', label: 'Receipt Reports', description: 'Can view receipt and expense reports' },
      { key: 'reports.budget_variance', label: 'Budget Variance', description: 'Can view budget vs actual reports' },
      { key: 'reports.commitment', label: 'Commitment Reports', description: 'Can view PO and subcontract commitments' },
      { key: 'reports.custom', label: 'Custom Reports', description: 'Can create custom report views' },
      { key: 'reports.export', label: 'Export Reports', description: 'Can export reports to Excel/PDF' },
      { key: 'reports.print', label: 'Print Reports', description: 'Can print reports' },
      { key: 'reports.schedule', label: 'Schedule Reports', description: 'Can schedule automated report emails' },
    ]
  },
  {
    category: 'System Administration',
    permissions: [
      { key: 'admin.access', label: 'Admin Panel Access', description: 'Can access admin and settings sections' },
      { key: 'admin.users', label: 'Manage Users', description: 'Can create/edit/delete users' },
      { key: 'admin.view_users', label: 'View All Users', description: 'Can view all user accounts' },
      { key: 'admin.edit_user_roles', label: 'Edit User Roles', description: 'Can change user roles and permissions' },
      { key: 'admin.assign_jobs', label: 'Assign Job Access', description: 'Can control user job access permissions' },
      { key: 'admin.roles', label: 'Manage Roles', description: 'Can create and modify role definitions' },
      { key: 'admin.permissions', label: 'Manage Permissions', description: 'Can configure role-based permissions' },
      { key: 'admin.company_settings', label: 'Company Settings', description: 'Can modify company-wide settings' },
      { key: 'admin.branding', label: 'Manage Branding', description: 'Can customize colors, logos, and themes' },
      { key: 'admin.cost_codes', label: 'Manage Cost Codes', description: 'Can create and modify cost code structure' },
      { key: 'admin.cost_code_structure', label: 'Edit Cost Code Structure', description: 'Can reorganize cost code hierarchy' },
      { key: 'admin.payment_terms', label: 'Manage Payment Terms', description: 'Can configure payment term options' },
      { key: 'admin.integrations', label: 'Manage Integrations', description: 'Can configure third-party integrations' },
      { key: 'admin.email_templates', label: 'Email Templates', description: 'Can customize email templates' },
      { key: 'admin.pdf_templates', label: 'PDF Templates', description: 'Can customize PDF document templates' },
      { key: 'admin.notifications', label: 'Notification Settings', description: 'Can configure notification rules' },
      { key: 'admin.audit_logs', label: 'View Audit Logs', description: 'Can view system audit and activity logs' },
      { key: 'admin.security', label: 'Security Settings', description: 'Can manage security and access policies' },
      { key: 'admin.backup', label: 'Backup & Export', description: 'Can perform system backups and data exports' },
      { key: 'admin.punch_clock_settings', label: 'Punch Clock Settings', description: 'Can configure punch clock system' },
      { key: 'admin.visitor_log_settings', label: 'Visitor Log Settings', description: 'Can configure visitor logging system' },
    ]
  },
  {
    category: 'PM Lynk (Mobile App)',
    permissions: [
      { key: 'pm_lynk.messages', label: 'Messages', description: 'Access messaging in PM Lynk' },
      { key: 'pm_lynk.delivery_tickets', label: 'Delivery Tickets', description: 'View and manage delivery tickets in PM Lynk' },
      { key: 'pm_lynk.receipt_scanner', label: 'Receipt Scanner', description: 'Scan and upload receipts in PM Lynk' },
      { key: 'pm_lynk.tasks', label: 'Tasks', description: 'View and manage tasks in PM Lynk' },
      { key: 'pm_lynk.safety', label: 'Safety', description: 'Access safety documents and checklists in PM Lynk' },
      { key: 'pm_lynk.directory', label: 'Directory', description: 'Access project team directory in PM Lynk' },
      { key: 'pm_lynk.bill_coding', label: 'Bill Coding', description: 'Code and manage bills in PM Lynk (typically project managers only)' },
    ]
  },
  {
    category: 'Dashboard Sections',
    permissions: [
      { key: 'dashboard.stats', label: 'Stats Overview', description: 'Show key metrics and statistics' },
      { key: 'dashboard.notifications', label: 'Notifications', description: 'Show notifications panel' },
      { key: 'dashboard.messages', label: 'Messages', description: 'Show messages panel' },
      { key: 'dashboard.active_jobs', label: 'Active Jobs', description: 'Show active jobs list' },
      { key: 'dashboard.bills_overview', label: 'Bills Overview', description: 'Show bills needing coding' },
      { key: 'dashboard.payment_status', label: 'Payment Status', description: 'Show payment tracking' },
      { key: 'dashboard.invoice_summary', label: 'Invoice Summary', description: 'Show invoice overview' },
      { key: 'dashboard.budget_tracking', label: 'Budget Tracking', description: 'Show budget progress' },
      { key: 'dashboard.punch_clock', label: 'Punch Clock Status', description: 'Show punch clock tracking' },
      { key: 'dashboard.timesheet_approval', label: 'Timesheet Approval', description: 'Show pending timesheets' },
      { key: 'dashboard.overtime_alerts', label: 'Overtime Alerts', description: 'Show overtime warnings' },
      { key: 'dashboard.employee_attendance', label: 'Employee Attendance', description: 'Show attendance tracking' },
      { key: 'dashboard.project_progress', label: 'Project Progress', description: 'Show project completion status' },
      { key: 'dashboard.task_deadlines', label: 'Task Deadlines', description: 'Show upcoming deadlines' },
      { key: 'dashboard.resource_allocation', label: 'Resource Allocation', description: 'Show resource usage' },
      { key: 'dashboard.credit_card_coding', label: 'Credit Card Coding', description: 'Show credit card transactions needing coding' },
    ]
  }
];

const defaultRoleDefinitions: RoleDefinition[] = [
  {
    role: 'admin',
    label: 'Administrator',
    color: 'destructive',
    permissions: Object.fromEntries(
      PERMISSION_CATEGORIES.flatMap(cat => 
        cat.permissions.map(p => [p.key, true])
      )
    )
  },
  {
    role: 'controller',
    label: 'Controller',
    color: 'secondary',
    permissions: {
      // Jobs - View only, no editing
      'jobs.view': true,
      'jobs.view_all': true,
      'jobs.view_details': true,
      'jobs.view_financials': true,
      'jobs.view_profitability': true,
      'jobs.view_cost_codes': true,
      'jobs.view_location': true,
      
      // Bills - Full access
      'bills.view': true,
      'bills.view_all': true,
      'bills.view_details': true,
      'bills.view_amounts': true,
      'bills.create': true,
      'bills.edit': true,
      'bills.edit_vendor': true,
      'bills.edit_date': true,
      'bills.approve': true,
      'bills.reject': true,
      'bills.code': true,
      'bills.split_coding': true,
      'bills.make_payment': true,
      'bills.void_payment': true,
      'bills.view_payment_history': true,
      'bills.upload_attachments': true,
      'bills.add_notes': true,
      'bills.communicate': true,
      
      // Receipts - Full access
      'receipts.view': true,
      'receipts.view_all': true,
      'receipts.view_uncoded': true,
      'receipts.view_coded': true,
      'receipts.upload': true,
      'receipts.code': true,
      'receipts.edit_coding': true,
      'receipts.split': true,
      'receipts.approve': true,
      'receipts.reject': true,
      'receipts.view_amounts': true,
      'receipts.add_notes': true,
      'receipts.link_bills': true,
      'receipts.use_ocr': true,
      
      // Vendors - View and manage
      'vendors.view': true,
      'vendors.view_all': true,
      'vendors.view_details': true,
      'vendors.view_contact': true,
      'vendors.create': true,
      'vendors.edit': true,
      'vendors.edit_payment_terms': true,
      'vendors.view_compliance': true,
      'vendors.view_history': true,
      'vendors.add_notes': true,
      
      // Banking - Full access
      'banking.view': true,
      'banking.view_accounts': true,
      'banking.view_balances': true,
      'banking.view_transactions': true,
      'banking.reconcile': true,
      'banking.view_reconciliation': true,
      'banking.create_entries': true,
      'banking.edit_entries': true,
      'banking.view_ledger': true,
      'banking.view_chart': true,
      'banking.view_reports': true,
      'banking.export_data': true,
      
      // Credit Cards - Full access
      'credit_cards.view': true,
      'credit_cards.view_all': true,
      'credit_cards.view_details': true,
      'credit_cards.view_transactions': true,
      'credit_cards.view_statements': true,
      'credit_cards.code_transactions': true,
      'credit_cards.split_transactions': true,
      'credit_cards.approve_coding': true,
      'credit_cards.make_payment': true,
      'credit_cards.view_payment_history': true,
      
      // Employees - View only
      'employees.view': true,
      'employees.view_all': true,
      'employees.view_details': true,
      'employees.view_contact': true,
      'employees.view_pay_rate': true,
      
      // Timecards - View and approve
      'timecards.view': true,
      'timecards.view_all': true,
      'timecards.edit': true,
      'timecards.approve': true,
      'timecards.reject': true,
      'timecards.export': true,
      
      // PO & Subcontracts - Approve only
      'po.view': true,
      'po.view_all': true,
      'po.view_details': true,
      'po.approve': true,
      'po.reject': true,
      'subcontracts.view': true,
      'subcontracts.view_all': true,
      'subcontracts.view_details': true,
      'subcontracts.approve': true,
      
      // Reports - Full access
      'reports.view': true,
      'reports.job_costing': true,
      'reports.job_profitability': true,
      'reports.financial': true,
      'reports.balance_sheet': true,
      'reports.cash_flow': true,
      'reports.timecard': true,
      'reports.payroll': true,
      'reports.vendor': true,
      'reports.vendor_aging': true,
      'reports.receipt': true,
      'reports.budget_variance': true,
      'reports.commitment': true,
      'reports.export': true,
      'reports.print': true,
      
      // PM Lynk - Full access
      'pm_lynk.messages': true,
      'pm_lynk.delivery_tickets': true,
      'pm_lynk.receipt_scanner': true,
      'pm_lynk.tasks': true,
      'pm_lynk.safety': true,
      'pm_lynk.directory': true,
      'pm_lynk.bill_coding': true,

      // Admin - User management only
      'admin.access': true,
      'admin.view_users': true,
      'admin.users': true,
      
      // Dashboard
      'dashboard.stats': true,
      'dashboard.notifications': true,
      'dashboard.messages': true,
      'dashboard.bills_overview': true,
      'dashboard.payment_status': true,
      'dashboard.invoice_summary': true,
      'dashboard.budget_tracking': true,
      'dashboard.timesheet_approval': true,
      'dashboard.credit_card_coding': true,
    }
  },
  {
    role: 'project_manager',
    label: 'Project Manager',
    color: 'default',
    permissions: {
      // Jobs - Full access
      'jobs.view': true,
      'jobs.view_all': true,
      'jobs.view_details': true,
      'jobs.create': true,
      'jobs.edit': true,
      'jobs.edit_dates': true,
      'jobs.edit_budget': true,
      'jobs.edit_status': true,
      'jobs.manage_budget': true,
      'jobs.view_financials': true,
      'jobs.view_profitability': true,
      'jobs.assign_users': true,
      'jobs.manage_phases': true,
      'jobs.view_cost_codes': true,
      'jobs.manage_cost_codes': true,
      'jobs.upload_photos': true,
      'jobs.delete_photos': true,
      'jobs.view_location': true,
      'jobs.edit_location': true,
      
      // Bills - View and code
      'bills.view': true,
      'bills.view_all': true,
      'bills.view_details': true,
      'bills.view_amounts': true,
      'bills.create': true,
      'bills.edit': true,
      'bills.code': true,
      'bills.split_coding': true,
      'bills.upload_attachments': true,
      'bills.add_notes': true,
      'bills.communicate': true,
      
      // Receipts - Full access
      'receipts.view': true,
      'receipts.view_all': true,
      'receipts.view_uncoded': true,
      'receipts.view_coded': true,
      'receipts.upload': true,
      'receipts.code': true,
      'receipts.edit_coding': true,
      'receipts.split': true,
      'receipts.view_amounts': true,
      'receipts.add_notes': true,
      'receipts.link_bills': true,
      'receipts.use_ocr': true,
      
      // Vendors - Full access
      'vendors.view': true,
      'vendors.view_all': true,
      'vendors.view_details': true,
      'vendors.view_contact': true,
      'vendors.create': true,
      'vendors.edit': true,
      'vendors.edit_payment_terms': true,
      'vendors.view_compliance': true,
      'vendors.manage_compliance': true,
      'vendors.upload_insurance': true,
      'vendors.upload_permits': true,
      'vendors.upload_contracts': true,
      'vendors.view_history': true,
      'vendors.add_notes': true,
      
      // Employees - Full access
      'employees.view': true,
      'employees.view_all': true,
      'employees.view_details': true,
      'employees.view_contact': true,
      'employees.view_pay_rate': true,
      'employees.create': true,
      'employees.edit': true,
      'employees.assign_jobs': true,
      'employees.manage_pins': true,
      
      // Timecards - Full access
      'timecards.view': true,
      'timecards.view_all': true,
      'timecards.edit': true,
      'timecards.create': true,
      'timecards.approve': true,
      'timecards.reject': true,
      'timecards.export': true,
      'punch_clock.view_dashboard': true,
      'punch_clock.manual_punch': true,
      
      // PO & Subcontracts - Full access
      'po.view': true,
      'po.view_all': true,
      'po.view_details': true,
      'po.create': true,
      'po.edit': true,
      'po.issue': true,
      'po.close': true,
      'subcontracts.view': true,
      'subcontracts.view_all': true,
      'subcontracts.view_details': true,
      'subcontracts.create': true,
      'subcontracts.edit': true,
      'subcontracts.upload_docs': true,
      'subcontracts.manage_change_orders': true,
      
      // Reports
      'reports.view': true,
      'reports.job_costing': true,
      'reports.job_profitability': true,
      'reports.timecard': true,
      'reports.payroll': true,
      'reports.vendor': true,
      'reports.receipt': true,
      'reports.budget_variance': true,
      'reports.commitment': true,
      'reports.export': true,
      'reports.print': true,
      
      // PM Lynk - Full access (project managers get bill coding)
      'pm_lynk.messages': true,
      'pm_lynk.delivery_tickets': true,
      'pm_lynk.receipt_scanner': true,
      'pm_lynk.tasks': true,
      'pm_lynk.safety': true,
      'pm_lynk.directory': true,
      'pm_lynk.bill_coding': true,

      // Dashboard
      'dashboard.stats': true,
      'dashboard.notifications': true,
      'dashboard.messages': true,
      'dashboard.active_jobs': true,
      'dashboard.bills_overview': true,
      'dashboard.project_progress': true,
      'dashboard.task_deadlines': true,
      'dashboard.resource_allocation': true,
      'dashboard.employee_attendance': true,
      'dashboard.punch_clock': true,
      'dashboard.timesheet_approval': true,
    }
  },
  {
    role: 'employee',
    label: 'Employee',
    color: 'outline',
    permissions: {
      // Receipts - Upload and code own receipts
      'receipts.view': true,
      'receipts.upload': true,
      'receipts.code': true,
      'receipts.add_notes': true,
      
      // Timecards - View own timecards only
      'timecards.view': true,

      // PM Lynk - Access all except bill coding
      'pm_lynk.messages': true,
      'pm_lynk.delivery_tickets': true,
      'pm_lynk.receipt_scanner': true,
      'pm_lynk.tasks': true,
      'pm_lynk.safety': true,
      'pm_lynk.directory': true,
      
      // Dashboard - Limited view
      'dashboard.notifications': true,
      'dashboard.messages': true,
      'dashboard.punch_clock': true,
    }
  },
  {
    role: 'view_only',
    label: 'View Only',
    color: 'outline',
    permissions: {
      // Jobs - View only, NO editing whatsoever
      'jobs.view': true,
      'jobs.view_all': true,
      'jobs.view_details': true,
      'jobs.view_financials': true,
      'jobs.view_profitability': true,
      'jobs.view_cost_codes': true,
      'jobs.view_location': true,
      
      // Bills - View only, NO editing
      'bills.view': true,
      'bills.view_all': true,
      'bills.view_details': true,
      'bills.view_amounts': true,
      'bills.view_payment_history': true,
      
      // Receipts - View only
      'receipts.view': true,
      'receipts.view_all': true,
      'receipts.view_coded': true,
      'receipts.view_amounts': true,
      
      // Vendors - View only
      'vendors.view': true,
      'vendors.view_all': true,
      'vendors.view_details': true,
      'vendors.view_contact': true,
      'vendors.view_compliance': true,
      'vendors.view_history': true,
      
      // Banking - View only
      'banking.view': true,
      'banking.view_accounts': true,
      'banking.view_balances': true,
      'banking.view_transactions': true,
      'banking.view_reconciliation': true,
      'banking.view_ledger': true,
      'banking.view_chart': true,
      'banking.view_reports': true,
      
      // Credit Cards - View only
      'credit_cards.view': true,
      'credit_cards.view_all': true,
      'credit_cards.view_details': true,
      'credit_cards.view_transactions': true,
      'credit_cards.view_statements': true,
      'credit_cards.view_payment_history': true,
      
      // Employees - View only
      'employees.view': true,
      'employees.view_all': true,
      'employees.view_details': true,
      'employees.view_contact': true,
      
      // Timecards - View only
      'timecards.view': true,
      'timecards.view_all': true,
      
      // PO & Subcontracts - View only
      'po.view': true,
      'po.view_all': true,
      'po.view_details': true,
      'subcontracts.view': true,
      'subcontracts.view_all': true,
      'subcontracts.view_details': true,
      
      // Reports - View and export only
      'reports.view': true,
      'reports.job_costing': true,
      'reports.job_profitability': true,
      'reports.financial': true,
      'reports.balance_sheet': true,
      'reports.cash_flow': true,
      'reports.timecard': true,
      'reports.payroll': true,
      'reports.vendor': true,
      'reports.vendor_aging': true,
      'reports.receipt': true,
      'reports.budget_variance': true,
      'reports.commitment': true,
      'reports.export': true,
      'reports.print': true,
      
      // Dashboard - View only
      'dashboard.stats': true,
      'dashboard.notifications': true,
      'dashboard.active_jobs': true,
      'dashboard.bills_overview': true,
      'dashboard.payment_status': true,
      'dashboard.budget_tracking': true,
      'dashboard.project_progress': true,
    }
  },
  {
    role: 'vendor',
    label: 'Vendor',
    color: 'secondary',
    permissions: {
      // Jobs - View only jobs they're assigned to
      'jobs.view': true,
      'jobs.view_details': true,
      
      // Bills - View and submit bills
      'bills.view': true,
      'bills.view_details': true,
      'bills.view_amounts': true,
      'bills.create': true,
      'bills.upload_attachments': true,
      'bills.add_notes': true,
      'bills.communicate': true,
      
      // Purchase Orders - View only
      'po.view': true,
      'po.view_details': true,
      
      // Subcontracts - View only their subcontracts
      'subcontracts.view': true,
      'subcontracts.view_details': true,
      'subcontracts.upload_docs': true,
      
      // Documents - Upload compliance documents
      'vendors.view_compliance': true,
      'vendors.manage_compliance': true,
      'vendors.upload_insurance': true,
      'vendors.upload_permits': true,
      'vendors.upload_contracts': true,
      
      // Dashboard - Limited view
      'dashboard.notifications': true,
      'dashboard.messages': true,
    }
  }
];

export default function RoleDefinitions() {
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>(defaultRoleDefinitions);
  const [openRoles, setOpenRoles] = useState<{ [key: string]: boolean }>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const { toast } = useToast();

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    // Initialize with first role open by default
    setOpenRoles({ [defaultRoleDefinitions[0].role]: true });
    setLoading(false);
  }, []);

  const toggleRole = (role: string) => {
    setOpenRoles(prev => ({ ...prev, [role]: !prev[role] }));
  };

  const updatePermission = (role: string, permissionKey: string, checked: boolean) => {
    setRoleDefinitions(prev =>
      prev.map(r =>
        r.role === role
          ? { ...r, permissions: { ...r.permissions, [permissionKey]: checked } }
          : r
      )
    );
    setHasUnsavedChanges(true);
  };

  const saveChanges = () => {
    // In a real application, this would save to the database
    setHasUnsavedChanges(false);
    toast({
      title: 'Changes Saved',
      description: 'Role permissions have been updated successfully',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading role definitions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {hasUnsavedChanges && isAdmin && (
        <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
          <p className="text-sm text-muted-foreground">You have unsaved changes to role permissions</p>
          <Button onClick={saveChanges} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      )}

      {!isAdmin && (
        <div className="p-4 bg-accent rounded-lg">
          <p className="text-sm text-muted-foreground">Only administrators can modify role permissions.</p>
        </div>
      )}
      
      <div className="space-y-4">
        {roleDefinitions.map((roleDef) => (
          <Card key={roleDef.role}>
            <Collapsible open={openRoles[roleDef.role]} onOpenChange={() => toggleRole(roleDef.role)}>
              <CardHeader>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Badge variant={roleDef.color as any}>{roleDef.label}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {Object.values(roleDef.permissions).filter(Boolean).length} permissions enabled
                      </span>
                    </div>
                    {openRoles[roleDef.role] ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {PERMISSION_CATEGORIES.map((category) => (
                    <div key={category.category} className="space-y-3">
                      <h4 className="font-semibold text-sm">{category.category}</h4>
                      <div className="space-y-3 pl-4">
                        {category.permissions.map((permission) => (
                          <div key={permission.key} className="flex items-start gap-3">
                            <Checkbox
                              id={`${roleDef.role}-${permission.key}`}
                              checked={roleDef.permissions[permission.key] || false}
                              onCheckedChange={(checked) =>
                                isAdmin && updatePermission(roleDef.role, permission.key, checked as boolean)
                              }
                              disabled={!isAdmin}
                            />
                            <div className="flex-1 space-y-1">
                              <Label
                                htmlFor={`${roleDef.role}-${permission.key}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {permission.label}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {permission.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  );
}