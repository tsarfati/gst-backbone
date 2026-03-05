import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { HelpTooltip } from '@/components/HelpTooltip';
import {
  Plus,
  Search,
  Loader2,
  Building2,
  DollarSign,
  Pencil,
  Package,
  CreditCard,
  ExternalLink,
} from 'lucide-react';

interface OrganizationSub {
  id: string;
  tenant_id: string;
  tenant_name: string;
  company_count: number;
  tier_id: string;
  tier_name: string;
  monthly_price: number;
  status: string;
  start_date: string;
  billing_cycle: string | null;
  notes: string | null;
}

interface SubscriptionTier {
  id: string;
  name: string;
  monthly_price: number;
  is_active: boolean;
  stripe_price_id: string | null;
}

interface Company {
  id: string;
  name: string;
  tenant_id: string;
  tenant_name: string;
}

interface OrganizationOption {
  id: string;
  name: string;
  company_count: number;
}

export default function CompanySubscriptionManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationSubs, setOrganizationSubs] = useState<OrganizationSub[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<OrganizationSub | null>(null);

  // Form
  const [formOrganizationId, setFormOrganizationId] = useState('');
  const [formTierId, setFormTierId] = useState('');
  const [formStatus, setFormStatus] = useState('active');
  const [formBillingCycle, setFormBillingCycle] = useState('monthly');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [{ data: subsData, error: sErr }, { data: tiersData, error: tErr }, { data: companiesData, error: cErr }] = await Promise.all([
        supabase.from('company_subscriptions').select(`
          *,
          companies!company_subscriptions_company_id_fkey (
            name,
            tenant_id,
            tenants!companies_tenant_id_fkey (name)
          ),
          subscription_tiers!company_subscriptions_tier_id_fkey (name, monthly_price)
        `).order('created_at', { ascending: false }),
        supabase.from('subscription_tiers').select('id, name, monthly_price, is_active, stripe_price_id').eq('is_active', true).order('sort_order'),
        supabase.from('companies').select(`
          id,
          name,
          tenant_id,
          tenants!companies_tenant_id_fkey (name)
        `).eq('is_active', true).order('name'),
      ]);

      if (sErr) throw sErr;
      if (tErr) throw tErr;
      if (cErr) throw cErr;

      const normalizedCompanies: Company[] = (companiesData || []).map((company: any) => ({
        id: company.id,
        name: company.name || 'Unknown',
        tenant_id: company.tenant_id,
        tenant_name: company.tenants?.name || 'Unknown Organization',
      }));
      setTiers(tiersData || []);
      setCompanies(normalizedCompanies);

      const companyCountByTenant = normalizedCompanies.reduce<Record<string, number>>((acc, company) => {
        if (!company.tenant_id) return acc;
        acc[company.tenant_id] = (acc[company.tenant_id] || 0) + 1;
        return acc;
      }, {});

      const subsByTenant = new Map<string, OrganizationSub>();
      for (const sub of (subsData || []) as any[]) {
        const tenantId = sub.companies?.tenant_id as string | undefined;
        if (!tenantId) continue;
        if (subsByTenant.has(tenantId)) continue;
        subsByTenant.set(tenantId, {
          id: sub.id,
          tenant_id: tenantId,
          tenant_name: sub.companies?.tenants?.name || 'Unknown Organization',
          company_count: companyCountByTenant[tenantId] || 0,
          tier_id: sub.tier_id,
          tier_name: sub.subscription_tiers?.name || 'Unknown',
          monthly_price: sub.subscription_tiers?.monthly_price || 0,
          status: sub.status,
          start_date: sub.start_date,
          billing_cycle: sub.billing_cycle,
          notes: sub.notes,
        });
      }
      setOrganizationSubs(Array.from(subsByTenant.values()));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load subscriptions.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openAssignDialog = (sub?: OrganizationSub) => {
    if (sub) {
      setEditingSub(sub);
      setFormOrganizationId(sub.tenant_id);
      setFormTierId(sub.tier_id);
      setFormStatus(sub.status);
      setFormBillingCycle(sub.billing_cycle || 'monthly');
      setFormNotes(sub.notes || '');
    } else {
      setEditingSub(null);
      setFormOrganizationId('');
      setFormTierId('');
      setFormStatus('active');
      setFormBillingCycle('monthly');
      setFormNotes('');
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formOrganizationId || !formTierId || !user) {
      toast({ title: 'Error', description: 'Organization and tier are required.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const orgCompanyIds = companies
        .filter((company) => company.tenant_id === formOrganizationId)
        .map((company) => company.id);

      if (orgCompanyIds.length === 0) {
        throw new Error('No active companies found for this organization.');
      }

      const upsertRows = orgCompanyIds.map((companyId) => ({
        company_id: companyId,
        tier_id: formTierId,
        status: formStatus,
        billing_cycle: formBillingCycle,
        notes: formNotes.trim() || null,
        assigned_by: user.id,
      }));

      const { error } = await supabase
        .from('company_subscriptions')
        .upsert(upsertRows as any, { onConflict: 'company_id' });
      if (error) throw error;

      toast({
        title: 'Success',
        description: editingSub
          ? `Organization subscription updated across ${orgCompanyIds.length} compan${orgCompanyIds.length === 1 ? 'y' : 'ies'}.`
          : `Organization subscription assigned across ${orgCompanyIds.length} compan${orgCompanyIds.length === 1 ? 'y' : 'ies'}.`,
      });
      setDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      console.error('Error saving subscription:', error);
      const msg = error.message?.includes('unique')
        ? 'One or more companies already have subscriptions. Existing rows were updated.'
        : error.message;
      toast({ title: 'Error', description: msg || 'Failed to save.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredSubs = organizationSubs.filter(s =>
    s.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.tier_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const totalMRR = organizationSubs.filter(s => s.status === 'active').reduce((acc, s) => acc + s.monthly_price, 0);
  const activeSubs = organizationSubs.filter(s => s.status === 'active').length;

  const organizations = useMemo<OrganizationOption[]>(() => {
    const map = new Map<string, OrganizationOption>();
    companies.forEach((company) => {
      if (!company.tenant_id) return;
      const existing = map.get(company.tenant_id);
      if (existing) {
        existing.company_count += 1;
      } else {
        map.set(company.tenant_id, {
          id: company.tenant_id,
          name: company.tenant_name || 'Unknown Organization',
          company_count: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [companies]);

  const unassignedOrganizations = organizations.filter((org) => !organizationSubs.some((s) => s.tenant_id === org.id));

  const handleStripeCheckout = async (sub: OrganizationSub) => {
    const tier = tiers.find(t => t.id === sub.tier_id);
    if (!tier?.stripe_price_id) {
      toast({ title: 'Not Synced', description: 'This tier has no Stripe price. Go to Tiers tab and click "Sync" first.', variant: 'destructive' });
      return;
    }
    const targetCompany = companies.find((company) => company.tenant_id === sub.tenant_id);
    if (!targetCompany) {
      toast({ title: 'No Company', description: 'No active company found for this organization.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId: tier.stripe_price_id, companyId: targetCompany.id, companyName: targetCompany.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.open(data.url, '_blank');
    } catch (error: any) {
      toast({ title: 'Checkout Error', description: error.message || 'Failed to create checkout session.', variant: 'destructive' });
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
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Monthly Revenue
                  <HelpTooltip text="Total monthly recurring revenue from all active subscriptions. This is calculated from the tier prices assigned to active companies." />
                </p>
                <p className="text-2xl font-bold text-green-600">${totalMRR.toLocaleString()}</p>
              </div>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                <p className="text-2xl font-bold">{activeSubs}</p>
              </div>
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Companies</p>
                <p className="text-2xl font-bold">{companies.length}</p>
              </div>
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Unassigned
                  <HelpTooltip text="Organizations that haven't been assigned a subscription tier yet. Click 'Assign Subscription' to set one up for all companies in that organization." />
                </p>
                <p className="text-2xl font-bold text-amber-600">{unassignedOrganizations.length}</p>
              </div>
              <Package className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search organizations..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => openAssignDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Assign Subscription
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredSubs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No subscriptions found</p>
              <p className="text-sm">Assign a subscription tier to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubs.map(sub => (
                  <TableRow key={sub.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{sub.tenant_name}</TableCell>
                    <TableCell>{sub.company_count}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sub.tier_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sub.status === 'active' ? 'default' : sub.status === 'suspended' ? 'destructive' : 'secondary'}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{sub.billing_cycle || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">${sub.monthly_price}/mo</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(sub.start_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => handleStripeCheckout(sub)}
                          title="Send Stripe checkout link"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Checkout
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openAssignDialog(sub)}>
                          <Pencil className="h-4 w-4" />
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

      {/* Assign / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSub ? 'Edit Subscription' : 'Assign Subscription'}</DialogTitle>
            <DialogDescription>
              {editingSub ? 'Update the subscription for this organization and all of its companies.' : 'Select an organization and assign a subscription tier to all companies in it.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>
                Organization *
                <HelpTooltip text="Select the organization to assign a subscription tier to. This syncs to all active companies in that organization." />
              </Label>
              <Select value={formOrganizationId} onValueChange={setFormOrganizationId} disabled={!!editingSub}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {(editingSub ? organizations : unassignedOrganizations).map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.company_count} compan{org.company_count === 1 ? 'y' : 'ies'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>
                Subscription Tier *
                <HelpTooltip text="Choose which tier this organization should be on. The tier determines feature access and pricing for all companies under that organization." />
              </Label>
              <Select value={formTierId} onValueChange={setFormTierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tier" />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — ${t.monthly_price}/mo {t.stripe_price_id ? '✓' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  Status
                  <HelpTooltip text="Active = company can use the platform. Suspended = temporarily disabled. Trial = free trial period. Cancelled = no longer subscribed." />
                </Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  Billing Cycle
                  <HelpTooltip text="Monthly charges the tier price each month. Annual charges once per year (if an annual price is set on the tier)." />
                </Label>
                <Select value={formBillingCycle} onValueChange={setFormBillingCycle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>
                Notes
                <HelpTooltip text="Internal notes about this subscription. Only visible to super admins." />
              </Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingSub ? 'Save Changes' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
