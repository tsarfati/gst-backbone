import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { X, Plus, CheckCircle, AlertTriangle, DollarSign, Users, Bell, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import JobBillApprovalSettings from './JobBillApprovalSettings';
import { useSettings } from '@/contexts/SettingsContext';

const payablesSettingsSchema = z.object({
  bills_require_approval: z.boolean(),
  bills_approval_roles: z.array(z.string()),
  bills_auto_approve_roles: z.array(z.string()),
  bills_max_auto_approve_amount: z.number().min(0),
  payments_require_approval: z.boolean(),
  payment_approval_threshold: z.number().min(0),
  payment_approval_roles: z.array(z.string()),
  payment_auto_approve_roles: z.array(z.string()),
  payment_dual_approval_threshold: z.number().min(0),
  payment_dual_approval_roles: z.array(z.string()),
  notify_on_bill_submission: z.boolean(),
  notify_on_payment_approval: z.boolean(),
  send_payment_confirmations: z.boolean(),
  default_payment_terms: z.string(),
  default_payment_method: z.string(),
  require_receipt_attachment: z.boolean(),
  require_bill_documents: z.boolean(),
  require_cc_attachment: z.boolean(),
  allowed_subcontract_vendor_types: z.array(z.string()),
  allowed_po_vendor_types: z.array(z.string()),
  show_vendor_compliance_warnings: z.boolean(),
});

interface PayablesSettingsData {
  bills_require_approval: boolean;
  bills_approval_roles: string[];
  bills_auto_approve_roles: string[];
  bills_max_auto_approve_amount: number;
  payments_require_approval: boolean;
  payment_approval_threshold: number;
  payment_approval_roles: string[];
  payment_auto_approve_roles: string[];
  payment_dual_approval_threshold: number;
  payment_dual_approval_roles: string[];
  notify_on_bill_submission: boolean;
  notify_on_payment_approval: boolean;
  send_payment_confirmations: boolean;
  default_payment_terms: string;
  default_payment_method: string;
  require_receipt_attachment: boolean;
  require_bill_documents: boolean;
  require_cc_attachment: boolean;
  allowed_subcontract_vendor_types: string[];
  allowed_po_vendor_types: string[];
  show_vendor_compliance_warnings: boolean;
}

const defaultSettings: PayablesSettingsData = {
  bills_require_approval: true,
  bills_approval_roles: ['admin', 'controller'],
  bills_auto_approve_roles: ['admin'],
  bills_max_auto_approve_amount: 1000,
  payments_require_approval: true,
  payment_approval_threshold: 5000,
  payment_approval_roles: ['admin', 'controller'],
  payment_auto_approve_roles: ['admin'],
  payment_dual_approval_threshold: 25000,
  payment_dual_approval_roles: ['admin', 'controller'],
  notify_on_bill_submission: true,
  notify_on_payment_approval: true,
  send_payment_confirmations: true,
  default_payment_terms: '30',
  default_payment_method: 'check',
  require_receipt_attachment: false,
  require_bill_documents: false,
  require_cc_attachment: false,
  allowed_subcontract_vendor_types: ['Contractor', 'Design Professional'],
  allowed_po_vendor_types: ['Supplier'],
  show_vendor_compliance_warnings: true,
};

const availableRoles = [
  { value: 'admin', label: 'Admin', icon: Settings },
  { value: 'controller', label: 'Controller', icon: DollarSign },
  { value: 'project_manager', label: 'Project Manager', icon: Users },
  { value: 'manager', label: 'Manager', icon: Users },
  { value: 'employee', label: 'Employee', icon: Users },
];

const paymentMethods = [
  { value: 'check', label: 'Check' },
  { value: 'ach', label: 'ACH Transfer' },
  { value: 'wire', label: 'Wire Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
];

const paymentTermsOptions = [
  { value: 'asap', label: 'ASAP' },
  { value: '15', label: 'Net 15' },
  { value: '30', label: 'Net 30' },
  { value: '45', label: 'Net 45' },
  { value: '60', label: 'Net 60' },
];

const vendorTypes = [
  { value: 'Contractor', label: 'Contractor' },
  { value: 'Supplier', label: 'Supplier' },
  { value: 'Consultant', label: 'Consultant' },
  { value: 'Design Professional', label: 'Design Professional' },
  { value: 'Other', label: 'Other' },
];

export default function PayablesSettings() {
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { settings: appSettings } = useSettings();
  const [settings, setSettings] = useState<PayablesSettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const autoSaveReadyRef = useRef(false);

  useEffect(() => {
    if (currentCompany?.id) {
      loadSettings();
    }
  }, [currentCompany?.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('payables_settings')
        .select('*')
        .eq('company_id', currentCompany?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          bills_require_approval: data.bills_require_approval,
          bills_approval_roles: data.bills_approval_roles,
          bills_auto_approve_roles: data.bills_auto_approve_roles,
           bills_max_auto_approve_amount: parseFloat(String(data.bills_max_auto_approve_amount || '1000')),
           payments_require_approval: data.payments_require_approval,
           payment_approval_threshold: parseFloat(String(data.payment_approval_threshold || '5000')),
           payment_approval_roles: data.payment_approval_roles,
           payment_auto_approve_roles: data.payment_auto_approve_roles,
           payment_dual_approval_threshold: parseFloat(String(data.payment_dual_approval_threshold || '25000')),
          payment_dual_approval_roles: data.payment_dual_approval_roles,
          notify_on_bill_submission: data.notify_on_bill_submission,
          notify_on_payment_approval: data.notify_on_payment_approval,
          send_payment_confirmations: data.send_payment_confirmations,
          default_payment_terms: data.default_payment_terms,
          default_payment_method: data.default_payment_method,
          require_receipt_attachment: data.require_receipt_attachment,
          require_bill_documents: data.require_bill_documents ?? false,
          require_cc_attachment: data.require_cc_attachment ?? false,
          allowed_subcontract_vendor_types: data.allowed_subcontract_vendor_types || ['Contractor', 'Design Professional'],
          allowed_po_vendor_types: data.allowed_po_vendor_types || ['Supplier'],
          show_vendor_compliance_warnings: data.show_vendor_compliance_warnings ?? true,
        });
      }
      autoSaveReadyRef.current = true;
    } catch (error) {
      console.error('Error loading payables settings:', error);
      toast({
        title: "Error",
        description: "Failed to load payables settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (showToast: boolean = true) => {
    try {
      setSaving(true);
      
      const validatedSettings = payablesSettingsSchema.parse(settings);
      
      const { error } = await supabase
        .from('payables_settings')
        .upsert({
          company_id: currentCompany?.id,
          ...validatedSettings,
          created_by: profile?.user_id,
        });

      if (error) throw error;

      if (showToast) {
        toast({
          title: "Settings saved",
          description: "Payables settings have been updated successfully.",
        });
      }
    } catch (error) {
      console.error('Error saving payables settings:', error);
      if (showToast) {
        toast({
          title: "Error",
          description: "Failed to save payables settings",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (key: keyof PayablesSettingsData, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const addRole = (settingKey: keyof PayablesSettingsData, role: string) => {
    const currentRoles = settings[settingKey] as string[];
    if (!currentRoles.includes(role)) {
      updateSettings(settingKey, [...currentRoles, role]);
    }
  };

  const removeRole = (settingKey: keyof PayablesSettingsData, role: string) => {
    const currentRoles = settings[settingKey] as string[];
    updateSettings(settingKey, currentRoles.filter(r => r !== role));
  };

  useEffect(() => {
    if (!appSettings.autoSave || loading || saving || !currentCompany?.id || !autoSaveReadyRef.current) return;

    const timer = setTimeout(() => {
      void saveSettings(false);
    }, 900);

    return () => clearTimeout(timer);
  }, [settings, appSettings.autoSave, loading, saving, currentCompany?.id]);

  const RoleSelector = ({ 
    settingKey, 
    title, 
    description 
  }: { 
    settingKey: keyof PayablesSettingsData;
    title: string;
    description: string;
  }) => {
    const selectedRoles = settings[settingKey] as string[];
    
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">{title}</Label>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedRoles.map(role => {
            const roleInfo = availableRoles.find(r => r.value === role);
            return (
              <Badge key={role} variant="secondary" className="flex items-center gap-1">
                {roleInfo?.label || role}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeRole(settingKey, role)}
                />
              </Badge>
            );
          })}
        </div>
        <Select onValueChange={(role) => addRole(settingKey, role)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Add role..." />
          </SelectTrigger>
          <SelectContent>
            {availableRoles
              .filter(role => !selectedRoles.includes(role.value))
              .map(role => (
                <SelectItem key={role.value} value={role.value}>
                  <div className="flex items-center gap-2">
                    <role.icon className="h-4 w-4" />
                    {role.label}
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading payables settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Bills Approval Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold">Bills Approval Requirements</h3>
        </div>
        
        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Bill Approval</Label>
              <p className="text-sm text-muted-foreground">All bills must be approved before payment</p>
            </div>
            <Switch
              checked={settings.bills_require_approval}
              onCheckedChange={(checked) => updateSettings('bills_require_approval', checked)}
            />
          </div>

          {settings.bills_require_approval && (
            <>
              <RoleSelector
                settingKey="bills_approval_roles"
                title="Bill Approval Roles"
                description="User roles that can approve bills"
              />

              <RoleSelector
                settingKey="bills_auto_approve_roles"
                title="Auto-Approval Roles"
                description="User roles that can create auto-approved bills"
              />

              <div className="space-y-3">
                <Label>Auto-Approval Amount Limit</Label>
                <p className="text-sm text-muted-foreground">Bills under this amount from auto-approval roles are automatically approved</p>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.bills_max_auto_approve_amount}
                  onChange={(e) => updateSettings('bills_max_auto_approve_amount', parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Payment Approval Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Payment Approval Settings</h3>
        </div>
        
        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Payment Approval</Label>
              <p className="text-sm text-muted-foreground">Payments above threshold require approval</p>
            </div>
            <Switch
              checked={settings.payments_require_approval}
              onCheckedChange={(checked) => updateSettings('payments_require_approval', checked)}
            />
          </div>

          {settings.payments_require_approval && (
            <>
              <div className="space-y-3">
                <Label>Payment Approval Threshold</Label>
                <p className="text-sm text-muted-foreground">Payments above this amount require approval</p>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.payment_approval_threshold}
                  onChange={(e) => updateSettings('payment_approval_threshold', parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
              </div>

              <RoleSelector
                settingKey="payment_approval_roles"
                title="Payment Approval Roles"
                description="User roles that can approve payments"
              />

              <RoleSelector
                settingKey="payment_auto_approve_roles"
                title="Auto-Approval Roles"
                description="User roles that can create auto-approved payments"
              />

              <div className="space-y-3">
                <Label>Dual Approval Threshold</Label>
                <p className="text-sm text-muted-foreground">Payments above this amount require two approvals</p>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.payment_dual_approval_threshold}
                  onChange={(e) => updateSettings('payment_dual_approval_threshold', parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
              </div>

              <RoleSelector
                settingKey="payment_dual_approval_roles"
                title="Dual Approval Roles"
                description="User roles required for dual approval"
              />
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Notification Settings */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-orange-600" />
          <h3 className="text-lg font-semibold">Notification Settings</h3>
        </div>
        
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Bill Submission Notifications</Label>
              <p className="text-sm text-muted-foreground">Notify approvers when bills are submitted</p>
            </div>
            <Switch
              checked={settings.notify_on_bill_submission}
              onCheckedChange={(checked) => updateSettings('notify_on_bill_submission', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Payment Approval Notifications</Label>
              <p className="text-sm text-muted-foreground">Notify when payments need approval</p>
            </div>
            <Switch
              checked={settings.notify_on_payment_approval}
              onCheckedChange={(checked) => updateSettings('notify_on_payment_approval', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Payment Confirmations</Label>
              <p className="text-sm text-muted-foreground">Send confirmation emails when payments are processed</p>
            </div>
            <Switch
              checked={settings.send_payment_confirmations}
              onCheckedChange={(checked) => updateSettings('send_payment_confirmations', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Vendor Type Restrictions */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Type Restrictions</CardTitle>
          <CardDescription>Configure which vendor types can be assigned to subcontracts and purchase orders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Allowed Subcontract Vendor Types */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Allowed Vendor Types for Subcontracts</Label>
            <p className="text-xs text-muted-foreground">
              Select which vendor types can be assigned to subcontracts
            </p>
            <div className="space-y-2">
              {vendorTypes.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`subcontract-${type.value}`}
                    checked={settings.allowed_subcontract_vendor_types.includes(type.value)}
                    onChange={(e) => {
                      const types = e.target.checked
                        ? [...settings.allowed_subcontract_vendor_types, type.value]
                        : settings.allowed_subcontract_vendor_types.filter(t => t !== type.value);
                      updateSettings("allowed_subcontract_vendor_types", types);
                    }}
                    className="rounded border-input"
                  />
                  <Label htmlFor={`subcontract-${type.value}`} className="font-normal cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Allowed PO Vendor Types */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Allowed Vendor Types for Purchase Orders</Label>
            <p className="text-xs text-muted-foreground">
              Select which vendor types can be assigned to purchase orders
            </p>
            <div className="space-y-2">
              {vendorTypes.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`po-${type.value}`}
                    checked={settings.allowed_po_vendor_types.includes(type.value)}
                    onChange={(e) => {
                      const types = e.target.checked
                        ? [...settings.allowed_po_vendor_types, type.value]
                        : settings.allowed_po_vendor_types.filter(t => t !== type.value);
                      updateSettings("allowed_po_vendor_types", types);
                    }}
                    className="rounded border-input"
                  />
                  <Label htmlFor={`po-${type.value}`} className="font-normal cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Default Settings */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Default Settings</h3>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Label>Default Payment Terms</Label>
            <Select
              value={settings.default_payment_terms}
              onValueChange={(value) => updateSettings('default_payment_terms', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentTermsOptions.map(term => (
                  <SelectItem key={term.value} value={term.value}>
                    {term.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Default Payment Method</Label>
            <Select
              value={settings.default_payment_method}
              onValueChange={(value) => updateSettings('default_payment_method', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map(method => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between md:col-span-2">
            <div className="space-y-1">
              <Label>Require Receipt Attachment</Label>
              <p className="text-sm text-muted-foreground">Bills must have receipt attachments</p>
            </div>
            <Switch
              checked={settings.require_receipt_attachment}
              onCheckedChange={(checked) => updateSettings('require_receipt_attachment', checked)}
            />
          </div>

          <div className="flex items-center justify-between md:col-span-2">
            <div className="space-y-1">
              <Label>Require Bill Documents</Label>
              <p className="text-sm text-muted-foreground">All bills must have a document or attachment before submission</p>
            </div>
            <Switch
              checked={settings.require_bill_documents}
              onCheckedChange={(checked) => updateSettings('require_bill_documents', checked)}
            />
          </div>

          <div className="flex items-center justify-between md:col-span-2">
            <div className="space-y-1">
              <Label>Require Credit Card Attachments</Label>
              <p className="text-sm text-muted-foreground">Credit card transactions must have attachments to be marked as coded</p>
            </div>
            <Switch
              checked={settings.require_cc_attachment}
              onCheckedChange={(checked) => updateSettings('require_cc_attachment', checked)}
            />
          </div>

          <div className="flex items-center justify-between md:col-span-2">
            <div className="space-y-1">
              <Label>Show Vendor Compliance Warnings</Label>
              <p className="text-sm text-muted-foreground">Display warnings when entering bills for vendors with missing compliance documents</p>
            </div>
            <Switch
              checked={settings.show_vendor_compliance_warnings}
              onCheckedChange={(checked) => updateSettings('show_vendor_compliance_warnings', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Job-Specific Bill Approval Settings */}
      <JobBillApprovalSettings />

      {!appSettings.autoSave && (
        <div className="flex justify-end pt-6">
          <Button onClick={() => void saveSettings()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Payables Settings'}
          </Button>
        </div>
      )}
    </div>
  );
}
