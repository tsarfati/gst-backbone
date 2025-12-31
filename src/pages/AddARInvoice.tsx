import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Building, AlertCircle, Save, Send, Download } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateAIAInvoice, downloadBlob, type AIATemplateData } from "@/utils/aiaTemplateProcessor";

interface Job {
  id: string;
  name: string;
  customer_id: string | null;
  address: string | null;
}

interface Customer {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

interface SOVItem {
  id: string;
  item_number: string;
  description: string;
  scheduled_value: number;
}

interface LineItem {
  sov_id: string;
  item_number: string;
  description: string;
  scheduled_value: number;
  previous_applications: number;
  this_period: number;
  materials_stored: number;
  total_completed: number;
  percent_complete: number;
  balance_to_finish: number;
  retainage: number;
}

export default function AddARInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sovItems, setSovItems] = useState<SOVItem[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [hasNoSOV, setHasNoSOV] = useState(false);
  const [previousInvoices, setPreviousInvoices] = useState<any[]>([]);

  // Form state
  const [selectedJobId, setSelectedJobId] = useState<string>(searchParams.get("jobId") || "");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [applicationNumber, setApplicationNumber] = useState(1);
  const [periodFrom, setPeriodFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [periodTo, setPeriodTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [contractDate, setContractDate] = useState("");
  const [retainagePercent, setRetainagePercent] = useState(10);

  useEffect(() => {
    if (currentCompany?.id) {
      loadInitialData();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (selectedJobId && currentCompany?.id) {
      loadSOVForJob(selectedJobId);
      loadPreviousInvoices(selectedJobId);
      
      // Set customer from job
      const job = jobs.find(j => j.id === selectedJobId);
      if (job?.customer_id) {
        setSelectedCustomerId(job.customer_id);
      }
    }
  }, [selectedJobId, jobs]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      const [jobsRes, customersRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, name, customer_id, address")
          .eq("company_id", currentCompany!.id)
          .eq("status", "active")
          .order("name"),
        supabase
          .from("customers")
          .select("id, name, address, city, state, zip_code")
          .eq("company_id", currentCompany!.id)
          .eq("is_active", true)
          .order("name")
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (customersRes.error) throw customersRes.error;

      setJobs(jobsRes.data || []);
      setCustomers(customersRes.data || []);

      // Generate invoice number
      const { count } = await supabase
        .from("ar_invoices")
        .select("*", { count: "exact", head: true })
        .eq("company_id", currentCompany!.id);
      
      setInvoiceNumber(`INV-${String((count || 0) + 1).padStart(5, "0")}`);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSOVForJob = async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from("schedule_of_values")
        .select("*")
        .eq("company_id", currentCompany!.id)
        .eq("job_id", jobId)
        .eq("is_active", true)
        .order("sort_order");

      if (error) throw error;

      if (!data || data.length === 0) {
        setHasNoSOV(true);
        setSovItems([]);
        setLineItems([]);
        return;
      }

      setHasNoSOV(false);
      setSovItems(data.map(item => ({
        id: item.id,
        item_number: item.item_number,
        description: item.description,
        scheduled_value: Number(item.scheduled_value)
      })));

      // Initialize line items
      setLineItems(data.map(item => ({
        sov_id: item.id,
        item_number: item.item_number,
        description: item.description,
        scheduled_value: Number(item.scheduled_value),
        previous_applications: 0,
        this_period: 0,
        materials_stored: 0,
        total_completed: 0,
        percent_complete: 0,
        balance_to_finish: Number(item.scheduled_value),
        retainage: 0
      })));
    } catch (error: any) {
      console.error("Error loading SOV:", error);
    }
  };

  const loadPreviousInvoices = async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from("ar_invoices")
        .select("application_number")
        .eq("company_id", currentCompany!.id)
        .eq("job_id", jobId)
        .order("application_number", { ascending: false })
        .limit(1);

      if (error) throw error;

      const lastAppNumber = data?.[0]?.application_number || 0;
      setApplicationNumber(lastAppNumber + 1);
      
      // Load previous line items to calculate previous applications
      if (lastAppNumber > 0) {
        const { data: prevInvoice } = await supabase
          .from("ar_invoices")
          .select(`
            id,
            ar_invoice_line_items (
              sov_id,
              total_completed,
              materials_stored
            )
          `)
          .eq("company_id", currentCompany!.id)
          .eq("job_id", jobId)
          .order("application_number", { ascending: false })
          .limit(1)
          .single();

        if (prevInvoice?.ar_invoice_line_items) {
          setPreviousInvoices(prevInvoice.ar_invoice_line_items);
        }
      }
    } catch (error: any) {
      console.error("Error loading previous invoices:", error);
    }
  };

  const updateLineItem = (index: number, field: 'this_period' | 'materials_stored', value: number) => {
    const newItems = [...lineItems];
    const item = { ...newItems[index] };
    
    if (field === 'this_period') {
      item.this_period = value;
    } else if (field === 'materials_stored') {
      item.materials_stored = value;
    }
    
    // Recalculate totals
    const previousApp = previousInvoices.find(p => p.sov_id === item.sov_id);
    const prevCompleted = previousApp?.total_completed || 0;
    
    item.total_completed = prevCompleted + item.this_period + item.materials_stored;
    item.percent_complete = item.scheduled_value > 0 
      ? Math.round((item.total_completed / item.scheduled_value) * 10000) / 100 
      : 0;
    item.balance_to_finish = item.scheduled_value - item.total_completed;
    item.retainage = item.total_completed * (retainagePercent / 100);
    item.previous_applications = prevCompleted;
    
    newItems[index] = item;
    setLineItems(newItems);
  };

  // Calculate summary values
  const totals = lineItems.reduce((acc, item) => ({
    scheduledValue: acc.scheduledValue + item.scheduled_value,
    previousApplications: acc.previousApplications + item.previous_applications,
    thisPeriod: acc.thisPeriod + item.this_period,
    materialsStored: acc.materialsStored + item.materials_stored,
    totalCompleted: acc.totalCompleted + item.total_completed,
    balanceToFinish: acc.balanceToFinish + item.balance_to_finish,
    retainage: acc.retainage + item.retainage
  }), {
    scheduledValue: 0,
    previousApplications: 0,
    thisPeriod: 0,
    materialsStored: 0,
    totalCompleted: 0,
    balanceToFinish: 0,
    retainage: 0
  });

  const overallPercent = totals.scheduledValue > 0 
    ? Math.round((totals.totalCompleted / totals.scheduledValue) * 10000) / 100 
    : 0;

  // G702 calculations
  const contractSum = totals.scheduledValue;
  const changeOrders = 0; // Can be extended later
  const totalContractSum = contractSum + changeOrders;
  const totalCompletedStored = totals.totalCompleted;
  const totalRetainage = totals.retainage;
  const lessPreviousCertificates = totals.previousApplications - (totals.previousApplications * (retainagePercent / 100));
  const currentPaymentDue = (totalCompletedStored - totalRetainage) - lessPreviousCertificates;

  const handleSave = async () => {
    if (!selectedJobId || !selectedCustomerId) {
      toast({
        title: "Error",
        description: "Please select a job and customer",
        variant: "destructive",
      });
      return;
    }

    if (lineItems.length === 0) {
      toast({
        title: "Error",
        description: "No line items to invoice",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Create invoice - note: balance_due is a generated column, don't include it
      const { data: invoice, error: invoiceError } = await supabase
        .from("ar_invoices")
        .insert({
          company_id: currentCompany!.id,
          customer_id: selectedCustomerId,
          job_id: selectedJobId,
          invoice_number: invoiceNumber,
          application_number: applicationNumber,
          issue_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          period_from: periodFrom,
          period_to: periodTo,
          contract_date: contractDate || null,
          amount: totals.thisPeriod,
          total_amount: currentPaymentDue,
          contract_amount: contractSum,
          change_orders_amount: changeOrders,
          retainage_percent: retainagePercent,
          total_retainage: totalRetainage,
          less_previous_certificates: lessPreviousCertificates,
          current_payment_due: currentPaymentDue,
          status: "draft",
          created_by: user!.id
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lineItemsToInsert = lineItems.map(item => ({
        company_id: currentCompany!.id,
        ar_invoice_id: invoice.id,
        sov_id: item.sov_id,
        scheduled_value: item.scheduled_value,
        previous_applications: item.previous_applications,
        this_period: item.this_period,
        materials_stored: item.materials_stored,
        total_completed: item.total_completed,
        percent_complete: item.percent_complete,
        balance_to_finish: item.balance_to_finish,
        retainage: item.retainage
      }));

      const { error: lineItemsError } = await supabase
        .from("ar_invoice_line_items")
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      toast({
        title: "Success",
        description: "Invoice created successfully",
      });

      navigate(`/receivables/invoices/${invoice.id}`);
    } catch (error: any) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const generateAIAPdf = async (forReview: boolean = false) => {
    // First, try to use the uploaded Excel template
    if (currentCompany?.id) {
      const templateData: AIATemplateData = {
        // Company Information
        company_name: currentCompany.name || '',
        company_address: currentCompany.address || '',
        company_city: currentCompany.city || '',
        company_state: currentCompany.state || '',
        company_zip: currentCompany.zip_code || '',
        company_phone: currentCompany.phone || '',
        company_email: currentCompany.email || '',
        license_number: (currentCompany as any).license_number || '',

        // Customer/Owner Information
        owner_name: selectedCustomer?.name || '',
        owner_address: selectedCustomer?.address || '',
        owner_city: selectedCustomer?.city || '',
        owner_state: selectedCustomer?.state || '',
        owner_zip: selectedCustomer?.zip_code || '',
        owner_phone: '',
        owner_email: '',

        // Project/Job Information
        project_name: selectedJob?.name || '',
        project_number: selectedJobId || '',
        project_address: selectedJob?.address || '',
        project_city: '',
        project_state: '',
        project_zip: '',
        architect_name: '',
        architect_project_no: '',

        // Contract Information
        contract_date: contractDate ? format(new Date(contractDate), 'MM/dd/yyyy') : '',
        contract_amount: `$${formatNumber(contractSum)}`,
        change_orders_amount: `$${formatNumber(changeOrders)}`,
        current_contract_sum: `$${formatNumber(totalContractSum)}`,
        retainage_percent: `${retainagePercent}%`,

        // Application/Invoice Details
        application_number: String(applicationNumber),
        application_date: format(new Date(), 'MM/dd/yyyy'),
        period_from: periodFrom ? format(new Date(periodFrom), 'MM/dd/yyyy') : '',
        period_to: periodTo ? format(new Date(periodTo), 'MM/dd/yyyy') : '',
        total_completed: `$${formatNumber(totalCompletedStored)}`,
        total_retainage: `$${formatNumber(totalRetainage)}`,
        total_earned_less_retainage: `$${formatNumber(totalCompletedStored - totalRetainage)}`,
        less_previous_certificates: `$${formatNumber(lessPreviousCertificates)}`,
        current_payment_due: `$${formatNumber(currentPaymentDue)}`,
        balance_to_finish: `$${formatNumber(totals.balanceToFinish + totalRetainage)}`,

        // Line Items
        lineItems: lineItems.map(item => ({
          item_number: item.item_number,
          description: item.description,
          scheduled_value: item.scheduled_value,
          previous_applications: item.previous_applications,
          this_period: item.this_period,
          materials_stored: item.materials_stored,
          total_completed: item.total_completed,
          percent_complete: item.percent_complete,
          balance_to_finish: item.balance_to_finish,
          retainage: item.retainage,
        })),
      };

      const result = await generateAIAInvoice(currentCompany.id, templateData, { forReview });
      
      if (result) {
        downloadBlob(result.blob, result.fileName);
        toast({
          title: forReview ? "Template Export for Review" : "Template Export Downloaded",
          description: `${result.fileName} has been downloaded using your custom template`,
        });
        return;
      }
    }

    // Fallback to standard PDF generation if no template found
    // Use landscape orientation for better table layout
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // --- PAGE 1: G702 Application and Certificate for Payment ---
    
    // Header box with title
    doc.setFillColor(240, 240, 240);
    doc.rect(10, 10, pageWidth - 20, 20, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("APPLICATION AND CERTIFICATION FOR PAYMENT", pageWidth / 2, 18, { align: "center" });
    doc.setFontSize(10);
    doc.text("AIA DOCUMENT G702", pageWidth / 2, 25, { align: "center" });
    
    if (forReview) {
      doc.setTextColor(200, 0, 0);
      doc.setFontSize(12);
      doc.text("*** FOR REVIEW ***", pageWidth - 50, 18);
      doc.setTextColor(0, 0, 0);
    }
    
    const startY = 38;
    
    // Create a 3-column layout like the template
    const col1X = 14;
    const col2X = 110;
    const col3X = 200;
    
    // Column 1: Owner info
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("TO OWNER:", col1X, startY);
    doc.setFont("helvetica", "normal");
    doc.text(selectedCustomer?.name || "-", col1X, startY + 5);
    const customerAddress = [
      selectedCustomer?.address,
      [selectedCustomer?.city, selectedCustomer?.state, selectedCustomer?.zip_code].filter(Boolean).join(", ")
    ].filter(Boolean).join("\n");
    doc.text(customerAddress, col1X, startY + 10);
    
    // Column 1: Contractor info
    doc.setFont("helvetica", "bold");
    doc.text("FROM CONTRACTOR:", col1X, startY + 25);
    doc.setFont("helvetica", "normal");
    doc.text(currentCompany?.name || "-", col1X, startY + 30);
    const companyAddress = [
      currentCompany?.address,
      [currentCompany?.city, currentCompany?.state, currentCompany?.zip_code].filter(Boolean).join(", ")
    ].filter(Boolean).join("\n");
    doc.text(companyAddress, col1X, startY + 35);
    
    // Column 2: Project info
    doc.setFont("helvetica", "bold");
    doc.text("PROJECT:", col2X, startY);
    doc.setFont("helvetica", "normal");
    doc.text(selectedJob?.name || "-", col2X, startY + 5);
    doc.text(selectedJob?.address || "", col2X, startY + 10);
    
    doc.setFont("helvetica", "bold");
    doc.text("CONTRACT FOR:", col2X, startY + 20);
    doc.setFont("helvetica", "normal");
    doc.text(selectedJob?.address || "-", col2X, startY + 25);
    
    doc.setFont("helvetica", "bold");
    doc.text("CONTRACT DATE:", col2X, startY + 35);
    doc.setFont("helvetica", "normal");
    doc.text(contractDate ? format(new Date(contractDate), "MM/dd/yyyy") : "-", col2X + 30, startY + 35);
    
    // Column 3: Application details
    doc.setFont("helvetica", "bold");
    doc.text("APPLICATION NO:", col3X, startY);
    doc.setFont("helvetica", "normal");
    doc.text(String(applicationNumber), col3X + 35, startY);
    
    doc.setFont("helvetica", "bold");
    doc.text("APPLICATION DATE:", col3X, startY + 8);
    doc.setFont("helvetica", "normal");
    doc.text(format(new Date(), "MM/dd/yyyy"), col3X + 38, startY + 8);
    
    doc.setFont("helvetica", "bold");
    doc.text("PERIOD TO:", col3X, startY + 16);
    doc.setFont("helvetica", "normal");
    doc.text(periodTo ? format(new Date(periodTo), "MM/dd/yyyy") : "-", col3X + 25, startY + 16);
    
    // Contractor's certification text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("CONTRACTOR'S APPLICATION FOR PAYMENT", col1X, startY + 50);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const certText = "The undersigned Contractor certifies that to the best of the Contractor's knowledge, information and belief the Work covered by this Application for Payment has been completed in accordance with the Contract Documents, that all amounts have been paid by the Contractor for Work for which previous Certificates for Payment were issued and payments received from the Owner, and that current payment shown herein is now due.";
    const splitCertText = doc.splitTextToSize(certText, 150);
    doc.text(splitCertText, col1X, startY + 55);
    
    // Contract Summary Table - positioned on the right side
    const contractTableX = 175;
    const contractTableY = startY + 50;
    
    autoTable(doc, {
      startY: contractTableY,
      margin: { left: contractTableX },
      tableWidth: 105,
      head: [],
      body: [
        ["1. ORIGINAL CONTRACT SUM", `$${formatNumber(contractSum)}`],
        ["2. Net change by Change Orders", `$${formatNumber(changeOrders)}`],
        ["3. CONTRACT SUM TO DATE", `$${formatNumber(totalContractSum)}`],
        ["4. TOTAL COMPLETED & STORED TO DATE", `$${formatNumber(totalCompletedStored)}`],
        [`5. RETAINAGE (${retainagePercent}%)`, `$${formatNumber(totalRetainage)}`],
        ["6. TOTAL EARNED LESS RETAINAGE", `$${formatNumber(totalCompletedStored - totalRetainage)}`],
        ["7. LESS PREVIOUS CERTIFICATES", `$${formatNumber(lessPreviousCertificates)}`],
        ["8. CURRENT PAYMENT DUE", `$${formatNumber(currentPaymentDue)}`],
        ["9. BALANCE TO FINISH INCL. RETAINAGE", `$${formatNumber(totals.balanceToFinish + totalRetainage)}`],
      ],
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 40, halign: "right", fontStyle: "bold" }
      },
      didParseCell: (data) => {
        if (data.row.index === 2 || data.row.index === 5 || data.row.index === 7) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [245, 245, 245];
        }
      }
    });
    
    // Amount Certified and Signature section
    const signatureY = startY + 75;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("AMOUNT CERTIFIED . . . . . . . . . . . $ ____________________", col1X, signatureY);
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("(Attach explanation if amount certified differs from the amount applied.)", col1X, signatureY + 5);
    
    // Signature lines
    const sigY = signatureY + 15;
    doc.line(col1X, sigY, 70, sigY);
    doc.text("CONTRACTOR", col1X, sigY + 4);
    doc.text("By: ____________________ Date: __________", col1X, sigY + 9);
    
    doc.line(80, sigY, 150, sigY);
    doc.text("ARCHITECT", 80, sigY + 4);
    doc.text("By: ____________________ Date: __________", 80, sigY + 9);
    
    // Footer
    doc.setFontSize(6);
    doc.text("AIA DOCUMENT G702 · APPLICATION AND CERTIFICATION FOR PAYMENT · 1992 EDITION · AIA · ©1992", pageWidth / 2, pageHeight - 8, { align: "center" });
    
    // --- PAGE 2: G703 Continuation Sheet (Landscape) ---
    doc.addPage("landscape");
    
    // Header
    doc.setFillColor(240, 240, 240);
    doc.rect(10, 10, pageWidth - 20, 16, "F");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CONTINUATION SHEET", 14, 18);
    doc.text("AIA DOCUMENT G703", 14, 24);
    
    if (forReview) {
      doc.setTextColor(200, 0, 0);
      doc.text("*** FOR REVIEW ***", pageWidth - 50, 18);
      doc.setTextColor(0, 0, 0);
    }
    
    // Application info inline with header
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`APPLICATION NO: ${applicationNumber}`, 100, 18);
    doc.text(`APPLICATION DATE: ${format(new Date(), "MM/dd/yyyy")}`, 160, 18);
    doc.text(`PERIOD TO: ${periodTo ? format(new Date(periodTo), "MM/dd/yyyy") : "-"}`, 230, 18);
    doc.text(`PROJECT: ${selectedJob?.name || "-"}`, 100, 24);
    
    // G703 Table - Full width landscape using simple strings for type safety
    autoTable(doc, {
      startY: 32,
      margin: { left: 10, right: 10 },
      head: [[
        "A\nITEM NO.",
        "B\nDESCRIPTION OF WORK",
        "C\nSCHEDULED VALUE",
        "D\nPREVIOUS APP",
        "E\nTHIS PERIOD",
        "F\nMATERIALS STORED",
        "G\nTOTAL COMPLETED",
        "H\n%",
        "I\nBALANCE TO FINISH",
        "J\nRETAINAGE"
      ]],
      body: [
        ...lineItems.map(item => [
          item.item_number,
          item.description,
          `$${formatNumber(item.scheduled_value)}`,
          `$${formatNumber(item.previous_applications)}`,
          `$${formatNumber(item.this_period)}`,
          `$${formatNumber(item.materials_stored)}`,
          `$${formatNumber(item.total_completed)}`,
          `${item.percent_complete}%`,
          `$${formatNumber(item.balance_to_finish)}`,
          `$${formatNumber(item.retainage)}`
        ]),
        // Totals row
        [
          "",
          "GRAND TOTAL",
          `$${formatNumber(totals.scheduledValue)}`,
          `$${formatNumber(totals.previousApplications)}`,
          `$${formatNumber(totals.thisPeriod)}`,
          `$${formatNumber(totals.materialsStored)}`,
          `$${formatNumber(totals.totalCompleted)}`,
          `${overallPercent}%`,
          `$${formatNumber(totals.balanceToFinish)}`,
          `$${formatNumber(totals.retainage)}`
        ]
      ],
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: 255, fontSize: 7, halign: "center", valign: "middle", minCellHeight: 14 },
      columnStyles: {
        0: { cellWidth: 20, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 28, halign: "right" },
        3: { cellWidth: 25, halign: "right" },
        4: { cellWidth: 25, halign: "right" },
        5: { cellWidth: 30, halign: "right" },
        6: { cellWidth: 32, halign: "right" },
        7: { cellWidth: 15, halign: "center" },
        8: { cellWidth: 30, halign: "right" },
        9: { cellWidth: 24, halign: "right" }
      },
      didParseCell: (data) => {
        // Style the totals row
        if (data.row.index === lineItems.length && data.section === "body") {
          data.cell.styles.fillColor = [230, 230, 230];
          data.cell.styles.fontStyle = "bold";
        }
      }
    });
    
    // Footer
    doc.setFontSize(6);
    doc.text("AIA DOCUMENT G703 · CONTINUATION SHEET · 1992 EDITION · AIA · ©1992", pageWidth / 2, pageHeight - 8, { align: "center" });
    
    // Save
    const fileName = `AIA_Invoice_${invoiceNumber}_App${applicationNumber}${forReview ? "_REVIEW" : ""}.pdf`;
    doc.save(fileName);
    
    toast({
      title: forReview ? "PDF for Review Generated" : "PDF Downloaded",
      description: `${fileName} has been downloaded`,
    });
  };

  const handleSaveProgress = async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Please select a job first",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Create invoice as draft - note: balance_due is a generated column
      const { data: invoice, error: invoiceError } = await supabase
        .from("ar_invoices")
        .insert({
          company_id: currentCompany!.id,
          customer_id: selectedCustomerId || null,
          job_id: selectedJobId,
          invoice_number: invoiceNumber,
          application_number: applicationNumber,
          issue_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          period_from: periodFrom,
          period_to: periodTo,
          contract_date: contractDate || null,
          amount: totals.thisPeriod,
          total_amount: currentPaymentDue,
          contract_amount: contractSum,
          change_orders_amount: changeOrders,
          retainage_percent: retainagePercent,
          total_retainage: totalRetainage,
          less_previous_certificates: lessPreviousCertificates,
          current_payment_due: currentPaymentDue,
          status: "draft",
          created_by: user!.id
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items if we have them
      if (lineItems.length > 0) {
        const lineItemsToInsert = lineItems.map(item => ({
          company_id: currentCompany!.id,
          ar_invoice_id: invoice.id,
          sov_id: item.sov_id,
          scheduled_value: item.scheduled_value,
          previous_applications: item.previous_applications,
          this_period: item.this_period,
          materials_stored: item.materials_stored,
          total_completed: item.total_completed,
          percent_complete: item.percent_complete,
          balance_to_finish: item.balance_to_finish,
          retainage: item.retainage
        }));

        const { error: lineItemsError } = await supabase
          .from("ar_invoice_line_items")
          .insert(lineItemsToInsert);

        if (lineItemsError) throw lineItemsError;
      }

      toast({
        title: "Progress Saved",
        description: "Invoice draft saved successfully",
      });

      navigate(`/receivables/invoices/${invoice.id}`);
    } catch (error: any) {
      console.error("Error saving progress:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save progress",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendForReview = () => {
    if (!selectedJobId || !selectedCustomerId) {
      toast({
        title: "Error",
        description: "Please select a job and customer first",
        variant: "destructive",
      });
      return;
    }
    generateAIAPdf(true);
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/receivables/invoices")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">New AIA Invoice</h1>
          <p className="text-muted-foreground">Application for Payment (G702/G703)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={handleSaveProgress} 
            disabled={saving || !selectedJobId}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Progress
          </Button>
          <Button 
            variant="outline" 
            onClick={() => generateAIAPdf(false)} 
            disabled={hasNoSOV || lineItems.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleSendForReview} 
            disabled={hasNoSOV || lineItems.length === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            Send for Review
          </Button>
          <Button onClick={handleSave} disabled={saving || hasNoSOV}>
            <FileText className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Create Invoice"}
          </Button>
        </div>
      </div>

      {/* Job & Customer Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Application #</Label>
              <Input type="number" value={applicationNumber} onChange={(e) => setApplicationNumber(parseInt(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Period From</Label>
              <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Period To</Label>
              <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Contract Date</Label>
              <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Retainage %</Label>
              <Input 
                type="number" 
                value={retainagePercent} 
                onChange={(e) => setRetainagePercent(parseFloat(e.target.value) || 0)}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No SOV Warning */}
      {hasNoSOV && selectedJobId && (
        <Card className="border-destructive">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-medium mb-2">No Schedule of Values Found</h3>
              <p className="text-muted-foreground mb-4">
                This project needs a Schedule of Values (SOV) set up before you can create an invoice.
              </p>
              <Button onClick={() => navigate(`/jobs/${selectedJobId}?tab=billing`)}>
                Set Up Billing Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AIA Invoice Tabs */}
      {!hasNoSOV && selectedJobId && lineItems.length > 0 && (
        <Tabs defaultValue="g703" className="space-y-4">
          <TabsList>
            <TabsTrigger value="g702">
              <FileText className="h-4 w-4 mr-2" />
              G702 - Application Summary
            </TabsTrigger>
            <TabsTrigger value="g703">
              <Building className="h-4 w-4 mr-2" />
              G703 - Continuation Sheet
            </TabsTrigger>
          </TabsList>

          {/* G702 - Application Summary */}
          <TabsContent value="g702">
            <Card>
              <CardHeader>
                <CardTitle>AIA Document G702 - Application and Certificate for Payment</CardTitle>
                <CardDescription>Application No. {applicationNumber}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Project Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">TO OWNER:</Label>
                      <p className="font-medium">{selectedCustomer?.name || "-"}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedCustomer?.address && `${selectedCustomer.address}, `}
                        {selectedCustomer?.city && `${selectedCustomer.city}, `}
                        {selectedCustomer?.state} {selectedCustomer?.zip_code}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">PROJECT:</Label>
                      <p className="font-medium">{selectedJob?.name || "-"}</p>
                      <p className="text-sm text-muted-foreground">{selectedJob?.address}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">APPLICATION NO:</Label>
                      <p className="font-medium">{applicationNumber}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">PERIOD TO:</Label>
                      <p className="font-medium">{periodTo}</p>
                    </div>
                  </div>
                </div>

                {/* Contract Summary */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium border-b pb-2">CONTRACT SUMMARY</h4>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>1. ORIGINAL CONTRACT SUM</div>
                    <div className="text-right font-medium">${formatNumber(contractSum)}</div>
                    
                    <div>2. Net change by Change Orders</div>
                    <div className="text-right font-medium">${formatNumber(changeOrders)}</div>
                    
                    <div className="font-medium">3. CONTRACT SUM TO DATE (Line 1 ± 2)</div>
                    <div className="text-right font-bold">${formatNumber(totalContractSum)}</div>
                    
                    <div>4. TOTAL COMPLETED & STORED TO DATE</div>
                    <div className="text-right font-medium">${formatNumber(totalCompletedStored)}</div>
                    
                    <div>5. RETAINAGE:</div>
                    <div className="text-right font-medium">${formatNumber(totalRetainage)}</div>
                    
                    <div className="font-medium">6. TOTAL EARNED LESS RETAINAGE (Line 4 - 5)</div>
                    <div className="text-right font-bold">${formatNumber(totalCompletedStored - totalRetainage)}</div>
                    
                    <div>7. LESS PREVIOUS CERTIFICATES FOR PAYMENT</div>
                    <div className="text-right font-medium">${formatNumber(lessPreviousCertificates)}</div>
                    
                    <div className="font-medium text-lg border-t pt-2">8. CURRENT PAYMENT DUE</div>
                    <div className="text-right font-bold text-lg border-t pt-2">${formatNumber(currentPaymentDue)}</div>
                    
                    <div>9. BALANCE TO FINISH, INCLUDING RETAINAGE</div>
                    <div className="text-right font-medium">${formatNumber(totals.balanceToFinish + totalRetainage)}</div>
                  </div>
                </div>

                {/* Percent Complete */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <span className="font-medium">PERCENT COMPLETE:</span>
                  <span className="text-2xl font-bold">{overallPercent}%</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* G703 - Continuation Sheet */}
          <TabsContent value="g703">
            <Card>
              <CardHeader>
                <CardTitle>AIA Document G703 - Continuation Sheet</CardTitle>
                <CardDescription>Schedule of Values detailing work completed this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Item No.</TableHead>
                        <TableHead>Description of Work</TableHead>
                        <TableHead className="text-right w-28">Scheduled Value</TableHead>
                        <TableHead className="text-right w-28">Previous Applications</TableHead>
                        <TableHead className="text-right w-28">This Period</TableHead>
                        <TableHead className="text-right w-28">Materials Stored</TableHead>
                        <TableHead className="text-right w-28">Total Completed</TableHead>
                        <TableHead className="text-right w-16">%</TableHead>
                        <TableHead className="text-right w-28">Balance to Finish</TableHead>
                        <TableHead className="text-right w-28">Retainage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => (
                        <TableRow key={item.sov_id}>
                          <TableCell className="font-medium">{item.item_number}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">${formatNumber(item.scheduled_value)}</TableCell>
                          <TableCell className="text-right">${formatNumber(item.previous_applications)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground text-xs">$</span>
                              <CurrencyInput
                                value={item.this_period}
                                onChange={(val) => updateLineItem(index, "this_period", parseFloat(val) || 0)}
                                className="w-24 text-right text-sm"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground text-xs">$</span>
                              <CurrencyInput
                                value={item.materials_stored}
                                onChange={(val) => updateLineItem(index, "materials_stored", parseFloat(val) || 0)}
                                className="w-24 text-right text-sm"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">${formatNumber(item.total_completed)}</TableCell>
                          <TableCell className="text-right">{item.percent_complete}%</TableCell>
                          <TableCell className="text-right">${formatNumber(item.balance_to_finish)}</TableCell>
                          <TableCell className="text-right">${formatNumber(item.retainage)}</TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={2}>GRAND TOTAL</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.scheduledValue)}</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.previousApplications)}</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.thisPeriod)}</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.materialsStored)}</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.totalCompleted)}</TableCell>
                        <TableCell className="text-right">{overallPercent}%</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.balanceToFinish)}</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.retainage)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
