import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, DollarSign, TrendingUp, Users, Clock, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function ConstructionDashboard() {
  const { currentCompany } = useCompany();
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalBudget: 0,
    activeSubcontracts: 0,
    activePurchaseOrders: 0,
    totalCosts: 0,
    onTimeJobs: 0,
    overdueJobs: 0,
    totalEmployees: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchDashboardData();
    }
  }, [currentCompany?.id]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch active jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*, job_budgets(budgeted_amount, actual_amount)')
        .eq('company_id', currentCompany?.id)
        .eq('is_active', true);

      const subcontractCount = 0; // Placeholder
      const poCount = 0; // Placeholder

      // Calculate stats
      const totalBudget = jobs?.reduce((sum, job) => {
        const jobBudget = job.job_budgets?.reduce((s: number, b: any) => s + Number(b.budgeted_amount || 0), 0) || 0;
        return sum + jobBudget;
      }, 0) || 0;

      const totalCosts = jobs?.reduce((sum, job) => {
        const jobActual = job.job_budgets?.reduce((s: number, b: any) => s + Number(b.actual_amount || 0), 0) || 0;
        return sum + jobActual;
      }, 0) || 0;

      const today = new Date();
      const onTime = jobs?.filter(j => !j.end_date || new Date(j.end_date) >= today).length || 0;
      const overdue = jobs?.filter(j => j.end_date && new Date(j.end_date) < today).length || 0;

      setStats({
        activeJobs: jobs?.length || 0,
        totalBudget,
        activeSubcontracts: subcontractCount || 0,
        activePurchaseOrders: poCount || 0,
        totalCosts,
        onTimeJobs: onTime,
        overdueJobs: overdue,
        totalEmployees: 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const statCards = [
    {
      title: "Active Jobs",
      value: stats.activeJobs,
      icon: BarChart3,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Total Budget",
      value: formatCurrency(stats.totalBudget),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Total Costs",
      value: formatCurrency(stats.totalCosts),
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    },
    {
      title: "Active Subcontracts",
      value: stats.activeSubcontracts,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      title: "Purchase Orders",
      value: stats.activePurchaseOrders,
      icon: Package,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100"
    },
    {
      title: "On-Time Jobs",
      value: stats.onTimeJobs,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    },
    {
      title: "Overdue Jobs",
      value: stats.overdueJobs,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100"
    },
    {
      title: "Budget Remaining",
      value: formatCurrency(stats.totalBudget - stats.totalCosts),
      icon: DollarSign,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100"
    },
  ];

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Construction Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of all construction projects and activities</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`${stat.bgColor} p-2 rounded-lg`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Budget Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Budget Utilization</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.totalBudget > 0 ? ((stats.totalCosts / stats.totalBudget) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ 
                      width: `${stats.totalBudget > 0 ? Math.min((stats.totalCosts / stats.totalBudget) * 100, 100) : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Budget</p>
                  <p className="text-lg font-semibold">{formatCurrency(stats.totalBudget)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Costs</p>
                  <p className="text-lg font-semibold">{formatCurrency(stats.totalCosts)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium">On Time</span>
                </div>
                <span className="text-2xl font-bold text-emerald-600">{stats.onTimeJobs}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="font-medium">Overdue</span>
                </div>
                <span className="text-2xl font-bold text-red-600">{stats.overdueJobs}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
