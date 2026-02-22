import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { HelpTooltip } from '@/components/HelpTooltip';
import {
  Loader2,
  CreditCard,
  FileText,
  Calendar,
  Download,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Shield,
} from 'lucide-react';

interface SubscriptionData {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  planName: string;
  planAmount: number;
  planInterval: string;
  priceId: string;
}

interface InvoiceData {
  id: string;
  number: string | null;
  status: string;
  amount: number;
  currency: string;
  date: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
}

interface PaymentMethodData {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface AvailableTier {
  id: string;
  name: string;
  monthly_price: number;
  stripe_price_id: string | null;
}

export default function SubscriptionPortal() {
  const { user } = useAuth();
  const { currentCompany: selectedCompany } = useCompany();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [availableTiers, setAvailableTiers] = useState<AvailableTier[]>([]);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
  const [selectedNewPriceId, setSelectedNewPriceId] = useState('');

  const fetchDetails = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-subscription-details', {
        body: { companyId: selectedCompany?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubscription(data.subscription || null);
      setInvoices(data.invoices || []);
      setPaymentMethods(data.paymentMethods || []);
      setCustomerId(data.customerId || null);
    } catch (err: any) {
      console.error('Error fetching subscription details:', err);
      toast({ title: 'Error', description: err.message || 'Failed to load subscription details.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany?.id, toast]);

  const fetchTiers = useCallback(async () => {
    const { data } = await supabase
      .from('subscription_tiers')
      .select('id, name, monthly_price, stripe_price_id')
      .eq('is_active', true)
      .order('sort_order');
    setAvailableTiers(data || []);
  }, []);

  useEffect(() => {
    fetchDetails();
    fetchTiers();
  }, [fetchDetails, fetchTiers]);

  const handleAction = async (action: string, extra?: Record<string, string>) => {
    setActionLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: {
          action,
          customerId,
          subscriptionId: subscription?.id,
          ...extra,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        window.open(data.url, '_blank');
      }

      toast({ title: 'Success', description: getActionMessage(action) });
      setCancelDialogOpen(false);
      setChangePlanDialogOpen(false);
      await fetchDetails();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Action failed.', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const getActionMessage = (action: string) => {
    switch (action) {
      case 'cancel-subscription': return 'Your subscription will cancel at the end of the billing period.';
      case 'reactivate-subscription': return 'Subscription reactivated successfully.';
      case 'change-plan': return 'Plan changed successfully. Prorations will apply.';
      default: return 'Action completed.';
    }
  };

  const formatCurrency = (amount: number, currency = 'usd') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive'; icon: React.ReactNode }> = {
      active: { variant: 'default', icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
      trialing: { variant: 'secondary', icon: <Calendar className="h-3 w-3 mr-1" /> },
      past_due: { variant: 'destructive', icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
      canceled: { variant: 'destructive', icon: <XCircle className="h-3 w-3 mr-1" /> },
      paid: { variant: 'default', icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
      open: { variant: 'secondary', icon: <FileText className="h-3 w-3 mr-1" /> },
      void: { variant: 'secondary', icon: <XCircle className="h-3 w-3 mr-1" /> },
    };
    const cfg = map[status] || { variant: 'secondary' as const, icon: null };
    return (
      <Badge variant={cfg.variant} className="gap-0">
        {cfg.icon}
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Subscription Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your plan, billing, and payment methods
            <HelpTooltip text="This portal shows your current subscription status, past invoices, and lets you update your payment method or change plans." />
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDetails} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payment">Payment Method</TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="space-y-4">
          {!subscription ? (
            <Card>
              <CardContent className="py-12 text-center">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="font-medium text-lg">No Active Subscription</p>
                <p className="text-sm text-muted-foreground mt-1">Contact your administrator to set up a subscription.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>
                      Current Plan
                      <HelpTooltip text="Your active subscription tier. This determines which features your company has access to." />
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{subscription.planName}</p>
                    <p className="text-muted-foreground">
                      {formatCurrency(subscription.planAmount)}/{subscription.planInterval}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>
                      Status
                      <HelpTooltip text="Active means your subscription is in good standing. Past Due means a payment failed. Trialing means you're in a free trial." />
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(subscription.status)}
                      {subscription.cancelAtPeriodEnd && (
                        <Badge variant="destructive" className="text-xs">Cancels Soon</Badge>
                      )}
                    </div>
                    {subscription.cancelAtPeriodEnd && subscription.cancelAt && (
                      <p className="text-xs text-destructive mt-2">
                        Cancels on {new Date(subscription.cancelAt).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>
                      Billing Period
                      <HelpTooltip text="The date range for your current billing cycle. You'll be charged again at the end of this period." />
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium">
                      {new Date(subscription.currentPeriodStart).toLocaleDateString()} —{' '}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Next charge: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Plan Actions</CardTitle>
                  <CardDescription>
                    Change your plan or manage cancellation
                    <HelpTooltip text="Changing plans will prorate your charges. Cancellation takes effect at the end of your billing period — you keep access until then." />
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3 flex-wrap">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setSelectedNewPriceId('');
                      setChangePlanDialogOpen(true);
                    }}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    Change Plan
                  </Button>

                  {subscription.cancelAtPeriodEnd ? (
                    <Button
                      variant="default"
                      className="gap-2"
                      disabled={actionLoading === 'reactivate-subscription'}
                      onClick={() => handleAction('reactivate-subscription')}
                    >
                      {actionLoading === 'reactivate-subscription' && <Loader2 className="h-4 w-4 animate-spin" />}
                      <CheckCircle2 className="h-4 w-4" />
                      Reactivate Subscription
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={() => setCancelDialogOpen(true)}
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel Subscription
                    </Button>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===== INVOICES TAB ===== */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice History
              </CardTitle>
              <CardDescription>
                View and download your past invoices
                <HelpTooltip text="All invoices from Stripe for your company. Click the PDF icon to download or the link icon to view the hosted invoice page." />
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No invoices found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.number || inv.id.slice(0, 12)}</TableCell>
                        <TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
                        <TableCell>{getStatusBadge(inv.status)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(inv.amount, inv.currency)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.pdfUrl && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" title="Download PDF">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {inv.hostedUrl && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" title="View invoice">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PAYMENT METHOD TAB ===== */}
        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Methods
              </CardTitle>
              <CardDescription>
                Your saved payment methods
                <HelpTooltip text="Cards on file with Stripe. Click 'Update Payment Method' to add or change your card via a secure Stripe checkout page." />
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentMethods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payment methods on file</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map(pm => (
                    <div
                      key={pm.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${pm.isDefault ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium capitalize">
                            {pm.brand} •••• {pm.last4}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Expires {pm.expMonth}/{pm.expYear}
                          </p>
                        </div>
                      </div>
                      {pm.isDefault && <Badge variant="secondary">Default</Badge>}
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="mt-4 gap-2"
                disabled={!customerId || actionLoading === 'create-update-payment-session'}
                onClick={() => handleAction('create-update-payment-session')}
              >
                {actionLoading === 'create-update-payment-session' && <Loader2 className="h-4 w-4 animate-spin" />}
                <CreditCard className="h-4 w-4" />
                Update Payment Method
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cancel Subscription
            </DialogTitle>
            <DialogDescription>
              Your subscription will remain active until the end of your current billing period on{' '}
              <strong>{subscription ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : ''}</strong>.
              After that, you'll lose access to premium features. You can reactivate anytime before then.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Keep Subscription</Button>
            <Button
              variant="destructive"
              disabled={actionLoading === 'cancel-subscription'}
              onClick={() => handleAction('cancel-subscription')}
            >
              {actionLoading === 'cancel-subscription' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={changePlanDialogOpen} onOpenChange={setChangePlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Change Plan
            </DialogTitle>
            <DialogDescription>
              Select a new plan. Charges will be prorated — you'll only pay the difference for the remainder of your billing period.
              <HelpTooltip text="If you upgrade, you'll be charged the prorated difference immediately. If you downgrade, you'll receive a credit on your next invoice." />
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedNewPriceId} onValueChange={setSelectedNewPriceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {availableTiers
                  .filter(t => t.stripe_price_id && t.stripe_price_id !== subscription?.priceId)
                  .map(t => (
                    <SelectItem key={t.id} value={t.stripe_price_id!}>
                      {t.name} — ${t.monthly_price}/mo
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {availableTiers.filter(t => t.stripe_price_id && t.stripe_price_id !== subscription?.priceId).length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">No other plans available. Ask your admin to sync tiers with Stripe.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!selectedNewPriceId || actionLoading === 'change-plan'}
              onClick={() => handleAction('change-plan', { priceId: selectedNewPriceId })}
            >
              {actionLoading === 'change-plan' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
