import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { getRequiredFeaturesForPermission } from '@/utils/subscriptionFeatureGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface FeatureModule {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  sort_order: number;
  is_active: boolean;
}

interface TierRow {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number | null;
  is_active: boolean;
  is_default: boolean;
  show_locked_menu_items?: boolean | null;
  locked_menu_upgrade_message?: string | null;
}

interface TierAccessItem {
  key: string;
  label: string;
  menuKey: string;
  featurePrefixes?: string[];
}

interface TierAccessSection {
  key: string;
  label: string;
  items: TierAccessItem[];
}

const TIER_ACCESS_SECTIONS: TierAccessSection[] = [
  {
    key: 'construction',
    label: 'Construction',
    items: [
      { key: 'construction-dashboard', label: 'Dashboard', menuKey: 'jobs', featurePrefixes: ['jobs'] },
      { key: 'construction-jobs', label: 'Jobs', menuKey: 'jobs', featurePrefixes: ['jobs', 'job_'] },
      { key: 'construction-subcontracts', label: 'Subcontracts', menuKey: 'vendors', featurePrefixes: ['subcontracts'] },
      { key: 'construction-rfps', label: 'RFPs & Bids', menuKey: 'jobs', featurePrefixes: ['rfp', 'bid'] },
      { key: 'construction-submittals', label: 'Submittals', menuKey: 'jobs', featurePrefixes: ['submittal'] },
      { key: 'construction-pos', label: 'Purchase Orders', menuKey: 'vendors', featurePrefixes: ['purchase-orders', 'purchase_orders'] },
      { key: 'construction-reports', label: 'Reports', menuKey: 'jobs', featurePrefixes: ['construction-reports', 'construction_reports'] },
    ],
  },
  {
    key: 'receipts',
    label: 'Receipts',
    items: [
      { key: 'receipts-upload', label: 'Upload Receipts', menuKey: 'receipts', featurePrefixes: ['receipts-upload', 'receipts_upload'] },
      { key: 'receipts-uncoded', label: 'Uncoded Receipts', menuKey: 'receipts', featurePrefixes: ['receipts-uncoded', 'receipts_uncoded'] },
      { key: 'receipts-coded', label: 'Coded Receipts', menuKey: 'receipts', featurePrefixes: ['receipts-coded', 'receipts_coded'] },
      { key: 'receipts-reports', label: 'Receipt Reports', menuKey: 'reports', featurePrefixes: ['receipt-reports', 'receipt_reports'] },
    ],
  },
  {
    key: 'receivables',
    label: 'Receivables',
    items: [
      { key: 'receivables-customers', label: 'Customers', menuKey: 'receivables', featurePrefixes: ['customers'] },
      { key: 'receivables-invoices', label: 'Invoices', menuKey: 'receivables', featurePrefixes: ['ar-invoices', 'ar_invoices', 'receivables-invoices'] },
      { key: 'receivables-payments', label: 'Payments', menuKey: 'receivables', featurePrefixes: ['ar-payments', 'ar_payments', 'payments'] },
      { key: 'receivables-reports', label: 'Reports', menuKey: 'reports', featurePrefixes: ['receivables-reports', 'receivables_reports'] },
    ],
  },
  {
    key: 'payables',
    label: 'Payables',
    items: [
      { key: 'payables-dashboard', label: 'Payables Dashboard', menuKey: 'payables-dashboard', featurePrefixes: ['payables-dashboard', 'payables_dashboard'] },
      { key: 'payables-vendors', label: 'Vendors', menuKey: 'vendors', featurePrefixes: ['vendors', 'vendor-portal', 'vendor_portal'] },
      { key: 'payables-bills', label: 'Bills', menuKey: 'bills', featurePrefixes: ['bills'] },
      { key: 'payables-credit-cards', label: 'Credit Cards', menuKey: 'banking-credit-cards', featurePrefixes: ['credit-cards', 'credit_cards'] },
      { key: 'payables-make-payment', label: 'Make Payment', menuKey: 'make-payment', featurePrefixes: ['make-payment', 'make_payment'] },
      { key: 'payables-history', label: 'Payment History', menuKey: 'payment-history', featurePrefixes: ['payment-history', 'payment_history'] },
      { key: 'payables-reports', label: 'Bill Reports', menuKey: 'payment-reports', featurePrefixes: ['payment-reports', 'payment_reports'] },
    ],
  },
  {
    key: 'company-files',
    label: 'Company Files',
    items: [
      { key: 'company-files-docs', label: 'All Documents', menuKey: 'company-files', featurePrefixes: ['company-files', 'company_files'] },
      { key: 'company-files-contracts', label: 'Contracts', menuKey: 'company-contracts', featurePrefixes: ['company-contracts', 'company_contracts'] },
      { key: 'company-files-permits', label: 'Permits', menuKey: 'company-permits', featurePrefixes: ['company-permits', 'company_permits'] },
      { key: 'company-files-insurance', label: 'Insurance', menuKey: 'company-insurance', featurePrefixes: ['company-insurance', 'company_insurance'] },
    ],
  },
  {
    key: 'employees',
    label: 'Employees',
    items: [
      { key: 'employees-all', label: 'All Employees', menuKey: 'employees', featurePrefixes: ['employees'] },
      { key: 'employees-punch-clock', label: 'Punch Clock', menuKey: 'punch-clock-dashboard', featurePrefixes: ['punch-clock', 'punch_clock', 'timesheets', 'timecard'] },
      { key: 'employees-payroll', label: 'Payroll', menuKey: 'employees', featurePrefixes: ['payroll'] },
      { key: 'employees-performance', label: 'Performance', menuKey: 'employees', featurePrefixes: ['performance'] },
      { key: 'employees-reports', label: 'Reports', menuKey: 'employees', featurePrefixes: ['employee-reports', 'employee_reports'] },
    ],
  },
  {
    key: 'messaging',
    label: 'Messages',
    items: [
      { key: 'messages-all', label: 'All Messages', menuKey: 'messages', featurePrefixes: ['messages', 'messaging'] },
      { key: 'messages-chat', label: 'Team Chat', menuKey: 'messages', featurePrefixes: ['team-chat', 'team_chat'] },
      { key: 'messages-announcements', label: 'Announcements', menuKey: 'announcements', featurePrefixes: ['announcements'] },
    ],
  },
  {
    key: 'tasks',
    label: 'Tasks',
    items: [
      { key: 'tasks-all', label: 'All Tasks', menuKey: 'jobs', featurePrefixes: ['tasks'] },
      { key: 'tasks-project', label: 'Project Tasks', menuKey: 'jobs', featurePrefixes: ['project-tasks', 'project_tasks'] },
      { key: 'tasks-deadlines', label: 'Deadlines', menuKey: 'jobs', featurePrefixes: ['task-deadlines', 'task_deadlines'] },
    ],
  },
  {
    key: 'banking',
    label: 'Banking',
    items: [
      { key: 'banking-accounts', label: 'Bank Accounts', menuKey: 'banking-accounts', featurePrefixes: ['banking-accounts', 'banking_accounts', 'bank-accounts'] },
      { key: 'banking-reporting', label: 'Reporting', menuKey: 'banking-reports', featurePrefixes: ['banking-reports', 'banking_reports'] },
      { key: 'banking-journal', label: 'Journal Entries', menuKey: 'journal-entries', featurePrefixes: ['journal-entries', 'journal_entries'] },
      { key: 'banking-deposits', label: 'Deposits', menuKey: 'deposits', featurePrefixes: ['deposits'] },
      { key: 'banking-print', label: 'Print Checks', menuKey: 'print-checks', featurePrefixes: ['print-checks', 'print_checks'] },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    items: [
      { key: 'settings-company', label: 'Company Settings', menuKey: 'company-settings', featurePrefixes: ['company-settings', 'company_settings'] },
      { key: 'settings-notifications', label: 'Notifications & Email', menuKey: 'notification-settings', featurePrefixes: ['notification-settings', 'notification_settings'] },
      { key: 'settings-security', label: 'Data & Security', menuKey: 'security-settings', featurePrefixes: ['security-settings', 'security_settings'] },
      { key: 'settings-users', label: 'User Management', menuKey: 'user-settings', featurePrefixes: ['user-settings', 'user_settings'] },
      { key: 'settings-punchclock', label: 'PunchClock Link', menuKey: 'punch-clock-settings', featurePrefixes: ['punch-clock-settings', 'punch_clock_settings', 'punch_clock_app'] },
      { key: 'settings-pmlynk', label: 'PM Lynk', menuKey: 'pm-lynk-settings', featurePrefixes: ['pm-lynk-settings', 'pm_lynk_settings', 'pm-lynk', 'pm_lynk'] },
      { key: 'settings-subscription', label: 'Subscription', menuKey: 'subscription-settings', featurePrefixes: ['subscription-settings', 'subscription_settings'] },
    ],
  },
];

const normalizeFeatureKey = (key: string) => String(key || '').toLowerCase().replace(/_/g, '-');

export default function SubscriptionTierEditor() {
  const { tierId } = useParams<{ tierId: string }>();
  const isCreate = !tierId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, loading: tenantLoading } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState<FeatureModule[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('0');
  const [annualPrice, setAnnualPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [showLockedMenuItems, setShowLockedMenuItems] = useState(false);
  const [lockedMenuUpgradeMessage, setLockedMenuUpgradeMessage] = useState(
    'You do not have access to this feature. Please upgrade your account or contact your account manager.'
  );
  const [search, setSearch] = useState('');

  const [openSections, setOpenSections] = useState<string[]>(TIER_ACCESS_SECTIONS.map((s) => s.key));
  const [openItems, setOpenItems] = useState<string[]>([]);

  useEffect(() => {
    if (!tenantLoading && !isSuperAdmin) {
      navigate('/', { replace: true });
    }
  }, [tenantLoading, isSuperAdmin, navigate]);

  useEffect(() => {
    if (tenantLoading || !isSuperAdmin) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data: featuresData, error: fErr } = await supabase
          .from('feature_modules')
          .select('*')
          .eq('is_active', true)
          .order('category')
          .order('sort_order');
        if (fErr) throw fErr;
        setFeatures((featuresData || []) as FeatureModule[]);

        if (tierId) {
          let tier: any = null;
          const withLockedColumns = await supabase
            .from('subscription_tiers')
            .select('id, name, description, monthly_price, annual_price, is_active, is_default, show_locked_menu_items, locked_menu_upgrade_message')
            .eq('id', tierId)
            .single();

          if (withLockedColumns.error) {
            const errMsg = String(withLockedColumns.error.message || '').toLowerCase();
            if (errMsg.includes('column') && errMsg.includes('show_locked_menu_items')) {
              const fallback = await supabase
                .from('subscription_tiers')
                .select('id, name, description, monthly_price, annual_price, is_active, is_default')
                .eq('id', tierId)
                .single();
              if (fallback.error) throw fallback.error;
              tier = fallback.data;
            } else {
              throw withLockedColumns.error;
            }
          } else {
            tier = withLockedColumns.data;
          }

          const row = tier as TierRow;
          setName(row.name || '');
          setDescription(row.description || '');
          setMonthlyPrice(String(row.monthly_price ?? 0));
          setAnnualPrice(row.annual_price != null ? String(row.annual_price) : '');
          setIsActive(!!row.is_active);
          setIsDefault(!!row.is_default);
          setShowLockedMenuItems(!!row.show_locked_menu_items);
          if (row.locked_menu_upgrade_message) setLockedMenuUpgradeMessage(row.locked_menu_upgrade_message);

          const { data: accessRows, error: aErr } = await supabase
            .from('tier_feature_access')
            .select('feature_module_id')
            .eq('tier_id', tierId);
          if (aErr) throw aErr;
          setSelectedFeatures((accessRows || []).map((r: any) => r.feature_module_id));
        }
      } catch (error: any) {
        console.error('Error loading tier editor:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load tier editor',
          variant: 'destructive',
        });
        navigate('/super-admin');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tierId, tenantLoading, isSuperAdmin, toast, navigate]);

  const featuresById = useMemo(() => {
    const map = new Map<string, FeatureModule>();
    for (const feature of features) map.set(feature.id, feature);
    return map;
  }, [features]);

  const itemFeatureIds = useMemo(() => {
    const idMap: Record<string, string[]> = {};

    for (const section of TIER_ACCESS_SECTIONS) {
      for (const item of section.items) {
        const requiredKeys = getRequiredFeaturesForPermission(item.menuKey).map(normalizeFeatureKey);
        const prefixes = (item.featurePrefixes || []).map(normalizeFeatureKey);

        const matchedIds = features
          .filter((feature) => {
            const normalized = normalizeFeatureKey(feature.key);
            const requiredMatch = requiredKeys.includes(normalized);
            const prefixMatch = prefixes.some((prefix) => normalized.startsWith(prefix));
            return requiredMatch || prefixMatch;
          })
          .map((feature) => feature.id);

        const fallbackIds = features
          .filter((feature) => requiredKeys.includes(normalizeFeatureKey(feature.key)))
          .map((feature) => feature.id);

        idMap[item.key] = Array.from(new Set([...(matchedIds.length ? matchedIds : fallbackIds)]));
      }
    }

    return idMap;
  }, [features]);

  const sectionFeatureIds = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const section of TIER_ACCESS_SECTIONS) {
      map[section.key] = Array.from(
        new Set(section.items.flatMap((item) => itemFeatureIds[item.key] || []))
      );
    }
    return map;
  }, [itemFeatureIds]);

  const getState = (featureIds: string[]) => {
    if (featureIds.length === 0) return 'off' as const;
    const count = featureIds.filter((id) => selectedFeatures.includes(id)).length;
    if (count === 0) return 'off' as const;
    if (count === featureIds.length) return 'on' as const;
    return 'partial' as const;
  };

  const setMany = (featureIds: string[], checked: boolean) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (checked) {
        featureIds.forEach((id) => next.add(id));
      } else {
        featureIds.forEach((id) => next.delete(id));
      }
      return Array.from(next);
    });
  };

  const toggleFeature = (featureId: string, checked: boolean) => {
    setSelectedFeatures((prev) => {
      if (checked) {
        if (prev.includes(featureId)) return prev;
        return [...prev, featureId];
      }
      return prev.filter((id) => id !== featureId);
    });
  };

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TIER_ACCESS_SECTIONS;

    return TIER_ACCESS_SECTIONS
      .map((section) => {
        const sectionMatch = section.label.toLowerCase().includes(q);
        const items = section.items.filter((item) => {
          if (sectionMatch) return true;
          if (item.label.toLowerCase().includes(q) || item.menuKey.toLowerCase().includes(q)) return true;
          const ids = itemFeatureIds[item.key] || [];
          return ids.some((id) => {
            const feature = featuresById.get(id);
            if (!feature) return false;
            return (
              feature.name.toLowerCase().includes(q) ||
              feature.key.toLowerCase().includes(q) ||
              (feature.description || '').toLowerCase().includes(q)
            );
          });
        });
        return { ...section, items };
      })
      .filter((section) => section.items.length > 0);
  }, [search, itemFeatureIds, featuresById]);

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast({ title: 'Validation', description: 'Tier name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let currentTierId = tierId;

      if (isCreate) {
        const basePayload: any = {
          name: name.trim(),
          description: description.trim() || null,
          monthly_price: Number(monthlyPrice || 0),
          annual_price: annualPrice ? Number(annualPrice) : null,
          is_active: isActive,
          is_default: isDefault,
          created_by: user.id,
        };
        const lockedPayload: any = {
          ...basePayload,
          show_locked_menu_items: showLockedMenuItems,
          locked_menu_upgrade_message: lockedMenuUpgradeMessage.trim() || null,
        };

        let insertResult = await supabase
          .from('subscription_tiers')
          .insert(lockedPayload)
          .select('id')
          .single();

        if (insertResult.error) {
          const errMsg = String(insertResult.error.message || '').toLowerCase();
          if (errMsg.includes('column') && errMsg.includes('show_locked_menu_items')) {
            insertResult = await supabase
              .from('subscription_tiers')
              .insert(basePayload)
              .select('id')
              .single();
          }
        }

        if (insertResult.error) throw insertResult.error;
        currentTierId = (insertResult.data as any).id;
      } else {
        const basePayload: any = {
          name: name.trim(),
          description: description.trim() || null,
          monthly_price: Number(monthlyPrice || 0),
          annual_price: annualPrice ? Number(annualPrice) : null,
          is_active: isActive,
          is_default: isDefault,
        };
        const lockedPayload: any = {
          ...basePayload,
          show_locked_menu_items: showLockedMenuItems,
          locked_menu_upgrade_message: lockedMenuUpgradeMessage.trim() || null,
        };

        let updateResult = await supabase
          .from('subscription_tiers')
          .update(lockedPayload)
          .eq('id', tierId);

        if (updateResult.error) {
          const errMsg = String(updateResult.error.message || '').toLowerCase();
          if (errMsg.includes('column') && errMsg.includes('show_locked_menu_items')) {
            updateResult = await supabase
              .from('subscription_tiers')
              .update(basePayload)
              .eq('id', tierId);
          }
        }

        if (updateResult.error) throw updateResult.error;
      }

      if (!currentTierId) throw new Error('Tier id missing after save');

      await supabase.from('tier_feature_access').delete().eq('tier_id', currentTierId);

      if (selectedFeatures.length > 0) {
        const { error } = await supabase.from('tier_feature_access').insert(
          selectedFeatures.map((featureId) => ({
            tier_id: currentTierId,
            feature_module_id: featureId,
          }))
        );
        if (error) throw error;
      }

      toast({ title: 'Saved', description: `Tier ${isCreate ? 'created' : 'updated'} successfully` });
      navigate('/super-admin');
    } catch (error: any) {
      console.error('Error saving tier:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save tier', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 md:px-6 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/super-admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{isCreate ? 'Create Tier' : 'Edit Tier'}</h1>
            <p className="text-sm text-muted-foreground">Configure pricing and access down to child/sub-child controls.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          <Save className="h-4 w-4 mr-2" />
          Save Tier
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tier Details</CardTitle>
          <CardDescription>Set core details, pricing, and locked-feature visibility behavior.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label>Tier Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Pro" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Monthly Price ($)</Label>
            <Input type="number" min="0" step="0.01" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Annual Price ($)</Label>
            <Input type="number" min="0" step="0.01" value={annualPrice} onChange={(e) => setAnnualPrice(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Default Tier</Label>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>

          <div className="md:col-span-2 rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show Locked Features In Menu</Label>
                <p className="text-xs text-muted-foreground">If enabled, non-included menu items are shown as locked/upgrade required.</p>
              </div>
              <Switch checked={showLockedMenuItems} onCheckedChange={setShowLockedMenuItems} />
            </div>
            {showLockedMenuItems && (
              <div className="space-y-2">
                <Label>Locked Feature Message</Label>
                <Textarea
                  value={lockedMenuUpgradeMessage}
                  onChange={(e) => setLockedMenuUpgradeMessage(e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tier Access Control</CardTitle>
          <CardDescription>
            Mirrors the left navigation: section → menu item → child/sub-child feature controls.
          </CardDescription>
          <div className="pt-2">
            <Input
              placeholder="Search section, menu item, or feature..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredSections.length === 0 ? (
            <div className="text-sm text-muted-foreground">No matching access controls found.</div>
          ) : (
            filteredSections.map((section) => {
              const sectionIds = sectionFeatureIds[section.key] || [];
              const sectionState = getState(sectionIds);
              const sectionOpen = openSections.includes(section.key);

              return (
                <Collapsible
                  key={section.key}
                  open={sectionOpen}
                  onOpenChange={(open) =>
                    setOpenSections((prev) =>
                      open ? [...new Set([...prev, section.key])] : prev.filter((key) => key !== section.key)
                    )
                  }
                >
                  <div className="rounded-md border">
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
                      <div className="flex items-center gap-2">
                        <CollapsibleTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6">
                            {sectionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <span className="font-medium">{section.label}</span>
                        <Badge variant="secondary">{sectionIds.filter((id) => selectedFeatures.includes(id)).length}/{sectionIds.length}</Badge>
                        <Badge variant={sectionState === 'on' ? 'default' : sectionState === 'partial' ? 'secondary' : 'outline'}>
                          {sectionState === 'on' ? 'On' : sectionState === 'partial' ? 'Partial' : 'Off'}
                        </Badge>
                      </div>
                      <Switch checked={sectionState === 'on'} onCheckedChange={(checked) => setMany(sectionIds, !!checked)} />
                    </div>

                    <CollapsibleContent>
                      <div className="divide-y">
                        {section.items.map((item) => {
                          const itemIds = itemFeatureIds[item.key] || [];
                          const itemState = getState(itemIds);
                          const itemOpen = openItems.includes(item.key);
                          const itemFeatures = itemIds
                            .map((id) => featuresById.get(id))
                            .filter((f): f is FeatureModule => !!f)
                            .sort((a, b) => a.name.localeCompare(b.name));

                          return (
                            <Collapsible
                              key={item.key}
                              open={itemOpen}
                              onOpenChange={(open) =>
                                setOpenItems((prev) =>
                                  open ? [...new Set([...prev, item.key])] : prev.filter((key) => key !== item.key)
                                )
                              }
                            >
                              <div className="px-3 py-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <CollapsibleTrigger asChild>
                                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0">
                                        {itemOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                      </Button>
                                    </CollapsibleTrigger>
                                    <div className="min-w-0">
                                      <div className="font-medium text-sm truncate">{item.label}</div>
                                      <div className="text-xs text-muted-foreground">menu key: {item.menuKey}</div>
                                    </div>
                                    <Badge variant="secondary">{itemIds.filter((id) => selectedFeatures.includes(id)).length}/{itemIds.length}</Badge>
                                    <Badge variant={itemState === 'on' ? 'default' : itemState === 'partial' ? 'secondary' : 'outline'}>
                                      {itemState === 'on' ? 'On' : itemState === 'partial' ? 'Partial' : 'Off'}
                                    </Badge>
                                  </div>
                                  <Switch checked={itemState === 'on'} onCheckedChange={(checked) => setMany(itemIds, !!checked)} />
                                </div>

                                <CollapsibleContent>
                                  <div className="mt-2 ml-8 rounded border bg-muted/10 divide-y">
                                    {itemFeatures.length === 0 ? (
                                      <div className="px-3 py-2 text-xs text-muted-foreground">
                                        No mapped child controls yet for this menu item.
                                      </div>
                                    ) : (
                                      itemFeatures.map((feature) => (
                                        <div key={feature.id} className="px-3 py-2 flex items-start justify-between gap-3">
                                          <div>
                                            <div className="text-sm font-medium">{feature.name}</div>
                                            <div className="text-xs text-muted-foreground">{feature.key}</div>
                                          </div>
                                          <Checkbox
                                            checked={selectedFeatures.includes(feature.id)}
                                            onCheckedChange={(checked) => toggleFeature(feature.id, !!checked)}
                                          />
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
