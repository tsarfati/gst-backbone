import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileSpreadsheet, Mail } from "lucide-react";
import ReportEmailModal from "@/components/ReportEmailModal";
import { formatNumber } from "@/utils/formatNumber";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportAoAToXlsx } from "@/utils/exceljsExport";
import { format } from "date-fns";

interface SubcontractSummary {
  id: string;
  name: string;
  vendor_name: string;
  job_name: string;
  contract_amount: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  invoiced_amount: number;
  paid_amount: number;
  retainage_held: number;
}

export default function SubcontractSummaryReport() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [subcontracts, setSubcontracts] = useState<SubcontractSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      loadSubcontracts();
    }
  }, [currentCompany?.id]);

  const loadSubcontracts = async () => {
    try {
      setLoading(true);

      // Load subcontracts with vendor and job info
      const { data: subs, error } = await supabase
        .from("subcontracts")
        .select(`
          id, name, contract_amount, status, start_date, end_date,
          retainage_percentage, apply_retainage,
          vendors(id, name),
          jobs!inner(id, name, company_id)
        `)
        .eq("jobs.company_id", currentCompany!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get all subcontract IDs for batch queries
      const subIds = (subs || []).map((s) => s.id);

      // Get all invoices for these subcontracts
      const { data: allInvoices } = await supabase
        .from("invoices")
        .select("id, subcontract_id, amount, retainage_amount, status")
        .in("subcontract_id", subIds.length > 0 ? subIds : ["no-match"]);

      // Get all invoice IDs that belong to subcontracts
      const invoiceIds = (allInvoices || []).map((inv) => inv.id);

      // Get payment_invoice_lines for these invoices to calculate paid amounts
      const { data: paymentLines } = await supabase
        .from("payment_invoice_lines")
        .select("invoice_id, amount_paid")
        .in("invoice_id", invoiceIds.length > 0 ? invoiceIds : ["no-match"]);

      // Build maps for quick lookup
      const invoicesBySubcontract = new Map<string, typeof allInvoices>();
      (allInvoices || []).forEach((inv) => {
        const existing = invoicesBySubcontract.get(inv.subcontract_id!) || [];
        existing.push(inv);
        invoicesBySubcontract.set(inv.subcontract_id!, existing);
      });

      const paidByInvoice = new Map<string, number>();
      (paymentLines || []).forEach((pl) => {
        paidByInvoice.set(pl.invoice_id, (paidByInvoice.get(pl.invoice_id) || 0) + Number(pl.amount_paid || 0));
      });

      // Build summaries
      const summaries: SubcontractSummary[] = (subs || []).map((sub) => {
        const invoices = invoicesBySubcontract.get(sub.id) || [];
        const invoicedAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
        const retainageHeld = invoices.reduce((sum, inv) => sum + Number(inv.retainage_amount || 0), 0);

        // Sum paid amounts from payment_invoice_lines for this subcontract's invoices
        let paidAmount = 0;
        invoices.forEach((inv) => {
          paidAmount += paidByInvoice.get(inv.id) || 0;
        });

        return {
          id: sub.id,
          name: sub.name,
          vendor_name: (sub as any).vendors?.name || "-",
          job_name: (sub as any).jobs?.name || "-",
          contract_amount: sub.contract_amount || 0,
          status: sub.status || "draft",
          start_date: sub.start_date,
          end_date: sub.end_date,
          invoiced_amount: invoicedAmount,
          paid_amount: paidAmount,
          retainage_held: retainageHeld,
        };
      });

      setSubcontracts(summaries);
    } catch (error) {
      console.error("Error loading subcontracts:", error);
      toast({
        title: "Error",
        description: "Failed to load subcontracts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = subcontracts.reduce(
    (acc, sub) => ({
      contract: acc.contract + sub.contract_amount,
      invoiced: acc.invoiced + sub.invoiced_amount,
      paid: acc.paid + sub.paid_amount,
      retainage: acc.retainage + sub.retainage_held,
    }),
    { contract: 0, invoiced: 0, paid: 0, retainage: 0 }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "completed": return "bg-blue-100 text-blue-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const buildPdfDoc = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    doc.setFontSize(18);
    doc.text("Subcontract Summary Report", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, 14, 28);
    doc.text(`Company: ${currentCompany?.name || ""}`, 14, 34);
    
    const tableData = subcontracts.map(sub => [
      sub.name,
      sub.vendor_name,
      sub.job_name,
      sub.status,
      `$${formatNumber(sub.contract_amount)}`,
      `$${formatNumber(sub.invoiced_amount)}`,
      `$${formatNumber(sub.paid_amount)}`,
      `$${formatNumber(sub.retainage_held)}`,
      `$${formatNumber(sub.contract_amount - sub.invoiced_amount)}`,
    ]);
    
    autoTable(doc, {
      startY: 40,
      head: [["Subcontract", "Vendor", "Project", "Status", "Contract Amt", "Invoiced", "Paid", "Retainage", "Remaining"]],
      body: tableData,
      foot: [["", "", "", "Totals:", 
        `$${formatNumber(totals.contract)}`,
        `$${formatNumber(totals.invoiced)}`,
        `$${formatNumber(totals.paid)}`,
        `$${formatNumber(totals.retainage)}`,
        `$${formatNumber(totals.contract - totals.invoiced)}`
      ]],
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    });
    
    return doc;
  };

  const exportToPDF = () => {
    const doc = buildPdfDoc();
    doc.save(`subcontract-summary-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  const exportToExcel = async () => {
    const worksheetData = [
      ["Subcontract Summary Report"],
      [`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`],
      [`Company: ${currentCompany?.name || ""}`],
      [],
      [
        "Subcontract",
        "Vendor",
        "Project",
        "Status",
        "Start Date",
        "End Date",
        "Contract Amount",
        "Invoiced",
        "Paid",
        "Retainage Held",
        "Remaining",
      ],
      ...subcontracts.map((sub) => [
        sub.name,
        sub.vendor_name,
        sub.job_name,
        sub.status,
        sub.start_date ? format(new Date(sub.start_date), "MM/dd/yyyy") : "-",
        sub.end_date ? format(new Date(sub.end_date), "MM/dd/yyyy") : "-",
        sub.contract_amount,
        sub.invoiced_amount,
        sub.paid_amount,
        sub.retainage_held,
        sub.contract_amount - sub.invoiced_amount,
      ]),
      [],
      [
        "",
        "",
        "",
        "Totals:",
        "",
        "",
        totals.contract,
        totals.invoiced,
        totals.paid,
        totals.retainage,
        totals.contract - totals.invoiced,
      ],
    ];

    try {
      await exportAoAToXlsx({
        data: worksheetData,
        sheetName: "Subcontracts",
        fileName: `subcontract-summary-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
      });
      toast({ title: "Success", description: "Excel file exported successfully" });
    } catch (e) {
      console.error("Excel export failed:", e);
      toast({ title: "Error", description: "Failed to export Excel file", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Subcontract Summary Report</h1>
            <p className="text-muted-foreground text-sm">Overview of all subcontract agreements</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToPDF} disabled={loading || subcontracts.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={loading || subcontracts.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(true)} disabled={loading || subcontracts.length === 0}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(totals.contract)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(totals.invoiced)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${formatNumber(totals.paid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retainage Held</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">${formatNumber(totals.retainage)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subcontracts ({subcontracts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : subcontracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No subcontracts found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subcontract</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Contract</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Retainage</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subcontracts.map((sub) => (
                    <TableRow 
                      key={sub.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/subcontracts/${sub.id}`)}
                    >
                      <TableCell className="font-medium">{sub.name}</TableCell>
                      <TableCell>{sub.vendor_name}</TableCell>
                      <TableCell>{sub.job_name}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(sub.status)}>{sub.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">${formatNumber(sub.contract_amount)}</TableCell>
                      <TableCell className="text-right">${formatNumber(sub.invoiced_amount)}</TableCell>
                      <TableCell className="text-right text-green-600">${formatNumber(sub.paid_amount)}</TableCell>
                      <TableCell className="text-right text-amber-600">${formatNumber(sub.retainage_held)}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${formatNumber(sub.contract_amount - sub.invoiced_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ReportEmailModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        generatePdf={buildPdfDoc}
        reportName="Subcontract Summary Report"
        fileName={`subcontract-summary-${format(new Date(), "yyyy-MM-dd")}.pdf`}
      />
    </div>
  );
}
