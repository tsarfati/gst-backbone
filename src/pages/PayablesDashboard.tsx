import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Clock, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign,
  TrendingUp,
  Filter,
  Plus,
  Eye,
  Calendar,
  Building2,
  Receipt,
  PieChart
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

interface PayableMetrics {
  totalOutstanding: number;
  overdueBills: number;
  pendingApproval: number;
  paidThisMonth: number;
  avgPaymentDays: number;
  totalVendors: number;
}

interface RecentActivity {
  id: string;
  type: 'payment' | 'bill_created' | 'bill_approved' | 'bill_overdue';
  description: string;
  amount: number;
  vendor: string;
  date: string;
}

export default function PayablesDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<PayableMetrics>({
    totalOutstanding: 0,
    overdueBills: 0, 
    pendingApproval: 0,
    paidThisMonth: 0,
    avgPaymentDays: 0,
    totalVendors: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("this_month");

  useEffect(() => {
    if (user && (currentCompany?.id || profile?.current_company_id)) {
      loadDashboardData();
    }
  }, [user, currentCompany, profile?.current_company_id, selectedPeriod]);

  const loadDashboardData = async () => {
    if (!user || !(currentCompany?.id || profile?.current_company_id)) return;
    
    try {
      setLoading(true);
      
      // Load vendors count
      const { data: vendorsData } = await supabase
        .from('vendors')
        .select('id')
        .eq('company_id', currentCompany?.id || profile?.current_company_id);

      // Load invoices for calculations (filtered by company)
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*, vendors!inner(company_id)')
        .eq('vendors.company_id', currentCompany?.id || profile?.current_company_id)
        .order('created_at', { ascending: false });

      // Calculate metrics
      const totalOutstanding = (invoicesData || [])
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);

      const overdueBills = (invoicesData || [])
        .filter(inv => inv.status === 'overdue').length;

      const pendingApproval = (invoicesData || [])
        .filter(inv => inv.status === 'pending').length;

      const currentMonth = new Date();
      const paidThisMonth = (invoicesData || [])
        .filter(inv => {
          if (inv.status !== 'paid') return false;
          const invDate = new Date(inv.created_at);
          return invDate.getMonth() === currentMonth.getMonth() && 
                 invDate.getFullYear() === currentMonth.getFullYear();
        })
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);

      setMetrics({
        totalOutstanding,
        overdueBills,
        pendingApproval,
        paidThisMonth,
        avgPaymentDays: 15, // Placeholder
        totalVendors: (vendorsData || []).length
      });

      // Remove mock data - just set empty array
      setRecentActivity([]);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const statusCards = [
    {
      title: "Total Outstanding",
      value: `$${metrics.totalOutstanding.toLocaleString()}`,
      icon: DollarSign,
      variant: "default" as const,
      description: "Amount owed to vendors",
      onClick: () => navigate('/invoices?status=outstanding')
    },
    {
      title: "Pending Approval",
      value: metrics.pendingApproval.toString(),
      icon: Clock,
      variant: "warning" as const,
      description: "Bills awaiting approval",
      onClick: () => navigate('/invoices?status=pending')
    },
    {
      title: "Overdue Bills",
      value: metrics.overdueBills.toString(),
      icon: AlertTriangle,
      variant: "destructive" as const,
      description: "Past due payments",
      onClick: () => navigate('/invoices?status=overdue')
    },
    {
      title: "Paid This Month",
      value: `$${metrics.paidThisMonth.toLocaleString()}`,
      icon: CheckCircle,
      variant: "success" as const,
      description: "Successfully processed",
      onClick: () => navigate('/bills/payments')
    }
  ];

  const quickActions = [
    { name: "Add Bill", href: "/bills/add", icon: Plus },
    { name: "View All Bills", href: "/bills", icon: Eye },
    { name: "Payment Reports", href: "/bills/payment-reports", icon: TrendingUp },
    { name: "Add Vendor", href: "/vendors/add", icon: Building2 },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'payment': return CheckCircle;
      case 'bill_created': return FileText;
      case 'bill_approved': return CheckCircle;
      case 'bill_overdue': return AlertTriangle;
      default: return FileText;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'payment': return 'text-success';
      case 'bill_created': return 'text-primary';
      case 'bill_approved': return 'text-success';
      case 'bill_overdue': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading payables dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payables Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor vendor payments and bill management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <TrendingUp className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statusCards.map((card) => (
          <Card 
            key={card.title} 
            className="hover-stat cursor-pointer transition-all hover:shadow-md"
            onClick={card.onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
              <Badge variant={card.variant} className="mt-2">
                {card.variant === "warning" && "Needs Attention"}
                {card.variant === "success" && "On Track"}
                {card.variant === "destructive" && "Urgent"}
                {card.variant === "default" && "Active"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts and Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Payment Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Average Payment Days</span>
                <span className="font-semibold">{metrics.avgPaymentDays} days</span>
              </div>
              <Progress value={65} className="h-2" />
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-3 bg-success/10 rounded-lg">
                  <p className="text-lg font-bold text-success">{metrics.totalVendors}</p>
                  <p className="text-xs text-muted-foreground">Active Vendors</p>
                </div>
                <div className="text-center p-3 bg-primary/10 rounded-lg">
                  <p className="text-lg font-bold text-primary">
                    ${(metrics.totalOutstanding / Math.max(metrics.totalVendors, 1)).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg per Vendor</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow Impact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Cash Flow Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">This Month Outflow</span>
                <span className="font-semibold text-destructive">
                  -${metrics.paidThisMonth.toLocaleString()}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Upcoming (Next 30 days)</span>
                  <span>${(metrics.totalOutstanding * 0.6).toLocaleString()}</span>
                </div>
                <Progress value={60} className="h-2" />
                
                <div className="flex justify-between text-sm">
                  <span>Future Obligations</span>
                  <span>${(metrics.totalOutstanding * 0.4).toLocaleString()}</span>
                </div>
                <Progress value={40} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Button
                key={action.name}
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => navigate(action.href)}
              >
                <action.icon className="h-6 w-6" />
                <span className="text-sm">{action.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity & Upcoming Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              ) : (
                recentActivity.map((activity) => {
                  const ActivityIcon = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <ActivityIcon className={`h-4 w-4 ${getActivityColor(activity.type)}`} />
                        <div>
                          <p className="font-medium text-sm">{activity.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.vendor} • ${activity.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.date).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No scheduled payments</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Schedule Payment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}