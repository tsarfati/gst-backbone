import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, DollarSign } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";

interface ARPayment {
  id: string;
  payment_number: string | null;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  status: string;
  customer: {
    name: string;
  } | null;
  ar_invoice: {
    invoice_number: string;
  } | null;
}

export default function ARPayments() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [payments, setPayments] = useState<ARPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (currentCompany?.id) {
      loadPayments();
    }
  }, [currentCompany?.id]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("ar_payments")
        .select(`
          id, payment_number, payment_date, amount, payment_method, reference_number, status,
          customers(name),
          ar_invoices(invoice_number)
        `)
        .eq("company_id", currentCompany!.id)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      
      setPayments((data || []).map((pmt: any) => ({
        ...pmt,
        customer: pmt.customers,
        ar_invoice: pmt.ar_invoices
      })));
    } catch (error: any) {
      console.error("Error loading payments:", error);
      toast({
        title: "Error",
        description: "Failed to load payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(
    (p) =>
      p.payment_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      p.reference_number?.toLowerCase().includes(search.toLowerCase())
  );

  const totalReceived = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "check": return "🏦";
      case "ach": return "🔄";
      case "wire": return "📡";
      case "credit_card": return "💳";
      case "cash": return "💵";
      default: return "💰";
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payments Received</h1>
        </div>
        <Button onClick={() => navigate("/receivables/payments/add")}>
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${formatNumber(totalReceived)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatNumber(
                payments
                  .filter(p => new Date(p.payment_date).getMonth() === new Date().getMonth())
                  .reduce((sum, p) => sum + p.amount, 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Payment History</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No payments match your search" : "No payments recorded yet"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/receivables/payments/${payment.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{payment.payment_number || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{payment.customer?.name || "-"}</TableCell>
                    <TableCell>{payment.ar_invoice?.invoice_number || "-"}</TableCell>
                    <TableCell>{format(new Date(payment.payment_date), "MM/dd/yyyy")}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        {getMethodIcon(payment.payment_method)}
                        <span className="capitalize">{payment.payment_method.replace("_", " ")}</span>
                      </span>
                    </TableCell>
                    <TableCell>{payment.reference_number || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={payment.status === "received" ? "default" : "secondary"}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      ${formatNumber(payment.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
