import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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

interface DynamicBudgetManagerProps {
  jobId: string;
}

export default function DynamicBudgetManager({ jobId }: DynamicBudgetManagerProps) {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [jobId]);

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
        .eq('job_id', jobId);

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
    } finally {
      setLoading(false);
    }
  };

  const getBaseCode = (code: string): string | null => {
    const match = code.match(/^(\d+\.\d+)/);
    return match ? match[1] : null;
  };

  const groupCostCodesByBase = (): BudgetGroup[] => {
    const groups: Record<string, BudgetGroup> = {};
    
    budgetLines.forEach(line => {
      if (!line.cost_code) return;
      
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
    
    // Return all groups (including those already dynamic, so they can be toggled off)
    return Object.values(groups).filter(g => g.costCodes.length >= 2 || g.dynamicBudget);
  };

  const handleToggleDynamic = async (baseCode: string, enabled: boolean) => {
    const group = groupCostCodesByBase().find(g => g.baseCode === baseCode);
    if (!group) return;

    if (enabled) {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      try {
        const existingDynamic = budgetLines.find(
          line => line.is_dynamic && line.cost_code?.code === baseCode
        );

        let dynamicBudgetId: string;

        if (existingDynamic?.id) {
          dynamicBudgetId = existingDynamic.id;
        } else {
          const { data: companyData } = await supabase
            .from('cost_codes')
            .select('company_id')
            .eq('id', group.costCodes[0].cost_code_id)
            .single();

          const { data: newCostCode, error: costCodeError } = await supabase
            .from('cost_codes')
            .insert({
              job_id: jobId,
              company_id: companyData?.company_id,
              code: baseCode,
              description: group.costCodes[0].cost_code?.description || '',
              type: null,
              is_active: true
            })
            .select()
            .single();

          if (costCodeError) throw costCodeError;

          const { data: dynamicBudget, error: dynamicError } = await supabase
            .from('job_budgets')
            .insert({
              job_id: jobId,
              cost_code_id: newCostCode.id,
              budgeted_amount: 0,
              actual_amount: 0,
              committed_amount: 0,
              is_dynamic: true,
              created_by: user.data.user.id
            })
            .select()
            .single();

          if (dynamicError) throw dynamicError;
          dynamicBudgetId = dynamicBudget.id;
        }

        const updatePromises = group.costCodes.map(line => 
          supabase
            .from('job_budgets')
            .update({ parent_budget_id: dynamicBudgetId })
            .eq('id', line.id)
        );

        await Promise.all(updatePromises);

        toast({
          title: "Success",
          description: `Dynamic budget enabled for ${baseCode}`,
        });

        loadData();
      } catch (error) {
        console.error('Error creating dynamic budget:', error);
        toast({
          title: "Error",
          description: "Failed to enable dynamic budget",
          variant: "destructive",
        });
      }
    } else {
      if (!group.dynamicBudget?.id) return;

      try {
        const childBudgets = budgetLines.filter(b => b.parent_budget_id === group.dynamicBudget!.id);
        const updatePromises = childBudgets.map(child =>
          supabase
            .from('job_budgets')
            .update({ parent_budget_id: null })
            .eq('id', child.id)
        );

        await Promise.all(updatePromises);

        await supabase
          .from('job_budgets')
          .delete()
          .eq('id', group.dynamicBudget.id);

        if (group.dynamicBudget.cost_code_id) {
          await supabase
            .from('cost_codes')
            .delete()
            .eq('id', group.dynamicBudget.cost_code_id);
        }

        toast({
          title: "Success",
          description: `Dynamic budget disabled for ${baseCode}`,
        });

        loadData();
      } catch (error) {
        console.error('Error removing dynamic budget:', error);
        toast({
          title: "Error",
          description: "Failed to disable dynamic budget",
          variant: "destructive",
        });
      }
    }
  };

  const potentialDynamicGroups = groupCostCodesByBase();

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading dynamic budgets...</p>
      </div>
    );
  }

  if (potentialDynamicGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No eligible cost code groups found. Add multiple cost codes with the same base number (e.g., 01.01 with different types) to create dynamic budget groups.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dynamic Budget Groups</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enable dynamic budgets for groups of 2+ cost codes with the same base number. Dynamic budgets allow you to set a total budget shared across multiple cost code types.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {potentialDynamicGroups.map(group => {
          const isDynamic = !!group.dynamicBudget;
          
          return (
            <div key={group.baseCode} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <Checkbox
                checked={isDynamic}
                onCheckedChange={(checked) => handleToggleDynamic(group.baseCode, checked as boolean)}
                className="mt-1"
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg">{group.baseCode}</span>
                  {isDynamic && group.dynamicBudget?.cost_code && (
                    <>
                      <Badge variant="default">Active</Badge>
                      <span className="text-sm font-medium text-primary">
                        {group.dynamicBudget.cost_code.code} - {group.dynamicBudget.cost_code.description}
                      </span>
                    </>
                  )}
                  {!isDynamic && <Badge variant="outline">{group.costCodes.length} cost codes</Badge>}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground pl-4 border-l-2 border-muted">
                  {group.costCodes.map(cc => (
                    <div key={cc.cost_code_id} className="flex items-center gap-2">
                      <span className="font-mono">{cc.cost_code?.code}</span>
                      {cc.cost_code?.type && (
                        <Badge variant="secondary" className="text-xs">
                          {cc.cost_code.type}
                        </Badge>
                      )}
                      <span>{cc.cost_code?.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
