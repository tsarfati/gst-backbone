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

      // Create a map of existing forecasts by cost_code_id
      const forecastMap = new Map(
        (forecasts || []).map(f => [f.cost_code_id, f])
      );

      // Check if there are any dynamic budgets
      const dynamicBudgets = (budgets || []).filter((b: any) => b.is_dynamic);
      const hasDynamicBudgets = dynamicBudgets.length > 0;

      // Helper to get actuals from journal entries
      const getActualAmount = async (costCodeId: string): Promise<number> => {
        const { data: journalLines } = await supabase
          .from('journal_entry_lines')
          .select('debit_amount')
          .eq('job_id', id)
          .eq('cost_code_id', costCodeId);

        return (journalLines || []).reduce(
          (sum, line) => sum + Number(line.debit_amount || 0), 0
        );
      };

      let lines: BudgetForecastLine[] = [];

      if (hasDynamicBudgets) {
        // Show dynamic budget parents with aggregated child data
        lines = await Promise.all(
          dynamicBudgets.map(async (parent: any) => {
            // Find all children of this dynamic budget
            const children = (budgets || []).filter((b: any) => b.parent_budget_id === parent.id);
            
            // Aggregate child actuals and committed
            let totalActual = 0;
            let totalCommitted = 0;
            
            for (const child of children) {
              const childActual = await getActualAmount(child.cost_code_id);
              totalActual += Math.max(childActual, Number(child.actual_amount || 0));
              totalCommitted += Number(child.committed_amount || 0);
            }

            // If no children, use parent's own values
            if (children.length === 0) {
              const parentActual = await getActualAmount(parent.cost_code_id);
              totalActual = Math.max(parentActual, Number(parent.actual_amount || 0));
              totalCommitted = Number(parent.committed_amount || 0);
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
              estimated_percent: existingForecast?.estimated_percent_complete ?? calculatedPercent,
              notes: existingForecast?.notes || '',
            };
          })
        );
      } else {
        // No dynamic budgets - show individual cost codes (excluding .0 suffix codes)
        lines = await Promise.all(
          (budgets || [])
            .filter((b: any) => b.cost_codes && !b.cost_codes.code?.endsWith('.0'))
            .map(async (b: any) => {
              const actualFromJournal = await getActualAmount(b.cost_code_id);
              const actual = Math.max(actualFromJournal, Number(b.actual_amount || 0));
              const budgeted = Number(b.budgeted_amount || 0);
              const committed = Number(b.committed_amount || 0);
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
                estimated_percent: existingForecast?.estimated_percent_complete ?? calculatedPercent,
                notes: existingForecast?.notes || '',
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
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Cost Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-[120px]">Budgeted</TableHead>
                  <TableHead className="text-right w-[120px]">Spent</TableHead>
                  <TableHead className="text-right w-[120px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 ml-auto">
                          Remaining
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Budgeted amount minus spent to date</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-right w-[100px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 ml-auto">
                          Calc %
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Calculated based on spent / budgeted</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center w-[120px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 mx-auto">
                          Est. % Complete
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Your estimated percentage complete</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-right w-[120px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 ml-auto">
                          Over/Under
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Projected over/under budget based on estimate</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
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
                    <TableRow key={line.cost_code_id} className={isOverBudget ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-mono text-sm">{line.code}</TableCell>
                      <TableCell>
                        {line.description}
                        {isOverBudget && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            Over Budget
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.budgeted_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(spent)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${remaining < 0 ? 'text-destructive' : ''}`}>
                        {formatCurrency(remaining)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {line.calculated_percent.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={line.estimated_percent}
                            onChange={(e) => updateEstimatedPercent(line.cost_code_id, parseFloat(e.target.value) || 0)}
                            className="w-20 text-center h-8"
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {line.estimated_percent > 0 ? (
                          <div className={`flex items-center justify-end gap-1 font-medium ${isProjectedOver ? 'text-destructive' : 'text-green-600'}`}>
                            {isProjectedOver ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                            <span>
                              {isProjectedOver ? '-' : '+'}
                              {formatCurrency(Math.abs(overUnder))}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
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
