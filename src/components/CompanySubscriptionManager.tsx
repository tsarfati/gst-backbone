import { useState, useEffect } from 'react';
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
import {
  Plus,
  Search,
  Loader2,
  Building2,
  DollarSign,
  Pencil,
  Package,
  CreditCard,
  TrendingUp,
  Users,
} from 'lucide-react';

interface CompanySub {
  id: string;
  company_id: string;
  company_name: string;
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
}

interface Company {
  id: string;
  name: string;
}

export default function CompanySubscriptionManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companySubs, setCompanySubs] = useState<CompanySub[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<CompanySub | null>(null);

  // Form
  const [formCompanyId, setFormCompanyId] = useState('');
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
          companies!company_subscriptions_company_id_fkey (name),
          subscription_tiers!company_subscriptions_tier_id_fkey (name, monthly_price)
        `).order('created_at', { ascending: false }),
        supabase.from('subscription_tiers').select('id, name, monthly_price, is_active').eq('is_active', true).order('sort_order'),
        supabase.from('companies').select('id, name').eq('is_active', true).order('name'),
      ]);

      if (sErr) throw sErr;
      if (tErr) throw tErr;
      if (cErr) throw cErr;

      setTiers(tiersData || []);
      setCompanies(companiesData || []);
      setCompanySubs(
        (subsData || []).map((s: any) => ({
          id: s.id,
          company_id: s.company_id,
          company_name: s.companies?.name || 'Unknown',
          tier_id: s.tier_id,
          tier_name: s.subscription_tiers?.name || 'Unknown',
          monthly_price: s.subscription_tiers?.monthly_price || 0,
          status: s.status,
          start_date: s.start_date,
          billing_cycle: s.billing_cycle,
          notes: s.notes,
        }))
      );
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load subscriptions.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openAssignDialog = (sub?: CompanySub) => {
    if (sub) {
      setEditingSub(sub);
      setFormCompanyId(sub.company_id);
      setFormTierId(sub.tier_id);
      setFormStatus(sub.status);
      setFormBillingCycle(sub.billing_cycle || 'monthly');
      setFormNotes(sub.notes || '');
    } else {
      setEditingSub(null);
      setFormCompanyId('');
      setFormTierId('');
      setFormStatus('active');
      setFormBillingCycle('monthly');
      setFormNotes('');
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formCompanyId || !formTierId || !user) {
      toast({ title: 'Error', description: 'Company and tier are required.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingSub) {
        const { error } = await supabase
          .from('company_subscriptions')
          .update({
            tier_id: formTierId,
            status: formStatus,
            billing_cycle: formBillingCycle,
            notes: formNotes.trim() || null,
          })
          .eq('id', editingSub.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_subscriptions')
          .insert({
            company_id: formCompanyId,
            tier_id: formTierId,
            status: formStatus,
            billing_cycle: formBillingCycle,
            notes: formNotes.trim() || null,
            assigned_by: user.id,
          });
        if (error) throw error;
      }

      toast({ title: 'Success', description: editingSub ? 'Subscription updated.' : 'Subscription assigned.' });
      setDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      console.error('Error saving subscription:', error);
      const msg = error.message?.includes('unique') ? 'This company already has a subscription. Edit the existing one instead.' : error.message;
      toast({ title: 'Error', description: msg || 'Failed to save.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredSubs = companySubs.filter(s =>
    s.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.tier_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const totalMRR = companySubs.filter(s => s.status === 'active').reduce((acc, s) => acc + s.monthly_price, 0);
  const activeSubs = companySubs.filter(s => s.status === 'active').length;
  const unassignedCompanies = companies.filter(c => !companySubs.some(s => s.company_id === c.id));

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
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
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
                <p className="text-sm text-muted-foreground">Unassigned</p>
                <p className="text-2xl font-bold text-amber-600">{unassignedCompanies.length}</p>
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
          <Input placeholder="Search companies..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
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
                  <TableHead>Company</TableHead>
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
                    <TableCell className="font-medium">{sub.company_name}</TableCell>
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
                      <Button variant="ghost" size="icon" onClick={() => openAssignDialog(sub)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
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
              {editingSub ? 'Update the subscription for this company.' : 'Select a company and assign a subscription tier.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Company *</Label>
              <Select value={formCompanyId} onValueChange={setFormCompanyId} disabled={!!editingSub}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {(editingSub ? companies : unassignedCompanies).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subscription Tier *</Label>
              <Select value={formTierId} onValueChange={setFormTierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tier" />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — ${t.monthly_price}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
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
                <Label>Billing Cycle</Label>
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
              <Label>Notes</Label>
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
