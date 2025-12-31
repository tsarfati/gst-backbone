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
  budgeted: number;
  actual: number;
  committed: number;
  remaining: number;
  percent_used: number;
  is_dynamic_group: boolean;
  parent_cost_code_id: string | null;
  dynamic_parent_code?: string;
  dynamic_parent_budget?: number;
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

      // First get all cost codes to understand hierarchy
      const { data: costCodesData } = await supabase
        .from("cost_codes")
        .select("id, code, description, is_dynamic_group, parent_cost_code_id, job_id")
        .eq("company_id", currentCompany!.id)
        .eq("is_active", true);

      // Create lookup maps
      const costCodeMap = new Map(costCodesData?.map(cc => [cc.id, cc]) || []);
      const dynamicParentIds = new Set(
        costCodesData?.filter(cc => cc.is_dynamic_group).map(cc => cc.id) || []
      );

      let query = supabase
        .from("job_budgets")
        .select(`
          id, job_id, cost_code_id, budgeted_amount, actual_amount, committed_amount,
          jobs!inner(id, name, company_id),
          cost_codes!inner(id, code, description, is_dynamic_group, parent_cost_code_id)
        `)
        .eq("jobs.company_id", currentCompany!.id);

      if (selectedJob !== "all") {
        query = query.eq("job_id", selectedJob);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter out dynamic group parent codes, only show their children
      const lines: BudgetLine[] = (data || [])
        .filter((item: any) => {
          // Exclude dynamic group parent codes
          if (item.cost_codes?.is_dynamic_group) return false;
          return true;
        })
        .map((item: any) => {
          const budgeted = item.budgeted_amount || 0;
          const actual = item.actual_amount || 0;
          const committed = item.committed_amount || 0;
          const remaining = budgeted - actual - committed;
          const percentUsed = budgeted > 0 ? ((actual + committed) / budgeted) * 100 : 0;

          // Check if this code has a dynamic parent
          const parentId = item.cost_codes?.parent_cost_code_id;
          const parentCode = parentId ? costCodeMap.get(parentId) : null;
          const hasDynamicParent = parentCode?.is_dynamic_group || false;

          // Get dynamic parent info if applicable
          let dynamicParentCode: string | undefined;
          let dynamicParentBudget: number | undefined;
          if (hasDynamicParent && parentCode) {
            dynamicParentCode = parentCode.code;
            // Find the budget for the dynamic parent
            const parentBudget = data?.find((d: any) => d.cost_code_id === parentId);
            dynamicParentBudget = parentBudget?.budgeted_amount || 0;
          }

          return {
            id: item.id,
            job_id: item.job_id,
            job_name: item.jobs?.name || "-",
            cost_code: item.cost_codes?.code || "-",
            cost_code_id: item.cost_codes?.id || "",
            cost_code_description: item.cost_codes?.description || "-",
            budgeted,
            actual,
            committed,
            remaining,
            percent_used: percentUsed,
            is_dynamic_group: item.cost_codes?.is_dynamic_group || false,
            parent_cost_code_id: item.cost_codes?.parent_cost_code_id,
            dynamic_parent_code: dynamicParentCode,
            dynamic_parent_budget: dynamicParentBudget,
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

  const totals = budgetLines.reduce(
    (acc, line) => ({
      budgeted: acc.budgeted + line.budgeted,
      actual: acc.actual + line.actual,
      committed: acc.committed + line.committed,
      remaining: acc.remaining + line.remaining,
    }),
    { budgeted: 0, actual: 0, committed: 0, remaining: 0 }
  );

  const overBudgetCount = budgetLines.filter(l => l.remaining < 0).length;

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
                        <div className="flex items-center gap-2">
                          {line.cost_code}
                          {line.dynamic_parent_code && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
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
                      <TableCell className={`text-right font-medium ${getStatusColor(line.remaining, line.budgeted)}`}>
                        ${formatNumber(line.remaining)}
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
