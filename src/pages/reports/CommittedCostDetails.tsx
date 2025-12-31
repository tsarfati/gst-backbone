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
import { Download, FileSpreadsheet, Filter, X } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface CommittedItem {
  id: string;
  type: "subcontract" | "purchase_order" | "bill" | "credit_card";
  name: string;
  vendor_name?: string;
  date: string;
  amount: number;
  status: string;
  cost_code?: string;
  cost_code_description?: string;
}

interface Job {
  id: string;
  name: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
}

export default function CommittedCostDetails() {
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
  const [showFilters, setShowFilters] = useState(!urlJobId);
  
  const [items, setItems] = useState<CommittedItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<CommittedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [resolvedCostCodeId, setResolvedCostCodeId] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany?.id) {
      loadFilterData();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (selectedJobId && currentCompany?.id) {
      loadCostCodesForJob(selectedJobId);
    } else {
      setCostCodes([]);
      setSelectedCostCodeId("");
    }
  }, [selectedJobId, currentCompany?.id]);

  useEffect(() => {
    if (selectedCostCodeId) {
      resolveCostCodeId(selectedCostCodeId);
    } else {
      setResolvedCostCodeId(null);
    }
  }, [selectedCostCodeId]);

  useEffect(() => {
    if (selectedJobId) {
      loadCommittedItems();
    }
  }, [selectedJobId, resolvedCostCodeId]);

  useEffect(() => {
    applyFilters();
  }, [items, selectedType]);

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
        .select("cost_code_id, cost_codes(id, code, description)")
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

  const loadCommittedItems = useCallback(async () => {
    if (!selectedJobId) return;
    
    try {
      setLoading(true);
      const actualCostCodeId = resolvedCostCodeId;
      const allItems: CommittedItem[] = [];

      // Load subcontracts
      const { data: subcontracts, error: subError } = await supabase
        .from("subcontracts")
        .select("id, name, contract_amount, cost_distribution, status, created_at, vendors(name)")
        .eq("job_id", selectedJobId)
        .not("status", "eq", "cancelled");

      if (subError) throw subError;

      // Get cost code info for display
      const costCodeMap = new Map<string, { code: string; description: string }>();
      if (subcontracts) {
        const costCodeIds = new Set<string>();
        subcontracts.forEach((sub: any) => {
          if (Array.isArray(sub.cost_distribution)) {
            sub.cost_distribution.forEach((dist: any) => {
              if (dist.cost_code_id) costCodeIds.add(dist.cost_code_id);
            });
          }
        });

        if (costCodeIds.size > 0) {
          const { data: ccData } = await supabase
            .from("cost_codes")
            .select("id, code, description")
            .in("id", Array.from(costCodeIds));
          
          (ccData || []).forEach((cc: any) => {
            costCodeMap.set(cc.id, { code: cc.code, description: cc.description });
          });
        }
      }

      // Process subcontracts
      (subcontracts || []).forEach((sub: any) => {
        const distribution = sub.cost_distribution;
        if (Array.isArray(distribution)) {
          distribution.forEach((dist: any) => {
            // Filter by cost code if specified
            if (actualCostCodeId && dist.cost_code_id !== actualCostCodeId) return;
            
            const cc = costCodeMap.get(dist.cost_code_id);
            allItems.push({
              id: sub.id,
              type: "subcontract",
              name: sub.name,
              vendor_name: sub.vendors?.name,
              date: sub.created_at,
              amount: Number(dist.amount || 0),
              status: sub.status,
              cost_code: cc?.code,
              cost_code_description: cc?.description,
            });
          });
        }
      });

      // Load unposted bills (invoices)
      let billsQuery = supabase
        .from("invoices")
        .select(`
          id, invoice_number, issue_date, amount, status,
          vendors(name),
          cost_codes(code, description)
        `)
        .eq("job_id", selectedJobId)
        .neq("status", "posted");

      if (actualCostCodeId) {
        billsQuery = billsQuery.eq("cost_code_id", actualCostCodeId);
      }

      const { data: bills, error: billsError } = await billsQuery;
      if (billsError) throw billsError;

      (bills || []).forEach((bill: any) => {
        allItems.push({
          id: bill.id,
          type: "bill",
          name: `Bill #${bill.invoice_number}`,
          vendor_name: bill.vendors?.name,
          date: bill.issue_date,
          amount: Number(bill.amount || 0),
          status: bill.status,
          cost_code: bill.cost_codes?.code,
          cost_code_description: bill.cost_codes?.description,
        });
      });

      // Load unposted credit card transactions
      let ccQuery = supabase
        .from("credit_card_transaction_distributions")
        .select(`
          id, amount,
          cost_codes(code, description),
          credit_card_transactions(
            id, description, transaction_date, journal_entry_id, coding_status
          )
        `)
        .eq("job_id", selectedJobId);

      if (actualCostCodeId) {
        ccQuery = ccQuery.eq("cost_code_id", actualCostCodeId);
      }

      const { data: ccDists, error: ccError } = await ccQuery;
      if (ccError) throw ccError;

      (ccDists || [])
        .filter((d: any) => !d.credit_card_transactions?.journal_entry_id)
        .forEach((dist: any) => {
          allItems.push({
            id: dist.credit_card_transactions?.id || dist.id,
            type: "credit_card",
            name: dist.credit_card_transactions?.description || "Credit Card",
            date: dist.credit_card_transactions?.transaction_date || "",
            amount: Number(dist.amount || 0),
            status: dist.credit_card_transactions?.coding_status || "pending",
            cost_code: dist.cost_codes?.code,
            cost_code_description: dist.cost_codes?.description,
          });
        });

      allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(allItems);
    } catch (error) {
      console.error("Error loading committed items:", error);
      toast({
        title: "Error",
        description: "Failed to load committed cost details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedJobId, resolvedCostCodeId, toast]);

  const applyFilters = () => {
    let filtered = [...items];

    if (selectedType !== "all") {
      filtered = filtered.filter(item => item.type === selectedType);
    }

    setFilteredItems(filtered);
    setTotalAmount(filtered.reduce((sum, item) => sum + item.amount, 0));
  };

  const clearFilters = () => {
    setSelectedType("all");
  };

  const getSelectedJobName = () => {
    const job = jobs.find(j => j.id === selectedJobId);
    return job ? job.name : urlJobName || "";
  };

  const getSelectedCostCodeDescription = () => {
    const cc = costCodes.find(c => c.id === selectedCostCodeId);
    return cc ? `${cc.code} - ${cc.description}` : urlCostCodeDescription || "";
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      subcontract: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      purchase_order: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      bill: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      credit_card: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    };
    const labels: Record<string, string> = {
      subcontract: "Subcontract",
      purchase_order: "PO",
      bill: "Bill",
      credit_card: "Credit Card",
    };
    return (
      <Badge className={variants[type] || "bg-gray-100 text-gray-800"}>
        {labels[type] || type}
      </Badge>
    );
  };

  const handleItemClick = (item: CommittedItem) => {
    if (item.type === "subcontract") {
      navigate(`/subcontracts/${item.id}`);
    } else if (item.type === "bill") {
      navigate(`/bills/${item.id}`);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Committed Cost Details", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Job: ${getSelectedJobName()}`, 14, 25);
    if (selectedCostCodeId) {
      doc.text(`Cost Code: ${getSelectedCostCodeDescription()}`, 14, 30);
    }
    doc.text(`Total Committed: $${formatNumber(totalAmount)}`, 14, selectedCostCodeId ? 35 : 30);
    
    const tableData = filteredItems.map(item => {
      const costCodeDisplay = item.cost_code 
        ? `${item.cost_code} - ${item.cost_code_description || ""}`
        : "-";
      return [
        new Date(item.date).toLocaleDateString(),
        item.type === "subcontract" ? "Subcontract" : 
          item.type === "purchase_order" ? "PO" : 
          item.type === "bill" ? "Bill" : "Credit Card",
        item.name,
        item.vendor_name || "-",
        costCodeDisplay,
        item.status,
        `$${formatNumber(item.amount)}`,
      ];
    });
    
    autoTable(doc, {
      startY: selectedCostCodeId ? 40 : 35,
      head: [["Date", "Type", "Name", "Vendor", "Cost Code", "Status", "Amount"]],
      body: tableData,
      foot: [["", "", "", "", "", "Total:", `$${formatNumber(totalAmount)}`]],
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    });
    
    doc.save(`committed-cost-details-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  const exportToExcel = () => {
    const worksheetData = [
      ["Committed Cost Details"],
      [],
      ["Job:", getSelectedJobName()],
      ...(selectedCostCodeId ? [["Cost Code:", getSelectedCostCodeDescription()]] : []),
      ["Total Committed:", `$${formatNumber(totalAmount)}`],
      [],
      ["Date", "Type", "Name", "Vendor", "Cost Code", "Status", "Amount"],
      ...filteredItems.map(item => {
        const costCodeDisplay = item.cost_code 
          ? `${item.cost_code} - ${item.cost_code_description || ""}`
          : "-";
        return [
          new Date(item.date).toLocaleDateString(),
          item.type === "subcontract" ? "Subcontract" : 
            item.type === "purchase_order" ? "PO" : 
            item.type === "bill" ? "Bill" : "Credit Card",
          item.name,
          item.vendor_name || "-",
          costCodeDisplay,
          item.status,
          item.amount,
        ];
      }),
      [],
      ["", "", "", "", "", "Total:", totalAmount],
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Committed Costs");
    
    XLSX.writeFile(workbook, `committed-cost-details-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Success", description: "Excel file exported successfully" });
  };

  const activeFilterCount = [selectedType !== "all"].filter(Boolean).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Committed Cost Details</h1>
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
            disabled={loading || filteredItems.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={loading || filteredItems.length === 0}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <Label>Commitment Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="subcontract">Subcontracts</SelectItem>
                    <SelectItem value="bill">Bills</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {activeFilterCount > 0 && (
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              Commitments
              {filteredItems.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filteredItems.length} items)
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
              Select a job to view committed costs
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No committed costs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Cost Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, index) => {
                  const costCodeDisplay = item.cost_code 
                    ? `${item.cost_code} - ${item.cost_code_description || ""}`
                    : "-";

                  return (
                    <TableRow
                      key={`${item.type}-${item.id}-${index}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleItemClick(item)}
                    >
                      <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                      <TableCell>{getTypeBadge(item.type)}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.vendor_name || "-"}</TableCell>
                      <TableCell>{costCodeDisplay}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${formatNumber(item.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
