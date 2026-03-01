import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CreditCard, Download, Search, Calendar, DollarSign, FileText, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  invoiceNumber?: string;
}

const getStatusVariant = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s.includes("reconciled") || s.includes("paid") || ["cleared", "sent", "completed", "posted", "success"].includes(s)) {
    return "success" as const;
  }
  if (["failed", "error", "rejected"].includes(s)) {
    return "destructive" as const;
  }
  // Display-only: default to success for other payment states
  return "success" as const;
};

const getMethodIcon = (method: string) => {
  switch (method) {
    case "ach":
      return "🏦";
    case "wire":
      return "💱";
    case "check":
      return "📄";
    case "credit_card":
      return "💳";
    case "cash":
      return "💵";
    default:
      return "💰";
  }
};

const getDisplayStatus = (status: string) => {
  const s = (status || "").toLowerCase();
  if (["cleared", "reconciled"].includes(s)) return "Paid & Reconciled";
  return "Paid";
};

export default function PaymentHistory() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PaymentRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!currentCompany) return;
      setLoading(true);
      try {
        // Fetch payments for current company through vendors
        // @ts-ignore - Supabase type inference issue with deeply nested types
        const paymentResponse: any = await supabase
          .from("payments")
          .select("*, vendors!inner(company_id)")
          .eq("vendors.company_id", currentCompany.id)
          .order("payment_date", { ascending: false });
        
        const { data: paymentData, error: paymentError } = paymentResponse;

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
        
        const vendorResponse: any = uniqueVendorIds.length > 0
          ? await supabase.from("vendors").select("id, name").in("id", uniqueVendorIds as string[])
          : { data: [], error: null };
        
        const { data: vendorData, error: vendorError } = vendorResponse;

        if (vendorError) throw vendorError;

        const vendorMap: Record<string, string> = {};
        vendorData?.forEach((v: any) => {
          vendorMap[v.id] = v.name;
        });

        // Fetch invoice lines
        const paymentIds = paymentData.map((p: any) => p.id);
        const invoiceLineResponse: any = paymentIds.length > 0
          ? await supabase.from("payment_invoice_lines").select("payment_id, invoice_id").in("payment_id", paymentIds)
          : { data: [], error: null };
        
        const { data: invoiceLineData, error: invoiceLineError } = invoiceLineResponse;

        if (invoiceLineError) throw invoiceLineError;

        const invoiceMap: Record<string, string> = {};
        const invoiceIds: string[] = [];
        invoiceLineData?.forEach((line: any) => {
          if (!invoiceMap[line.payment_id]) {
            invoiceMap[line.payment_id] = line.invoice_id;
            invoiceIds.push(line.invoice_id);
          }
        });

        // Fetch invoice numbers (optional)
        const invoiceResponse: any = invoiceIds.length > 0
          // @ts-ignore - bills table may not be in generated types for some environments
          ? await supabase.from("invoices").select("id, invoice_number").in("id", invoiceIds)
          : { data: [], error: null };
        
        const invoiceNumberMap: Record<string, string> = {};
        if (invoiceResponse?.error) {
          console.warn("Could not fetch invoice numbers from bills table", invoiceResponse.error);
        } else {
          invoiceResponse?.data?.forEach((inv: any) => {
            invoiceNumberMap[inv.id] = inv.invoice_number;
          });
        }

        const mapped: PaymentRow[] = paymentData.map((p: any) => {
          const invoiceId = invoiceMap[p.id];
          return {
            id: p.id,
            payment_number: p.payment_number || "",
            amount: Number(p.amount) || 0,
            payment_date: p.payment_date || "",
            payment_method: p.payment_method || "",
            status: p.status || "",
            reference: p.memo || "",
            vendor: (p.vendor_id && vendorMap[p.vendor_id]) || "",
            invoiceId: invoiceId,
            invoiceNumber: invoiceId ? invoiceNumberMap[invoiceId] : undefined,
          };
        });

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

    // Date range filter
    if (startDate) {
      list = list.filter((p) => new Date(p.payment_date) >= startDate);
    }
    if (endDate) {
      list = list.filter((p) => new Date(p.payment_date) <= endDate);
    }

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
      const statusLower = filterStatus.toLowerCase();
      if (statusLower === "reconciled") {
        list = list.filter((p) => p.status.toLowerCase().includes("reconciled"));
      } else if (statusLower === "paid") {
        list = list.filter((p) => !p.status.toLowerCase().includes("reconciled"));
      }
    }

    // Method filter
    if (filterMethod !== "all") {
      list = list.filter((p) => p.payment_method === filterMethod);
    }

    return list;
  }, [rows, searchTerm, filterStatus, filterMethod, startDate, endDate]);

  // Apply date filtering to rows for counter calculations
  const dateFilteredRows = useMemo(() => {
    let list = [...rows];
    if (startDate) {
      list = list.filter((r) => new Date(r.payment_date) >= startDate);
    }
    if (endDate) {
      list = list.filter((r) => new Date(r.payment_date) <= endDate);
    }
    return list;
  }, [rows, startDate, endDate]);

  const totalPaid = useMemo(
    () => dateFilteredRows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [dateFilteredRows]
  );
  
  const paidCount = useMemo(
    () => dateFilteredRows.filter((r) => {
      const s = r.status.toLowerCase();
      return !["cleared", "reconciled"].includes(s);
    }).length,
    [dateFilteredRows]
  );
  
  const reconciledCount = useMemo(
    () => dateFilteredRows.filter((r) => {
      const s = r.status.toLowerCase();
      return ["cleared", "reconciled"].includes(s);
    }).length,
    [dateFilteredRows]
  );

  const totalNotReconciled = useMemo(
    () => dateFilteredRows
      .filter((r) => {
        const s = r.status.toLowerCase();
        return !["cleared", "reconciled"].includes(s);
      })
      .reduce((s, r) => s + Number(r.amount || 0), 0),
    [dateFilteredRows]
  );
  
  const notReconciledCount = useMemo(
    () => dateFilteredRows.filter((r) => {
      const s = r.status.toLowerCase();
      return !["cleared", "reconciled"].includes(s);
    }).length,
    [dateFilteredRows]
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
            <div className="flex gap-2 mt-2">
              <Badge variant="success">{paidCount} Paid</Badge>
              <Badge variant="success">{reconciledCount} Reconciled</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Reconciled</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalNotReconciled.toLocaleString()}</div>
            <Badge variant="warning" className="mt-2">
              {notReconciledCount} pending reconciliation
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid (Not Reconciled)</SelectItem>
                <SelectItem value="reconciled">Paid & Reconciled</SelectItem>
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
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setFilterStatus("all");
                setFilterMethod("all");
                setStartDate(undefined);
                setEndDate(undefined);
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
                    className="cursor-pointer group hover:bg-primary/5 transition-colors"
                    onClick={() => navigate(`/payables/payments/${p.id}`)}
                  >
                    <TableCell className="font-medium border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg">{p.payment_number}</TableCell>
                    <TableCell className="border-y border-transparent group-hover:border-primary">
                      <Button 
                        variant="link" 
                        className="h-auto p-0 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (p.invoiceId) navigate(`/bills/${p.invoiceId}`);
                        }}
                      >
                        {p.invoiceNumber || (p.invoiceId ? p.invoiceId.slice(0, 8) : "—")}
                      </Button>
                    </TableCell>
                    <TableCell className="border-y border-transparent group-hover:border-primary">{p.vendor}</TableCell>
                    <TableCell className="font-semibold border-y border-transparent group-hover:border-primary">${Number(p.amount).toLocaleString()}</TableCell>
                    <TableCell className="border-y border-transparent group-hover:border-primary">{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell className="border-y border-transparent group-hover:border-primary">
                      <div className="flex items-center gap-2">
                        <span>{getMethodIcon(p.payment_method)}</span>
                        {p.payment_method.toUpperCase()}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm border-y border-transparent group-hover:border-primary">{p.reference || "—"}</TableCell>
                    <TableCell className="border-y border-transparent group-hover:border-primary last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                      <Badge variant={getStatusVariant(getDisplayStatus(p.status))}>{getDisplayStatus(p.status)}</Badge>
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
