import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CreditCard, Download, Search, Calendar, DollarSign, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

interface PaymentRow {
  id: string;
  payment_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  reference: string;
  vendor: string;
  invoiceId?: string;
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case "cleared":
    case "sent":
      return "success" as const;
    case "pending":
    case "draft":
      return "warning" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "default" as const;
  }
};

const getMethodIcon = (method: string) => {
  switch (method) {
    case "ach":
      return "🏦";
    case "wire":
      return "💱";
    case "check":
      return "📄";
    case "card":
      return "💳";
    default:
      return "💰";
  }
};

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PaymentRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!currentCompany) return;
      setLoading(true);
      try {
        // Fetch payments for current company
        const paymentsQuery = supabase.from("payments").select("*").eq("company_id", currentCompany.id);
        const { data: paymentData, error: paymentError } = await paymentsQuery.order("payment_date", { ascending: false });

        if (paymentError) throw paymentError;
        if (!paymentData) {
          setRows([]);
          return;
        }

        // Fetch vendors
        const vendorIds = paymentData
          .map((p: any) => p.vendor_id)
          .filter((id: any): id is string => !!id);
        
        const uniqueVendorIds = [...new Set(vendorIds)];
        
        const { data: vendorData, error: vendorError } = uniqueVendorIds.length > 0
          ? await supabase.from("vendors").select("id, name").in("id", uniqueVendorIds)
          : { data: [], error: null };

        if (vendorError) throw vendorError;

        const vendorMap: Record<string, string> = {};
        vendorData?.forEach((v: any) => {
          vendorMap[v.id] = v.name;
        });

        // Fetch invoice lines
        const paymentIds = paymentData.map((p: any) => p.id);
        const { data: invoiceLineData, error: invoiceLineError } = paymentIds.length > 0
          ? await supabase.from("payment_invoice_lines").select("payment_id, invoice_id").in("payment_id", paymentIds)
          : { data: [], error: null };

        if (invoiceLineError) throw invoiceLineError;

        const invoiceMap: Record<string, string> = {};
        invoiceLineData?.forEach((line: any) => {
          if (!invoiceMap[line.payment_id]) {
            invoiceMap[line.payment_id] = line.invoice_id;
          }
        });

        const mapped: PaymentRow[] = paymentData.map((p: any) => ({
          id: p.id,
          payment_number: p.payment_number || "",
          amount: Number(p.amount) || 0,
          payment_date: p.payment_date || "",
          payment_method: p.payment_method || "",
          status: p.status || "",
          reference: p.memo || "",
          vendor: (p.vendor_id && vendorMap[p.vendor_id]) || "",
          invoiceId: invoiceMap[p.id],
        }));

        setRows(mapped);
      } catch (e) {
        console.error("Error loading payments", e);
        toast({ title: "Error", description: "Failed to load payment history", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentCompany, toast]);

  const filteredPayments = useMemo(() => {
    let list = [...rows];

    // Text search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((p) =>
        p.vendor.toLowerCase().includes(q) ||
        (p.invoiceId || "").toLowerCase().includes(q) ||
        p.payment_number.toLowerCase().includes(q) ||
        (p.reference || "").toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      list = list.filter((p) => p.status === filterStatus);
    }

    // Method filter
    if (filterMethod !== "all") {
      list = list.filter((p) => p.payment_method === filterMethod);
    }

    return list;
  }, [rows, searchTerm, filterStatus, filterMethod]);

  const totalPaid = useMemo(
    () => rows.filter((r) => r.status === "cleared" || r.status === "sent").reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );
  const totalProcessing = useMemo(
    () => rows.filter((r) => r.status === "pending" || r.status === "draft").reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );
  const thisMonthTotal = useMemo(() => {
    const now = new Date();
    return rows
      .filter((r) => {
        const d = new Date(r.payment_date);
        return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
      })
      .reduce((s, r) => s + Number(r.amount || 0), 0);
  }, [rows]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
          <p className="text-muted-foreground">Track all payment transactions and history</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPaid.toLocaleString()}</div>
            <Badge variant="success" className="mt-2">
              {rows.filter((r) => r.status === "cleared" || r.status === "sent").length} completed
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalProcessing.toLocaleString()}</div>
            <Badge variant="warning" className="mt-2">
              {rows.filter((r) => r.status === "pending" || r.status === "draft").length} pending
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${thisMonthTotal.toLocaleString()}</div>
            <Badge variant="default" className="mt-2">
              {rows.filter((r) => {
                const d = new Date(r.payment_date);
                const n = new Date();
                return d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth();
              }).length} transactions
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="ach">ACH</SelectItem>
                <SelectItem value="wire">Wire</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setFilterStatus("all");
                setFilterMethod("all");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment #</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No payment history found</p>
                      <p className="text-sm">Payments will appear here once invoices are processed</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow 
                    key={p.id} 
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => navigate(`/payables/payments/${p.id}`)}
                  >
                    <TableCell className="font-medium">{p.payment_number}</TableCell>
                    <TableCell>
                      <Button 
                        variant="link" 
                        className="h-auto p-0 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (p.invoiceId) navigate(`/bills/${p.invoiceId}`);
                        }}
                      >
                        {p.invoiceId || "—"}
                      </Button>
                    </TableCell>
                    <TableCell>{p.vendor}</TableCell>
                    <TableCell className="font-semibold">${Number(p.amount).toLocaleString()}</TableCell>
                    <TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getMethodIcon(p.payment_method)}</span>
                        {p.payment_method.toUpperCase()}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.reference || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(p.status)}>{p.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
