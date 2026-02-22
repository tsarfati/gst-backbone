import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Package,
  DollarSign,
  ToggleLeft,
  Layers,
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
  features: string[]; // feature_module_ids
}

const CATEGORY_LABELS: Record<string, string> = {
  time_tracking: 'Time Tracking',
  hr: 'HR & Employees',
  construction: 'Construction',
  accounting: 'Accounting & Finance',
  reports: 'Reports',
  communication: 'Communication',
  mobile: 'Mobile Apps',
  general: 'General',
};

export default function SubscriptionTierManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [features, setFeatures] = useState<FeatureModule[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMonthlyPrice, setFormMonthlyPrice] = useState('0');
  const [formAnnualPrice, setFormAnnualPrice] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formFeatures, setFormFeatures] = useState<string[]>([]);

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
        (tiersData || []).map(t => ({
          ...t,
          features: tierFeatureMap[t.id] || [],
        }))
      );
    } catch (error) {
      console.error('Error fetching tiers:', error);
      toast({ title: 'Error', description: 'Failed to load subscription tiers.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTier(null);
    setFormName('');
    setFormDescription('');
    setFormMonthlyPrice('0');
    setFormAnnualPrice('');
    setFormIsActive(true);
    setFormIsDefault(false);
    setFormFeatures([]);
    setDialogOpen(true);
  };

  const openEditDialog = (tier: SubscriptionTier) => {
    setEditingTier(tier);
    setFormName(tier.name);
    setFormDescription(tier.description || '');
    setFormMonthlyPrice(tier.monthly_price.toString());
    setFormAnnualPrice(tier.annual_price?.toString() || '');
    setFormIsActive(tier.is_active);
    setFormIsDefault(tier.is_default);
    setFormFeatures([...tier.features]);
    setDialogOpen(true);
  };

  const toggleFeature = (featureId: string) => {
    setFormFeatures(prev =>
      prev.includes(featureId) ? prev.filter(f => f !== featureId) : [...prev, featureId]
    );
  };

  const selectAllInCategory = (category: string) => {
    const categoryFeatureIds = features.filter(f => f.category === category).map(f => f.id);
    const allSelected = categoryFeatureIds.every(id => formFeatures.includes(id));
    if (allSelected) {
      setFormFeatures(prev => prev.filter(id => !categoryFeatureIds.includes(id)));
    } else {
      setFormFeatures(prev => [...new Set([...prev, ...categoryFeatureIds])]);
    }
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
      setDialogOpen(false);
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

  // Group features by category
  const featuresByCategory = features.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {} as Record<string, FeatureModule[]>);

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
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTier ? 'Edit Tier' : 'Create New Tier'}</DialogTitle>
            <DialogDescription>
              Configure the tier details and select which features are included.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="tierName">Tier Name *</Label>
                <Input id="tierName" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g., Punch Clock Only" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="tierDesc">Description</Label>
                <Textarea id="tierDesc" value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Brief description of what this tier includes..." rows={2} />
              </div>
              <div>
                <Label htmlFor="monthlyPrice">Monthly Price ($)</Label>
                <Input id="monthlyPrice" type="number" min="0" step="0.01" value={formMonthlyPrice} onChange={e => setFormMonthlyPrice(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="annualPrice">Annual Price ($)</Label>
                <Input id="annualPrice" type="number" min="0" step="0.01" value={formAnnualPrice} onChange={e => setFormAnnualPrice(e.target.value)} placeholder="Optional" />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formIsDefault} onCheckedChange={setFormIsDefault} />
                <Label>Default Tier</Label>
              </div>
            </div>

            {/* Feature Selection */}
            <div>
              <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                <ToggleLeft className="h-4 w-4" />
                Feature Access ({formFeatures.length} selected)
              </Label>
              <Accordion type="multiple" className="border rounded-md">
                {Object.entries(featuresByCategory)
                  .sort(([, a], [, b]) => (a[0]?.sort_order || 0) - (b[0]?.sort_order || 0))
                  .map(([category, catFeatures]) => {
                    const selectedCount = catFeatures.filter(f => formFeatures.includes(f.id)).length;
                    const allSelected = selectedCount === catFeatures.length;
                    return (
                      <AccordionItem key={category} value={category}>
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span>{CATEGORY_LABELS[category] || category}</span>
                            <Badge variant="secondary" className="text-xs">
                              {selectedCount}/{catFeatures.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="mb-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => selectAllInCategory(category)}
                            >
                              {allSelected ? 'Deselect All' : 'Select All'}
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {catFeatures.map(feature => (
                              <label
                                key={feature.id}
                                className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                              >
                                <Checkbox
                                  checked={formFeatures.includes(feature.id)}
                                  onCheckedChange={() => toggleFeature(feature.id)}
                                  className="mt-0.5"
                                />
                                <div>
                                  <span className="text-sm font-medium">{feature.name}</span>
                                  {feature.description && (
                                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
              </Accordion>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingTier ? 'Save Changes' : 'Create Tier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
