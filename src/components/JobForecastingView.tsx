import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Save, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Percent, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber } from "@/utils/formatNumber";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BudgetForecastLine {
  id?: string;
  cost_code_id: string;
  code: string;
  description: string;
  budgeted_amount: number;
  actual_amount: number;
  committed_amount: number;
  calculated_percent: number;
  estimated_percent: number;
  notes?: string;
  updated_at?: string;
  updated_by_name?: string;
}

interface JobSummary {
  total_budgeted: number;
  total_spent: number;
  calculated_percent: number;
  estimated_percent: number;
}

export default function JobForecastingView() {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [forecastLines, setForecastLines] = useState<BudgetForecastLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadForecastData = useCallback(async () => {
    if (!id) return;

    try {
      // Load budget lines with cost code info
      const { data: budgets, error: budgetError } = await supabase
        .from('job_budgets')
        .select(`
          id,
          cost_code_id,
          budgeted_amount,
          actual_amount,
          committed_amount,
          is_dynamic,
          parent_budget_id,
          cost_codes (
            id,
            code,
            description,
            is_dynamic_group
          )
        `)
        .eq('job_id', id)
        .order('created_at', { ascending: true });

      if (budgetError) throw budgetError;

      // Load existing forecast data
      const { data: forecasts, error: forecastError } = await supabase
        .from('job_budget_forecasts')
        .select('*')
        .eq('job_id', id);

      if (forecastError) throw forecastError;

      // Load profile names for updated_by users
      const updatedByIds = [...new Set((forecasts || []).map(f => f.updated_by).filter(Boolean))];
      let profileMap = new Map<string, string>();
      
      if (updatedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', updatedByIds);
        
        profileMap = new Map(
          (profiles || []).map(p => [p.user_id, `${p.first_name || ''} ${p.last_name || ''}`.trim()])
        );
      }

      // Create a map of existing forecasts by cost_code_id
      const forecastMap = new Map(
        (forecasts || []).map(f => [f.cost_code_id, {
          ...f,
          updated_by_name: f.updated_by ? profileMap.get(f.updated_by) || null : null
        }])
      );

      // Check if there are any dynamic budgets
      const dynamicBudgets = (budgets || []).filter((b: any) => b.is_dynamic);
      const hasDynamicBudgets = dynamicBudgets.length > 0;

      // Helper to get actuals from journal entries AND paid invoices
      const getActualAmount = async (costCodeId: string): Promise<number> => {
        // Get from posted journal entry lines
        const { data: journalLines } = await supabase
          .from('journal_entry_lines')
          .select('debit_amount, journal_entries!inner(status)')
          .eq('job_id', id)
          .eq('cost_code_id', costCodeId)
          .eq('journal_entries.status', 'posted');

        const journalTotal = (journalLines || []).reduce(
          (sum, line) => sum + Number(line.debit_amount || 0), 0
        );

        // Get from paid invoices (these are actual costs)
        const { data: paidInvoices } = await supabase
          .from('invoices')
          .select('amount')
          .eq('job_id', id)
          .eq('cost_code_id', costCodeId)
          .eq('status', 'paid');

        const invoiceTotal = (paidInvoices || []).reduce(
          (sum, inv) => sum + Number(inv.amount || 0), 0
        );

        return journalTotal + invoiceTotal;
      };

      // Helper to get committed amounts from unpaid invoices, subcontracts, and POs
      const getCommittedAmount = async (costCodeId: string): Promise<number> => {
        let total = 0;

        // Unpaid invoices (pending, approved, pending_payment, etc.) - not paid, not cancelled
        const { data: unpaidInvoices } = await supabase
          .from('invoices')
          .select('amount, status')
          .eq('job_id', id)
          .eq('cost_code_id', costCodeId)
          .not('status', 'in', '("paid","cancelled")');

        total += (unpaidInvoices || []).reduce(
          (sum, inv) => sum + Number(inv.amount || 0), 0
        );

        // Subcontracts - check cost_distribution
        const { data: subcontracts } = await supabase
          .from('subcontracts')
          .select('contract_amount, cost_distribution')
          .eq('job_id', id)
          .not('status', 'eq', 'cancelled');

        (subcontracts || []).forEach((sub: any) => {
          const raw = sub.cost_distribution;
          let parsed: any = raw;
          if (typeof raw === 'string') {
            try { parsed = JSON.parse(raw); } catch { parsed = null; }
          }
          const items = Array.isArray(parsed) ? parsed : 
            (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) ? parsed.items : [];
          
          items.forEach((dist: any) => {
            if (dist?.cost_code_id === costCodeId) {
              total += Number(dist?.amount || 0);
            }
          });
        });

        // Purchase orders
        const { data: purchaseOrders } = await (supabase as any)
          .from('purchase_orders')
          .select('amount, status')
          .eq('job_id', id)
          .eq('cost_code_id', costCodeId);

        (purchaseOrders || []).forEach((po: any) => {
          if (po?.status !== 'cancelled') {
            total += Number(po?.amount || 0);
          }
        });

        return total;
      };

      let lines: BudgetForecastLine[] = [];

      if (hasDynamicBudgets) {
        // Show dynamic budget parents with aggregated child data
        lines = await Promise.all(
          dynamicBudgets.map(async (parent: any) => {
            // Find all children of this dynamic budget
            const children = (budgets || []).filter((b: any) => b.parent_budget_id === parent.id);
            
            // Aggregate child actuals and committed from live queries
            let totalActual = 0;
            let totalCommitted = 0;
            
            for (const child of children) {
              const childActual = await getActualAmount(child.cost_code_id);
              const childCommitted = await getCommittedAmount(child.cost_code_id);
              totalActual += childActual;
              totalCommitted += childCommitted;
            }

            // If no children, use parent's own values from live queries
            if (children.length === 0) {
              totalActual = await getActualAmount(parent.cost_code_id);
              totalCommitted = await getCommittedAmount(parent.cost_code_id);
            }

            const budgeted = Number(parent.budgeted_amount || 0);
            const spent = totalActual + totalCommitted;
            const calculatedPercent = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;
            
            const existingForecast = forecastMap.get(parent.cost_code_id);
            
            return {
              id: existingForecast?.id,
              cost_code_id: parent.cost_code_id,
              code: parent.cost_codes?.code || '',
              description: parent.cost_codes?.description || '',
              budgeted_amount: budgeted,
              actual_amount: totalActual,
              committed_amount: totalCommitted,
              calculated_percent: calculatedPercent,
              estimated_percent: existingForecast?.estimated_percent_complete ?? 0,
              notes: existingForecast?.notes || '',
              updated_at: existingForecast?.updated_at,
              updated_by_name: existingForecast?.updated_by_name,
            };
          })
        );
      } else {
        // No dynamic budgets - show individual cost codes (excluding .0 suffix codes)
        lines = await Promise.all(
          (budgets || [])
            .filter((b: any) => b.cost_codes && !b.cost_codes.code?.endsWith('.0'))
            .map(async (b: any) => {
              const actual = await getActualAmount(b.cost_code_id);
              const committed = await getCommittedAmount(b.cost_code_id);
              const budgeted = Number(b.budgeted_amount || 0);
              const spent = actual + committed;
              
              const calculatedPercent = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;
              const existingForecast = forecastMap.get(b.cost_code_id);
              
              return {
                id: existingForecast?.id,
                cost_code_id: b.cost_code_id,
                code: b.cost_codes?.code || '',
                description: b.cost_codes?.description || '',
                budgeted_amount: budgeted,
                actual_amount: actual,
                committed_amount: committed,
                calculated_percent: calculatedPercent,
                estimated_percent: existingForecast?.estimated_percent_complete ?? 0,
                notes: existingForecast?.notes || '',
                updated_at: existingForecast?.updated_at,
                updated_by_name: existingForecast?.updated_by_name,
              };
            })
        );
      }

      // Sort by cost code
      lines.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

      setForecastLines(lines);
    } catch (error) {
      console.error('Error loading forecast data:', error);
      toast({
        title: "Error",
        description: "Failed to load forecast data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadForecastData();
  }, [loadForecastData]);

  const updateEstimatedPercent = (costCodeId: string, value: number) => {
    // Clamp value between 0 and 100
    const clampedValue = Math.min(Math.max(value, 0), 100);
    
    setForecastLines(prev =>
      prev.map(line =>
        line.cost_code_id === costCodeId
          ? { ...line, estimated_percent: clampedValue }
          : line
      )
    );
    setHasChanges(true);
  };

  const saveForecast = async () => {
    if (!id || !user) return;
    
    setSaving(true);
    try {
      // Upsert all forecast entries
      const upserts = forecastLines.map(line => ({
        job_id: id,
        cost_code_id: line.cost_code_id,
        estimated_percent_complete: line.estimated_percent,
        notes: line.notes || null,
        updated_by: user.id,
      }));

      const { error } = await supabase
        .from('job_budget_forecasts')
        .upsert(upserts, { 
          onConflict: 'job_id,cost_code_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Forecast saved successfully",
      });
      setHasChanges(false);
      loadForecastData(); // Reload to get IDs
    } catch (error) {
      console.error('Error saving forecast:', error);
      toast({
        title: "Error",
        description: "Failed to save forecast",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Calculate summary totals
  const summary: JobSummary = forecastLines.reduce(
    (acc, line) => ({
      total_budgeted: acc.total_budgeted + line.budgeted_amount,
      total_spent: acc.total_spent + line.actual_amount + line.committed_amount,
      calculated_percent: 0, // Will calculate after
      estimated_percent: 0, // Will calculate after
    }),
    { total_budgeted: 0, total_spent: 0, calculated_percent: 0, estimated_percent: 0 }
  );

  // Calculate weighted averages for percentages
  if (summary.total_budgeted > 0) {
    const weightedCalc = forecastLines.reduce(
      (sum, line) => sum + (line.calculated_percent * line.budgeted_amount), 0
    );
    const weightedEst = forecastLines.reduce(
      (sum, line) => sum + (line.estimated_percent * line.budgeted_amount), 0
    );
    summary.calculated_percent = weightedCalc / summary.total_budgeted;
    summary.estimated_percent = weightedEst / summary.total_budgeted;
  }

  const getVarianceColor = (calculated: number, estimated: number) => {
    const diff = estimated - calculated;
    if (Math.abs(diff) < 5) return 'text-muted-foreground';
    if (diff > 0) return 'text-green-600'; // Ahead of schedule
    return 'text-amber-600'; // Behind schedule
  };

  const getVarianceBadge = (calculated: number, estimated: number) => {
    const diff = estimated - calculated;
    if (Math.abs(diff) < 5) return null;
    if (diff > 0) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700 ml-2">
          <TrendingUp className="h-3 w-3 mr-1" />
          Ahead
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 ml-2">
        <TrendingDown className="h-3 w-3 mr-1" />
        Behind
      </Badge>
    );
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading forecast data...</div>;
  }

  if (forecastLines.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p>No budget lines found for this job.</p>
          <p className="text-sm mt-1">Add cost codes and budget amounts first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Total Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.total_budgeted)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Spent to Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.total_spent)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              Calculated Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.calculated_percent.toFixed(1)}%</div>
            <Progress value={summary.calculated_percent} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              Estimated Complete
              {getVarianceBadge(summary.calculated_percent, summary.estimated_percent)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getVarianceColor(summary.calculated_percent, summary.estimated_percent)}`}>
              {summary.estimated_percent.toFixed(1)}%
            </div>
            <Progress value={summary.estimated_percent} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Forecast Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Budget Line Forecasting</CardTitle>
            <CardDescription>
              Enter your estimated percentage complete for each budget line item
            </CardDescription>
          </div>
          <Button onClick={saveForecast} disabled={saving || !hasChanges} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Forecast'}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[80px] font-semibold">Code</TableHead>
                  <TableHead className="min-w-[180px] font-semibold">Description</TableHead>
                  <TableHead className="text-right w-[110px] font-semibold px-4">Budgeted</TableHead>
                  <TableHead className="text-right w-[110px] font-semibold px-4 border-l border-border/50">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 ml-auto">
                          Spent
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Actual costs from journal entries</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-right w-[110px] font-semibold px-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 ml-auto">
                          Committed
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Pending subcontracts & purchase orders</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-right w-[110px] font-semibold px-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 ml-auto">
                          Remaining
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Budgeted minus (spent + committed)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center w-[70px] font-semibold px-3 border-l border-border/50">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 mx-auto">
                          Calc %
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Spent / budgeted</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center w-[90px] font-semibold px-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 mx-auto">
                          Est %
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Estimated % complete</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-right w-[120px] font-semibold px-4 border-l border-border/50">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 ml-auto">
                          Over/Under
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Projected over/under budget</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="w-[110px] font-semibold px-3">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecastLines.map((line) => {
                  const spent = line.actual_amount + line.committed_amount;
                  const remaining = line.budgeted_amount - spent;
                  const isOverBudget = spent > line.budgeted_amount;
                  
                  // Calculate projected over/under based on estimate
                  // If estimate is X% complete and we've spent Y, projected total = Y / (X/100)
                  // Over/under = budgeted - projected total
                  const projectedTotal = line.estimated_percent > 0 
                    ? (spent / (line.estimated_percent / 100)) 
                    : (line.estimated_percent === 0 && spent > 0 ? Infinity : 0);
                  const overUnder = line.budgeted_amount - projectedTotal;
                  const isProjectedOver = projectedTotal > line.budgeted_amount;
                  
                  return (
                    <TableRow key={line.cost_code_id} className={`${isOverBudget ? 'bg-destructive/5' : 'hover:bg-muted/30'}`}>
                      <TableCell className="font-mono text-sm py-3">{line.code}</TableCell>
                      <TableCell className="py-3">
                        <span className="font-medium">{line.description}</span>
                        {isOverBudget && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            Over
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums px-4 py-3">
                        {formatCurrency(line.budgeted_amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums px-4 py-3 border-l border-border/30">
                        {formatCurrency(line.actual_amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums px-4 py-3">
                        {formatCurrency(line.committed_amount)}
                      </TableCell>
                      <TableCell className={`text-right font-medium tabular-nums px-4 py-3 ${remaining < 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {formatCurrency(remaining)}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground tabular-nums px-3 py-3 border-l border-border/30">
                        {line.calculated_percent.toFixed(0)}%
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={line.estimated_percent}
                            onChange={(e) => updateEstimatedPercent(line.cost_code_id, parseFloat(e.target.value) || 0)}
                            className="w-14 text-center h-8 text-sm tabular-nums"
                          />
                          <span className="text-muted-foreground text-xs">%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-4 py-3 border-l border-border/30">
                        {line.estimated_percent > 0 ? (
                          <div className={`flex items-center justify-end gap-1.5 font-semibold tabular-nums ${isProjectedOver ? 'text-destructive' : 'text-green-600'}`}>
                            {isProjectedOver ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                            <span>
                              {isProjectedOver ? '' : '+'}
                              {formatCurrency(overUnder)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground px-3 py-3">
                        {line.updated_at ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{new Date(line.updated_at).toLocaleDateString()}</span>
                            {line.updated_by_name && (
                              <span className="truncate max-w-[90px] opacity-70">{line.updated_by_name}</span>
                            )}
                          </div>
                        ) : (
                          <span className="opacity-50">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Legend */}
          <div className="mt-4 p-4 flex flex-wrap gap-6 text-sm text-muted-foreground border-t">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span>Projected under budget</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span>Projected over budget</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
