import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Edit, FileText, Building, Calendar, DollarSign } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Invoice {
  id: string;
  invoice_number: string;
  application_number: number | null;
  issue_date: string;
  due_date: string | null;
  period_from: string | null;
  period_to: string | null;
  contract_date: string | null;
  contract_amount: number | null;
  change_orders_amount: number | null;
  total_amount: number;
  current_payment_due: number | null;
  less_previous_certificates: number | null;
  total_retainage: number | null;
  retainage_percent: number | null;
  status: string;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  } | null;
  job: {
    id: string;
    name: string;
    address: string | null;
  } | null;
}

interface LineItem {
  id: string;
  sov_id: string;
  scheduled_value: number;
  previous_applications: number;
  this_period: number;
  materials_stored: number;
  total_completed: number;
  percent_complete: number;
  balance_to_finish: number;
  retainage: number;
  sov: {
    item_number: string;
    description: string;
  } | null;
}

export default function ARInvoiceDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && currentCompany?.id) {
      loadInvoice();
    }
  }, [id, currentCompany?.id]);

  const loadInvoice = async () => {
    try {
      setLoading(true);

      const { data: invoiceData, error: invoiceError } = await supabase
        .from("ar_invoices")
        .select(`
          *,
          customer:customers(id, name, address, city, state, zip_code),
          job:jobs(id, name, address)
        `)
        .eq("id", id)
        .eq("company_id", currentCompany!.id)
        .single();

      if (invoiceError) throw invoiceError;
      setInvoice(invoiceData);

      // Load line items
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from("ar_invoice_line_items")
        .select(`
          *,
          sov:schedule_of_values(item_number, description)
        `)
        .eq("ar_invoice_id", id)
        .order("created_at");

      if (lineItemsError) throw lineItemsError;
      setLineItems(lineItemsData || []);
    } catch (error) {
      console.error("Error loading invoice:", error);
      toast({
        title: "Error",
        description: "Failed to load invoice details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      partial: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
      overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };
    return (
      <Badge className={variants[status] || variants.draft}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const exportToPDF = () => {
    if (!invoice) return;

    const doc = new jsPDF({ orientation: "landscape" });
    
    // Header
    doc.setFontSize(16);
    doc.text("APPLICATION AND CERTIFICATE FOR PAYMENT", 148, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(`AIA DOCUMENT G702`, 148, 22, { align: "center" });

    // Left side info
    doc.setFontSize(9);
    let y = 35;
    doc.text(`TO OWNER: ${invoice.customer?.name || ""}`, 14, y);
    if (invoice.customer?.address) {
      y += 5;
      doc.text(invoice.customer.address, 14, y);
    }
    if (invoice.customer?.city || invoice.customer?.state || invoice.customer?.zip_code) {
      y += 5;
      doc.text(`${invoice.customer?.city || ""}, ${invoice.customer?.state || ""} ${invoice.customer?.zip_code || ""}`, 14, y);
    }

    // Right side info
    doc.text(`APPLICATION NO: ${invoice.application_number || 1}`, 200, 35);
    doc.text(`PERIOD FROM: ${invoice.period_from ? format(new Date(invoice.period_from), "MM/dd/yyyy") : ""}`, 200, 40);
    doc.text(`PERIOD TO: ${invoice.period_to ? format(new Date(invoice.period_to), "MM/dd/yyyy") : ""}`, 200, 45);
    doc.text(`PROJECT: ${invoice.job?.name || ""}`, 200, 55);

    // Contract summary
    const summaryY = 75;
    doc.text(`1. ORIGINAL CONTRACT SUM: $${formatNumber(invoice.contract_amount || 0)}`, 14, summaryY);
    doc.text(`2. CHANGE ORDERS: $${formatNumber(invoice.change_orders_amount || 0)}`, 14, summaryY + 6);
    doc.text(`3. CONTRACT SUM TO DATE: $${formatNumber((invoice.contract_amount || 0) + (invoice.change_orders_amount || 0))}`, 14, summaryY + 12);
    doc.text(`4. TOTAL COMPLETED: $${formatNumber(invoice.total_amount)}`, 14, summaryY + 18);
    doc.text(`5. RETAINAGE: $${formatNumber(invoice.total_retainage || 0)}`, 14, summaryY + 24);
    doc.text(`6. LESS PREVIOUS CERTIFICATES: $${formatNumber(invoice.less_previous_certificates || 0)}`, 14, summaryY + 30);
    doc.text(`7. CURRENT PAYMENT DUE: $${formatNumber(invoice.current_payment_due || 0)}`, 14, summaryY + 36);

    // Line items table (G703)
    if (lineItems.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text("CONTINUATION SHEET - AIA DOCUMENT G703", 148, 15, { align: "center" });

      const tableData = lineItems.map((item) => [
        item.sov?.item_number || "",
        item.sov?.description || "",
        `$${formatNumber(item.scheduled_value)}`,
        `$${formatNumber(item.previous_applications)}`,
        `$${formatNumber(item.this_period)}`,
        `$${formatNumber(item.materials_stored)}`,
        `$${formatNumber(item.total_completed)}`,
        `${item.percent_complete.toFixed(1)}%`,
        `$${formatNumber(item.balance_to_finish)}`,
        `$${formatNumber(item.retainage)}`,
      ]);

      autoTable(doc, {
        startY: 25,
        head: [["Item", "Description", "Scheduled Value", "Previous", "This Period", "Materials", "Total Complete", "%", "Balance", "Retainage"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [71, 85, 105], fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 50 },
        },
      });
    }

    doc.save(`invoice-${invoice.invoice_number}.pdf`);
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/receivables/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">Loading invoice...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/receivables/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Invoice Not Found</h1>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              The invoice you're looking for doesn't exist or you don't have access to it.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/receivables/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Invoice #{invoice.invoice_number}</h1>
              {getStatusBadge(invoice.status)}
            </div>
            <p className="text-muted-foreground text-sm">
              Application #{invoice.application_number || 1}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          {invoice.status === "draft" && (
            <Button onClick={() => navigate(`/receivables/invoices/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Current Payment Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatNumber(invoice.current_payment_due || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatNumber(invoice.total_amount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" />
              Retainage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatNumber(invoice.total_retainage || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {invoice.retainage_percent || 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {invoice.period_from && format(new Date(invoice.period_from), "MMM d, yyyy")}
              {invoice.period_from && invoice.period_to && " - "}
              {invoice.period_to && format(new Date(invoice.period_to), "MMM d, yyyy")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-muted-foreground text-sm">Name:</span>
              <p className="font-medium">{invoice.customer?.name || "-"}</p>
            </div>
            {invoice.customer?.address && (
              <div>
                <span className="text-muted-foreground text-sm">Address:</span>
                <p className="font-medium">
                  {invoice.customer.address}
                  {invoice.customer.city && `, ${invoice.customer.city}`}
                  {invoice.customer.state && `, ${invoice.customer.state}`}
                  {invoice.customer.zip_code && ` ${invoice.customer.zip_code}`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-muted-foreground text-sm">Project:</span>
              <p className="font-medium">{invoice.job?.name || "-"}</p>
            </div>
            {invoice.job?.address && (
              <div>
                <span className="text-muted-foreground text-sm">Address:</span>
                <p className="font-medium">{invoice.job.address}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground text-sm">Contract Amount:</span>
              <p className="font-medium">${formatNumber(invoice.contract_amount || 0)}</p>
            </div>
            {(invoice.change_orders_amount || 0) > 0 && (
              <div>
                <span className="text-muted-foreground text-sm">Change Orders:</span>
                <p className="font-medium">${formatNumber(invoice.change_orders_amount || 0)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      {lineItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule of Values (G703)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Scheduled Value</TableHead>
                    <TableHead className="text-right">Previous</TableHead>
                    <TableHead className="text-right">This Period</TableHead>
                    <TableHead className="text-right">Materials</TableHead>
                    <TableHead className="text-right">Total Complete</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Retainage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.sov?.item_number || "-"}</TableCell>
                      <TableCell>{item.sov?.description || "-"}</TableCell>
                      <TableCell className="text-right">${formatNumber(item.scheduled_value)}</TableCell>
                      <TableCell className="text-right">${formatNumber(item.previous_applications)}</TableCell>
                      <TableCell className="text-right">${formatNumber(item.this_period)}</TableCell>
                      <TableCell className="text-right">${formatNumber(item.materials_stored)}</TableCell>
                      <TableCell className="text-right">${formatNumber(item.total_completed)}</TableCell>
                      <TableCell className="text-right">{item.percent_complete.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">${formatNumber(item.balance_to_finish)}</TableCell>
                      <TableCell className="text-right">${formatNumber(item.retainage)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
