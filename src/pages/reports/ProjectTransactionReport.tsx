import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileSpreadsheet, Filter, Mail } from "lucide-react";
import ReportEmailModal from "@/components/ReportEmailModal";
import { formatNumber } from "@/utils/formatNumber";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportAoAToXlsx } from "@/utils/exceljsExport";
import { format } from "date-fns";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";

interface Transaction {
  id: string;
  date: string;
  type: string;
  reference: string;
  vendor_name: string;
  job_name: string;
  cost_code: string;
  description: string;
  amount: number;
}

interface Job {
  id: string;
  name: string;
}

export default function ProjectTransactionReport() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id && !websiteJobAccessLoading) {
      loadJobs();
    }
  }, [currentCompany?.id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  useEffect(() => {
    if (currentCompany?.id && !websiteJobAccessLoading) {
      loadTransactions();
    }
  }, [currentCompany?.id, selectedJob, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  useEffect(() => {
    if (selectedJob !== "all" && !isPrivileged && !allowedJobIds.includes(selectedJob)) {
      setSelectedJob("all");
    }
  }, [selectedJob, isPrivileged, allowedJobIds.join(",")]);

  const loadJobs = async () => {
    if (!isPrivileged && allowedJobIds.length === 0) {
      setJobs([]);
      return;
    }
    let query = supabase
      .from("jobs")
      .select("id, name")
      .eq("company_id", currentCompany!.id)
      .order("name");
    if (!isPrivileged) {
      query = query.in("id", allowedJobIds);
    }
    const { data } = await query;
    setJobs(data || []);
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const allTransactions: Transaction[] = [];

      // Load bills/invoices
      let billsQuery = supabase
        .from("invoices")
        .select(`
          id, invoice_number, issue_date, amount, description,
          vendors(name),
          jobs!inner(id, name),
          cost_codes(code, description)
        `)
        .eq("jobs.company_id", currentCompany!.id);
      if (!isPrivileged) {
        if (allowedJobIds.length === 0) {
          billsQuery = billsQuery.eq("job_id", "__no_access__");
        } else {
          billsQuery = billsQuery.in("job_id", allowedJobIds);
        }
      }

      if (selectedJob !== "all") {
        billsQuery = billsQuery.eq("job_id", selectedJob);
      }

      const { data: bills } = await billsQuery;

      (bills || []).forEach((bill: any) => {
        allTransactions.push({
          id: bill.id,
          date: bill.issue_date || "",
          type: "Bill",
          reference: bill.invoice_number || "-",
          vendor_name: bill.vendors?.name || "-",
          job_name: bill.jobs?.name || "-",
          cost_code: bill.cost_codes ? `${bill.cost_codes.code} - ${bill.cost_codes.description}` : "-",
          description: bill.description || "",
          amount: bill.amount || 0,
        });
      });

      // Load credit card transactions via distributions
      let ccQuery = supabase
        .from("credit_card_transaction_distributions")
        .select(`
          id, amount,
          jobs!inner(id, name, company_id),
          cost_codes(code, description),
          credit_card_transactions!inner(
            id, transaction_date, description, reference_number,
            vendors(name)
          )
        `)
        .eq("jobs.company_id", currentCompany!.id);
      if (!isPrivileged) {
        if (allowedJobIds.length === 0) {
          ccQuery = ccQuery.eq("job_id", "__no_access__");
        } else {
          ccQuery = ccQuery.in("job_id", allowedJobIds);
        }
      }

      if (selectedJob !== "all") {
        ccQuery = ccQuery.eq("job_id", selectedJob);
      }

      const { data: ccData } = await ccQuery;

      (ccData || []).forEach((dist: any) => {
        const tx = dist.credit_card_transactions;
        allTransactions.push({
          id: tx?.id || dist.id,
          date: tx?.transaction_date || "",
          type: "Credit Card",
          reference: tx?.reference_number || "-",
          vendor_name: tx?.vendors?.name || "-",
          job_name: dist.jobs?.name || "-",
          cost_code: dist.cost_codes ? `${dist.cost_codes.code} - ${dist.cost_codes.description}` : "-",
          description: tx?.description || "",
          amount: dist.amount || 0,
        });
      });

      // Load payments
      let paymentsQuery = supabase
        .from("payments")
        .select(`
          id, payment_number, payment_date, amount, payment_method,
          vendors!inner(name, company_id)
        `)
        .eq("vendors.company_id", currentCompany!.id);

      const { data: payments } = await paymentsQuery;

      (payments || []).forEach((pmt: any) => {
        allTransactions.push({
          id: pmt.id,
          date: pmt.payment_date || "",
          type: "Payment",
          reference: pmt.payment_number || "-",
          vendor_name: pmt.vendors?.name || "-",
          job_name: "-",
          cost_code: "-",
          description: `Payment via ${pmt.payment_method || "check"}`,
          amount: -(pmt.amount || 0),
        });
      });

      // Sort by date descending
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTransactions);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const buildPdfDoc = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Project Transaction Report", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, 14, 28);
    doc.text(`Company: ${currentCompany?.name || ""}`, 14, 34);
    if (selectedJob !== "all") {
      const job = jobs.find(j => j.id === selectedJob);
      doc.text(`Project: ${job?.name || ""}`, 14, 40);
    }
    
    const tableData = transactions.map(t => [
      t.date ? format(new Date(t.date), "MM/dd/yyyy") : "-",
      t.type,
      t.reference,
      t.vendor_name,
      t.job_name,
      t.cost_code.length > 25 ? t.cost_code.substring(0, 25) + "..." : t.cost_code,
      `$${formatNumber(t.amount)}`,
    ]);
    
    autoTable(doc, {
      startY: selectedJob !== "all" ? 46 : 40,
      head: [["Date", "Type", "Reference", "Vendor", "Project", "Cost Code", "Amount"]],
      body: tableData,
      foot: [["", "", "", "", "", "Total:", `$${formatNumber(totalAmount)}`]],
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    });
    
    return doc;
  };

  const exportToPDF = async () => {
    const doc = await buildPdfDoc();
    doc.save(`project-transactions-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  const exportToExcel = async () => {
    const worksheetData = [
      ["Project Transaction Report"],
      [`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`],
      [`Company: ${currentCompany?.name || ""}`],
      [],
      ["Date", "Type", "Reference", "Vendor", "Project", "Cost Code", "Description", "Amount"],
      ...transactions.map((t) => [
        t.date ? format(new Date(t.date), "MM/dd/yyyy") : "-",
        t.type,
        t.reference,
        t.vendor_name,
        t.job_name,
        t.cost_code,
        t.description,
        t.amount,
      ]),
      [],
      ["", "", "", "", "", "", "Total:", totalAmount],
    ];

    try {
      await exportAoAToXlsx({
        data: worksheetData,
        sheetName: "Transactions",
        fileName: `project-transactions-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
      });
      toast({ title: "Success", description: "Excel file exported successfully" });
    } catch (e) {
      console.error("Excel export failed:", e);
      toast({ title: "Error", description: "Failed to export Excel file", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Project Transaction Report</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {jobs.map(job => (
                <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportToPDF} disabled={loading || transactions.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={loading || transactions.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(true)} disabled={loading || transactions.length === 0}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transactions ({transactions.length})</span>
            <span className={`text-lg font-semibold ${totalAmount < 0 ? "text-red-600" : ""}`}>
              Total: ${formatNumber(totalAmount)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No transactions found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Cost Code</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={`${tx.type}-${tx.id}`}>
                      <TableCell>{tx.date ? format(new Date(tx.date), "MM/dd/yyyy") : "-"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          tx.type === "Bill" ? "bg-blue-100 text-blue-800" :
                          tx.type === "Credit Card" ? "bg-purple-100 text-purple-800" :
                          "bg-green-100 text-green-800"
                        }`}>
                          {tx.type}
                        </span>
                      </TableCell>
                      <TableCell>{tx.reference}</TableCell>
                      <TableCell>{tx.vendor_name}</TableCell>
                      <TableCell>{tx.job_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{tx.cost_code}</TableCell>
                      <TableCell className={`text-right font-medium ${tx.amount < 0 ? "text-red-600" : ""}`}>
                        ${formatNumber(tx.amount)}
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
        reportName="Project Transaction Report"
        fileName={`project-transactions-${format(new Date(), "yyyy-MM-dd")}.pdf`}
      />
    </div>
  );
}
