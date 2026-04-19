import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ReportEmailModal from "@/components/ReportEmailModal";
import { ArrowLeft, ChevronDown, Download, FileSpreadsheet, Mail } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createAoAXlsxBlob, exportAoAToXlsx } from "@/utils/exceljsExport";
import { formatNumber } from "@/utils/formatNumber";
import { getEffectivePaidByInvoice } from "@/utils/paymentAllocations";
import { addCompanyLogoToPdf } from "@/utils/reportPdfBranding";
import { format } from "date-fns";

interface JobOption {
  id: string;
  name: string;
}

interface AgingInvoiceRow {
  id: string;
  job_id: string | null;
  job_name: string;
  vendor_name: string;
  invoice_number: string;
  issue_date: string | null;
  due_date: string | null;
  status: string;
  original_amount: number;
  amount_paid: number;
  outstanding_amount: number;
  aging_bucket: "Current" | "1-30" | "31-60" | "61-90" | "91+";
  days_past_due: number;
}

interface JobAgingSummaryRow {
  job_id: string;
  job_name: string;
  current: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_91_plus: number;
  total: number;
  invoice_count: number;
}

const AP_AGING_CANDIDATE_STATUSES = ["pending", "pending_approval", "pending_coding", "approved", "pending_payment", "overdue", "paid"];

const getDaysPastDue = (dueDate?: string | null) => {
  if (!dueDate) return 0;
  const today = new Date();
  const due = new Date(dueDate);
  const diffMs = today.getTime() - due.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

const getAgingBucket = (daysPastDue: number): AgingInvoiceRow["aging_bucket"] => {
  if (daysPastDue <= 0) return "Current";
  if (daysPastDue <= 30) return "1-30";
  if (daysPastDue <= 60) return "31-60";
  if (daysPastDue <= 90) return "61-90";
  return "91+";
};

const formatCurrency = (value: number) => `$${formatNumber(value || 0)}`;

export default function APAgingByJobReport() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();

  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [invoiceRows, setInvoiceRows] = useState<AgingInvoiceRow[]>([]);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailAttachmentType, setEmailAttachmentType] = useState<"pdf" | "excel">("pdf");

  useEffect(() => {
    if (currentCompany?.id && !websiteJobAccessLoading) {
      loadJobs();
    }
  }, [currentCompany?.id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  useEffect(() => {
    if (currentCompany?.id && !websiteJobAccessLoading) {
      loadReport();
    }
  }, [currentCompany?.id, selectedJob, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  useEffect(() => {
    if (selectedJob !== "all" && !isPrivileged && !allowedJobIds.includes(selectedJob)) {
      setSelectedJob("all");
    }
  }, [selectedJob, isPrivileged, allowedJobIds.join(",")]);

  const loadJobs = async () => {
    if (!currentCompany?.id) return;
    if (!isPrivileged && allowedJobIds.length === 0) {
      setJobs([]);
      return;
    }

    let query = supabase
      .from("jobs")
      .select("id, name")
      .eq("company_id", currentCompany.id)
      .order("name");

    if (!isPrivileged) {
      query = query.in("id", allowedJobIds);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error loading jobs for AP aging report", error);
      return;
    }

    setJobs(data || []);
  };

  const loadReport = async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);

      const { data: vendorRows, error: vendorError } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("company_id", currentCompany.id);

      if (vendorError) throw vendorError;

      const vendorIds = (vendorRows || []).map((vendor: any) => vendor.id).filter(Boolean);
      const vendorNameById = new Map<string, string>(
        (vendorRows || []).map((vendor: any) => [vendor.id, vendor.name || "Unknown Vendor"])
      );

      if (!vendorIds.length) {
        setInvoiceRows([]);
        return;
      }

      const invoiceQuery = supabase
        .from("invoices")
        .select("id, vendor_id, job_id, invoice_number, issue_date, due_date, amount, status, jobs(id, name)")
        .in("vendor_id", vendorIds)
        // Include paid rows here because some partially paid bills were previously
        // marked as paid. We filter true zero-balance bills after payment lines load.
        .in("status", AP_AGING_CANDIDATE_STATUSES);

      const { data: invoiceData, error: invoiceError } = await invoiceQuery.order("due_date", { ascending: true });
      if (invoiceError) throw invoiceError;

      if (!invoiceData?.length) {
        setInvoiceRows([]);
        return;
      }

      const invoiceIds = invoiceData.map((invoice: any) => invoice.id);

      const [
        { data: paymentLineRows, error: paymentLineError },
        { data: distributionRows, error: distributionError },
      ] = await Promise.all([
        supabase
          .from("payment_invoice_lines")
          .select("invoice_id, payment_id, amount_paid, payments(amount)")
          .in("invoice_id", invoiceIds),
        supabase
          .from("invoice_cost_distributions")
          .select(`
            invoice_id,
            amount,
            cost_codes (
              job_id,
              jobs (id, name)
            )
          `)
          .in("invoice_id", invoiceIds),
      ]);

      if (paymentLineError) throw paymentLineError;
      if (distributionError) throw distributionError;

      const amountPaidByInvoiceId = getEffectivePaidByInvoice((paymentLineRows || []) as any[]);

      const distributionsByInvoiceId = new Map<string, Array<{ job_id: string | null; job_name: string; amount: number }>>();
      (distributionRows || []).forEach((distribution: any) => {
        const invoiceId = distribution.invoice_id;
        if (!invoiceId) return;
        const job = distribution.cost_codes?.jobs;
        const rows = distributionsByInvoiceId.get(invoiceId) || [];
        rows.push({
          job_id: job?.id || distribution.cost_codes?.job_id || null,
          job_name: job?.name || "No Job",
          amount: Number(distribution.amount || 0),
        });
        distributionsByInvoiceId.set(invoiceId, rows);
      });

      const rows: AgingInvoiceRow[] = (invoiceData || [])
        .flatMap((invoice: any) => {
          const originalAmount = Number(invoice.amount || 0);
          const amountPaid = amountPaidByInvoiceId.get(invoice.id) || 0;
          const outstandingAmount = Math.max(0, originalAmount - amountPaid);
          const daysPastDue = getDaysPastDue(invoice.due_date || invoice.issue_date);
          const agingBucket = getAgingBucket(daysPastDue);
          const groupedJobAmounts = new Map<string, { job_name: string; amount: number }>();

          (distributionsByInvoiceId.get(invoice.id) || [])
            .filter((distribution) => distribution.job_id)
            .forEach((distribution) => {
              const jobId = distribution.job_id!;
              const existing = groupedJobAmounts.get(jobId) || { job_name: distribution.job_name, amount: 0 };
              existing.amount += distribution.amount;
              groupedJobAmounts.set(jobId, existing);
            });

          const allocations = groupedJobAmounts.size > 0
            ? Array.from(groupedJobAmounts.entries()).map(([jobId, value]) => ({
                job_id: jobId,
                job_name: value.job_name,
                amount: value.amount,
              }))
            : [{
                job_id: invoice.job_id || null,
                job_name: invoice.jobs?.name || (invoice.job_id ? "Unknown Job" : "No Job"),
                amount: originalAmount,
              }];
          const allocationTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0) || originalAmount || 1;

          return allocations.map((allocation) => {
            const allocationRatio = Number(allocation.amount || 0) / allocationTotal;
            return {
              id: `${invoice.id}-${allocation.job_id || "no-job"}`,
              job_id: allocation.job_id || null,
              job_name: allocation.job_name,
              vendor_name: vendorNameById.get(invoice.vendor_id) || "Unknown Vendor",
              invoice_number: invoice.invoice_number || "(No invoice #)",
              issue_date: invoice.issue_date || null,
              due_date: invoice.due_date || null,
              status: invoice.status || "unknown",
              original_amount: originalAmount * allocationRatio,
              amount_paid: amountPaid * allocationRatio,
              outstanding_amount: outstandingAmount * allocationRatio,
              aging_bucket: agingBucket,
              days_past_due: daysPastDue,
            };
          });
        })
        .filter((row) => row.outstanding_amount > 0.009)
        .filter((row) => {
          if (selectedJob !== "all") return row.job_id === selectedJob;
          if (isPrivileged) return true;
          return !!row.job_id && allowedJobIds.includes(row.job_id);
        })
        .sort((a, b) => {
          if (a.job_name !== b.job_name) return a.job_name.localeCompare(b.job_name);
          return (a.due_date || "").localeCompare(b.due_date || "");
        });

      setInvoiceRows(rows);
    } catch (error) {
      console.error("Error loading AP aging by job report", error);
      toast({
        title: "Error",
        description: "Failed to load AP aging report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const summaryRows = useMemo<JobAgingSummaryRow[]>(() => {
    const grouped = new Map<string, JobAgingSummaryRow>();

    invoiceRows.forEach((row) => {
      const key = row.job_id || "no-job";
      if (!grouped.has(key)) {
        grouped.set(key, {
          job_id: key,
          job_name: row.job_name,
          current: 0,
          bucket_1_30: 0,
          bucket_31_60: 0,
          bucket_61_90: 0,
          bucket_91_plus: 0,
          total: 0,
          invoice_count: 0,
        });
      }

      const bucket = grouped.get(key)!;
      bucket.invoice_count += 1;
      bucket.total += row.outstanding_amount;
      if (row.aging_bucket === "Current") bucket.current += row.outstanding_amount;
      if (row.aging_bucket === "1-30") bucket.bucket_1_30 += row.outstanding_amount;
      if (row.aging_bucket === "31-60") bucket.bucket_31_60 += row.outstanding_amount;
      if (row.aging_bucket === "61-90") bucket.bucket_61_90 += row.outstanding_amount;
      if (row.aging_bucket === "91+") bucket.bucket_91_plus += row.outstanding_amount;
    });

    return Array.from(grouped.values()).sort((a, b) => a.job_name.localeCompare(b.job_name));
  }, [invoiceRows]);

  const totals = useMemo(() => {
    return summaryRows.reduce(
      (acc, row) => {
        acc.current += row.current;
        acc.bucket_1_30 += row.bucket_1_30;
        acc.bucket_31_60 += row.bucket_31_60;
        acc.bucket_61_90 += row.bucket_61_90;
        acc.bucket_91_plus += row.bucket_91_plus;
        acc.total += row.total;
        acc.invoice_count += row.invoice_count;
        return acc;
      },
      {
        current: 0,
        bucket_1_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_91_plus: 0,
        total: 0,
        invoice_count: 0,
      }
    );
  }, [summaryRows]);

  const reportFileDate = format(new Date(), "yyyy-MM-dd");
  const reportJobLabel = selectedJob !== "all"
    ? jobs.find((job) => job.id === selectedJob)?.name || ""
    : "All Accessible Jobs";

  const buildWorksheetData = () => [
      ["AP Aging By Job Report"],
      [`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`],
      [`Company: ${currentCompany?.name || ""}`],
      [`Job: ${reportJobLabel}`],
      [],
      ["Job Summary"],
      ["Job", "Invoices", "Current", "1-30", "31-60", "61-90", "91+", "Total Outstanding"],
      ...summaryRows.map((row) => [
        row.job_name,
        row.invoice_count,
        row.current,
        row.bucket_1_30,
        row.bucket_31_60,
        row.bucket_61_90,
        row.bucket_91_plus,
        row.total,
      ]),
      [],
      ["Invoice Detail"],
      ["Job", "Vendor", "Invoice #", "Issue Date", "Due Date", "Status", "Days Past Due", "Original Amount", "Paid", "Outstanding", "Bucket"],
      ...invoiceRows.map((row) => [
        row.job_name,
        row.vendor_name,
        row.invoice_number,
        row.issue_date || "",
        row.due_date || "",
        row.status,
        row.days_past_due,
        row.original_amount,
        row.amount_paid,
        row.outstanding_amount,
        row.aging_bucket,
      ]),
    ];

  const buildPdfDoc = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 36;
    await addCompanyLogoToPdf(doc, currentCompany?.logo_url, { x: 36, y: 24, maxWidth: 120, maxHeight: 40 });

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("AP Aging By Job Report", 170, y);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, 170, y + 18);
    doc.text(`Company: ${currentCompany?.name || ""}`, 170, y + 32);
    doc.text(`Job: ${reportJobLabel}`, 170, y + 46);

    doc.setFont("helvetica", "bold");
    doc.text(`Total Outstanding: ${formatCurrency(totals.total)}`, pageWidth - 220, y + 18);
    doc.text(`Open Invoices: ${totals.invoice_count}`, pageWidth - 220, y + 32);

    y = 104;

    autoTable(doc, {
      startY: y,
      head: [["Job", "Invoices", "Current", "1-30", "31-60", "61-90", "91+", "Total"]],
      body: summaryRows.map((row) => [
        row.job_name,
        row.invoice_count,
        formatCurrency(row.current),
        formatCurrency(row.bucket_1_30),
        formatCurrency(row.bucket_31_60),
        formatCurrency(row.bucket_61_90),
        formatCurrency(row.bucket_91_plus),
        formatCurrency(row.total),
      ]),
      foot: [[
        "Totals",
        totals.invoice_count,
        formatCurrency(totals.current),
        formatCurrency(totals.bucket_1_30),
        formatCurrency(totals.bucket_31_60),
        formatCurrency(totals.bucket_61_90),
        formatCurrency(totals.bucket_91_plus),
        formatCurrency(totals.total),
      ]],
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 170 },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
      },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 28,
      head: [["Job", "Vendor", "Invoice #", "Due Date", "Status", "Days", "Original", "Paid", "Outstanding", "Bucket"]],
      body: invoiceRows.map((row) => [
        row.job_name,
        row.vendor_name,
        row.invoice_number,
        row.due_date ? format(new Date(row.due_date), "MM/dd/yyyy") : "-",
        row.status.replace(/_/g, " "),
        row.days_past_due,
        formatCurrency(row.original_amount),
        formatCurrency(row.amount_paid),
        formatCurrency(row.outstanding_amount),
        row.aging_bucket,
      ]),
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105], fontSize: 7 },
      bodyStyles: { fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 120 },
        2: { cellWidth: 70 },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
      },
    });

    return doc;
  };

  const exportToPDF = async () => {
    const doc = await buildPdfDoc();
    doc.save(`ap-aging-by-job-${reportFileDate}.pdf`);
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  const exportToExcel = async () => {
    await exportAoAToXlsx({
      fileName: `ap-aging-by-job-${reportFileDate}.xlsx`,
      sheetName: "AP Aging By Job",
      data: buildWorksheetData(),
    });

    toast({ title: "Success", description: "Excel exported successfully" });
  };

  const generateExcelAttachment = async () => ({
    blob: await createAoAXlsxBlob({
      sheetName: "AP Aging By Job",
      data: buildWorksheetData(),
    }),
    filename: `ap-aging-by-job-${reportFileDate}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const openEmailModal = (attachmentType: "pdf" | "excel") => {
    setEmailAttachmentType(attachmentType);
    setEmailModalOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/construction/reports")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">AP Aging By Job</h1>
            <p className="text-muted-foreground">Open accounts payable invoices grouped and aged by project.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue placeholder="Filter by job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accessible Jobs</SelectItem>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={exportToPDF} disabled={loading || invoiceRows.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>

          <Button variant="outline" onClick={exportToExcel} disabled={loading || invoiceRows.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Excel
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={loading || invoiceRows.length === 0}>
                <Mail className="mr-2 h-4 w-4" />
                Share
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEmailModal("pdf")}>
                <Download className="mr-2 h-4 w-4" />
                Email PDF attachment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEmailModal("excel")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Email Excel attachment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            <p className="text-xs text-muted-foreground">{totals.invoice_count} open invoice(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.current)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">1-30 + 31-60</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.bucket_1_30 + totals.bucket_31_60)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">61+ Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.bucket_61_90 + totals.bucket_91_plus)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">1-30</TableHead>
                <TableHead className="text-right">31-60</TableHead>
                <TableHead className="text-right">61-90</TableHead>
                <TableHead className="text-right">91+</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {loading ? "Loading report..." : "No open AP invoices found for the selected scope."}
                  </TableCell>
                </TableRow>
              ) : (
                summaryRows.map((row) => (
                  <TableRow key={row.job_id}>
                    <TableCell className="font-medium">{row.job_name}</TableCell>
                    <TableCell className="text-right">{row.invoice_count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.current)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.bucket_1_30)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.bucket_31_60)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.bucket_61_90)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.bucket_91_plus)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Days Past Due</TableHead>
                <TableHead className="text-right">Original</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Bucket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    {loading ? "Loading report..." : "No invoice detail to show."}
                  </TableCell>
                </TableRow>
              ) : (
                invoiceRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.job_name}</TableCell>
                    <TableCell>{row.vendor_name}</TableCell>
                    <TableCell>{row.invoice_number}</TableCell>
                    <TableCell>{row.due_date ? format(new Date(row.due_date), "MM/dd/yyyy") : "-"}</TableCell>
                    <TableCell>{row.status.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right">{row.days_past_due}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.original_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.amount_paid)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(row.outstanding_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={row.aging_bucket === "Current" ? "outline" : row.aging_bucket === "91+" ? "destructive" : "secondary"}>
                        {row.aging_bucket}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ReportEmailModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        generatePdf={emailAttachmentType === "pdf" ? buildPdfDoc : undefined}
        generateAttachment={emailAttachmentType === "excel" ? generateExcelAttachment : undefined}
        reportName="AP Aging By Job"
        fileName={`ap-aging-by-job-${reportFileDate}.${emailAttachmentType === "pdf" ? "pdf" : "xlsx"}`}
      />
    </div>
  );
}
