import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/utils/formatNumber";
import { 
  Users, FileText, DollarSign, TrendingUp, 
  Clock, AlertTriangle, ArrowRight 
} from "lucide-react";

export default function ReceivablesDashboard() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    totalInvoiced: 0,
    totalOutstanding: 0,
    overdueAmount: 0,
    overdueCount: 0,
    paymentsThisMonth: 0,
    recentPayments: [] as any[],
    recentInvoices: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      loadStats();
    }
  }, [currentCompany?.id]);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Get customer counts
      const { data: customers } = await supabase
        .from("customers")
        .select("id, is_active")
        .eq("company_id", currentCompany!.id);

      // Get invoice totals
      const { data: invoices } = await supabase
        .from("ar_invoices")
        .select("id, total_amount, balance_due, status, invoice_number, issue_date, customers(name)")
        .eq("company_id", currentCompany!.id)
        .order("issue_date", { ascending: false })
        .limit(5);

      // Get payment totals
      const { data: payments } = await supabase
        .from("ar_payments")
        .select("id, amount, payment_date, customers(name)")
        .eq("company_id", currentCompany!.id)
        .order("payment_date", { ascending: false })
        .limit(5);

      const allInvoices = invoices || [];
      const allPayments = payments || [];
      const allCustomers = customers || [];

      // Calculate this month's payments
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const paymentsThisMonth = allPayments
        .filter(p => new Date(p.payment_date) >= thisMonth)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      setStats({
        totalCustomers: allCustomers.length,
        activeCustomers: allCustomers.filter(c => c.is_active).length,
        totalInvoiced: allInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
        totalOutstanding: allInvoices.reduce((sum, i) => sum + (i.balance_due || 0), 0),
        overdueAmount: allInvoices
          .filter(i => i.status === "overdue")
          .reduce((sum, i) => sum + (i.balance_due || 0), 0),
        overdueCount: allInvoices.filter(i => i.status === "overdue").length,
        paymentsThisMonth,
        recentPayments: allPayments.slice(0, 5),
        recentInvoices: allInvoices.slice(0, 5),
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: "New Customer", icon: Users, path: "/receivables/customers/add" },
    { label: "New Invoice", icon: FileText, path: "/receivables/invoices/add" },
    { label: "Record Payment", icon: DollarSign, path: "/receivables/payments/add" },
    { label: "View Reports", icon: TrendingUp, path: "/receivables/reports" },
  ];

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts Receivable</h1>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => navigate(action.path)}
          >
            <action.icon className="h-6 w-6" />
            <span>{action.label}</span>
          </Button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary/50" onClick={() => navigate("/receivables/customers")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">{stats.activeCustomers} active</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50" onClick={() => navigate("/receivables/invoices")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">${formatNumber(stats.totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">of ${formatNumber(stats.totalInvoiced)} invoiced</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-red-500/50" onClick={() => navigate("/receivables/invoices?status=overdue")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${formatNumber(stats.overdueAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.overdueCount} invoices overdue</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-green-500/50" onClick={() => navigate("/receivables/payments")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${formatNumber(stats.paymentsThisMonth)}</div>
            <p className="text-xs text-muted-foreground">payments received</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/receivables/invoices")}>
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No invoices yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentInvoices.map((inv: any) => (
                  <div 
                    key={inv.id} 
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/receivables/invoices/${inv.id}`)}
                  >
                    <div>
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">{inv.customers?.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${formatNumber(inv.total_amount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {inv.balance_due > 0 ? `$${formatNumber(inv.balance_due)} due` : "Paid"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Payments</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/receivables/payments")}>
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No payments yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentPayments.map((pmt: any) => (
                  <div 
                    key={pmt.id} 
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/receivables/payments/${pmt.id}`)}
                  >
                    <div>
                      <div className="font-medium">{pmt.customers?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(pmt.payment_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-green-600">+${formatNumber(pmt.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
