import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Download, FileSpreadsheet, Filter, AlertTriangle } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BudgetLine {
  id: string;
  job_id: string;
  job_name: string;
  cost_code: string;
  cost_code_id: string;
  cost_code_description: string;
  cost_code_type?: string | null;
  budgeted: number;
  actual: number;
  committed: number;
  remaining: number;
  percent_used: number;
  // Dynamic budget metadata (when this line is a child of a dynamic group)
  dynamic_parent_budget_id?: string;
  dynamic_parent_code?: string;
  dynamic_parent_budget?: number;
  dynamic_group_spent?: number;
  dynamic_group_remaining?: number;
}

interface Job {
  id: string;
  name: string;
}

export default function ProjectCostBudgetStatus() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      loadJobs();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (currentCompany?.id) {
      loadBudgetData();
    }
  }, [currentCompany?.id, selectedJob]);

  const loadJobs = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("id, name")
      .eq("company_id", currentCompany!.id)
      .order("name");
    setJobs(data || []);
  };

  const loadBudgetData = async () => {
    try {
      setLoading(true);

      // Base budgets query
      let budgetsQuery = supabase
        .from("job_budgets")
        .select(
          `
          id,
          job_id,
          cost_code_id,
          budgeted_amount,
          is_dynamic,
          parent_budget_id,
          jobs!inner(id, name, company_id),
          cost_codes!inner(id, code, description, type)
        `
        )
        .eq("jobs.company_id", currentCompany!.id);

      // Posted journal entry lines = actuals (debit amounts for expenses)
      let actualsQuery = supabase
        .from("journal_entry_lines")
        .select(
          `
          id,
          job_id,
          cost_code_id,
          debit_amount,
          journal_entries!inner(status, company_id)
        `
        )
        .eq("journal_entries.company_id", currentCompany!.id)
        .eq("journal_entries.status", "posted")
        .gt("debit_amount", 0);

      // Paid invoices NOT linked to subcontracts or POs (for actuals)
      let paidInvoicesQuery = supabase
        .from("invoices")
        .select("id, job_id, cost_code_id, amount, subcontract_id, purchase_order_id, vendors!inner(company_id)")
        .eq("vendors.company_id", currentCompany!.id)
        .eq("status", "paid")
        .is("subcontract_id", null)
        .is("purchase_order_id", null);

      // Subcontracts = committed (cost_distribution is JSONB with cost_code_id and amount)
      let subcontractsQuery = supabase
        .from("subcontracts")
        .select(
          `
          id,
          job_id,
          cost_distribution,
          status,
          jobs!inner(company_id)
        `
        )
        .eq("jobs.company_id", currentCompany!.id)
        .neq("status", "cancelled");

      // Purchase orders = committed
      let purchaseOrdersQuery = (supabase as any)
        .from("purchase_orders")
        .select("id, job_id, cost_code_id, amount, status, jobs!inner(company_id)")
        .eq("jobs.company_id", currentCompany!.id)
        .neq("status", "cancelled");

      if (selectedJob !== "all") {
        budgetsQuery = budgetsQuery.eq("job_id", selectedJob);
        actualsQuery = actualsQuery.eq("job_id", selectedJob);
        paidInvoicesQuery = paidInvoicesQuery.eq("job_id", selectedJob);
        subcontractsQuery = subcontractsQuery.eq("job_id", selectedJob);
        purchaseOrdersQuery = purchaseOrdersQuery.eq("job_id", selectedJob);
      }

      const [
        { data: budgetRows, error: budgetsError },
        { data: actualRows, error: actualsError },
        { data: paidInvoiceRows, error: paidInvoicesError },
        { data: subcontractRows, error: subcontractsError },
        { data: purchaseOrderRows, error: purchaseOrdersError },
      ] = await Promise.all([budgetsQuery, actualsQuery, paidInvoicesQuery, subcontractsQuery, purchaseOrdersQuery]);

      if (budgetsError) throw budgetsError;
      if (actualsError) throw actualsError;
      if (paidInvoicesError) throw paidInvoicesError;
      if (subcontractsError) throw subcontractsError;
      if (purchaseOrdersError) throw purchaseOrdersError;

      const data = budgetRows || [];

      // Build actuals map from posted journal entry lines
      const actualsMap = new Map<string, number>();
      (actualRows || []).forEach((jl: any) => {
        if (!jl.job_id || !jl.cost_code_id) return;
        const key = `${jl.job_id}:${jl.cost_code_id}`;
        actualsMap.set(key, (actualsMap.get(key) || 0) + Number(jl.debit_amount || 0));
      });

      // Add paid invoices (not linked to subcontracts/POs) to actuals
      (paidInvoiceRows || []).forEach((inv: any) => {
        if (!inv.job_id || !inv.cost_code_id) return;
        const key = `${inv.job_id}:${inv.cost_code_id}`;
        actualsMap.set(key, (actualsMap.get(key) || 0) + Number(inv.amount || 0));
      });

      // Build committed map from subcontracts (cost_distribution JSONB) + purchase orders
      const committedMap = new Map<string, number>();
      
      // Process subcontracts with cost_distribution
      (subcontractRows || []).forEach((sub: any) => {
        if (!sub.job_id || !sub.cost_distribution) return;
        const distribution = sub.cost_distribution;
        if (Array.isArray(distribution)) {
          distribution.forEach((dist: any) => {
            if (!dist.cost_code_id) return;
            const key = `${sub.job_id}:${dist.cost_code_id}`;
            committedMap.set(key, (committedMap.get(key) || 0) + Number(dist.amount || 0));
          });
        }
      });

      // Add purchase orders to committed
      (purchaseOrderRows || []).forEach((po: any) => {
        if (!po.job_id || !po.cost_code_id) return;
        const key = `${po.job_id}:${po.cost_code_id}`;
        committedMap.set(key, (committedMap.get(key) || 0) + Number(po.amount || 0));
      });

      // Dynamic budgets are determined by job_budgets.parent_budget_id
      // Build a map of parent budget id -> parent budget info
      const dynamicParents = new Map<
        string,
        {
          budgetId: string;
          jobId: string;
          code: string;
          budget: number;
        }
      >();

      // First pass: identify dynamic parent budgets (is_dynamic = true)
      data.forEach((item: any) => {
        if (item.is_dynamic === true) {
          dynamicParents.set(item.id, {
            budgetId: item.id,
            jobId: item.job_id,
            code: item.cost_codes?.code || "",
            budget: Number(item.budgeted_amount || 0),
          });
        }
      });

      // Build map: child budget -> parent budget id
      const childToParent = new Map<string, string>();
      data.forEach((item: any) => {
        if (item.parent_budget_id && dynamicParents.has(item.parent_budget_id)) {
          childToParent.set(item.id, item.parent_budget_id);
        }
      });

      // Sum spend (actual + committed) of children per dynamic group
      const groupSpentMap = new Map<string, number>();
      data
        .filter((item: any) => item.is_dynamic !== true)
        .forEach((item: any) => {
          const parentBudgetId = item.parent_budget_id as string | null;
          if (!parentBudgetId || !dynamicParents.has(parentBudgetId)) return;

          const actual = actualsMap.get(`${item.job_id}:${item.cost_code_id}`) || 0;
          const committed = committedMap.get(`${item.job_id}:${item.cost_code_id}`) || 0;
          const spent = actual + committed;

          groupSpentMap.set(parentBudgetId, (groupSpentMap.get(parentBudgetId) || 0) + spent);
        });

      // Filter out dynamic parents from the list - show children (and regular codes)
      const lines: BudgetLine[] = data
        .filter((item: any) => item.is_dynamic !== true)
        .map((item: any) => {
          const actual = actualsMap.get(`${item.job_id}:${item.cost_code_id}`) || 0;
          const committed = committedMap.get(`${item.job_id}:${item.cost_code_id}`) || 0;
          const budgeted = Number(item.budgeted_amount || 0);
          const remaining = budgeted - actual - committed;

          // Default percent used: line-based
          let percentUsed = budgeted > 0 ? ((actual + committed) / budgeted) * 100 : 0;

          let dynamicParentCode: string | undefined;
          let dynamicParentBudget: number | undefined;
          let dynamicParentBudgetId: string | undefined;
          let dynamicGroupSpent: number | undefined;
          let dynamicGroupRemaining: number | undefined;

          // Check if this budget has a dynamic parent via parent_budget_id
          const parentBudgetId = item.parent_budget_id as string | null;
          if (parentBudgetId && dynamicParents.has(parentBudgetId)) {
            const parent = dynamicParents.get(parentBudgetId)!;
            const groupSpent = groupSpentMap.get(parentBudgetId) || 0;

            dynamicParentBudgetId = parentBudgetId;
            dynamicParentCode = parent.code;
            dynamicParentBudget = parent.budget;
            dynamicGroupSpent = groupSpent;
            dynamicGroupRemaining = parent.budget - groupSpent;

            // For dynamic children: % used is group-based
            percentUsed = parent.budget > 0 ? (groupSpent / parent.budget) * 100 : 0;
          }

          return {
            id: item.id,
            job_id: item.job_id,
            job_name: item.jobs?.name || "-",
            cost_code: item.cost_codes?.code || "-",
            cost_code_id: item.cost_codes?.id || "",
            cost_code_description: item.cost_codes?.description || "-",
            cost_code_type: item.cost_codes?.type ?? null,
            budgeted,
            actual,
            committed,
            remaining,
            percent_used: percentUsed,
            dynamic_parent_budget_id: dynamicParentBudgetId,
            dynamic_parent_code: dynamicParentCode,
            dynamic_parent_budget: dynamicParentBudget,
            dynamic_group_spent: dynamicGroupSpent,
            dynamic_group_remaining: dynamicGroupRemaining,
          };
        });

      // Sort by job name, then cost code
      lines.sort((a, b) => {
        const jobCompare = a.job_name.localeCompare(b.job_name);
        if (jobCompare !== 0) return jobCompare;
        return a.cost_code.localeCompare(b.cost_code);
      });

      setBudgetLines(lines);
    } catch (error) {
      console.error("Error loading budget data:", error);
      toast({
        title: "Error",
        description: "Failed to load budget data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTypeLabel = (type?: string | null) => {
    if (!type) return null;
    const map: Record<string, string> = {
      labor: "Labor",
      material: "Material",
      materials: "Material",
      sub: "Sub",
      subcontract: "Sub",
      other: "Other",
    };
    return map[type] || (type.charAt(0).toUpperCase() + type.slice(1));
  };

  const totals = (() => {
    const seenDynamic = new Set<string>();

    return budgetLines.reduce(
      (acc, line) => {
        acc.actual += line.actual;
        acc.committed += line.committed;

        if (line.dynamic_parent_budget_id) {
          // Only count dynamic group budget/remaining once per group
          if (!seenDynamic.has(line.dynamic_parent_budget_id)) {
            seenDynamic.add(line.dynamic_parent_budget_id);
            const groupBudget = Number(line.dynamic_parent_budget ?? 0);
            const groupRemaining = Number(line.dynamic_group_remaining ?? 0);
            acc.budgeted += groupBudget;
            acc.remaining += groupRemaining;
          }
          // Don't add individual budgeted/remaining for dynamic children
        } else {
          acc.budgeted += line.budgeted;
          acc.remaining += line.remaining;
        }

        return acc;
      },
      { budgeted: 0, actual: 0, committed: 0, remaining: 0 }
    );
  })();

  const overBudgetCount = (() => {
    const seenDynamic = new Set<string>();

    return budgetLines.reduce((count, line) => {
      if (line.dynamic_parent_budget_id) {
        // Only count each dynamic group once for over-budget
        if (seenDynamic.has(line.dynamic_parent_budget_id)) return count;
        seenDynamic.add(line.dynamic_parent_budget_id);

        const groupRemaining = Number(line.dynamic_group_remaining ?? 0);
        return groupRemaining < 0 ? count + 1 : count;
      }

      return line.remaining < 0 ? count + 1 : count;
    }, 0);
  })();

  const getStatusColor = (remaining: number, budgeted: number) => {
    if (remaining < 0) return "text-red-600";
    if (budgeted > 0 && remaining / budgeted < 0.1) return "text-amber-600";
    return "text-green-600";
  };

  const getProgressColor = (percentUsed: number) => {
    if (percentUsed > 100) return "bg-red-500";
    if (percentUsed > 90) return "bg-amber-500";
    return "bg-green-500";
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    doc.setFontSize(18);
    doc.text("Project Cost Budget Status", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, 14, 28);
    doc.text(`Company: ${currentCompany?.name || ""}`, 14, 34);
    if (selectedJob !== "all") {
      const job = jobs.find(j => j.id === selectedJob);
      doc.text(`Project: ${job?.name || ""}`, 14, 40);
    }
    
    const tableData = budgetLines.map(line => [
      line.job_name,
      line.cost_code,
      line.cost_code_description.length > 30 ? line.cost_code_description.substring(0, 30) + "..." : line.cost_code_description,
      `$${formatNumber(line.budgeted)}`,
      `$${formatNumber(line.actual)}`,
      `$${formatNumber(line.committed)}`,
      `$${formatNumber(line.remaining)}`,
      `${line.percent_used.toFixed(1)}%`,
    ]);
    
    autoTable(doc, {
      startY: selectedJob !== "all" ? 46 : 40,
      head: [["Project", "Code", "Description", "Budget", "Actual", "Committed", "Remaining", "% Used"]],
      body: tableData,
      foot: [["", "", "Totals:", 
        `$${formatNumber(totals.budgeted)}`,
        `$${formatNumber(totals.actual)}`,
        `$${formatNumber(totals.committed)}`,
        `$${formatNumber(totals.remaining)}`,
        totals.budgeted > 0 ? `${(((totals.actual + totals.committed) / totals.budgeted) * 100).toFixed(1)}%` : "0%"
      ]],
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
      didParseCell: (data) => {
        // Highlight over-budget rows
        if (data.section === "body" && data.column.index === 6) {
          const remaining = budgetLines[data.row.index]?.remaining;
          if (remaining < 0) {
            data.cell.styles.textColor = [220, 38, 38];
          }
        }
      },
    });
    
    doc.save(`project-budget-status-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "Success", description: "PDF exported successfully" });
  };

  const exportToExcel = () => {
    const worksheetData = [
      ["Project Cost Budget Status"],
      [`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`],
      [`Company: ${currentCompany?.name || ""}`],
      [],
      ["Project", "Cost Code", "Description", "Budget", "Actual", "Committed", "Remaining", "% Used"],
      ...budgetLines.map(line => [
        line.job_name,
        line.cost_code,
        line.cost_code_description,
        line.budgeted,
        line.actual,
        line.committed,
        line.remaining,
        `${line.percent_used.toFixed(1)}%`,
      ]),
      [],
      ["", "", "Totals:", totals.budgeted, totals.actual, totals.committed, totals.remaining, 
        totals.budgeted > 0 ? `${(((totals.actual + totals.committed) / totals.budgeted) * 100).toFixed(1)}%` : "0%"
      ],
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Budget Status");
    XLSX.writeFile(workbook, `project-budget-status-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Success", description: "Excel file exported successfully" });
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
            <h1 className="text-2xl font-bold">Project Cost Budget Status</h1>
            <p className="text-muted-foreground text-sm">Budget vs actual costs comparison</p>
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
          <Button variant="outline" size="sm" onClick={exportToPDF} disabled={loading || budgetLines.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={loading || budgetLines.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(totals.budgeted)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Actual Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(totals.actual)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Committed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">${formatNumber(totals.committed)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.remaining < 0 ? "text-red-600" : "text-green-600"}`}>
              ${formatNumber(totals.remaining)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Over Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {overBudgetCount > 0 && <AlertTriangle className="h-5 w-5 text-red-500" />}
              <span className={`text-2xl font-bold ${overBudgetCount > 0 ? "text-red-600" : ""}`}>
                {overBudgetCount} items
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget Details ({budgetLines.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : budgetLines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No budget data found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Cost Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Committed</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="w-[150px]">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetLines.map((line) => (
                    <TableRow 
                      key={line.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/reports/project-cost-transaction-history?jobId=${line.job_id}&costCodeId=${line.id}&jobName=${encodeURIComponent(line.job_name)}&costCodeDescription=${encodeURIComponent(line.cost_code_description)}`)}
                    >
                      <TableCell>{line.job_name}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{line.cost_code}</span>

                          {line.cost_code_type && (
                            <Badge variant="outline" className="text-xs">
                              {formatTypeLabel(line.cost_code_type)}
                            </Badge>
                          )}

                          {line.dynamic_parent_code && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="text-xs">
                                  Dynamic
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Part of dynamic budget group: {line.dynamic_parent_code}</p>
                                {line.dynamic_parent_budget !== undefined && (
                                  <p>Group budget: ${formatNumber(line.dynamic_parent_budget)}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{line.cost_code_description}</TableCell>
                      <TableCell className="text-right">${formatNumber(line.budgeted)}</TableCell>
                      <TableCell className="text-right">${formatNumber(line.actual)}</TableCell>
                      <TableCell className="text-right text-amber-600">${formatNumber(line.committed)}</TableCell>
                      <TableCell className={`text-right font-medium ${
                        line.dynamic_parent_budget_id 
                          ? getStatusColor(line.dynamic_group_remaining ?? 0, line.dynamic_parent_budget ?? 0)
                          : getStatusColor(line.remaining, line.budgeted)
                      }`}>
                        {line.dynamic_parent_budget_id ? (
                          <Tooltip>
                            <TooltipTrigger>
                              ${formatNumber(line.dynamic_group_remaining ?? 0)}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Group remaining: ${formatNumber(line.dynamic_group_remaining ?? 0)}</p>
                              <p>This line actual: ${formatNumber(line.actual)}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          `$${formatNumber(line.remaining)}`
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={Math.min(line.percent_used, 100)} 
                            className="h-2 flex-1"
                          />
                          <span className={`text-xs min-w-[40px] ${line.percent_used > 100 ? "text-red-600 font-medium" : ""}`}>
                            {line.percent_used.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
