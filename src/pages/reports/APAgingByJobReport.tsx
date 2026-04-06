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
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { exportAoAToXlsx } from "@/utils/exceljsExport";
import { formatNumber } from "@/utils/formatNumber";
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

const OPEN_AP_STATUSES = ["pending", "pending_approval", "pending_coding", "approved", "pending_payment", "overdue"];

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

      let invoiceQuery = supabase
        .from("invoices")
        .select("id, vendor_id, job_id, invoice_number, issue_date, due_date, amount, status")
        .in("vendor_id", vendorIds)
        .in("status", OPEN_AP_STATUSES);

      if (selectedJob !== "all") {
        invoiceQuery = invoiceQuery.eq("job_id", selectedJob);
      } else if (!isPrivileged) {
        if (allowedJobIds.length === 0) {
          setInvoiceRows([]);
          return;
        }
        invoiceQuery = invoiceQuery.in("job_id", allowedJobIds);
      }

      const { data: invoiceData, error: invoiceError } = await invoiceQuery.order("due_date", { ascending: true });
      if (invoiceError) throw invoiceError;

      if (!invoiceData?.length) {
        setInvoiceRows([]);
        return;
      }

      const invoiceIds = invoiceData.map((invoice: any) => invoice.id);
      const jobIds = Array.from(new Set(invoiceData.map((invoice: any) => invoice.job_id).filter(Boolean)));

      const [{ data: paymentLineRows, error: paymentLineError }, { data: jobRows, error: jobError }] = await Promise.all([
        supabase
          .from("payment_invoice_lines")
          .select("invoice_id, amount_paid")
          .in("invoice_id", invoiceIds),
        jobIds.length
          ? supabase.from("jobs").select("id, name").in("id", jobIds as string[])
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (paymentLineError) throw paymentLineError;
      if (jobError) throw jobError;

      const jobNameById = new Map<string, string>((jobRows || []).map((job: any) => [job.id, job.name]));
      const amountPaidByInvoiceId = new Map<string, number>();
      (paymentLineRows || []).forEach((line: any) => {
        amountPaidByInvoiceId.set(
          line.invoice_id,
          (amountPaidByInvoiceId.get(line.invoice_id) || 0) + Number(line.amount_paid || 0)
        );
      });

      const rows: AgingInvoiceRow[] = (invoiceData || [])
        .map((invoice: any) => {
          const originalAmount = Number(invoice.amount || 0);
          const amountPaid = amountPaidByInvoiceId.get(invoice.id) || 0;
          const outstandingAmount = Math.max(0, originalAmount - amountPaid);
          const daysPastDue = getDaysPastDue(invoice.due_date || invoice.issue_date);

          return {
            id: invoice.id,
            job_id: invoice.job_id || null,
            job_name: jobNameById.get(invoice.job_id) || "No Job",
            vendor_name: vendorNameById.get(invoice.vendor_id) || "Unknown Vendor",
            invoice_number: invoice.invoice_number || "(No invoice #)",
            issue_date: invoice.issue_date || null,
            due_date: invoice.due_date || null,
            status: invoice.status || "unknown",
            original_amount: originalAmount,
            amount_paid: amountPaid,
            outstanding_amount: outstandingAmount,
            aging_bucket: getAgingBucket(daysPastDue),
            days_past_due: daysPastDue,
          };
        })
        .filter((row) => row.outstanding_amount > 0.009)
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

  const exportToExcel = async () => {
    const worksheetData = [
      ["AP Aging By Job Report"],
      [`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`],
      [`Company: ${currentCompany?.name || ""}`],
      selectedJob !== "all"
        ? [`Job: ${jobs.find((job) => job.id === selectedJob)?.name || ""}`]
        : ["Job: All Accessible Jobs"],
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

    await exportAoAToXlsx({
      filename: `ap-aging-by-job-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
      sheetName: "AP Aging By Job",
      data: worksheetData,
    });

    toast({ title: "Success", description: "Excel exported successfully" });
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

          <Button variant="outline" onClick={exportToExcel} disabled={loading || invoiceRows.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
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
    </div>
  );
}
