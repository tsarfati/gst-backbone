import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/formatNumber";
import { useActionPermissions } from "@/hooks/useActionPermissions";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface JobBudgetManagerProps {
  jobId: string;
  jobName?: string;
  selectedCostCodes: CostCode[];
  jobStatus?: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  type?: string;
}

interface BudgetLine {
  id?: string;
  cost_code_id: string;
  budgeted_amount: number;
  actual_amount: number;
  committed_amount: number;
  is_dynamic?: boolean;
  parent_budget_id?: string | null;
  cost_code?: CostCode;
}

interface BudgetGroup {
  baseCode: string;
  costCodes: (BudgetLine & { cost_code: CostCode })[];
  dynamicBudget?: BudgetLine;
}

interface DynamicBudgetSummary {
  parent_budget_id: string;
  dynamic_budget: number;
  total_actual_from_children: number;
  total_committed_from_children: number;
  remaining_budget: number;
  is_over_budget: boolean;
}

export default function JobBudgetManager({ jobId, jobName, selectedCostCodes, jobStatus }: JobBudgetManagerProps) {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit } = useActionPermissions();
  const isPlanning = jobStatus === 'planning';
  const canEditBudget = canEdit('job_budgets') && isPlanning;

  useEffect(() => {
    loadData();
  }, [jobId]);

  useEffect(() => {
    // Auto-populate budget lines when selected cost codes change
    if (selectedCostCodes.length > 0) {
      console.log('Selected cost codes changed, populating budget lines:', selectedCostCodes.length);
      populateBudgetLines();
    }
  }, [selectedCostCodes]);

  const loadData = async () => {
    try {
      const { data: budgetData, error: budgetError } = await supabase
        .from('job_budgets')
        .select(`
          *,
          cost_codes (
            id,
            code,
            description,
            type
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (budgetError) throw budgetError;

      // Calculate actual and committed amounts from live data
      const budgetLinesWithActuals = await Promise.all((budgetData || []).map(async (bd: any) => {
        const actualAmount = await calculateActualAmount(jobId, bd.cost_code_id);
        const committedAmount = await calculateCommittedAmount(jobId, bd.cost_code_id);
        
        return {
          id: bd.id,
          cost_code_id: bd.cost_code_id,
          budgeted_amount: bd.budgeted_amount,
          actual_amount: actualAmount,
          committed_amount: committedAmount,
          is_dynamic: bd.is_dynamic,
          parent_budget_id: bd.parent_budget_id,
          cost_code: bd.cost_codes
        };
      }));

      setBudgetLines(budgetLinesWithActuals);
    } catch (error) {
      console.error('Error loading budget data:', error);
      toast({
        title: "Error",
        description: "Failed to load budget data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateActualAmount = async (jobId: string, costCodeId: string): Promise<number> => {
    try {
      // Get amounts from posted journal entry lines (debit amounts for expenses)
      const { data: journalLines, error: jeError } = await supabase
        .from('journal_entry_lines')
        .select('debit_amount, journal_entries!inner(status)')
        .eq('job_id', jobId)
        .eq('cost_code_id', costCodeId)
        .eq('journal_entries.status', 'posted');

      if (jeError) throw jeError;

      return (journalLines || []).reduce((sum, line) => 
        sum + Number(line.debit_amount || 0), 0
      );
    } catch (error) {
      console.error('Error calculating actual amount:', error);
      return 0;
    }
  };

  const calculateCommittedAmount = async (jobId: string, costCodeId: string): Promise<number> => {
    try {
      let total = 0;

      // Subcontracts - committed costs (full contract amount)
      const { data: subcontracts, error: subError } = await supabase
        .from('subcontracts')
        .select('contract_amount, cost_distribution')
        .eq('job_id', jobId)
        .not('status', 'eq', 'cancelled');

      if (subError) throw subError;

      // Parse cost_distribution JSON to find amounts for this cost code
      (subcontracts || []).forEach((sub: any) => {
        const raw = sub.cost_distribution;

        // cost_distribution is jsonb, but older writes stored it as a JSON string
        let parsed: any = raw;
        if (typeof raw === 'string') {
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = null;
          }
        }

        const items = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === 'object' && Array.isArray((parsed as any).items)
            ? (parsed as any).items
            : [];

        items.forEach((dist: any) => {
          if (dist?.cost_code_id === costCodeId) {
            total += Number(dist?.amount || 0);
          }
        });
      });

      // Purchase Orders - committed costs (full PO amount)
      // NOTE: types.ts is read-only and may lag schema changes; cast to any to query newly added columns safely.
      const { data: purchaseOrders, error: poError } = await (supabase as any)
        .from('purchase_orders')
        .select('amount, status')
        .eq('job_id', jobId)
        .eq('cost_code_id', costCodeId);

      if (poError) throw poError;

      (purchaseOrders || []).forEach((po: any) => {
        if (po?.status !== 'cancelled') {
          total += Number(po?.amount || 0);
        }
      });

      return total;
    } catch (error) {
      console.error('Error calculating committed amount:', error);
      return 0;
    }
  };


  const populateBudgetLines = async () => {
    try {
      const { data: budgetData, error: budgetError } = await supabase
        .from('job_budgets')
        .select('id, cost_code_id')
        .eq('job_id', jobId);

      if (budgetError) throw budgetError;

      const existingIds = new Set((budgetData || []).map((b: any) => b.cost_code_id));
      const missing = selectedCostCodes.filter((cc) => !existingIds.has(cc.id));

      if (missing.length > 0) {
        const user = await supabase.auth.getUser();
        const inserts = missing.map((cc) => ({
          job_id: jobId,
          cost_code_id: cc.id,
          budgeted_amount: 0,
          actual_amount: 0,
          committed_amount: 0,
          is_dynamic: false,
          parent_budget_id: null,
          created_by: user.data.user?.id,
        }));

        const { error: insertError } = await supabase.from('job_budgets').insert(inserts);
        if (insertError) throw insertError;
      }

      // Always reload so actual/committed are calculated from live data (don’t overwrite with stored zeros)
      await loadData();
    } catch (error) {
      console.error('Error populating budget lines:', error);
    }
  };


  const updateBudgetLine = (costCodeId: string, field: keyof BudgetLine, value: any) => {
    // If updating a child's budgeted_amount, check against parent's budget
    if (field === 'budgeted_amount') {
      const line = budgetLines.find(l => l.cost_code_id === costCodeId);
      if (line?.parent_budget_id) {
        const parent = budgetLines.find(l => l.id === line.parent_budget_id);
        if (parent && value > parent.budgeted_amount) {
          toast({
            title: "Budget Exceeded",
            description: "Child budget cannot exceed parent dynamic budget amount",
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    const updated = budgetLines.map(line => 
      line.cost_code_id === costCodeId ? { ...line, [field]: value } : line
    );
    setBudgetLines(updated);
  };

  // Extract base code (e.g., "01.01" from "01.01" or "1.01-labor")
  const getBaseCode = (code: string): string | null => {
    const match = code.match(/^(\d+\.\d+)/);
    return match ? match[1] : null;
  };

  // Group cost codes by their base number
  const groupCostCodesByBase = (): BudgetGroup[] => {
    const groups: Record<string, BudgetGroup> = {};
    
    budgetLines.forEach(line => {
      if (!line.cost_code) return;
      
      // Skip if this is already a dynamic budget parent
      if (line.is_dynamic) {
        const baseCode = line.cost_code.code;
        if (!groups[baseCode]) {
          groups[baseCode] = {
            baseCode,
            costCodes: [],
            dynamicBudget: line
          };
        } else {
          groups[baseCode].dynamicBudget = line;
        }
        return;
      }
      
      // Skip if this line is a child of a dynamic budget
      if (line.parent_budget_id) return;
      
      const baseCode = getBaseCode(line.cost_code.code);
      if (baseCode) {
        if (!groups[baseCode]) {
          groups[baseCode] = {
            baseCode,
            costCodes: [],
            dynamicBudget: undefined
          };
        }
        groups[baseCode].costCodes.push(line as BudgetLine & { cost_code: CostCode });
      }
    });
    
    // Only return groups with 2+ cost codes
    return Object.values(groups).filter(g => g.costCodes.length >= 2);
  };


  const saveBudget = async () => {
    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      
      // Update all budget lines
      const updatePromises = budgetLines
        .filter(line => line.id) // Only update existing lines
        .map(line => 
          supabase
            .from('job_budgets')
            .update({
              budgeted_amount: line.budgeted_amount,
              actual_amount: line.actual_amount || 0,
              committed_amount: line.committed_amount || 0,
            })
            .eq('id', line.id)
        );

      await Promise.all(updatePromises);

      // Insert new budget lines (those without IDs)
      const newLines = budgetLines.filter(line => !line.id);
      if (newLines.length > 0) {
        const budgetInserts = newLines.map(line => ({
          job_id: jobId,
          cost_code_id: line.cost_code_id,
          budgeted_amount: line.budgeted_amount,
          actual_amount: line.actual_amount || 0,
          committed_amount: line.committed_amount || 0,
          is_dynamic: line.is_dynamic || false,
          parent_budget_id: line.parent_budget_id || null,
          created_by: user.data.user?.id
        }));

        await supabase.from('job_budgets').insert(budgetInserts);
      }

      // Update job total budget
      const totalBudget = budgetLines
        .filter(line => !line.parent_budget_id)
        .reduce((sum, line) => sum + (line.budgeted_amount || 0), 0);
      
      await supabase
        .from('jobs')
        .update({ budget_total: totalBudget })
        .eq('id', jobId);

      toast({
        title: "Success",
        description: "Budget saved successfully",
      });

      loadData();
    } catch (error) {
      console.error('Error saving budget:', error);
      toast({
        title: "Error",
        description: "Failed to save budget",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (baseCode: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(baseCode)) {
        newSet.delete(baseCode);
      } else {
        newSet.add(baseCode);
      }
      return newSet;
    });
  };

  // Get child budgets for a parent
  const getChildBudgets = (parentId: string) => 
    budgetLines.filter(b => b.parent_budget_id === parentId && b.cost_code);

  // Build unified list: dynamic parents, their children (indented), and regular budgets
  const buildUnifiedBudgetList = () => {
    const unified: Array<{
      line: BudgetLine;
      isChild: boolean;
      parentId?: string;
      isOverBudget?: boolean;
      remaining?: number;
      childCount?: number;
      parentBudget?: number;
      parentRemaining?: number;
      groupSpent?: number;
    }> = [];

    // First, collect all dynamic parents
    const dynamicParents = budgetLines.filter(b => b.is_dynamic && b.cost_code);
    const childIds = new Set(budgetLines.filter(b => b.parent_budget_id).map(b => b.cost_code_id));
    const regularLines = budgetLines.filter(b => !b.is_dynamic && !b.parent_budget_id && b.cost_code);

    // Combine all lines and sort by cost code
    const allLines = [...dynamicParents, ...regularLines].sort((a, b) =>
      (a.cost_code?.code || '').localeCompare(b.cost_code?.code || '', undefined, { numeric: true, sensitivity: 'base' })
    );

    // Build the unified list with children inserted after their parents
    allLines.forEach(line => {
      if (line.is_dynamic) {
        // This is a dynamic parent
        const children = getChildBudgets(line.id!).sort((a, b) =>
          (a.cost_code?.code || '').localeCompare(b.cost_code?.code || '', undefined, { numeric: true, sensitivity: 'base' })
        );
        const childrenSum = children.reduce((sum, c) => sum + (c.actual_amount + c.committed_amount), 0);
        const remaining = line.budgeted_amount - childrenSum;
        const isOverBudget = remaining < 0;

        unified.push({
          line,
          isChild: false,
          isOverBudget,
          remaining,
          childCount: children.length,
          groupSpent: childrenSum
        });

        // Show children when expanded (for any child count > 0)
        if (children.length > 0 && expandedGroups.has(line.cost_code?.code || '')) {
          children.forEach(child => {
            unified.push({
              line: child,
              isChild: true,
              parentId: line.id,
              parentBudget: line.budgeted_amount,
              parentRemaining: remaining,
              isOverBudget: isOverBudget,
              groupSpent: childrenSum
            });
          });
        }
      } else {
        // Regular budget line (not a parent, not a child)
        unified.push({
          line,
          isChild: false
        });
      }
    });

    return unified;
  };

  // Check if child inputs should be disabled based on dynamic budget rules
  const isChildDisabled = (parentId: string, childLine: BudgetLine): boolean => {
    const children = getChildBudgets(parentId);
    
    // Disable children when there are 2 or less
    if (children.length <= 2) {
      return true;
    }
    
    return false;
  };

  const totalBudget = budgetLines
    .filter(line => !line.parent_budget_id)
    .reduce((sum, line) => sum + (line.budgeted_amount || 0), 0);

  if (loading) {
    return <div>Loading budget data...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Budget - {jobName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {canEditBudget && (
            <div className="flex justify-end">
              <Button onClick={saveBudget} disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Budget'}
              </Button>
            </div>
          )}


          {/* Unified Budget List */}
          {budgetLines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Budget Lines</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cost Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Budgeted Amount</TableHead>
                      <TableHead>Actual Amount</TableHead>
                      <TableHead>Committed Amount</TableHead>
                      <TableHead>Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buildUnifiedBudgetList().map((item, index) => {
                      const { line, isChild, parentId, isOverBudget, remaining, childCount, parentBudget, parentRemaining, groupSpent } = item;
                      
                      // For children of dynamic budgets, use parent's remaining; for regular lines, use own variance
                      const variance = isChild && parentBudget !== undefined
                        ? parentRemaining ?? 0
                        : line.budgeted_amount - (line.actual_amount + line.committed_amount);
                      
                      const displayBudget = isChild && parentBudget !== undefined ? parentBudget : line.budgeted_amount;
                      const displayVariance = isChild && parentRemaining !== undefined ? parentRemaining : variance;

                      const isRowOverBudget = line.is_dynamic
                        ? (isOverBudget ?? false)
                        : isChild
                          ? (isOverBudget ?? false)
                          : variance < 0;

                      const toneClass = isRowOverBudget ? 'text-destructive' : 'text-success';
                      
                      const isExpanded = expandedGroups.has(line.cost_code?.code || '');
                      
                      return (
                        <TableRow 
                          key={line.id || line.cost_code_id} 
                          className={cn(
                            (isChild || line.is_dynamic) && "bg-primary/5 hover:bg-primary/10 transition-colors"
                          )}
                        >
                          <TableCell className={isChild ? "pl-12" : ""}>
                            <div className="flex items-center gap-2">
                              {line.is_dynamic && childCount !== undefined && childCount > 0 && (
                                <button
                                  onClick={() => toggleGroup(line.cost_code?.code || '')}
                                  className="hover:bg-primary/10 p-0.5 rounded"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                              {line.is_dynamic && childCount !== undefined && childCount > 0 && (
                                <span className="text-xs text-muted-foreground">({childCount})</span>
                              )}
                              <span className="font-mono text-sm">{line.cost_code?.code}</span>
                              {line.is_dynamic && (
                                <>
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Dynamic</Badge>
                                  {isOverBudget && (
                                    <Badge variant="destructive" className="flex items-center gap-1 text-[10px] px-1.5 py-0">
                                      <AlertCircle className="h-2.5 w-2.5" />
                                      Over
                                    </Badge>
                                  )}
                                </>
                              )}
                              {isChild && (
                                <span className="text-xs text-muted-foreground">(shares parent budget)</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {line.cost_code?.description}
                              {line.cost_code?.type && <span className="text-xs text-muted-foreground ml-2">({line.cost_code.type})</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isChild ? (
                              <span className="font-mono text-muted-foreground text-sm">
                                {formatCurrency(parentBudget ?? 0)}
                              </span>
                            ) : (
                              <CurrencyInput
                                value={line.budgeted_amount.toString()}
                                onChange={(value) => updateBudgetLine(line.cost_code_id, 'budgeted_amount', parseFloat(value) || 0)}
                                className="w-32"
                                placeholder="0.00"
                                disabled={!canEditBudget}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {line.is_dynamic ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const params = new URLSearchParams({
                                    jobId: jobId,
                                    costCodeId: line.cost_code_id,
                                    jobName: jobName || "",
                                    costCodeDescription: `${line.cost_code?.code} - ${line.cost_code?.description}`,
                                    type: "actual",
                                  });
                                  navigate(`/construction/reports/cost-history?${params.toString()}`);
                                }}
                                className={cn(
                                  "font-mono hover:underline cursor-pointer bg-transparent border-none p-0 text-left",
                                  toneClass
                                )}
                              >
                                {formatCurrency(getChildBudgets(line.id!).reduce((s, c) => s + c.actual_amount, 0))}
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const params = new URLSearchParams({
                                    jobId: jobId,
                                    costCodeId: line.cost_code_id,
                                    jobName: jobName || "",
                                    costCodeDescription: `${line.cost_code?.code} - ${line.cost_code?.description}`,
                                    type: "actual",
                                  });
                                  navigate(`/construction/reports/cost-history?${params.toString()}`);
                                }}
                                className={cn(
                                  "font-mono hover:underline cursor-pointer bg-transparent border-none p-0 text-left",
                                  toneClass
                                )}
                                type="button"
                              >
                                {formatCurrency(line.actual_amount)}
                              </button>
                            )}
                          </TableCell>
                          <TableCell>
                            {line.is_dynamic ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const params = new URLSearchParams({
                                    jobId: jobId,
                                    costCodeId: line.cost_code_id,
                                    jobName: jobName || "",
                                    costCodeDescription: `${line.cost_code?.code} - ${line.cost_code?.description}`,
                                    type: "committed",
                                  });
                                  navigate(`/construction/reports/committed-details?${params.toString()}`);
                                }}
                                className={cn(
                                  "font-mono hover:underline cursor-pointer bg-transparent border-none p-0 text-left",
                                  toneClass
                                )}
                                type="button"
                              >
                                {formatCurrency(getChildBudgets(line.id!).reduce((s, c) => s + c.committed_amount, 0))}
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const params = new URLSearchParams({
                                    jobId: jobId,
                                    costCodeId: line.cost_code_id,
                                    jobName: jobName || "",
                                    costCodeDescription: `${line.cost_code?.code} - ${line.cost_code?.description}`,
                                    type: "committed",
                                  });
                                  navigate(`/construction/reports/committed-details?${params.toString()}`);
                                }}
                                className={cn(
                                  "font-mono hover:underline cursor-pointer bg-transparent border-none p-0 text-left",
                                  toneClass
                                )}
                                type="button"
                              >
                                {formatCurrency(line.committed_amount)}
                              </button>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={cn("font-mono font-semibold", toneClass)}>
                              {line.is_dynamic ? formatCurrency(remaining ?? 0) : formatCurrency(displayVariance)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {budgetLines.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No budget lines available. Select cost codes for this job to start budgeting.
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="flex justify-end p-4 border-t">
          <div className="text-lg font-semibold">
          Total Budget: {formatCurrency(totalBudget)}
        </div>
      </div>
      </CardContent>
    </Card>
  );
}