import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DynamicBudgetManagerProps {
  jobId: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  parent_cost_code_id: string | null;
}

interface Budget {
  id: string;
  cost_code_id: string;
  budgeted_amount: number;
  actual_amount: number;
  committed_amount: number;
  is_dynamic: boolean;
  parent_budget_id: string | null;
  cost_codes: CostCode;
}

interface DynamicBudgetSummary {
  parent_budget_id: string;
  dynamic_budget: number;
  total_actual_from_children: number;
  total_committed_from_children: number;
  remaining_budget: number;
  is_over_budget: boolean;
}

export default function DynamicBudgetManager({ jobId }: DynamicBudgetManagerProps) {
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [dynamicSummaries, setDynamicSummaries] = useState<Record<string, DynamicBudgetSummary>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [newDynamicBudget, setNewDynamicBudget] = useState({
    cost_code_id: "",
    budgeted_amount: ""
  });
  const [newChildCode, setNewChildCode] = useState<Record<string, { code: string; description: string }>>({});

  useEffect(() => {
    if (jobId) {
      fetchData();
    }
  }, [jobId]);

  const fetchData = async () => {
    await Promise.all([
      fetchBudgets(),
      fetchCostCodes(),
      fetchDynamicSummaries()
    ]);
  };

  const fetchBudgets = async () => {
    const { data, error } = await supabase
      .from('job_budgets')
      .select('*, cost_codes(*)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching budgets:', error);
      return;
    }

    setBudgets(data || []);
  };

  const fetchCostCodes = async () => {
    const { data, error } = await supabase
      .from('cost_codes')
      .select('*')
      .eq('job_id', jobId)
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) {
      console.error('Error fetching cost codes:', error);
      return;
    }

    setCostCodes(data || []);
  };

  const fetchDynamicSummaries = async () => {
    const { data, error } = await supabase
      .from('dynamic_budget_summary')
      .select('*')
      .eq('job_id', jobId);

    if (error) {
      console.error('Error fetching dynamic summaries:', error);
      return;
    }

    const summariesMap: Record<string, DynamicBudgetSummary> = {};
    data?.forEach(summary => {
      summariesMap[summary.parent_budget_id] = summary;
    });
    setDynamicSummaries(summariesMap);
  };

  const handleCreateDynamicBudget = async () => {
    if (!newDynamicBudget.cost_code_id || !newDynamicBudget.budgeted_amount) {
      toast({
        title: "Missing information",
        description: "Please select a cost code and enter a budget amount",
        variant: "destructive"
      });
      return;
    }

    const user = await supabase.auth.getUser();
    if (!user.data.user) return;

    const { error } = await supabase
      .from('job_budgets')
      .insert({
        job_id: jobId,
        cost_code_id: newDynamicBudget.cost_code_id,
        budgeted_amount: parseFloat(newDynamicBudget.budgeted_amount),
        actual_amount: 0,
        committed_amount: 0,
        is_dynamic: true,
        created_by: user.data.user.id
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create dynamic budget",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: "Dynamic budget created successfully"
    });

    setNewDynamicBudget({ cost_code_id: "", budgeted_amount: "" });
    fetchData();
  };

  const handleCreateChildCostCode = async (parentBudgetId: string) => {
    const childData = newChildCode[parentBudgetId];
    if (!childData?.code || !childData?.description) {
      toast({
        title: "Missing information",
        description: "Please enter cost code and description",
        variant: "destructive"
      });
      return;
    }

    const user = await supabase.auth.getUser();
    if (!user.data.user) return;

    const parentBudget = budgets.find(b => b.id === parentBudgetId);
    if (!parentBudget) return;

    // Create child cost code
    const { data: newCostCode, error: costCodeError } = await supabase
      .from('cost_codes')
      .insert({
        job_id: jobId,
        code: childData.code,
        description: childData.description,
        parent_cost_code_id: parentBudget.cost_code_id,
        company_id: (await supabase
          .from('jobs')
          .select('company_id')
          .eq('id', jobId)
          .single()).data?.company_id,
        is_active: true
      })
      .select()
      .single();

    if (costCodeError) {
      toast({
        title: "Error",
        description: "Failed to create child cost code",
        variant: "destructive"
      });
      return;
    }

    // Create child budget entry with zero budgeted amount (will accumulate actuals)
    const { error: budgetError } = await supabase
      .from('job_budgets')
      .insert({
        job_id: jobId,
        cost_code_id: newCostCode.id,
        budgeted_amount: 0,
        actual_amount: 0,
        committed_amount: 0,
        is_dynamic: false,
        parent_budget_id: parentBudgetId,
        created_by: user.data.user.id
      });

    if (budgetError) {
      toast({
        title: "Error",
        description: "Failed to create child budget entry",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: "Child cost code created successfully"
    });

    setNewChildCode(prev => ({ ...prev, [parentBudgetId]: { code: "", description: "" } }));
    fetchData();
  };

  const toggleGroup = (budgetId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(budgetId)) {
        newSet.delete(budgetId);
      } else {
        newSet.add(budgetId);
      }
      return newSet;
    });
  };

  const availableParentCostCodes = costCodes.filter(cc => 
    !cc.parent_cost_code_id && 
    !budgets.some(b => b.cost_code_id === cc.id && b.is_dynamic)
  );

  const dynamicBudgets = budgets.filter(b => b.is_dynamic);
  const getChildBudgets = (parentId: string) => budgets.filter(b => b.parent_budget_id === parentId);

  return (
    <div className="space-y-6">
      {/* Create New Dynamic Budget */}
      <Card>
        <CardHeader>
          <CardTitle>Create Dynamic Budget Group</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Parent Cost Code</Label>
              <Select 
                value={newDynamicBudget.cost_code_id}
                onValueChange={(value) => setNewDynamicBudget(prev => ({ ...prev, cost_code_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a cost code" />
                </SelectTrigger>
                <SelectContent>
                  {availableParentCostCodes.map(cc => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} - {cc.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dynamic Budget Amount</Label>
              <CurrencyInput
                value={newDynamicBudget.budgeted_amount}
                onChange={(value) => setNewDynamicBudget(prev => ({ ...prev, budgeted_amount: value }))}
                placeholder="0.00"
              />
            </div>
          </div>
          <Button onClick={handleCreateDynamicBudget}>
            <Plus className="h-4 w-4 mr-2" />
            Create Dynamic Budget
          </Button>
        </CardContent>
      </Card>

      {/* Dynamic Budget Groups */}
      <div className="space-y-4">
        {dynamicBudgets.map(budget => {
          const summary = dynamicSummaries[budget.id];
          const childBudgets = getChildBudgets(budget.id);
          const isExpanded = expandedGroups.has(budget.id);

          return (
            <Card key={budget.id} className={summary?.is_over_budget ? "border-destructive" : ""}>
              <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(budget.id)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-70">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      <CardTitle className="text-base">
                        {budget.cost_codes.code} - {budget.cost_codes.description}
                      </CardTitle>
                      <Badge variant="secondary">Dynamic Budget</Badge>
                      {summary?.is_over_budget && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Over Budget
                        </Badge>
                      )}
                    </CollapsibleTrigger>
                  </div>
                  {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Budget</div>
                        <div className="font-semibold">${summary.dynamic_budget.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Actual</div>
                        <div className="font-semibold">${summary.total_actual_from_children.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Committed</div>
                        <div className="font-semibold">${summary.total_committed_from_children.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Remaining</div>
                        <div className={`font-semibold ${summary.remaining_budget < 0 ? 'text-destructive' : 'text-success'}`}>
                          ${summary.remaining_budget.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {/* Child Cost Codes */}
                    {childBudgets.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Child Cost Codes</Label>
                        <div className="space-y-2">
                          {childBudgets.map(child => (
                            <div key={child.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div>
                                <div className="font-medium">{child.cost_codes.code} - {child.cost_codes.description}</div>
                                <div className="text-sm text-muted-foreground">
                                  Actual: ${child.actual_amount.toLocaleString()} | 
                                  Committed: ${child.committed_amount.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Child Cost Code */}
                    <div className="border-t pt-4 space-y-4">
                      <Label className="text-sm font-medium">Add Child Cost Code</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm">Cost Code</Label>
                          <Input
                            value={newChildCode[budget.id]?.code || ""}
                            onChange={(e) => setNewChildCode(prev => ({
                              ...prev,
                              [budget.id]: { ...prev[budget.id], code: e.target.value }
                            }))}
                            placeholder="e.g., 1.09.01"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Description</Label>
                          <Input
                            value={newChildCode[budget.id]?.description || ""}
                            onChange={(e) => setNewChildCode(prev => ({
                              ...prev,
                              [budget.id]: { ...prev[budget.id], description: e.target.value }
                            }))}
                            placeholder="e.g., Materials"
                          />
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleCreateChildCostCode(budget.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Child Cost Code
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
