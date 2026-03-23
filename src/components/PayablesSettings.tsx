import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, CheckCircle, DollarSign, Users, Settings, Copy, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import JobBillApprovalSettings from './JobBillApprovalSettings';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';

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
  require_bill_distribution_before_approval: z.boolean(),
  require_cc_attachment: z.boolean(),
  allowed_subcontract_vendor_types: z.array(z.string()),
  allowed_po_vendor_types: z.array(z.string()),
  show_vendor_compliance_warnings: z.boolean(),
  vendor_portal_enabled: z.boolean(),
  vendor_portal_payment_changes_auto_approve: z.boolean(),
  vendor_portal_require_job_assignment_for_bills: z.boolean(),
  vendor_portal_default_job_access_billing: z.boolean(),
  vendor_portal_default_job_access_team_directory: z.boolean(),
  vendor_portal_default_job_access_plans: z.boolean(),
  vendor_portal_default_job_access_rfis: z.boolean(),
  vendor_portal_signup_background_image_url: z.string(),
  vendor_portal_signup_background_color: z.string(),
  vendor_portal_signup_company_logo_url: z.string(),
  vendor_portal_signup_header_logo_url: z.string(),
  vendor_portal_signup_header_title: z.string(),
  vendor_portal_signup_header_subtitle: z.string(),
  vendor_portal_signup_modal_color: z.string(),
  vendor_portal_signup_modal_opacity: z.number().min(0).max(1),
  vendor_portal_require_profile_completion: z.boolean(),
  vendor_portal_require_payment_method: z.boolean(),
  vendor_portal_require_w9: z.boolean(),
  vendor_portal_require_insurance: z.boolean(),
  vendor_portal_require_company_logo: z.boolean(),
  vendor_portal_require_user_avatar: z.boolean(),
  vendor_portal_signature_provider: z.string(),
  vendor_portal_allow_vendor_contract_negotiation: z.boolean(),
  vendor_portal_allow_vendor_sov_input: z.boolean(),
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
  require_bill_distribution_before_approval: boolean;
  require_cc_attachment: boolean;
  allowed_subcontract_vendor_types: string[];
  allowed_po_vendor_types: string[];
  show_vendor_compliance_warnings: boolean;
  vendor_portal_enabled: boolean;
  vendor_portal_payment_changes_auto_approve: boolean;
  vendor_portal_require_job_assignment_for_bills: boolean;
  vendor_portal_default_job_access_billing: boolean;
  vendor_portal_default_job_access_team_directory: boolean;
  vendor_portal_default_job_access_plans: boolean;
  vendor_portal_default_job_access_rfis: boolean;
  vendor_portal_signup_background_image_url: string;
  vendor_portal_signup_background_color: string;
  vendor_portal_signup_company_logo_url: string;
  vendor_portal_signup_header_logo_url: string;
  vendor_portal_signup_header_title: string;
  vendor_portal_signup_header_subtitle: string;
  vendor_portal_signup_modal_color: string;
  vendor_portal_signup_modal_opacity: number;
  vendor_portal_require_profile_completion: boolean;
  vendor_portal_require_payment_method: boolean;
  vendor_portal_require_w9: boolean;
  vendor_portal_require_insurance: boolean;
  vendor_portal_require_company_logo: boolean;
  vendor_portal_require_user_avatar: boolean;
  vendor_portal_signature_provider: string;
  vendor_portal_allow_vendor_contract_negotiation: boolean;
  vendor_portal_allow_vendor_sov_input: boolean;
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
  require_bill_distribution_before_approval: true,
  require_cc_attachment: false,
  allowed_subcontract_vendor_types: ['Contractor', 'Design Professional'],
  allowed_po_vendor_types: ['Supplier'],
  show_vendor_compliance_warnings: true,
  vendor_portal_enabled: true,
  vendor_portal_payment_changes_auto_approve: false,
  vendor_portal_require_job_assignment_for_bills: true,
  vendor_portal_default_job_access_billing: true,
  vendor_portal_default_job_access_team_directory: true,
  vendor_portal_default_job_access_plans: false,
  vendor_portal_default_job_access_rfis: false,
  vendor_portal_signup_background_image_url: '',
  vendor_portal_signup_background_color: '#030B20',
  vendor_portal_signup_company_logo_url: '',
  vendor_portal_signup_header_logo_url: '',
  vendor_portal_signup_header_title: 'Vendor & Design Professional Signup',
  vendor_portal_signup_header_subtitle: 'Create your account and submit your request for company approval.',
  vendor_portal_signup_modal_color: '#071231',
  vendor_portal_signup_modal_opacity: 0.96,
  vendor_portal_require_profile_completion: true,
  vendor_portal_require_payment_method: true,
  vendor_portal_require_w9: false,
  vendor_portal_require_insurance: false,
  vendor_portal_require_company_logo: false,
  vendor_portal_require_user_avatar: false,
  vendor_portal_signature_provider: 'manual',
  vendor_portal_allow_vendor_contract_negotiation: true,
  vendor_portal_allow_vendor_sov_input: true,
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
        const typedData = data as any;
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
          require_bill_distribution_before_approval: typedData.require_bill_distribution_before_approval ?? true,
          require_cc_attachment: data.require_cc_attachment ?? false,
          allowed_subcontract_vendor_types: data.allowed_subcontract_vendor_types || ['Contractor', 'Design Professional'],
          allowed_po_vendor_types: data.allowed_po_vendor_types || ['Supplier'],
          show_vendor_compliance_warnings: data.show_vendor_compliance_warnings ?? true,
          vendor_portal_enabled: typedData.vendor_portal_enabled ?? true,
          vendor_portal_payment_changes_auto_approve: typedData.vendor_portal_payment_changes_auto_approve ?? false,
          vendor_portal_require_job_assignment_for_bills: typedData.vendor_portal_require_job_assignment_for_bills ?? true,
          vendor_portal_default_job_access_billing: typedData.vendor_portal_default_job_access_billing ?? true,
          vendor_portal_default_job_access_team_directory: typedData.vendor_portal_default_job_access_team_directory ?? true,
          vendor_portal_default_job_access_plans: typedData.vendor_portal_default_job_access_plans ?? false,
          vendor_portal_default_job_access_rfis: typedData.vendor_portal_default_job_access_rfis ?? false,
          vendor_portal_signup_background_image_url: typedData.vendor_portal_signup_background_image_url ?? '',
          vendor_portal_signup_background_color: typedData.vendor_portal_signup_background_color ?? '#030B20',
          vendor_portal_signup_header_logo_url: typedData.vendor_portal_signup_header_logo_url ?? typedData.vendor_portal_signup_company_logo_url ?? '',
          vendor_portal_signup_company_logo_url: typedData.vendor_portal_signup_company_logo_url ?? typedData.vendor_portal_signup_header_logo_url ?? '',
          vendor_portal_signup_header_title: typedData.vendor_portal_signup_header_title ?? defaultSettings.vendor_portal_signup_header_title,
          vendor_portal_signup_header_subtitle: typedData.vendor_portal_signup_header_subtitle ?? defaultSettings.vendor_portal_signup_header_subtitle,
          vendor_portal_signup_modal_color: typedData.vendor_portal_signup_modal_color ?? '#071231',
          vendor_portal_signup_modal_opacity: Number(typedData.vendor_portal_signup_modal_opacity ?? 0.96),
          vendor_portal_require_profile_completion: typedData.vendor_portal_require_profile_completion ?? true,
          vendor_portal_require_payment_method: typedData.vendor_portal_require_payment_method ?? true,
          vendor_portal_require_w9: typedData.vendor_portal_require_w9 ?? false,
          vendor_portal_require_insurance: typedData.vendor_portal_require_insurance ?? false,
          vendor_portal_require_company_logo: typedData.vendor_portal_require_company_logo ?? false,
          vendor_portal_require_user_avatar: typedData.vendor_portal_require_user_avatar ?? false,
          vendor_portal_signature_provider: typedData.vendor_portal_signature_provider ?? 'manual',
          vendor_portal_allow_vendor_contract_negotiation: typedData.vendor_portal_allow_vendor_contract_negotiation ?? true,
          vendor_portal_allow_vendor_sov_input: typedData.vendor_portal_allow_vendor_sov_input ?? true,
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

  const persistVendorPortalSettings = async (partial: Partial<PayablesSettingsData>) => {
    if (!currentCompany?.id) return;
    try {
      const { data: updatedRows, error: updateError } = await supabase
        .from('payables_settings')
        .update(partial as any)
        .eq('company_id', currentCompany.id)
        .select('id');

      if (updateError) throw updateError;

      if (!updatedRows || updatedRows.length === 0) {
        if (!profile?.user_id) {
          throw new Error('Missing user context for payables settings creation.');
        }

        const { error: insertError } = await supabase
          .from('payables_settings')
          .insert({
            company_id: currentCompany.id,
            created_by: profile.user_id,
            ...defaultSettings,
            ...partial,
          } as any);

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Failed persisting vendor portal settings:', error);
      toast({
        title: 'Save failed',
        description: (error as any)?.message || 'Could not save vendor portal settings.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateVendorSetting = <K extends keyof PayablesSettingsData>(key: K, value: PayablesSettingsData[K]) => {
    updateSettings(key, value);
    void persistVendorPortalSettings({ [key]: value } as Partial<PayablesSettingsData>);
  };

  const publicVendorSignupUrl = currentCompany?.id
    ? `${window.location.origin}/vendor-signup?company=${encodeURIComponent(currentCompany.id)}`
    : '';

  const copyVendorSignupLink = async () => {
    if (!publicVendorSignupUrl) return;
    try {
      await navigator.clipboard.writeText(publicVendorSignupUrl);
      toast({
        title: 'Link copied',
        description: 'Vendor portal signup link copied to clipboard.',
      });
    } catch (error) {
      console.error('Failed to copy vendor signup link:', error);
      toast({
        title: 'Copy failed',
        description: 'Could not copy signup link.',
        variant: 'destructive',
      });
    }
  };

  const uploadVendorPortalAsset = async (
    file: File,
    field: 'vendor_portal_signup_background_image_url' | 'vendor_portal_signup_company_logo_url' | 'vendor_portal_signup_header_logo_url',
  ) => {
    if (!currentCompany?.id) return;

    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const filePath = `${currentCompany.id}/vendor-portal/${field}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('company-logos').getPublicUrl(filePath);
      if (field === 'vendor_portal_signup_header_logo_url' || field === 'vendor_portal_signup_company_logo_url') {
        // Keep both legacy fields aligned while using a single logo in UI.
        updateSettings('vendor_portal_signup_header_logo_url', data.publicUrl);
        updateSettings('vendor_portal_signup_company_logo_url', data.publicUrl);
        const saved = await persistVendorPortalSettings({
          vendor_portal_signup_header_logo_url: data.publicUrl,
          vendor_portal_signup_company_logo_url: data.publicUrl,
        });
        if (!saved) return;
      } else {
        updateSettings(field, data.publicUrl);
        const saved = await persistVendorPortalSettings({ [field]: data.publicUrl } as Partial<PayablesSettingsData>);
        if (!saved) return;
      }

      toast({
        title: 'Upload complete',
        description: 'Vendor portal branding asset updated.',
      });
    } catch (error) {
      console.error('Failed uploading vendor portal asset:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload vendor portal asset.',
        variant: 'destructive',
      });
    }
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

  const VendorPortalAssetDropzone = ({
    label,
    field,
    imageClassName,
  }: {
    label: string;
    field: 'vendor_portal_signup_background_image_url' | 'vendor_portal_signup_header_logo_url';
    imageClassName: string;
  }) => {
    const inputId = `vendor-portal-${field}-upload`;
    const value = settings[field];
    const [isDragging, setIsDragging] = useState(false);

    const onFileSelected = (file?: File) => {
      if (!file) return;
      void uploadVendorPortalAsset(file, field);
    };

    const onDrop: React.DragEventHandler<HTMLLabelElement> = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      onFileSelected(event.dataTransfer.files?.[0]);
    };

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <label
          htmlFor={inputId}
          onDrop={onDrop}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(false);
          }}
          className={cn(
            "group relative block cursor-pointer overflow-hidden rounded-lg border border-dashed bg-muted/20 transition-colors",
            isDragging ? "border-primary bg-primary/10" : "border-border/80 hover:border-primary/60 hover:bg-muted/40",
          )}
        >
          <div className="aspect-[16/8] w-full">
            {value ? (
              <img
                src={value}
                alt={`${label} preview`}
                className={cn('h-full w-full', imageClassName)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center gap-2 px-3 text-center text-xs text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                <span>No image uploaded</span>
              </div>
            )}
          </div>
          <div className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/45 px-4 text-center text-xs font-medium text-white transition-opacity",
            isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}>
            Drag Image Here or Choose Image
          </div>
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => onFileSelected(event.target.files?.[0])}
        />
      </div>
    );
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
        <div className="text-muted-foreground"><span className="loading-dots">Loading payables settings</span></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="approvals" className="space-y-6">
        <TabsList>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="defaults">Defaults & Rules</TabsTrigger>
          <TabsTrigger value="vendor-portal">Vendor Portal</TabsTrigger>
          <TabsTrigger value="job-approval">Job Bill Approval</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="space-y-8">
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

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Distribution Before Approval</Label>
              <p className="text-sm text-muted-foreground">
                Block approval until bill coding/distribution is complete (recommended)
              </p>
            </div>
            <Switch
              checked={settings.require_bill_distribution_before_approval}
              onCheckedChange={(checked) => updateSettings('require_bill_distribution_before_approval', checked)}
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
        </TabsContent>

        <TabsContent value="defaults" className="space-y-8">
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

          {/* Vendor Type Restrictions */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor Type Restrictions</CardTitle>
              <CardDescription>Configure which vendor types can be assigned to subcontracts and purchase orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
        </TabsContent>

        <TabsContent value="vendor-portal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Portal Customization</CardTitle>
              <CardDescription>
                Control the signup page visuals, colors, and modal styling for vendors/design professionals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <VendorPortalAssetDropzone
                    label="Background Image"
                    field="vendor_portal_signup_background_image_url"
                    imageClassName="object-cover"
                  />
                  <VendorPortalAssetDropzone
                    label="Company / Header Logo"
                    field="vendor_portal_signup_header_logo_url"
                    imageClassName="object-contain bg-white/90 p-2"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Signup Form Header</Label>
                    <Input
                      value={settings.vendor_portal_signup_header_title}
                      onChange={(e) => updateVendorSetting('vendor_portal_signup_header_title', e.target.value)}
                      placeholder="Vendor & Design Professional Signup"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Signup Form Subheader</Label>
                    <Input
                      value={settings.vendor_portal_signup_header_subtitle}
                      onChange={(e) => updateVendorSetting('vendor_portal_signup_header_subtitle', e.target.value)}
                      placeholder="Create your account and submit your request for approval."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Background Color (fallback)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={settings.vendor_portal_signup_background_color}
                        onChange={(e) => updateVendorSetting('vendor_portal_signup_background_color', e.target.value)}
                        className="h-10 w-14 p-1"
                      />
                      <Input
                        value={settings.vendor_portal_signup_background_color}
                        onChange={(e) => updateVendorSetting('vendor_portal_signup_background_color', e.target.value)}
                        placeholder="#030B20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Signup Modal Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={settings.vendor_portal_signup_modal_color}
                        onChange={(e) => updateVendorSetting('vendor_portal_signup_modal_color', e.target.value)}
                        className="h-10 w-14 p-1"
                      />
                      <Input
                        value={settings.vendor_portal_signup_modal_color}
                        onChange={(e) => updateVendorSetting('vendor_portal_signup_modal_color', e.target.value)}
                        placeholder="#071231"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Signup Modal Transparency</Label>
                    <Input
                      type="range"
                      min={10}
                      max={100}
                      step={1}
                      value={Math.round(settings.vendor_portal_signup_modal_opacity * 100)}
                      onChange={(e) =>
                        updateVendorSetting(
                          'vendor_portal_signup_modal_opacity',
                          Number(e.target.value) / 100,
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {Math.round(settings.vendor_portal_signup_modal_opacity * 100)}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                  <div className="rounded-md border border-border/60 p-2 space-y-1">
                    <div className="font-medium flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Background Preview</div>
                    {settings.vendor_portal_signup_background_image_url ? (
                      <img src={settings.vendor_portal_signup_background_image_url} alt="Background preview" className="h-16 w-full object-cover rounded" />
                    ) : (
                      <div
                        className="h-16 rounded flex items-center justify-center"
                        style={{ backgroundColor: settings.vendor_portal_signup_background_color }}
                      >
                        Color fallback
                      </div>
                    )}
                  </div>
                  <div className="rounded-md border border-border/60 p-2 space-y-1">
                    <div className="font-medium">Logo Preview</div>
                    {settings.vendor_portal_signup_header_logo_url ? (
                      <img src={settings.vendor_portal_signup_header_logo_url} alt="Logo preview" className="h-16 w-full object-contain rounded bg-white/90 p-1" />
                    ) : (
                      <div className="h-16 rounded bg-muted/40 flex items-center justify-center">Not set</div>
                    )}
                  </div>
                  <div className="rounded-md border border-border/60 p-2 space-y-1">
                    <div className="font-medium">Modal Preview</div>
                    <div
                      className="h-16 rounded border border-white/20"
                      style={{
                        backgroundColor: settings.vendor_portal_signup_modal_color,
                        opacity: settings.vendor_portal_signup_modal_opacity,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendor Portal Function</CardTitle>
              <CardDescription>
                Control portal availability, access defaults, and required onboarding behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Enable Vendor Portal</Label>
                  <p className="text-sm text-muted-foreground">Allow vendors/design professionals to access the portal experience</p>
                </div>
                <Switch
                  checked={settings.vendor_portal_enabled}
                  onCheckedChange={(checked) => updateVendorSetting('vendor_portal_enabled', checked)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Public Vendor Signup Link</Label>
                <Input value={publicVendorSignupUrl} readOnly />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" type="button" onClick={copyVendorSignupLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <Button variant="outline" type="button" asChild>
                  <a href={publicVendorSignupUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Signup Page
                  </a>
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Auto-Approve Vendor Payment Info Changes</Label>
                  <p className="text-sm text-muted-foreground">When off, all vendor payment method updates require internal approval</p>
                </div>
                <Switch
                  checked={settings.vendor_portal_payment_changes_auto_approve}
                  onCheckedChange={(checked) => updateVendorSetting('vendor_portal_payment_changes_auto_approve', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Require Job Assignment to Submit Bills</Label>
                  <p className="text-sm text-muted-foreground">Vendors must be associated with at least one job before bill submission</p>
                </div>
                <Switch
                  checked={settings.vendor_portal_require_job_assignment_for_bills}
                  onCheckedChange={(checked) => updateVendorSetting('vendor_portal_require_job_assignment_for_bills', checked)}
                />
              </div>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium">Contract Signature Provider</Label>
                <Select
                  value={settings.vendor_portal_signature_provider}
                  onValueChange={(value) => updateVendorSetting('vendor_portal_signature_provider', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (Upload Signed PDF)</SelectItem>
                    <SelectItem value="docusign">DocuSign (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
                {settings.vendor_portal_signature_provider === 'docusign' && (
                  <p className="text-xs text-muted-foreground">
                    DocuSign integration is not enabled yet. Keep this on Manual for live workflows.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label>Allow Vendor Contract Negotiation</Label>
                  <Switch
                    checked={settings.vendor_portal_allow_vendor_contract_negotiation}
                    onCheckedChange={(checked) => updateVendorSetting('vendor_portal_allow_vendor_contract_negotiation', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label>Allow Vendor SOV Input</Label>
                  <Switch
                    checked={settings.vendor_portal_allow_vendor_sov_input}
                    onCheckedChange={(checked) => updateVendorSetting('vendor_portal_allow_vendor_sov_input', checked)}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Default Job Access for Vendor Portal</Label>
                  <p className="text-sm text-muted-foreground mt-1">Applied by default when a vendor is assigned to a job</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Billing / Bill Submission</Label>
                    <Switch
                      checked={settings.vendor_portal_default_job_access_billing}
                      onCheckedChange={(checked) => updateVendorSetting('vendor_portal_default_job_access_billing', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Job Team Directory</Label>
                    <Switch
                      checked={settings.vendor_portal_default_job_access_team_directory}
                      onCheckedChange={(checked) => updateVendorSetting('vendor_portal_default_job_access_team_directory', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Plans</Label>
                    <Switch
                      checked={settings.vendor_portal_default_job_access_plans}
                      onCheckedChange={(checked) => updateVendorSetting('vendor_portal_default_job_access_plans', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>RFIs</Label>
                    <Switch
                      checked={settings.vendor_portal_default_job_access_rfis}
                      onCheckedChange={(checked) => updateVendorSetting('vendor_portal_default_job_access_rfis', checked)}
                    />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">First Invoice Requirements</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure onboarding checklist items vendors must complete before submitting their first invoice.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>Complete Profile</Label>
                    <Switch
                      checked={settings.vendor_portal_require_profile_completion}
                      onCheckedChange={(checked) => updateVendorSetting('vendor_portal_require_profile_completion', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>Set Payment Method</Label>
                    <Switch
                      checked={settings.vendor_portal_require_payment_method}
                      onCheckedChange={(checked) => updateVendorSetting('vendor_portal_require_payment_method', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>Upload W-9</Label>
                    <Switch
                      checked={settings.vendor_portal_require_w9}
                      onCheckedChange={(checked) => updateVendorSetting('vendor_portal_require_w9', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>Upload Insurance</Label>
                    <Switch
                      checked={settings.vendor_portal_require_insurance}
                      onCheckedChange={(checked) => updateVendorSetting('vendor_portal_require_insurance', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>Upload Company Logo</Label>
                    <Switch
                      checked={settings.vendor_portal_require_company_logo}
                      onCheckedChange={(checked) => updateVendorSetting('vendor_portal_require_company_logo', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>Set User Avatar</Label>
                    <Switch
                      checked={settings.vendor_portal_require_user_avatar}
                      onCheckedChange={(checked) => updateVendorSetting('vendor_portal_require_user_avatar', checked)}
                    />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Show Vendor Compliance Warnings</Label>
                  <p className="text-sm text-muted-foreground">Display warnings when entering bills for vendors with missing compliance documents</p>
                </div>
                <Switch
                  checked={settings.show_vendor_compliance_warnings}
                  onCheckedChange={(checked) => updateVendorSetting('show_vendor_compliance_warnings', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="job-approval" className="space-y-6">
          <JobBillApprovalSettings />
        </TabsContent>
      </Tabs>

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
