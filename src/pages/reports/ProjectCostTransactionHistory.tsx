import { useEffect, useState, useCallback, useMemo } from "react";
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
import { CalendarIcon, Download, FileSpreadsheet, Filter, X, ChevronDown, ChevronRight } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { autoFitColumns } from "@/utils/excelAutoFit";
import { CreditCardTransactionModal } from "@/components/CreditCardTransactionModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "bill" | "credit_card" | "journal_entry" | "subcontract" | "purchase_order";
  reference_number?: string;
  job_name?: string;
  cost_code?: string;
  cost_code_id?: string;
  cost_code_description?: string;
  category?: string;
  vendor_name?: string;
  credit_card_name?: string;
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

interface JobBudgetSummary {
  cost_code_id: string;
  cost_code: string;
  description: string;
  budgeted: number;
  actual: number;
  committed: number;
}

// Normalize category names
const normalizeCategory = (category?: string): string => {
  if (!category) return "Other";
  const lower = category.toLowerCase().trim().replace(/_/g, " ");
  
  // Map "one time" and other variations to proper names
  if (lower === "one time" || lower === "onetime" || lower === "one-time") {
    return "Subcontract";
  }
  if (lower === "labor") return "Labor";
  if (lower === "material" || lower === "materials") return "Material";
  if (lower === "equipment") return "Equipment";
  if (lower === "sub" || lower === "subcontract" || lower === "subcontracts") return "Subcontract";
  if (lower === "po" || lower === "purchase order" || lower === "purchase orders") return "Purchase Order";
  if (lower === "other") return "Other";
  
  // Default to using the cost code type if it's a known category
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
};

export default function ProjectCostTransactionHistory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  
  const urlJobId = searchParams.get("jobId");
  const urlCostCodeId = searchParams.get("costCodeId");
  const urlJobName = searchParams.get("jobName");
  const urlCostCodeDescription = searchParams.get("costCodeDescription");
  
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
  const [jobBudgetSummary, setJobBudgetSummary] = useState<JobBudgetSummary[]>([]);
  const [expandedCostCodes, setExpandedCostCodes] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentCompany?.id) {
      loadFilterData();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (selectedJobId && currentCompany?.id) {
      loadCostCodesForJob(selectedJobId);
      loadJobBudgetSummary(selectedJobId);
    } else {
      setCostCodes([]);
      setSelectedCostCodeId("");
      setJobBudgetSummary([]);
    }
  }, [selectedJobId, currentCompany?.id]);

  useEffect(() => {
    if (selectedCostCodeId && selectedCostCodeId !== "all") {
      resolveCostCodeId(selectedCostCodeId);
    } else {
      setResolvedCostCodeId(null);
    }
  }, [selectedCostCodeId]);

  useEffect(() => {
    if (selectedJobId) {
      loadTransactions();
    }
  }, [selectedJobId, resolvedCostCodeId]);

  useEffect(() => {
    applyFilters();
  }, [transactions, selectedType, selectedCategory, dateFrom, dateTo]);

  // Expand all cost codes by default when data loads
  useEffect(() => {
    if (filteredTransactions.length > 0) {
      const allCostCodes = new Set(filteredTransactions.map(t => t.cost_code || "uncategorized"));
      setExpandedCostCodes(allCostCodes);
    }
  }, [filteredTransactions]);

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

  const loadJobBudgetSummary = async (jobId: string) => {
    try {
      const { data: budgets, error } = await supabase
        .from("job_budgets")
        .select(`
          id,
          cost_code_id,
          budgeted_amount,
          actual_amount,
          committed_amount,
          cost_codes(id, code, description)
        `)
        .eq("job_id", jobId)
        .not("cost_code_id", "is", null);

      if (error) throw error;

      const summary: JobBudgetSummary[] = (budgets || []).map((b: any) => ({
        cost_code_id: b.cost_code_id,
        cost_code: b.cost_codes?.code || "",
        description: b.cost_codes?.description || "",
        budgeted: Number(b.budgeted_amount) || 0,
        actual: Number(b.actual_amount) || 0,
        committed: Number(b.committed_amount) || 0,
      }));

      setJobBudgetSummary(summary.sort((a, b) => a.cost_code.localeCompare(b.cost_code)));
    } catch (error) {
      console.error("Error loading job budget summary:", error);
    }
  };

  const resolveCostCodeId = async (costCodeId: string) => {
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

      // Build queries
      let journalQuery = supabase
        .from("journal_entry_lines")
        .select(`
          id, debit_amount, credit_amount, description, cost_code_id, account_id,
          journal_entries!inner(id, entry_date, reference, description, status),
          jobs(name),
          cost_codes(id, code, description, type),
          chart_of_accounts(id, account_name, account_number)
        `)
        .eq("job_id", selectedJobId);
      
      if (actualCostCodeId) {
        journalQuery = journalQuery.eq("cost_code_id", actualCostCodeId);
      }

      let billsQuery = supabase
        .from("invoices")
        .select(`
          id, invoice_number, issue_date, amount, description, status, bill_category, cost_code_id, subcontract_id,
          jobs(name),
          cost_codes(id, code, description, type),
          subcontracts(id, name),
          vendors(id, name)
        `)
        .eq("job_id", selectedJobId);
      
      if (actualCostCodeId) {
        billsQuery = billsQuery.eq("cost_code_id", actualCostCodeId);
      }

      // Credit card distributions - get ALL (both posted and not posted)
      let ccQuery = supabase
        .from("credit_card_transaction_distributions")
        .select(`
          id, amount, transaction_id, cost_code_id,
          jobs(name),
          cost_codes(id, code, description, type),
          credit_card_transactions(
            id, transaction_date, amount, description, reference_number, coding_status, category, journal_entry_id, vendor_id,
            credit_cards(id, card_name),
            vendors(id, name)
          )
        `)
        .eq("job_id", selectedJobId);
      
      if (actualCostCodeId) {
        ccQuery = ccQuery.eq("cost_code_id", actualCostCodeId);
      }

      // Also fetch credit cards with their liability accounts for detection
      const ccCardsQuery = supabase
        .from("credit_cards")
        .select("id, card_name, liability_account_id")
        .eq("company_id", currentCompany!.id);

      const [journalRes, billsRes, ccRes, ccCardsRes] = await Promise.all([
        journalQuery,
        billsQuery,
        ccQuery,
        ccCardsQuery,
      ]);

      if (journalRes.error) throw journalRes.error;
      if (billsRes.error) throw billsRes.error;
      if (ccRes.error) throw ccRes.error;

      const journalLines = journalRes.data || [];
      const bills = billsRes.data || [];
      const ccDistributions = ccRes.data || [];
      const creditCards = ccCardsRes.data || [];

      // Build a map of liability_account_id -> credit card name for detecting CC transactions
      const liabilityAccountToCardMap = new Map<string, string>();
      creditCards.forEach((card: any) => {
        if (card.liability_account_id) {
          liabilityAccountToCardMap.set(card.liability_account_id, card.card_name);
        }
      });

      // Build a map of journal_entry_id -> credit card info for posted CC transactions
      const postedCCMap = new Map<string, { credit_card_name?: string; vendor_name?: string }>();
      ccDistributions.forEach((dist: any) => {
        if (dist.credit_card_transactions?.journal_entry_id) {
          postedCCMap.set(dist.credit_card_transactions.journal_entry_id, {
            credit_card_name: dist.credit_card_transactions?.credit_cards?.card_name,
            vendor_name: dist.credit_card_transactions?.vendors?.name,
          });
        }
      });

      // Group journal lines by journal_entry_id to check for credit lines to CC liability accounts
      const journalEntryToCCMap = new Map<string, string>();
      journalLines.forEach((jl: any) => {
        // Check if this is a credit line to a CC liability account
        if (jl.credit_amount > 0 && jl.account_id) {
          const cardName = liabilityAccountToCardMap.get(jl.account_id);
          if (cardName) {
            journalEntryToCCMap.set(jl.journal_entries?.id, cardName);
          }
        }
      });

      const allTransactions: Transaction[] = [
        // Journal entry lines (debit amounts are expenses)
        ...journalLines
          .filter((jl: any) => jl.debit_amount > 0)
          .map((jl: any) => {
            // Check if this journal entry came from a credit card transaction
            const ccInfo = postedCCMap.get(jl.journal_entries?.id);
            // Also check if the journal entry credits a CC liability account (fallback detection)
            const ccCardName = ccInfo?.credit_card_name || journalEntryToCCMap.get(jl.journal_entries?.id);
            // For vendor, use CC info if available, otherwise fall back to description for merchant text
            const vendorName = ccInfo?.vendor_name || (ccCardName ? (jl.description || undefined) : undefined);
            
            return {
              id: jl.id,
              date: jl.journal_entries?.entry_date || "",
              description: jl.description || jl.journal_entries?.description || "Journal Entry",
              amount: Number(jl.debit_amount) || 0,
              type: "journal_entry" as const,
              reference_number: jl.journal_entries?.reference || undefined,
              job_name: jl.jobs?.name || "",
              cost_code: jl.cost_codes?.code || "",
              cost_code_id: jl.cost_code_id || "",
              cost_code_description: jl.cost_codes?.description || "",
              category: normalizeCategory(jl.cost_codes?.type),
              vendor_name: vendorName,
              credit_card_name: ccCardName,
            };
          }),
        // Bills not yet posted
        ...bills
          .filter((bill: any) => bill.status !== 'posted')
          .map((bill: any) => {
            // Determine category - prioritize cost code type, then bill_category
            // Cost code type is more specific and accurate
            let category = bill.cost_codes?.type || bill.bill_category;
            if (bill.subcontract_id) {
              category = "Subcontract";
            }
            return {
              id: bill.id,
              date: bill.issue_date || "",
              description: bill.description || (bill.subcontracts?.name ? `Subcontract: ${bill.subcontracts.name}` : "Bill"),
              amount: Number(bill.amount) || 0,
              type: bill.subcontract_id ? "subcontract" as const : "bill" as const,
              reference_number: bill.invoice_number || undefined,
              job_name: bill.jobs?.name || "",
              cost_code: bill.cost_codes?.code || "",
              cost_code_id: bill.cost_code_id || "",
              cost_code_description: bill.cost_codes?.description || "",
              category: normalizeCategory(category),
              vendor_name: bill.vendors?.name || undefined,
            };
          }),
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
            cost_code_id: dist.cost_code_id || "",
            cost_code_description: dist.cost_codes?.description || "",
            category: normalizeCategory(dist.credit_card_transactions?.category || dist.cost_codes?.type),
            vendor_name: dist.credit_card_transactions?.vendors?.name || undefined,
            credit_card_name: dist.credit_card_transactions?.credit_cards?.card_name || undefined,
          })),
      ];

      allTransactions.sort((a, b) => {
        // Sort by cost code first, then by category, then by date
        const codeCompare = (a.cost_code || "").localeCompare(b.cost_code || "");
        if (codeCompare !== 0) return codeCompare;
        const catCompare = (a.category || "").localeCompare(b.category || "");
        if (catCompare !== 0) return catCompare;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
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
  }, [selectedJobId, resolvedCostCodeId, currentCompany?.id, toast]);

  const applyFilters = () => {
    let filtered = [...transactions];

    if (selectedType !== "all") {
      filtered = filtered.filter(t => t.type === selectedType);
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(t => 
        t.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (dateFrom) {
      filtered = filtered.filter(t => new Date(t.date) >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(t => new Date(t.date) <= dateTo);
    }

    setFilteredTransactions(filtered);
    setTotalAmount(filtered.reduce((sum, t) => sum + t.amount, 0));
  };

  // Group transactions by cost code, then by category
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Record<string, Transaction[]>> = {};
    
    filteredTransactions.forEach(t => {
      const costCodeKey = t.cost_code || "uncategorized";
      const categoryKey = t.category || "Other";
      
      if (!groups[costCodeKey]) {
        groups[costCodeKey] = {};
      }
      if (!groups[costCodeKey][categoryKey]) {
        groups[costCodeKey][categoryKey] = [];
      }
      groups[costCodeKey][categoryKey].push(t);
    });

    // Sort cost codes
    const sortedCostCodes = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    
    return sortedCostCodes.map(costCode => {
      const categories = groups[costCode];
      const categoryOrder = ["Labor", "Material", "Equipment", "Subcontract", "Purchase Order", "Other"];
      const sortedCategories = Object.keys(categories).sort((a, b) => {
        const aIndex = categoryOrder.indexOf(a);
        const bIndex = categoryOrder.indexOf(b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });

      const costCodeTotal = Object.values(categories).flat().reduce((sum, t) => sum + t.amount, 0);
      const firstTransaction = Object.values(categories).flat()[0];
      
      return {
        costCode,
        costCodeDescription: firstTransaction?.cost_code_description || "",
        costCodeTotal,
        categories: sortedCategories.map(cat => ({
          category: cat,
          transactions: categories[cat],
          total: categories[cat].reduce((sum, t) => sum + t.amount, 0),
        })),
      };
    });
  }, [filteredTransactions]);

  const clearFilters = () => {
    setSelectedType("all");
    setSelectedCategory("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleTransactionClick = async (transaction: Transaction) => {
    if (transaction.type === "bill" || transaction.type === "subcontract") {
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
    } else if (transaction.type === "credit_card") {
      // Unposted credit card transaction
      setSelectedTransaction(transaction);
    } else if (transaction.type === "journal_entry" && transaction.credit_card_name) {
      // Posted credit card transaction - find the original CC transaction
      const { data: ccTxn } = await supabase
        .from("credit_card_transactions")
        .select("id")
        .eq("description", transaction.description)
        .maybeSingle();
      
      if (ccTxn) {
        setSelectedTransaction({ ...transaction, id: ccTxn.id });
      } else {
        // Fallback - navigate to journal entries
        navigate(`/accounting/journal-entries`);
      }
    } else {
      // Regular journal entry - navigate to journal entries page
      navigate(`/accounting/journal-entries`);
    }
  };

  const toggleCostCode = (costCode: string) => {
    setExpandedCostCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(costCode)) {
        newSet.delete(costCode);
      } else {
        newSet.add(costCode);
      }
      return newSet;
    });
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const getSelectedJobName = () => {
    const job = jobs.find(j => j.id === selectedJobId);
    return job ? job.name : urlJobName || "";
  };

  const getSelectedCostCodeDescription = () => {
    const cc = costCodes.find(c => c.id === selectedCostCodeId);
    return cc ? `${cc.code} - ${cc.description}` : urlCostCodeDescription || "";
  };

  const getCategoryBadge = (category?: string) => {
    if (!category) return <span className="text-muted-foreground">-</span>;
    const variants: Record<string, string> = {
      "Labor": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      "Material": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      "Equipment": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      "Subcontract": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      "Purchase Order": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
      "Other": "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    };
    return (
      <Badge className={variants[category] || variants.Other}>
        {category}
      </Badge>
    );
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Project Cost Transaction History", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Job: ${getSelectedJobName()}`, 14, 25);
    doc.text(`Total Amount: $${formatNumber(totalAmount)}`, 14, 30);
    
    let yPos = 40;
    
    groupedTransactions.forEach(group => {
      // Cost code header
      doc.setFontSize(11);
      doc.setFont(undefined as any, "bold");
      doc.text(`${group.costCode} - ${group.costCodeDescription}`, 14, yPos);
      doc.text(`$${formatNumber(group.costCodeTotal)}`, 180, yPos, { align: "right" });
      yPos += 6;
      
      group.categories.forEach(cat => {
        const tableData = cat.transactions.map(t => {
          // Determine the type label - use credit card name if available
          let typeLabel = "Posted";
          if (t.type === "bill") typeLabel = "Bill";
          else if (t.type === "subcontract") typeLabel = "Subcontract";
          else if (t.type === "credit_card") typeLabel = t.credit_card_name || "CC";
          else if (t.credit_card_name) typeLabel = t.credit_card_name; // For posted CC transactions
          
          return [
            new Date(t.date).toLocaleDateString(),
            typeLabel,
            t.vendor_name || "-",
            t.reference_number || "-",
            t.description.substring(0, 35),
            `$${formatNumber(t.amount)}`,
          ];
        });
        
        autoTable(doc, {
          startY: yPos,
          head: [[cat.category, "", "", "", "", `$${formatNumber(cat.total)}`]],
          body: tableData,
          theme: "plain",
          headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [239, 246, 255] }, // Light blue for alternating rows
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 25 },
            2: { cellWidth: 30 },
            5: { halign: "right" },
          },
          margin: { left: 20 },
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 4;
      });
      
      yPos += 4;
    });
    
    doc.save(`project-cost-transactions-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  const exportToExcel = () => {
    const worksheetData: any[][] = [
      ["Project Cost Transaction History"],
      [],
      ["Job:", getSelectedJobName()],
      ["Total Amount:", `$${formatNumber(totalAmount)}`],
      [],
    ];

    groupedTransactions.forEach(group => {
      worksheetData.push([`${group.costCode} - ${group.costCodeDescription}`, "", "", "", "", "", `$${formatNumber(group.costCodeTotal)}`]);
      
      group.categories.forEach(cat => {
        worksheetData.push(["", cat.category, "", "", "", "", `$${formatNumber(cat.total)}`]);
        worksheetData.push(["", "Date", "Type", "Vendor", "Reference", "Description", "Amount"]);
        
        cat.transactions.forEach(t => {
          // Determine the type label - use credit card name if available
          let typeLabel = "Posted";
          if (t.type === "bill") typeLabel = "Bill";
          else if (t.type === "subcontract") typeLabel = "Subcontract";
          else if (t.type === "credit_card") typeLabel = t.credit_card_name || "Credit Card";
          else if (t.credit_card_name) typeLabel = t.credit_card_name; // For posted CC transactions

          worksheetData.push([
            "",
            new Date(t.date).toLocaleDateString(),
            typeLabel,
            t.vendor_name || "-",
            t.reference_number || "-",
            t.description,
            t.amount,
          ]);
        });
        worksheetData.push([]);
      });
      worksheetData.push([]);
    });

    // Add category summary with new columns
    worksheetData.push(["COST SUMMARY BY CATEGORY"]);
    worksheetData.push(["Category", "Previous Cost", "Current Cost", "Cost to Date", "Budget", "Difference", "% Used"]);
    categorySummary.forEach(s => {
      worksheetData.push([
        s.category,
        s.previousCost,
        s.currentCost,
        s.costToDate,
        s.budget,
        s.difference,
        `${s.percent.toFixed(1)}%`,
      ]);
    });
    const summaryTotals = categorySummary.reduce((acc, s) => ({
      previousCost: acc.previousCost + s.previousCost,
      currentCost: acc.currentCost + s.currentCost,
      costToDate: acc.costToDate + s.costToDate,
      budget: acc.budget + s.budget,
      difference: acc.difference + s.difference,
    }), { previousCost: 0, currentCost: 0, costToDate: 0, budget: 0, difference: 0 });
    const totalPercent = summaryTotals.budget > 0 ? (summaryTotals.costToDate / summaryTotals.budget) * 100 : 0;
    worksheetData.push([
      "TOTAL",
      summaryTotals.previousCost,
      summaryTotals.currentCost,
      summaryTotals.costToDate,
      summaryTotals.budget,
      summaryTotals.difference,
      `${totalPercent.toFixed(1)}%`,
    ]);
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    autoFitColumns(worksheet, worksheetData);
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    
    XLSX.writeFile(workbook, `project-cost-transactions-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Success", description: "Excel file exported successfully" });
  };

  const activeFilterCount = [
    selectedType !== "all",
    selectedCategory !== "all",
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  // Calculate summary totals by category with budget info
  const categorySummary = useMemo(() => {
    const categoryTotals: Record<string, { previousCost: number; currentCost: number; budget: number }> = {};
    
    // Calculate budgets by category from jobBudgetSummary
    jobBudgetSummary.forEach(budget => {
      // Get the cost code to determine category
      const costCode = costCodes.find(cc => cc.id === budget.cost_code_id);
      const category = normalizeCategory(costCode?.type);
      if (!categoryTotals[category]) {
        categoryTotals[category] = { previousCost: 0, currentCost: 0, budget: 0 };
      }
      categoryTotals[category].budget += budget.budgeted;
    });
    
    // Calculate current costs from transactions (filtered by date if applicable)
    filteredTransactions.forEach(t => {
      const cat = t.category || "Other";
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { previousCost: 0, currentCost: 0, budget: 0 };
      }
      categoryTotals[cat].currentCost += t.amount;
    });
    
    // Calculate previous costs (all transactions minus filtered transactions)
    // For now, previous = 0 and current = cost to date since we don't have period filtering
    // If date filters are applied, we could calculate previous as costs before the filter period
    
    // Sort by predefined order
    const categoryOrder = ["Labor", "Material", "Equipment", "Subcontract", "Purchase Order", "Other"];
    return Object.entries(categoryTotals)
      .sort((a, b) => {
        const aIndex = categoryOrder.indexOf(a[0]);
        const bIndex = categoryOrder.indexOf(b[0]);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      })
      .map(([category, data]) => {
        const costToDate = data.previousCost + data.currentCost;
        const difference = data.budget - costToDate;
        const percent = data.budget > 0 ? (costToDate / data.budget) * 100 : 0;
        return {
          category,
          previousCost: data.previousCost,
          currentCost: data.currentCost,
          costToDate,
          budget: data.budget,
          difference,
          percent,
        };
      });
  }, [filteredTransactions, jobBudgetSummary, costCodes]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Project Cost Transaction History</h1>
          {selectedJobId && (
            <p className="text-muted-foreground text-sm mt-1">
              {getSelectedJobName()}
              {selectedCostCodeId && selectedCostCodeId !== "all" && ` - ${getSelectedCostCodeDescription()}`}
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
                    <SelectItem value="subcontract">Subcontracts</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

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
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
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

      {/* Results - Grouped by Cost Code then Category */}
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
            <div className="space-y-4">
              {groupedTransactions.map((group) => (
                <Collapsible
                  key={group.costCode}
                  open={expandedCostCodes.has(group.costCode)}
                  onOpenChange={() => toggleCostCode(group.costCode)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                      <div className="flex items-center gap-2">
                        {expandedCostCodes.has(group.costCode) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-semibold font-mono">{group.costCode}</span>
                        <span className="text-muted-foreground">- {group.costCodeDescription}</span>
                      </div>
                      <span className="font-semibold">${formatNumber(group.costCodeTotal)}</span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pl-6 pt-2 space-y-3">
                      {group.categories.map((cat) => {
                        const catKey = `${group.costCode}-${cat.category}`;
                        const isCatExpanded = expandedCategories.has(catKey);
                        
                        return (
                          <div key={cat.category} className="border rounded-lg overflow-hidden">
                            <div 
                              className="flex items-center justify-between p-2 bg-background cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={() => toggleCategory(catKey)}
                            >
                              <div className="flex items-center gap-2">
                                {isCatExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                {getCategoryBadge(cat.category)}
                                <span className="text-sm text-muted-foreground">
                                  ({cat.transactions.length} transactions)
                                </span>
                              </div>
                              <span className="font-medium">${formatNumber(cat.total)}</span>
                            </div>
                            
                            {isCatExpanded && (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[100px]">Date</TableHead>
                                    <TableHead className="w-[80px]">Type</TableHead>
                                    <TableHead className="w-[120px]">Vendor</TableHead>
                                    <TableHead className="w-[100px]">Reference</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right w-[100px]">Amount</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {cat.transactions.map((t) => (
                                    <TableRow
                                      key={`${t.type}-${t.id}`}
                                      className="cursor-pointer hover:bg-muted/50"
                                      onClick={() => handleTransactionClick(t)}
                                    >
                                      <TableCell className="text-sm">
                                        {new Date(t.date).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                          {t.type === "bill" ? "Bill" : 
                                           t.type === "subcontract" ? "Sub" :
                                           t.type === "credit_card" ? (t.credit_card_name || "CC") : 
                                           t.credit_card_name ? t.credit_card_name : "Posted"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-sm truncate max-w-[120px]">
                                        {t.vendor_name || "-"}
                                      </TableCell>
                                      <TableCell className="text-sm">{t.reference_number || "-"}</TableCell>
                                      <TableCell className="text-sm max-w-[250px] truncate">{t.description}</TableCell>
                                      <TableCell className="text-right font-medium">
                                        ${formatNumber(t.amount)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total Cost by Category Summary */}
      {selectedJobId && categorySummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cost Summary by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Previous Cost</TableHead>
                    <TableHead className="text-right">Current Cost</TableHead>
                    <TableHead className="text-right">Cost to Date</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead className="text-right">% Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categorySummary.map((s, idx) => (
                    <TableRow key={s.category} className={idx % 2 === 1 ? "bg-primary/5" : ""}>
                      <TableCell>{getCategoryBadge(s.category)}</TableCell>
                      <TableCell className="text-right">${formatNumber(s.previousCost)}</TableCell>
                      <TableCell className="text-right">${formatNumber(s.currentCost)}</TableCell>
                      <TableCell className="text-right font-medium">${formatNumber(s.costToDate)}</TableCell>
                      <TableCell className="text-right">${formatNumber(s.budget)}</TableCell>
                      <TableCell className={`text-right ${s.difference < 0 ? "text-destructive" : "text-green-600"}`}>
                        ${formatNumber(s.difference)}
                      </TableCell>
                      <TableCell className={`text-right ${s.percent > 100 ? "text-destructive font-semibold" : ""}`}>
                        {s.percent.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {(() => {
                    const totals = categorySummary.reduce((acc, s) => ({
                      previousCost: acc.previousCost + s.previousCost,
                      currentCost: acc.currentCost + s.currentCost,
                      costToDate: acc.costToDate + s.costToDate,
                      budget: acc.budget + s.budget,
                      difference: acc.difference + s.difference,
                    }), { previousCost: 0, currentCost: 0, costToDate: 0, budget: 0, difference: 0 });
                    const totalPercent = totals.budget > 0 ? (totals.costToDate / totals.budget) * 100 : 0;
                    return (
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.previousCost)}</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.currentCost)}</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.costToDate)}</TableCell>
                        <TableCell className="text-right">${formatNumber(totals.budget)}</TableCell>
                        <TableCell className={`text-right ${totals.difference < 0 ? "text-destructive" : "text-green-600"}`}>
                          ${formatNumber(totals.difference)}
                        </TableCell>
                        <TableCell className={`text-right ${totalPercent > 100 ? "text-destructive" : ""}`}>
                          {totalPercent.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
