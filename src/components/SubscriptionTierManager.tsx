import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { HelpTooltip } from '@/components/HelpTooltip';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Package,
  DollarSign,
  ToggleLeft,
  Layers,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface FeatureModule {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  sort_order: number;
  is_active: boolean;
}

interface SubscriptionTier {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  features: string[];
  stripe_product_id: string | null;
  stripe_price_id: string | null;
}

interface FeatureTreeBlueprintNode {
  key: string;
  label: string;
  description?: string;
  children?: FeatureTreeBlueprintNode[];
}

interface FeatureTreeNode {
  id: string;
  key: string;
  label: string;
  description?: string;
  featureIds: string[];
  children: FeatureTreeNode[];
}

type ToggleVisualState = 'off' | 'partial' | 'on';

const NON_GRANULAR_FEATURE_KEYS = new Set([
  'punch_clock',
  'timesheets',
  'employees',
  'employee_reports',
  'jobs_basic',
  'job_budgets',
  'job_cost_codes',
  'job_plans',
  'job_rfis',
  'job_permits',
  'job_photos',
  'job_filing',
  'delivery_tickets',
  'visitor_logs',
  'project_tasks',
  'subcontracts',
  'purchase_orders',
  'rfps',
  'vendors',
  'bills',
  'receipts',
  'chart_of_accounts',
  'journal_entries',
  'bank_accounts',
  'credit_cards',
  'ar_invoices',
  'payments',
  'customers',
  'construction_reports',
  'accounting_reports',
  'messaging',
  'announcements',
  'pm_lynk',
  'punch_clock_app',
  'organization_management',
  'ai_plan_qa_v1',
]);

const GRANULAR_ROOT_LABELS: Record<string, string> = {
  construction: 'Construction',
  accounting: 'Accounting & Finance',
  hr: 'HR & Employees',
  communication: 'Communication',
  mobile: 'Mobile',
  settings: 'Settings',
  general: 'General',
};

const getGranularRootKey = (feature: FeatureModule): string => {
  const key = feature.key;
  if (key.startsWith('jobs') || key.startsWith('subcontracts') || key.startsWith('purchase-orders') || key.startsWith('cost-codes') || key.startsWith('construction') || key.startsWith('delivery-tickets') || key.startsWith('tasks') || key.startsWith('project-tasks') || key.startsWith('task-deadlines')) return 'construction';
  if (key.startsWith('receipts') || key.startsWith('receipt-reports') || key.startsWith('receivables') || key.startsWith('customers') || key.startsWith('ar-invoices') || key.startsWith('ar-payments') || key.startsWith('payables') || key.startsWith('vendors') || key.startsWith('bills') || key.startsWith('banking') || key.startsWith('chart-of-accounts') || key.startsWith('journal-entries') || key.startsWith('deposits') || key.startsWith('print-checks') || key.startsWith('make-payment') || key.startsWith('payment-') || key.startsWith('credit-cards') || key.startsWith('reconcile')) return 'accounting';
  if (key.startsWith('employees') || key.startsWith('punch-clock') || key.startsWith('timesheets') || key.startsWith('timecard-reports')) return 'hr';
  if (key.startsWith('messages') || key === 'messaging' || key.startsWith('team-chat') || key.startsWith('announcements')) return 'communication';
  if (key.startsWith('pm-lynk')) return 'mobile';
  if (key.startsWith('settings') || key.startsWith('company-settings') || key.startsWith('user-settings') || key.startsWith('subscription-settings') || key.startsWith('notification-settings') || key.startsWith('security-settings')) return 'settings';
  return 'general';
};

const getGranularSectionKey = (featureKey: string): string => {
  if (featureKey.startsWith('jobs-')) {
    if (featureKey.startsWith('jobs-tab-photos-') || featureKey.startsWith('jobs-photos-')) return 'jobs/photos';
    if (featureKey.startsWith('jobs-tab-')) return `jobs/${featureKey.split('-').slice(2, 4).join('-')}`;
    return 'jobs/general';
  }
  if (featureKey.startsWith('ar-invoices-')) return 'ar-invoices';
  if (featureKey.startsWith('company-settings')) return 'company-settings';
  if (featureKey.startsWith('user-settings')) return 'user-settings';
  if (featureKey.startsWith('subscription-settings')) return 'subscription-settings';
  if (featureKey.startsWith('notification-settings')) return 'notification-settings';
  if (featureKey.startsWith('security-settings')) return 'security-settings';
  if (featureKey.startsWith('pm-lynk-')) return `pm-lynk/${featureKey.split('-').slice(2, 4).join('-')}`;
  if (featureKey.startsWith('banking-')) return 'banking';
  if (featureKey.startsWith('receivables-')) return 'receivables';
  if (featureKey.startsWith('payables-')) return 'payables';
  return featureKey.split('-').slice(0, 2).join('-') || featureKey;
};

const toLabel = (value: string): string =>
  value
    .replace(/[/_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

const FEATURE_TREE_BLUEPRINT: FeatureTreeBlueprintNode[] = [
  {
    key: 'construction',
    label: 'Construction',
    description: 'Construction module access and feature groups',
    children: [
      {
        key: 'jobs',
        label: 'Jobs',
        description: 'Jobs and job-level tabs/features',
        children: [
          { key: 'jobs_basic', label: 'Jobs List & Overview', description: 'View/manage job list and core details' },
          { key: 'job_budgets', label: 'Jobs > Budget Tab', description: 'Cost codes and budget tab' },
          { key: 'job_cost_codes', label: 'Jobs > Cost Codes', description: 'Cost code management' },
          { key: 'job_plans', label: 'Jobs > Plans Tab', description: 'Plans and sheets' },
          { key: 'job_rfis', label: 'Jobs > RFIs Tab', description: 'RFIs and responses' },
          { key: 'job_photos', label: 'Jobs > Photos Tab', description: 'Albums and photo library' },
          { key: 'job_filing', label: 'Jobs > Filing Cabinet Tab', description: 'Job files and documents' },
          { key: 'job_permits', label: 'Jobs > Permits Tab', description: 'Permits tracking' },
        ],
      },
      { key: 'subcontracts', label: 'Subcontracts' },
      { key: 'purchase_orders', label: 'Purchase Orders' },
      { key: 'rfps', label: 'RFPs & Bidding' },
      { key: 'delivery_tickets', label: 'Delivery Tickets' },
      { key: 'visitor_logs', label: 'Visitor Logs' },
      { key: 'project_tasks', label: 'Project Tasks' },
    ],
  },
  {
    key: 'payables',
    label: 'Payables & Accounting',
    children: [
      { key: 'vendors', label: 'Vendors' },
      { key: 'bills', label: 'Bills & Payables' },
      { key: 'receipts', label: 'Receipts' },
      { key: 'payments', label: 'Payments' },
      { key: 'bank_accounts', label: 'Bank Accounts' },
      { key: 'credit_cards', label: 'Credit Cards' },
      { key: 'chart_of_accounts', label: 'Chart of Accounts' },
      { key: 'journal_entries', label: 'Journal Entries' },
      { key: 'customers', label: 'Customers' },
      { key: 'ar_invoices', label: 'AR Invoices' },
    ],
  },
  {
    key: 'workforce',
    label: 'Workforce',
    children: [
      { key: 'employees', label: 'Employees' },
      { key: 'employee_reports', label: 'Employee Reports' },
      { key: 'punch_clock', label: 'Punch Clock' },
      { key: 'timesheets', label: 'Timesheets' },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    children: [
      { key: 'messaging', label: 'Messaging' },
      { key: 'announcements', label: 'Announcements' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    children: [
      { key: 'construction_reports', label: 'Construction Reports' },
      { key: 'accounting_reports', label: 'Accounting Reports' },
    ],
  },
  {
    key: 'mobile',
    label: 'Mobile',
    children: [
      { key: 'pm_lynk', label: 'PM Lynk App' },
      { key: 'punch_clock_app', label: 'Punch Clock App' },
    ],
  },
  {
    key: 'platform',
    label: 'Platform',
    children: [
      { key: 'organization_management', label: 'Organization Management' },
      { key: 'ai_plan_qa_v1', label: 'A-RFI' },
    ],
  },
];

export default function SubscriptionTierManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [features, setFeatures] = useState<FeatureModule[]>([]);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [syncingTierId, setSyncingTierId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMonthlyPrice, setFormMonthlyPrice] = useState('0');
  const [formAnnualPrice, setFormAnnualPrice] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formFeatures, setFormFeatures] = useState<string[]>([]);

  const featuresByKey = useMemo(() => {
    return features.reduce((acc, feature) => {
      acc[feature.key] = feature;
      return acc;
    }, {} as Record<string, FeatureModule>);
  }, [features]);

  const legacyFeatureTree = useMemo(() => {
    const usedFeatureIds = new Set<string>();
    let virtualNodeCount = 0;

    const buildNode = (blueprintNode: FeatureTreeBlueprintNode): FeatureTreeNode | null => {
      const feature = featuresByKey[blueprintNode.key];

      if (feature) {
        usedFeatureIds.add(feature.id);
        return {
          id: feature.id,
          key: blueprintNode.key,
          label: blueprintNode.label || feature.name,
          description: blueprintNode.description || feature.description || undefined,
          featureIds: [feature.id],
          children: [],
        };
      }

      const builtChildren = (blueprintNode.children || [])
        .map(buildNode)
        .filter((node): node is FeatureTreeNode => !!node);

      if (builtChildren.length === 0) return null;

      const aggregatedFeatureIds = builtChildren.flatMap(node => node.featureIds);
      virtualNodeCount += 1;

      return {
        id: `virtual-${blueprintNode.key}-${virtualNodeCount}`,
        key: blueprintNode.key,
        label: blueprintNode.label,
        description: blueprintNode.description,
        featureIds: aggregatedFeatureIds,
        children: builtChildren,
      };
    };

    const builtRoots = FEATURE_TREE_BLUEPRINT
      .map(buildNode)
      .filter((node): node is FeatureTreeNode => !!node);

    const uncategorized = features
      .filter(feature => !usedFeatureIds.has(feature.id))
      .sort((a, b) => a.sort_order - b.sort_order);

    if (uncategorized.length > 0) {
      builtRoots.push({
        id: 'virtual-uncategorized',
        key: 'uncategorized',
        label: 'Other Features',
        description: 'Feature modules not yet mapped in the hierarchy',
        featureIds: uncategorized.map(feature => feature.id),
        children: uncategorized.map(feature => ({
          id: feature.id,
          key: feature.key,
          label: feature.name,
          description: feature.description || undefined,
          featureIds: [feature.id],
          children: [],
        })),
      });
    }

    return builtRoots;
  }, [features, featuresByKey]);

  const granularFeatureTree = useMemo(() => {
    const granularFeatures = features
      .filter(feature => !NON_GRANULAR_FEATURE_KEYS.has(feature.key))
      .filter(feature => feature.key.includes('-'))
      .sort((a, b) => a.sort_order - b.sort_order);

    if (granularFeatures.length === 0) return [] as FeatureTreeNode[];

    const byRoot = new Map<string, FeatureModule[]>();
    granularFeatures.forEach(feature => {
      const root = getGranularRootKey(feature);
      const current = byRoot.get(root) || [];
      current.push(feature);
      byRoot.set(root, current);
    });

    return Array.from(byRoot.entries()).map(([rootKey, rootFeatures]) => {
      const bySection = new Map<string, FeatureModule[]>();
      rootFeatures.forEach(feature => {
        const section = getGranularSectionKey(feature.key);
        const current = bySection.get(section) || [];
        current.push(feature);
        bySection.set(section, current);
      });

      const sectionNodes: FeatureTreeNode[] = Array.from(bySection.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([sectionKey, sectionFeatures]) => ({
          id: `granular-section-${rootKey}-${sectionKey}`,
          key: sectionKey,
          label: toLabel(sectionKey),
          description: `${sectionFeatures.length} granular permissions`,
          featureIds: sectionFeatures.map(feature => feature.id),
          children: sectionFeatures.map(feature => ({
            id: feature.id,
            key: feature.key,
            label: feature.name,
            description: feature.description || undefined,
            featureIds: [feature.id],
            children: [],
          })),
        }));

      return {
        id: `granular-root-${rootKey}`,
        key: rootKey,
        label: GRANULAR_ROOT_LABELS[rootKey] || toLabel(rootKey),
        description: 'Role-level subscription controls',
        featureIds: sectionNodes.flatMap(node => node.featureIds),
        children: sectionNodes,
      };
    });
  }, [features]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [{ data: featuresData, error: fErr }, { data: tiersData, error: tErr }] = await Promise.all([
        supabase.from('feature_modules').select('*').order('sort_order'),
        supabase.from('subscription_tiers').select('*').order('sort_order'),
      ]);

      if (fErr) throw fErr;
      if (tErr) throw tErr;

      setFeatures(featuresData || []);

      // Fetch tier features
      const tierIds = tiersData?.map(t => t.id) || [];
      let tierFeatureMap: Record<string, string[]> = {};

      if (tierIds.length > 0) {
        const { data: tfData } = await supabase
          .from('tier_feature_access')
          .select('tier_id, feature_module_id')
          .in('tier_id', tierIds);

        (tfData || []).forEach(tf => {
          if (!tierFeatureMap[tf.tier_id]) tierFeatureMap[tf.tier_id] = [];
          tierFeatureMap[tf.tier_id].push(tf.feature_module_id);
        });
      }

      setTiers(
        (tiersData || []).map((t: any) => ({
          ...t,
          features: tierFeatureMap[t.id] || [],
          stripe_product_id: t.stripe_product_id || null,
          stripe_price_id: t.stripe_price_id || null,
        }))
      );
    } catch (error) {
      console.error('Error fetching tiers:', error);
      toast({ title: 'Error', description: 'Failed to load subscription tiers.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => navigate('/super-admin/tiers/new');

  const openEditDialog = (tier: SubscriptionTier) => {
    navigate(`/super-admin/tiers/${tier.id}/edit`);
  };

  const setNodeAccess = (node: FeatureTreeNode, enabled: boolean) => {
    const nodeFeatureIds = node.featureIds;
    setFormFeatures(prev => {
      if (enabled) {
        return [...new Set([...prev, ...nodeFeatureIds])];
      }
      return prev.filter(id => !nodeFeatureIds.includes(id));
    });
  };

  const getNodeState = (node: FeatureTreeNode): ToggleVisualState => {
    const selectedCount = node.featureIds.filter(id => formFeatures.includes(id)).length;
    if (selectedCount === 0) return 'off';
    if (selectedCount === node.featureIds.length) return 'on';
    return 'partial';
  };

  const renderFeatureNode = (node: FeatureTreeNode, depth: number = 0) => {
    const state = getNodeState(node);
    const selectedCount = node.featureIds.filter(id => formFeatures.includes(id)).length;
    const isLeaf = node.children.length === 0;

    return (
      <div key={node.id} className={depth > 0 ? 'mt-2' : ''}>
        <div
          className="flex items-start justify-between gap-3 rounded-md border bg-background p-3"
          style={{ marginLeft: `${depth * 16}px` }}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{node.label}</p>
            {node.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{node.description}</p>
            )}
            {!isLeaf && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={state === 'on' ? 'default' : 'secondary'} className="text-[10px]">
                  {state === 'partial' ? 'Partial' : state === 'on' ? 'Enabled' : 'Disabled'}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {selectedCount}/{node.featureIds.length} enabled
                </span>
              </div>
            )}
          </div>
          <Switch
            checked={state === 'on'}
            onCheckedChange={(checked) => setNodeAccess(node, !!checked)}
          />
        </div>
        {node.children.length > 0 && (
          <div className="mt-2 space-y-1">
            {node.children.map(child => renderFeatureNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: 'Error', description: 'Tier name is required.', variant: 'destructive' });
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      let tierId: string;

      if (editingTier) {
        const { error } = await supabase
          .from('subscription_tiers')
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
            monthly_price: parseFloat(formMonthlyPrice) || 0,
            annual_price: formAnnualPrice ? parseFloat(formAnnualPrice) : null,
            is_active: formIsActive,
            is_default: formIsDefault,
          })
          .eq('id', editingTier.id);
        if (error) throw error;
        tierId = editingTier.id;
      } else {
        const { data, error } = await supabase
          .from('subscription_tiers')
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
            monthly_price: parseFloat(formMonthlyPrice) || 0,
            annual_price: formAnnualPrice ? parseFloat(formAnnualPrice) : null,
            is_active: formIsActive,
            is_default: formIsDefault,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        tierId = data.id;
      }

      // Sync tier features: delete all, then re-insert
      await supabase.from('tier_feature_access').delete().eq('tier_id', tierId);

      if (formFeatures.length > 0) {
        const { error: insertErr } = await supabase.from('tier_feature_access').insert(
          formFeatures.map(fId => ({
            tier_id: tierId,
            feature_module_id: fId,
          }))
        );
        if (insertErr) throw insertErr;
      }

      toast({ title: 'Success', description: `Tier "${formName}" ${editingTier ? 'updated' : 'created'} successfully.` });
      await fetchData();
    } catch (error: any) {
      console.error('Error saving tier:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save tier.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tierId: string) => {
    try {
      const { error } = await supabase.from('subscription_tiers').delete().eq('id', tierId);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Subscription tier deleted.' });
      setDeleteConfirmId(null);
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete tier.', variant: 'destructive' });
    }
  };

  const syncTierToStripe = async (tier: SubscriptionTier) => {
    setSyncingTierId(tier.id);
    try {
      const { data, error } = await supabase.functions.invoke('sync-stripe-tier', {
        body: {
          tierId: tier.id,
          tierName: tier.name,
          monthlyPrice: tier.monthly_price,
          annualPrice: tier.annual_price,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Synced to Stripe', description: `"${tier.name}" product & price created in Stripe.` });
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Stripe Sync Error', description: error.message || 'Failed to sync to Stripe.', variant: 'destructive' });
    } finally {
      setSyncingTierId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Subscription Tiers
            <HelpTooltip text="Define your pricing tiers here. Each tier controls which features a company can access. After creating a tier, click 'Sync to Stripe' to create matching products in your Stripe account for billing." />
          </h2>
          <p className="text-sm text-muted-foreground">
            Create and manage subscription tiers with custom feature access
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Tier
        </Button>
      </div>

      {/* Tiers Table */}
      <Card>
        <CardContent className="p-0">
          {tiers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No subscription tiers created yet</p>
              <p className="text-sm">Create your first tier to start managing access</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Annual</TableHead>
                  <TableHead className="text-center">Features</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    Stripe
                    <HelpTooltip text="Shows whether this tier has been synced to Stripe. Click 'Sync' to create a matching Stripe product & price for billing." />
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map(tier => (
                  <TableRow key={tier.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditDialog(tier)}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{tier.name}</span>
                        {tier.is_default && (
                          <Badge variant="outline" className="ml-2 text-xs">Default</Badge>
                        )}
                        {tier.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{tier.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        {tier.monthly_price.toLocaleString()}/mo
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {tier.annual_price ? `$${tier.annual_price.toLocaleString()}/yr` : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{tier.features.length}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                        {tier.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tier.stripe_price_id ? (
                        <Badge variant="default" className="gap-1">
                          <Zap className="h-3 w-3" />
                          Synced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Not synced
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {tier.monthly_price > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                            disabled={syncingTierId === tier.id}
                            onClick={() => syncTierToStripe(tier)}
                          >
                            {syncingTierId === tier.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Sync
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(tier)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(tier.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Subscription Tier?</DialogTitle>
            <DialogDescription>
              This will permanently delete this tier and remove it from any companies using it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              Delete Tier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
