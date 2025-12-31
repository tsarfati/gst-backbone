import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download, FileSpreadsheet, Filter, X } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { CreditCardTransactionModal } from "@/components/CreditCardTransactionModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "bill" | "credit_card" | "journal_entry";
  reference_number?: string;
  job_name?: string;
  cost_code?: string;
  cost_code_description?: string;
  category?: string;
}

interface Job {
  id: string;
  name: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  type?: string;
}

export default function ProjectCostTransactionHistory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  
  // URL params (for direct navigation from budget page)
  const urlJobId = searchParams.get("jobId");
  const urlCostCodeId = searchParams.get("costCodeId");
  const urlJobName = searchParams.get("jobName");
  const urlCostCodeDescription = searchParams.get("costCodeDescription");
  
  // Filter state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(urlJobId || "");
  const [selectedCostCodeId, setSelectedCostCodeId] = useState<string>(urlCostCodeId || "");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(!urlJobId);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [resolvedCostCodeId, setResolvedCostCodeId] = useState<string | null>(null);

  // Load jobs and cost codes for filters
  useEffect(() => {
    if (currentCompany?.id) {
      loadFilterData();
    }
  }, [currentCompany?.id]);

  // Load cost codes when job changes
  useEffect(() => {
    if (selectedJobId && currentCompany?.id) {
      loadCostCodesForJob(selectedJobId);
    } else {
      setCostCodes([]);
      setSelectedCostCodeId("");
    }
  }, [selectedJobId, currentCompany?.id]);

  // Resolve cost code ID (might be budget ID)
  useEffect(() => {
    if (selectedCostCodeId) {
      resolveCostCodeId(selectedCostCodeId);
    } else {
      setResolvedCostCodeId(null);
    }
  }, [selectedCostCodeId]);

  // Load transactions when filters change
  useEffect(() => {
    if (selectedJobId && resolvedCostCodeId) {
      loadTransactions();
    } else if (selectedJobId && !selectedCostCodeId) {
      // Load all transactions for job (no cost code filter)
      loadTransactions();
    }
  }, [selectedJobId, resolvedCostCodeId]);

  // Apply client-side filters
  useEffect(() => {
    applyFilters();
  }, [transactions, selectedType, selectedCategory, dateFrom, dateTo]);

  const loadFilterData = async () => {
    try {
      setLoadingFilters(true);
      const { data: jobsData, error } = await supabase
        .from("jobs")
        .select("id, name")
        .eq("company_id", currentCompany!.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setJobs(jobsData || []);
    } catch (error) {
      console.error("Error loading jobs:", error);
    } finally {
      setLoadingFilters(false);
    }
  };

  const loadCostCodesForJob = async (jobId: string) => {
    try {
      // Get cost codes from budgets for this job
      const { data: budgets, error } = await supabase
        .from("job_budgets")
        .select("cost_code_id, cost_codes(id, code, description, type)")
        .eq("job_id", jobId)
        .not("cost_code_id", "is", null);

      if (error) throw error;

      const uniqueCostCodes = new Map<string, CostCode>();
      (budgets || []).forEach((b: any) => {
        if (b.cost_codes) {
          uniqueCostCodes.set(b.cost_codes.id, b.cost_codes);
        }
      });

      setCostCodes(Array.from(uniqueCostCodes.values()).sort((a, b) => a.code.localeCompare(b.code)));
    } catch (error) {
      console.error("Error loading cost codes:", error);
    }
  };

  const resolveCostCodeId = async (costCodeId: string) => {
    // First check if it's a budget ID
    const { data: budget } = await supabase
      .from("job_budgets")
      .select("cost_code_id")
      .eq("id", costCodeId)
      .maybeSingle();

    if (budget?.cost_code_id) {
      setResolvedCostCodeId(budget.cost_code_id);
    } else {
      setResolvedCostCodeId(costCodeId);
    }
  };

  const loadTransactions = useCallback(async () => {
    if (!selectedJobId) return;
    
    try {
      setLoading(true);
      
      const actualCostCodeId = resolvedCostCodeId;

      // Run all queries in parallel for better performance
      const [journalResult, billsResult, ccResult] = await Promise.all([
        // Journal entry lines
        supabase
          .from("journal_entry_lines")
          .select(`
            id,
            debit_amount,
            credit_amount,
            description,
            journal_entries!inner(id, entry_date, reference, description, status),
            jobs(name),
            cost_codes(code, description, type)
          `)
          .eq("job_id", selectedJobId)
          .then(res => {
            if (actualCostCodeId) {
              return supabase
                .from("journal_entry_lines")
                .select(`
                  id,
                  debit_amount,
                  credit_amount,
                  description,
                  journal_entries!inner(id, entry_date, reference, description, status),
                  jobs(name),
                  cost_codes(code, description, type)
                `)
                .eq("job_id", selectedJobId)
                .eq("cost_code_id", actualCostCodeId);
            }
            return res;
          }),
        
        // Bills
        supabase
          .from("invoices")
          .select(`
            id, invoice_number, issue_date, amount, description, status, bill_category,
            jobs(name),
            cost_codes(code, description, type)
          `)
          .eq("job_id", selectedJobId)
          .then(res => {
            if (actualCostCodeId) {
              return supabase
                .from("invoices")
                .select(`
                  id, invoice_number, issue_date, amount, description, status, bill_category,
                  jobs(name),
                  cost_codes(code, description, type)
                `)
                .eq("job_id", selectedJobId)
                .eq("cost_code_id", actualCostCodeId);
            }
            return res;
          }),
        
        // Credit card distributions
        supabase
          .from("credit_card_transaction_distributions")
          .select(`
            id, amount, transaction_id,
            jobs(name),
            cost_codes(code, description, type),
            credit_card_transactions(
              id, transaction_date, amount, description, reference_number, coding_status, category, journal_entry_id
            )
          `)
          .eq("job_id", selectedJobId)
          .then(res => {
            if (actualCostCodeId) {
              return supabase
                .from("credit_card_transaction_distributions")
                .select(`
                  id, amount, transaction_id,
                  jobs(name),
                  cost_codes(code, description, type),
                  credit_card_transactions(
                    id, transaction_date, amount, description, reference_number, coding_status, category, journal_entry_id
                  )
                `)
                .eq("job_id", selectedJobId)
                .eq("cost_code_id", actualCostCodeId);
            }
            return res;
          }),
      ]);

      // Actually run the queries properly
      let journalQuery = supabase
        .from("journal_entry_lines")
        .select(`
          id, debit_amount, credit_amount, description,
          journal_entries!inner(id, entry_date, reference, description, status),
          jobs(name),
          cost_codes(code, description, type)
        `)
        .eq("job_id", selectedJobId);
      
      if (actualCostCodeId) {
        journalQuery = journalQuery.eq("cost_code_id", actualCostCodeId);
      }

      let billsQuery = supabase
        .from("invoices")
        .select(`
          id, invoice_number, issue_date, amount, description, status, bill_category,
          jobs(name),
          cost_codes(code, description, type)
        `)
        .eq("job_id", selectedJobId);
      
      if (actualCostCodeId) {
        billsQuery = billsQuery.eq("cost_code_id", actualCostCodeId);
      }

      let ccQuery = supabase
        .from("credit_card_transaction_distributions")
        .select(`
          id, amount, transaction_id,
          jobs(name),
          cost_codes(code, description, type),
          credit_card_transactions(
            id, transaction_date, amount, description, reference_number, coding_status, category, journal_entry_id
          )
        `)
        .eq("job_id", selectedJobId);
      
      if (actualCostCodeId) {
        ccQuery = ccQuery.eq("cost_code_id", actualCostCodeId);
      }

      const [journalRes, billsRes, ccRes] = await Promise.all([
        journalQuery,
        billsQuery,
        ccQuery,
      ]);

      if (journalRes.error) throw journalRes.error;
      if (billsRes.error) throw billsRes.error;
      if (ccRes.error) throw ccRes.error;

      const journalLines = journalRes.data || [];
      const bills = billsRes.data || [];
      const ccDistributions = ccRes.data || [];

      const allTransactions: Transaction[] = [
        // Journal entry lines (debit amounts are expenses)
        ...journalLines
          .filter((jl: any) => jl.debit_amount > 0)
          .map((jl: any) => ({
            id: jl.id,
            date: jl.journal_entries?.entry_date || "",
            description: jl.description || jl.journal_entries?.description || "Journal Entry",
            amount: Number(jl.debit_amount) || 0,
            type: "journal_entry" as const,
            reference_number: jl.journal_entries?.reference || undefined,
            job_name: jl.jobs?.name || "",
            cost_code: jl.cost_codes?.code || "",
            cost_code_description: jl.cost_codes?.description || "",
            category: jl.cost_codes?.type || undefined,
          })),
        // Bills not yet posted
        ...bills
          .filter((bill: any) => bill.status !== 'posted')
          .map((bill: any) => ({
            id: bill.id,
            date: bill.issue_date || "",
            description: bill.description || "Bill",
            amount: Number(bill.amount) || 0,
            type: "bill" as const,
            reference_number: bill.invoice_number || undefined,
            job_name: bill.jobs?.name || "",
            cost_code: bill.cost_codes?.code || "",
            cost_code_description: bill.cost_codes?.description || "",
            category: bill.bill_category || bill.cost_codes?.type || undefined,
          })),
        // Credit card transactions not yet posted
        ...ccDistributions
          .filter((dist: any) => !dist.credit_card_transactions?.journal_entry_id)
          .map((dist: any) => ({
            id: dist.credit_card_transactions?.id || dist.transaction_id,
            date: dist.credit_card_transactions?.transaction_date || "",
            description: dist.credit_card_transactions?.description || "Credit Card Transaction",
            amount: Number(dist.amount) || 0,
            type: "credit_card" as const,
            reference_number: dist.credit_card_transactions?.reference_number || undefined,
            job_name: dist.jobs?.name || "",
            cost_code: dist.cost_codes?.code || "",
            cost_code_description: dist.cost_codes?.description || "",
            category: dist.credit_card_transactions?.category || dist.cost_codes?.type || undefined,
          })),
      ];

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
  }, [selectedJobId, resolvedCostCodeId, toast]);

  const applyFilters = () => {
    let filtered = [...transactions];

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter(t => t.type === selectedType);
    }

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter(t => 
        t.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(t => new Date(t.date) >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(t => new Date(t.date) <= dateTo);
    }

    setFilteredTransactions(filtered);
    setTotalAmount(filtered.reduce((sum, t) => sum + t.amount, 0));
  };

  const clearFilters = () => {
    setSelectedType("all");
    setSelectedCategory("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleTransactionClick = async (transaction: Transaction) => {
    if (transaction.type === "bill") {
      const { data: bill, error } = await supabase
        .from("invoices")
        .select("*, vendors(*)")
        .eq("id", transaction.id)
        .single();
      
      if (error) {
        toast({
          title: "Error",
          description: "Failed to load bill details",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedBill(bill);
    } else {
      setSelectedTransaction(transaction);
    }
  };

  const getSelectedJobName = () => {
    const job = jobs.find(j => j.id === selectedJobId);
    return job ? job.name : urlJobName || "";
  };

  const getSelectedCostCodeDescription = () => {
    const cc = costCodes.find(c => c.id === selectedCostCodeId);
    return cc ? `${cc.code} - ${cc.description}` : urlCostCodeDescription || "";
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Project Cost Transaction History", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Job: ${getSelectedJobName()}`, 14, 25);
    if (selectedCostCodeId) {
      doc.text(`Cost Code: ${getSelectedCostCodeDescription()}`, 14, 30);
    }
    doc.text(`Total Amount: $${formatNumber(totalAmount)}`, 14, selectedCostCodeId ? 35 : 30);
    
    const tableData = filteredTransactions.map(t => {
      const costCodeDisplay = t.cost_code 
        ? `${t.cost_code} - ${t.cost_code_description || ""}`
        : t.cost_code_description || "-";
      return [
        new Date(t.date).toLocaleDateString(),
        t.type === "bill" ? "Bill" : t.type === "credit_card" ? "Credit Card" : "Posted",
        t.reference_number || "-",
        t.description,
        costCodeDisplay,
        t.category || "-",
        `$${formatNumber(t.amount)}`,
      ];
    });
    
    autoTable(doc, {
      startY: selectedCostCodeId ? 40 : 35,
      head: [["Date", "Type", "Reference", "Description", "Cost Code", "Category", "Amount"]],
      body: tableData,
      foot: [["", "", "", "", "", "Total:", `$${formatNumber(totalAmount)}`]],
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    });
    
    doc.save(`project-cost-transactions-${new Date().toISOString().split("T")[0]}.pdf`);
    
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  const exportToExcel = () => {
    const worksheetData = [
      ["Project Cost Transaction History"],
      [],
      ["Job:", getSelectedJobName()],
      ...(selectedCostCodeId ? [["Cost Code:", getSelectedCostCodeDescription()]] : []),
      ["Total Amount:", `$${formatNumber(totalAmount)}`],
      [],
      ["Date", "Type", "Reference", "Description", "Cost Code", "Category", "Amount"],
      ...filteredTransactions.map(t => {
        const costCodeDisplay = t.cost_code 
          ? `${t.cost_code} - ${t.cost_code_description || ""}`
          : t.cost_code_description || "-";
        return [
          new Date(t.date).toLocaleDateString(),
          t.type === "bill" ? "Bill" : t.type === "credit_card" ? "Credit Card" : "Posted",
          t.reference_number || "-",
          t.description,
          costCodeDisplay,
          t.category || "-",
          t.amount,
        ];
      }),
      [],
      ["", "", "", "", "", "Total:", totalAmount],
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    
    XLSX.writeFile(workbook, `project-cost-transactions-${new Date().toISOString().split("T")[0]}.xlsx`);
    
    toast({ title: "Success", description: "Excel file exported successfully" });
  };

  const getCategoryBadge = (category?: string) => {
    if (!category) return <span className="text-muted-foreground">-</span>;
    const label = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    const variants: Record<string, string> = {
      labor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      material: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      materials: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      equipment: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      sub: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      subcontract: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    };
    return (
      <Badge className={variants[category.toLowerCase()] || variants.other}>
        {label === "Materials" ? "Material" : label === "Subcontract" ? "Sub" : label}
      </Badge>
    );
  };

  const activeFilterCount = [
    selectedType !== "all",
    selectedCategory !== "all",
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Project Cost Transaction History</h1>
          {selectedJobId && (
            <p className="text-muted-foreground text-sm mt-1">
              {getSelectedJobName()}
              {selectedCostCodeId && ` - ${getSelectedCostCodeDescription()}`}
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPDF}
            disabled={loading || filteredTransactions.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={loading || filteredTransactions.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Job Select */}
              <div className="space-y-2">
                <Label>Job</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cost Code Select */}
              <div className="space-y-2">
                <Label>Cost Code</Label>
                <Select 
                  value={selectedCostCodeId} 
                  onValueChange={setSelectedCostCodeId}
                  disabled={!selectedJobId || costCodes.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedJobId ? "All cost codes" : "Select job first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cost Codes</SelectItem>
                    {costCodes.map(cc => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.code} - {cc.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Filter */}
              <div className="space-y-2">
                <Label>Transaction Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="journal_entry">Posted</SelectItem>
                    <SelectItem value="bill">Bills</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="subcontract">Subcontract</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div className="space-y-2">
                <Label>Date From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "MM/dd/yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <Label>Date To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "MM/dd/yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              Transactions
              {filteredTransactions.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filteredTransactions.length} records)
                </span>
              )}
            </span>
            <span className="text-lg font-semibold">
              Total: ${formatNumber(totalAmount)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedJobId ? (
            <div className="text-center py-8 text-muted-foreground">
              Select a job to view transactions
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Cost Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => {
                  const costCodeDisplay = transaction.cost_code 
                    ? `${transaction.cost_code} - ${transaction.cost_code_description || ""}`
                    : transaction.cost_code_description || "-";

                  return (
                    <TableRow
                      key={`${transaction.type}-${transaction.id}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleTransactionClick(transaction)}
                    >
                      <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transaction.type === "bill" ? "Bill" : transaction.type === "credit_card" ? "Credit Card" : "Posted"}
                        </Badge>
                      </TableCell>
                      <TableCell>{transaction.reference_number || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{transaction.description}</TableCell>
                      <TableCell>{costCodeDisplay}</TableCell>
                      <TableCell>{getCategoryBadge(transaction.category)}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${formatNumber(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedTransaction && (
        <CreditCardTransactionModal
          transactionId={selectedTransaction.id}
          open={!!selectedTransaction}
          onOpenChange={(open) => !open && setSelectedTransaction(null)}
          onComplete={() => {
            setSelectedTransaction(null);
            loadTransactions();
          }}
        />
      )}

      {selectedBill && (
        <Dialog open={!!selectedBill} onOpenChange={() => setSelectedBill(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bill Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vendor</p>
                  <p className="text-sm">{selectedBill.vendors?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Invoice Number</p>
                  <p className="text-sm">{selectedBill.invoice_number || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="text-sm">{new Date(selectedBill.issue_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Amount</p>
                  <p className="text-sm font-semibold">${formatNumber(selectedBill.amount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={selectedBill.status === 'paid' ? 'default' : 'secondary'}>
                    {selectedBill.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm">{selectedBill.description || "N/A"}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => navigate(`/bills/${selectedBill.id}`)}>
                  View Full Details
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
