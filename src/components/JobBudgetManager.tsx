import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/formatNumber";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface JobBudgetManagerProps {
  jobId: string;
  jobName?: string;
  selectedCostCodes: CostCode[];
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

export default function JobBudgetManager({ jobId, jobName, selectedCostCodes }: JobBudgetManagerProps) {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { toast } = useToast();

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

      const normalizedBudgetLines: BudgetLine[] = (budgetData || []).map((bd: any) => ({
        id: bd.id,
        cost_code_id: bd.cost_code_id,
        budgeted_amount: bd.budgeted_amount,
        actual_amount: bd.actual_amount,
        committed_amount: bd.committed_amount,
        is_dynamic: bd.is_dynamic,
        parent_budget_id: bd.parent_budget_id,
        cost_code: bd.cost_codes
      }));

      setBudgetLines(normalizedBudgetLines);
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

  const populateBudgetLines = async () => {
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

    if (budgetError) {
      console.error('Error loading budget lines:', budgetError);
      return;
    }

    const existing: BudgetLine[] = (budgetData || []).map((bd: any) => ({
      id: bd.id,
      cost_code_id: bd.cost_code_id,
      budgeted_amount: bd.budgeted_amount,
      actual_amount: bd.actual_amount,
      committed_amount: bd.committed_amount,
      is_dynamic: bd.is_dynamic,
      parent_budget_id: bd.parent_budget_id,
      cost_code: bd.cost_codes,
    }));

    const byCostCodeId = new Map(existing.map((e) => [e.cost_code_id, e]));
    const newEntries: BudgetLine[] = [];
    
    selectedCostCodes.forEach((cc) => {
      if (!byCostCodeId.has(cc.id)) {
        const newLine: BudgetLine = {
          cost_code_id: cc.id,
          budgeted_amount: 0,
          actual_amount: 0,
          committed_amount: 0,
          is_dynamic: false,
          parent_budget_id: null,
          cost_code: cc,
        };
        byCostCodeId.set(cc.id, newLine);
        newEntries.push(newLine);
      }
    });

    // Persist new budget entries to database
    if (newEntries.length > 0) {
      const user = await supabase.auth.getUser();
      const inserts = newEntries.map(line => ({
        job_id: jobId,
        cost_code_id: line.cost_code_id,
        budgeted_amount: 0,
        actual_amount: 0,
        committed_amount: 0,
        is_dynamic: false,
        parent_budget_id: null,
        created_by: user.data.user?.id
      }));

      const { error: insertError } = await supabase.from('job_budgets').insert(inserts);
      if (insertError) {
        console.error('Error inserting new budget lines:', insertError);
      } else {
        // Reload to get IDs
        await loadData();
        return;
      }
    }

    const merged = Array.from(byCostCodeId.values()).sort((a, b) =>
      (a.cost_code?.code || '').localeCompare(b.cost_code?.code || '', undefined, { numeric: true, sensitivity: 'base' })
    );

    setBudgetLines(merged);
  };


  const updateBudgetLine = (costCodeId: string, field: keyof BudgetLine, value: any) => {
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
        const children = getChildBudgets(line.id!);
        const childrenSum = children.reduce((sum, c) => sum + (c.actual_amount + c.committed_amount), 0);
        const remaining = line.budgeted_amount - childrenSum;
        const isOverBudget = remaining < 0;

        unified.push({
          line,
          isChild: false,
          isOverBudget,
          remaining
        });

        // Add children after parent
        children.forEach(child => {
          unified.push({
            line: child,
            isChild: true,
            parentId: line.id
          });
        });
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
    
    // Rule 1: If exactly 2 children, disable both
    if (children.length === 2) {
      return true;
    }
    
    // Rule 2: If 3+ children and one has a budget set, disable the others
    if (children.length >= 3) {
      const anySetChild = children.find(c => (c.budgeted_amount || 0) > 0);
      if (anySetChild && (childLine.budgeted_amount || 0) === 0) {
        return true;
      }
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
          <div className="flex justify-end">
            <Button onClick={saveBudget} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Budget'}
            </Button>
          </div>


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
                      const { line, isChild, parentId, isOverBudget, remaining } = item;
                      const variance = line.budgeted_amount - (line.actual_amount + line.committed_amount);
                      
                      return (
                        <TableRow 
                          key={line.id || line.cost_code_id} 
                          className={cn(
                            isChild && "bg-muted/30",
                            line.is_dynamic && "bg-primary/5"
                          )}
                        >
                          <TableCell className={isChild ? "pl-12" : ""}>
                            <div className="flex items-center gap-2">
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
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {line.cost_code?.description}
                              {line.cost_code?.type && <span className="text-xs text-muted-foreground ml-2">({line.cost_code.type})</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <CurrencyInput
                              value={line.budgeted_amount.toString()}
                              onChange={(value) => updateBudgetLine(line.cost_code_id, 'budgeted_amount', parseFloat(value) || 0)}
                              className="w-32"
                              placeholder="0.00"
                              disabled={isChild && parentId ? isChildDisabled(parentId, line) : (line.is_dynamic && getChildBudgets(line.id!).length === 2)}
                            />
                          </TableCell>
                          <TableCell>
                            {line.is_dynamic 
                              ? formatCurrency(getChildBudgets(line.id!).reduce((s, c) => s + c.actual_amount, 0))
                              : formatCurrency(line.actual_amount)
                            }
                          </TableCell>
                          <TableCell>
                            {line.is_dynamic 
                              ? formatCurrency(getChildBudgets(line.id!).reduce((s, c) => s + c.committed_amount, 0))
                              : formatCurrency(line.committed_amount)
                            }
                          </TableCell>
                          <TableCell>
                            <span className={`${
                              (line.is_dynamic ? (remaining ?? 0) < 0 : variance < 0)
                                ? 'text-destructive font-semibold' 
                                : 'text-muted-foreground'
                            }`}>
                              {line.is_dynamic ? formatCurrency(remaining ?? 0) : formatCurrency(variance)}
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