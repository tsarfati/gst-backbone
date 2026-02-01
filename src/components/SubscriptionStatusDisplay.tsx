import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  CreditCard, 
  TrendingUp, 
  Users, 
  Building2,
  DollarSign,
  Crown,
  Star,
  Zap
} from 'lucide-react';

interface TenantSubscription {
  id: string;
  name: string;
  subscription_tier: string;
  is_active: boolean;
  max_companies: number | null;
  created_at: string;
  company_count: number;
  member_count: number;
}

// Subscription pricing (monthly revenue per tier)
const TIER_PRICING: Record<string, number> = {
  free: 0,
  starter: 29,
  professional: 99,
  enterprise: 299,
  custom: 0, // Custom pricing
};

const TIER_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-800',
  starter: 'bg-blue-100 text-blue-800',
  professional: 'bg-purple-100 text-purple-800',
  enterprise: 'bg-amber-100 text-amber-800',
  custom: 'bg-emerald-100 text-emerald-800',
};

const TIER_ICONS: Record<string, React.ReactNode> = {
  free: <Zap className="h-4 w-4" />,
  starter: <Star className="h-4 w-4" />,
  professional: <CreditCard className="h-4 w-4" />,
  enterprise: <Crown className="h-4 w-4" />,
  custom: <Building2 className="h-4 w-4" />,
};

export default function SubscriptionStatusDisplay() {
  const [subscriptions, setSubscriptions] = useState<TenantSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const { data: tenantsData, error } = await supabase
        .from('tenants')
        .select(`
          id,
          name,
          subscription_tier,
          is_active,
          max_companies,
          created_at,
          tenant_members (count),
          companies (count)
        `)
        .order('subscription_tier', { ascending: false });

      if (error) throw error;

      const enriched = tenantsData?.map(t => ({
        id: t.id,
        name: t.name,
        subscription_tier: t.subscription_tier || 'free',
        is_active: t.is_active,
        max_companies: t.max_companies,
        created_at: t.created_at,
        member_count: (t.tenant_members as any)?.[0]?.count || 0,
        company_count: (t.companies as any)?.[0]?.count || 0,
      })) || [];

      setSubscriptions(enriched);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate revenue metrics
  const totalMRR = subscriptions.reduce((acc, sub) => {
    return acc + (TIER_PRICING[sub.subscription_tier] || 0);
  }, 0);

  const tierCounts = subscriptions.reduce((acc, sub) => {
    const tier = sub.subscription_tier || 'free';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeSubscriptions = subscriptions.filter(s => s.is_active).length;
  const paidSubscriptions = subscriptions.filter(
    s => s.is_active && s.subscription_tier !== 'free'
  ).length;

  const conversionRate = subscriptions.length > 0 
    ? ((paidSubscriptions / subscriptions.length) * 100).toFixed(1)
    : '0';

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalMRR.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated MRR
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {paidSubscriptions}
            </div>
            <p className="text-xs text-muted-foreground">
              of {subscriptions.length} total groups
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {conversionRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Free to paid
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Groups</CardTitle>
            <Users className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {activeSubscriptions}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution */}
      <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <CardHeader>
          <CardTitle>Subscription Tier Distribution</CardTitle>
          <CardDescription>
            Breakdown of organizations by subscription level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(tierCounts).sort((a, b) => {
              const order = ['enterprise', 'professional', 'starter', 'free', 'custom'];
              return order.indexOf(a[0]) - order.indexOf(b[0]);
            }).map(([tier, count]) => {
              const percentage = ((count / subscriptions.length) * 100).toFixed(0);
              const revenue = count * (TIER_PRICING[tier] || 0);
              
              return (
                <div key={tier} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={TIER_COLORS[tier] || 'bg-gray-100'}>
                        {TIER_ICONS[tier]}
                        <span className="ml-1 capitalize">{tier}</span>
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {count} organization{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      ${revenue.toLocaleString()}/mo
                    </span>
                  </div>
                  <Progress value={parseFloat(percentage)} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card className="animate-fade-in" style={{ animationDelay: '0.35s' }}>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>
            Detailed view of all group subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Companies</TableHead>
                <TableHead className="text-center">Members</TableHead>
                <TableHead className="text-right">Monthly Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{sub.name}</TableCell>
                  <TableCell>
                    <Badge className={TIER_COLORS[sub.subscription_tier] || 'bg-gray-100'}>
                      {TIER_ICONS[sub.subscription_tier]}
                      <span className="ml-1 capitalize">{sub.subscription_tier}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={sub.is_active ? 'default' : 'destructive'}>
                      {sub.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="tabular-nums">
                      {sub.company_count}
                      {sub.max_companies && (
                        <span className="text-muted-foreground">/{sub.max_companies}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {sub.member_count}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    ${TIER_PRICING[sub.subscription_tier] || 0}/mo
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
