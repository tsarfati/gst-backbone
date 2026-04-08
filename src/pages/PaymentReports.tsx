import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  PieChart,
  CreditCard
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

interface PaymentRow {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  vendor_name: string;
}

interface MonthlyRow {
  month: string;
  totalPaid: number;
  invoiceCount: number;
  avgProcessTime: string;
}

interface VendorRow {
  vendor: string;
  totalPaid: number;
  invoiceCount: number;
  percentage: string;
}

interface MethodRow {
  method: string;
  count: number;
  percentage: string;
  avgAmount: number;
}

const PERIOD_LABELS: Record<string, string> = {
  "1month": "Last Month",
  "3months": "Last 3 Months",
  "6months": "Last 6 Months",
  "1year": "Last Year",
};

export default function PaymentReports() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoiceCreatedAtByPaymentId, setInvoiceCreatedAtByPaymentId] = useState<Record<string, string>>({});

  const getStartDate = (period: string) => {
    const now = new Date();
    const start = new Date(now);
    if (period === "1month") start.setMonth(now.getMonth() - 1);
    if (period === "3months") start.setMonth(now.getMonth() - 3);
    if (period === "6months") start.setMonth(now.getMonth() - 6);
    if (period === "1year") start.setFullYear(now.getFullYear() - 1);
    return start;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

  const formatMethodLabel = (method: string) =>
    (method || "unknown")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const downloadCsv = (filename: string, rows: Record<string, string | number>[]) => {
    if (!rows.length) {
      toast({ title: "No data", description: "No records to export for this period." });
      return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const value = row[h] ?? "";
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!currentCompany?.id) return;
      setLoading(true);
      try {
        const startDate = getStartDate(selectedPeriod);

        const vendorResponse: any = await supabase
          .from("vendors")
          .select("id, name")
          .eq("company_id", currentCompany.id);

        if (vendorResponse.error) throw vendorResponse.error;

        const vendors = vendorResponse.data || [];
        const vendorIds = vendors.map((vendor: any) => vendor.id).filter(Boolean);
        const vendorNameById = new Map<string, string>(
          vendors.map((vendor: any) => [vendor.id, vendor.name || "Unknown Vendor"])
        );

        if (!vendorIds.length) {
          setPayments([]);
          setInvoiceCreatedAtByPaymentId({});
          return;
        }

        const paymentResponse: any = await supabase
          .from("payments")
          .select("id, amount, payment_date, payment_method, vendor_id")
          .in("vendor_id", vendorIds)
          .gte("payment_date", startDate.toISOString().slice(0, 10))
          .order("payment_date", { ascending: true });

        if (paymentResponse.error) throw paymentResponse.error;

        const mappedPayments: PaymentRow[] = (paymentResponse.data || []).map((row: any) => ({
          id: row.id,
          amount: Number(row.amount) || 0,
          payment_date: row.payment_date,
          payment_method: row.payment_method || "unknown",
          vendor_name: vendorNameById.get(row.vendor_id) || "Unknown Vendor",
        }));

        setPayments(mappedPayments);

        const paymentIds = mappedPayments.map((p) => p.id);
        if (!paymentIds.length) {
          setInvoiceCreatedAtByPaymentId({});
          return;
        }

        const paymentInvoiceLines: any = await supabase
          .from("payment_invoice_lines")
          .select("payment_id, invoice_id")
          .in("payment_id", paymentIds);

        if (paymentInvoiceLines.error) throw paymentInvoiceLines.error;

        const invoiceIds = Array.from(new Set((paymentInvoiceLines.data || []).map((l: any) => l.invoice_id).filter(Boolean)));
        if (!invoiceIds.length) {
          setInvoiceCreatedAtByPaymentId({});
          return;
        }

        const invoicesResponse: any = await supabase
          .from("invoices")
          .select("id, created_at")
          .in("id", invoiceIds as string[]);

        if (invoicesResponse.error) throw invoicesResponse.error;

        const invoiceCreatedAtByInvoiceId = new Map<string, string>();
        (invoicesResponse.data || []).forEach((inv: any) => {
          invoiceCreatedAtByInvoiceId.set(inv.id, inv.created_at);
        });

        const invoiceByPayment: Record<string, string> = {};
        (paymentInvoiceLines.data || []).forEach((line: any) => {
          if (!invoiceByPayment[line.payment_id]) {
            invoiceByPayment[line.payment_id] = invoiceCreatedAtByInvoiceId.get(line.invoice_id) || "";
          }
        });

        setInvoiceCreatedAtByPaymentId(invoiceByPayment);
      } catch (error) {
        console.error("Error loading payment reports", error);
        toast({
          title: "Error",
          description: "Failed to load payment report data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentCompany?.id, selectedPeriod, toast]);

  const totals = useMemo(() => {
    const sorted = [...payments].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());
    const totalYearToDate = sorted.reduce((sum, row) => sum + row.amount, 0);

    const byMonth = new Map<string, number>();
    sorted.forEach((row) => {
      const key = `${new Date(row.payment_date).getFullYear()}-${new Date(row.payment_date).getMonth()}`;
      byMonth.set(key, (byMonth.get(key) || 0) + row.amount);
    });
    const monthValues = Array.from(byMonth.values());
    const currentMonthTotal = monthValues.length ? monthValues[monthValues.length - 1] : 0;
    const previousMonthTotal = monthValues.length > 1 ? monthValues[monthValues.length - 2] : 0;

    const avgPaymentValue = sorted.length ? totalYearToDate / sorted.length : 0;

    const processDays: number[] = sorted
      .map((row) => {
        const invoiceCreatedAt = invoiceCreatedAtByPaymentId[row.id];
        if (!invoiceCreatedAt) return null;
        const diffMs = new Date(row.payment_date).getTime() - new Date(invoiceCreatedAt).getTime();
        return diffMs >= 0 ? diffMs / (1000 * 60 * 60 * 24) : null;
      })
      .filter((v): v is number => v !== null);

    const avgProcessDays = processDays.length
      ? processDays.reduce((sum, v) => sum + v, 0) / processDays.length
      : 0;

    return {
      totalYearToDate,
      currentMonthTotal,
      previousMonthTotal,
      monthOverMonth: previousMonthTotal === 0
        ? 0
        : ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100,
      avgPaymentValue,
      avgProcessDays,
      totalInvoices: sorted.length,
    };
  }, [payments, invoiceCreatedAtByPaymentId]);

  const monthlyData: MonthlyRow[] = useMemo(() => {
    const grouped = new Map<string, { totalPaid: number; invoiceCount: number; processTimes: number[] }>();

    payments.forEach((row) => {
      const date = new Date(row.payment_date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      if (!grouped.has(key)) grouped.set(key, { totalPaid: 0, invoiceCount: 0, processTimes: [] });
      const bucket = grouped.get(key)!;
      bucket.totalPaid += row.amount;
      bucket.invoiceCount += 1;

      const invoiceCreatedAt = invoiceCreatedAtByPaymentId[row.id];
      if (invoiceCreatedAt) {
        const days = (new Date(row.payment_date).getTime() - new Date(invoiceCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) bucket.processTimes.push(days);
      }

      (bucket as any).label = label;
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, value]: any) => ({
        month: value.label,
        totalPaid: value.totalPaid,
        invoiceCount: value.invoiceCount,
        avgProcessTime: value.processTimes.length
          ? `${(value.processTimes.reduce((s: number, d: number) => s + d, 0) / value.processTimes.length).toFixed(1)}d`
          : "n/a",
      }));
  }, [payments, invoiceCreatedAtByPaymentId]);

  const vendorPayments: VendorRow[] = useMemo(() => {
    const grouped = new Map<string, { totalPaid: number; invoiceCount: number }>();
    const grandTotal = payments.reduce((sum, p) => sum + p.amount, 0);

    payments.forEach((row) => {
      if (!grouped.has(row.vendor_name)) grouped.set(row.vendor_name, { totalPaid: 0, invoiceCount: 0 });
      const bucket = grouped.get(row.vendor_name)!;
      bucket.totalPaid += row.amount;
      bucket.invoiceCount += 1;
    });

    return Array.from(grouped.entries())
      .map(([vendor, value]) => ({
        vendor,
        totalPaid: value.totalPaid,
        invoiceCount: value.invoiceCount,
        percentage: grandTotal ? ((value.totalPaid / grandTotal) * 100).toFixed(1) : "0.0",
      }))
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, 8);
  }, [payments]);

  const paymentMethods: MethodRow[] = useMemo(() => {
    const grouped = new Map<string, { count: number; totalAmount: number }>();
    const totalCount = payments.length;

    payments.forEach((row) => {
      if (!grouped.has(row.payment_method)) grouped.set(row.payment_method, { count: 0, totalAmount: 0 });
      const bucket = grouped.get(row.payment_method)!;
      bucket.count += 1;
      bucket.totalAmount += row.amount;
    });

    return Array.from(grouped.entries())
      .map(([method, value]) => ({
        method: formatMethodLabel(method),
        count: value.count,
        percentage: totalCount ? ((value.count / totalCount) * 100).toFixed(1) : "0.0",
        avgAmount: value.count ? value.totalAmount / value.count : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [payments]);

  const exportVendorSummary = () => {
    downloadCsv(`vendor-summary-${selectedPeriod}.csv`, vendorPayments.map((v) => ({
      vendor: v.vendor,
      total_paid: v.totalPaid.toFixed(2),
      invoice_count: v.invoiceCount,
      share_percent: v.percentage,
    })));
  };

  const exportMonthlyAnalysis = () => {
    downloadCsv(`monthly-analysis-${selectedPeriod}.csv`, monthlyData.map((m) => ({
      month: m.month,
      total_paid: m.totalPaid.toFixed(2),
      invoice_count: m.invoiceCount,
      avg_processing_time: m.avgProcessTime,
    })));
  };

  const exportCustomPeriod = () => {
    downloadCsv(`custom-period-${selectedPeriod}.csv`, payments.map((p) => ({
      payment_date: p.payment_date,
      vendor: p.vendor_name,
      payment_method: p.payment_method,
      amount: p.amount.toFixed(2),
    })));
  };

  if (loading) {
    return <div className="p-6">Loading payment reports...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">{PERIOD_LABELS[selectedPeriod] || "Selected period"}</p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCustomPeriod}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalYearToDate)}</div>
            <div className="flex items-center text-sm mt-2">
              <TrendingUp className="h-3 w-3 text-muted-foreground mr-1" />
              <span className="text-muted-foreground">{totals.monthOverMonth.toFixed(1)}% vs prior month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Payment Value</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.avgPaymentValue)}</div>
            <Badge variant="default" className="mt-2">Per payment</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.avgProcessDays.toFixed(1)} days</div>
            <Badge variant="default" className="mt-2">Invoice to payment</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalInvoices}</div>
            <Badge variant="default" className="mt-2">This period</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Monthly Payment Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment activity in this period.</p>
              ) : (
                monthlyData.map((month) => (
                  <div key={month.month} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{month.month}</p>
                      <p className="text-sm text-muted-foreground">
                        {month.invoiceCount} payments • {month.avgProcessTime} avg
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(month.totalPaid)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              Top Vendors by Payment Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vendorPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vendor payment data in this period.</p>
              ) : (
                vendorPayments.map((vendor, index) => (
                  <div key={vendor.vendor} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{vendor.vendor}</p>
                        <p className="text-sm text-muted-foreground">{vendor.invoiceCount} payments</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(vendor.totalPaid)}</p>
                      <Badge variant="default" className="text-xs">{vendor.percentage}%</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Methods Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {paymentMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment methods available in this period.</p>
            ) : (
              paymentMethods.map((method) => (
                <div key={method.method} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{method.method}</p>
                    <Badge variant="outline">{method.percentage}%</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Count:</span>
                      <span className="font-medium">{method.count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Amount:</span>
                      <span className="font-medium">{formatCurrency(method.avgAmount)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Generate Custom Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto flex-col p-4" onClick={exportVendorSummary}>
              <FileText className="h-6 w-6 mb-2" />
              <span className="font-medium">Vendor Summary</span>
              <span className="text-xs text-muted-foreground">Download totals by vendor</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" onClick={exportMonthlyAnalysis}>
              <BarChart3 className="h-6 w-6 mb-2" />
              <span className="font-medium">Monthly Analysis</span>
              <span className="text-xs text-muted-foreground">Download monthly trend analysis</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4" onClick={exportCustomPeriod}>
              <Calendar className="h-6 w-6 mb-2" />
              <span className="font-medium">Custom Period</span>
              <span className="text-xs text-muted-foreground">Download selected period details</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col p-4"
              onClick={() => navigate("/construction/reports/ap-aging-by-job")}
            >
              <FileText className="h-6 w-6 mb-2" />
              <span className="font-medium">AP Aging By Job</span>
              <span className="text-xs text-muted-foreground">Who is owed by job and aging bucket</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col p-4"
              onClick={() => navigate("/bills/credit-card-transaction-report")}
            >
              <CreditCard className="h-6 w-6 mb-2" />
              <span className="font-medium">Credit Card Transactions</span>
              <span className="text-xs text-muted-foreground">Transaction report by card</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
