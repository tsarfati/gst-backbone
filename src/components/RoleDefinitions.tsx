import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Save, ChevronDown, ChevronUp } from 'lucide-react';
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
      { key: 'jobs.create', label: 'Create Jobs', description: 'Can create new jobs/projects' },
      { key: 'jobs.edit', label: 'Edit Jobs', description: 'Can edit existing jobs' },
      { key: 'jobs.delete', label: 'Delete Jobs', description: 'Can delete jobs' },
      { key: 'jobs.view_all', label: 'View All Jobs', description: 'Can view all jobs in the company' },
      { key: 'jobs.manage_budget', label: 'Manage Job Budgets', description: 'Can create and modify job budgets' },
      { key: 'jobs.view_financials', label: 'View Job Financials', description: 'Can view job cost and financial data' },
      { key: 'jobs.assign_users', label: 'Assign Users to Jobs', description: 'Can assign team members to jobs' },
    ]
  },
  {
    category: 'Bills & Payables',
    permissions: [
      { key: 'bills.create', label: 'Create Bills', description: 'Can create new bills' },
      { key: 'bills.edit', label: 'Edit Bills', description: 'Can edit existing bills' },
      { key: 'bills.delete', label: 'Delete Bills', description: 'Can delete bills' },
      { key: 'bills.view_all', label: 'View All Bills', description: 'Can view all company bills' },
      { key: 'bills.approve', label: 'Approve Bills', description: 'Can approve bills for payment' },
      { key: 'bills.code', label: 'Code Bills', description: 'Can assign cost codes to bills' },
      { key: 'bills.make_payment', label: 'Make Payments', description: 'Can process bill payments' },
    ]
  },
  {
    category: 'Receipts & Expenses',
    permissions: [
      { key: 'receipts.upload', label: 'Upload Receipts', description: 'Can upload receipt images' },
      { key: 'receipts.code', label: 'Code Receipts', description: 'Can assign cost codes to receipts' },
      { key: 'receipts.approve', label: 'Approve Receipts', description: 'Can approve coded receipts' },
      { key: 'receipts.view_all', label: 'View All Receipts', description: 'Can view all company receipts' },
      { key: 'receipts.delete', label: 'Delete Receipts', description: 'Can delete receipts' },
    ]
  },
  {
    category: 'Vendors',
    permissions: [
      { key: 'vendors.create', label: 'Create Vendors', description: 'Can create new vendors' },
      { key: 'vendors.edit', label: 'Edit Vendors', description: 'Can edit vendor information' },
      { key: 'vendors.delete', label: 'Delete Vendors', description: 'Can delete vendors' },
      { key: 'vendors.view_all', label: 'View All Vendors', description: 'Can view all company vendors' },
      { key: 'vendors.manage_compliance', label: 'Manage Vendor Compliance', description: 'Can manage insurance, permits, contracts' },
    ]
  },
  {
    category: 'Banking & Accounting',
    permissions: [
      { key: 'banking.view_accounts', label: 'View Bank Accounts', description: 'Can view bank account details' },
      { key: 'banking.reconcile', label: 'Reconcile Accounts', description: 'Can reconcile bank accounts' },
      { key: 'banking.create_entries', label: 'Create Journal Entries', description: 'Can create manual journal entries' },
      { key: 'banking.view_ledger', label: 'View General Ledger', description: 'Can view general ledger' },
      { key: 'banking.manage_chart', label: 'Manage Chart of Accounts', description: 'Can modify chart of accounts' },
      { key: 'banking.view_reports', label: 'View Financial Reports', description: 'Can view financial reports' },
    ]
  },
  {
    category: 'Credit Cards',
    permissions: [
      { key: 'credit_cards.view', label: 'View Credit Cards', description: 'Can view credit card accounts' },
      { key: 'credit_cards.code_transactions', label: 'Code Transactions', description: 'Can code credit card transactions' },
      { key: 'credit_cards.make_payment', label: 'Make Payments', description: 'Can make credit card payments' },
      { key: 'credit_cards.manage', label: 'Manage Cards', description: 'Can add/edit/delete credit card accounts' },
    ]
  },
  {
    category: 'Employees & Time Tracking',
    permissions: [
      { key: 'employees.create', label: 'Create Employees', description: 'Can add new employees' },
      { key: 'employees.edit', label: 'Edit Employees', description: 'Can edit employee information' },
      { key: 'employees.delete', label: 'Delete Employees', description: 'Can delete employees' },
      { key: 'employees.view_all', label: 'View All Employees', description: 'Can view all company employees' },
      { key: 'timecards.view', label: 'View Timecards', description: 'Can view employee timecards' },
      { key: 'timecards.edit', label: 'Edit Timecards', description: 'Can edit timecard entries' },
      { key: 'timecards.approve', label: 'Approve Timecards', description: 'Can approve timecards for payroll' },
    ]
  },
  {
    category: 'Purchase Orders & Subcontracts',
    permissions: [
      { key: 'po.create', label: 'Create Purchase Orders', description: 'Can create purchase orders' },
      { key: 'po.edit', label: 'Edit Purchase Orders', description: 'Can edit purchase orders' },
      { key: 'po.approve', label: 'Approve Purchase Orders', description: 'Can approve purchase orders' },
      { key: 'subcontracts.create', label: 'Create Subcontracts', description: 'Can create subcontracts' },
      { key: 'subcontracts.edit', label: 'Edit Subcontracts', description: 'Can edit subcontracts' },
      { key: 'subcontracts.approve', label: 'Approve Subcontracts', description: 'Can approve subcontracts' },
    ]
  },
  {
    category: 'Reports & Analytics',
    permissions: [
      { key: 'reports.job_costing', label: 'Job Costing Reports', description: 'Can view job costing reports' },
      { key: 'reports.financial', label: 'Financial Reports', description: 'Can view financial reports' },
      { key: 'reports.timecard', label: 'Timecard Reports', description: 'Can view timecard reports' },
      { key: 'reports.vendor', label: 'Vendor Reports', description: 'Can view vendor reports' },
      { key: 'reports.export', label: 'Export Reports', description: 'Can export reports to Excel/PDF' },
    ]
  },
  {
    category: 'System Administration',
    permissions: [
      { key: 'admin.users', label: 'Manage Users', description: 'Can create/edit/delete users' },
      { key: 'admin.roles', label: 'Manage Roles', description: 'Can modify role permissions' },
      { key: 'admin.company_settings', label: 'Company Settings', description: 'Can modify company settings' },
      { key: 'admin.cost_codes', label: 'Manage Cost Codes', description: 'Can manage cost code structure' },
      { key: 'admin.integrations', label: 'Manage Integrations', description: 'Can configure system integrations' },
      { key: 'admin.audit_logs', label: 'View Audit Logs', description: 'Can view system audit logs' },
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
      'jobs.view_all': true,
      'jobs.view_financials': true,
      'bills.view_all': true,
      'bills.approve': true,
      'bills.code': true,
      'bills.make_payment': true,
      'receipts.view_all': true,
      'receipts.approve': true,
      'receipts.code': true,
      'vendors.view_all': true,
      'banking.view_accounts': true,
      'banking.reconcile': true,
      'banking.create_entries': true,
      'banking.view_ledger': true,
      'banking.view_reports': true,
      'credit_cards.view': true,
      'credit_cards.code_transactions': true,
      'credit_cards.make_payment': true,
      'employees.view_all': true,
      'timecards.view': true,
      'timecards.approve': true,
      'po.approve': true,
      'subcontracts.approve': true,
      'reports.job_costing': true,
      'reports.financial': true,
      'reports.timecard': true,
      'reports.vendor': true,
      'reports.export': true,
      'admin.users': true,
    }
  },
  {
    role: 'project_manager',
    label: 'Project Manager',
    color: 'default',
    permissions: {
      'jobs.create': true,
      'jobs.edit': true,
      'jobs.view_all': true,
      'jobs.manage_budget': true,
      'jobs.view_financials': true,
      'jobs.assign_users': true,
      'bills.view_all': true,
      'bills.code': true,
      'receipts.upload': true,
      'receipts.code': true,
      'receipts.view_all': true,
      'vendors.create': true,
      'vendors.edit': true,
      'vendors.view_all': true,
      'vendors.manage_compliance': true,
      'employees.view_all': true,
      'timecards.view': true,
      'timecards.edit': true,
      'po.create': true,
      'po.edit': true,
      'subcontracts.create': true,
      'subcontracts.edit': true,
      'reports.job_costing': true,
      'reports.timecard': true,
      'reports.vendor': true,
    }
  },
  {
    role: 'employee',
    label: 'Employee',
    color: 'outline',
    permissions: {
      'receipts.upload': true,
      'receipts.code': true,
      'timecards.view': true,
    }
  },
  {
    role: 'view_only',
    label: 'View Only',
    color: 'outline',
    permissions: {
      'jobs.view_all': true,
      'bills.view_all': true,
      'receipts.view_all': true,
      'vendors.view_all': true,
      'employees.view_all': true,
      'timecards.view': true,
      'reports.job_costing': true,
      'reports.financial': true,
      'reports.timecard': true,
      'reports.vendor': true,
    }
  }
];

export default function RoleDefinitions() {
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>(defaultRoleDefinitions);
  const [openRoles, setOpenRoles] = useState<{ [key: string]: boolean }>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  const isAdmin = profile?.role === 'admin';

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