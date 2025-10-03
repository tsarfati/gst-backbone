import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/formatNumber";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dynamicSummaries, setDynamicSummaries] = useState<Record<string, DynamicBudgetSummary>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [newDynamicBudget, setNewDynamicBudget] = useState({ cost_code_id: "", budgeted_amount: "" });
  const [newChildCode, setNewChildCode] = useState<Record<string, { code: string; description: string }>>({});
  const [availableCostCodes, setAvailableCostCodes] = useState<CostCode[]>([]);
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
      // Load existing budget lines
      const { data: budgetData, error: budgetError } = await supabase
        .from('job_budgets')
        .select(`
          *,
          cost_codes (
            id,
            code,
            description,
            type,
            parent_cost_code_id
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (budgetError) throw budgetError;

      setBudgetLines(budgetData || []);

      // Load dynamic summaries
      const { data: summariesData, error: summariesError } = await supabase
        .from('dynamic_budget_summary')
        .select('*')
        .eq('job_id', jobId);

      if (summariesError) throw summariesError;

      const summariesMap: Record<string, DynamicBudgetSummary> = {};
      summariesData?.forEach(summary => {
        summariesMap[summary.parent_budget_id] = summary;
      });
      setDynamicSummaries(summariesMap);

      // Load available cost codes for dynamic budgets
      const { data: jobData } = await supabase
        .from('jobs')
        .select('company_id')
        .eq('id', jobId)
        .single();

      if (jobData) {
        const { data: availableCodes } = await supabase
          .from('cost_codes')
          .select('*')
          .eq('job_id', jobId)
          .eq('is_active', true)
          .is('parent_cost_code_id', null)
          .order('code', { ascending: true });

        setAvailableCostCodes(availableCodes || []);
      }
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

  const populateBudgetLines = () => {
    console.log('populateBudgetLines called with', selectedCostCodes.length, 'cost codes');
    
    if (selectedCostCodes.length === 0) {
      console.log('No cost codes selected, clearing budget lines');
      setBudgetLines([]);
      return;
    }

    const newBudgetLines: BudgetLine[] = selectedCostCodes.map(costCode => {
      // Check if we already have a budget line for this cost code
      const existingLine = budgetLines.find(bl => bl.cost_code_id === costCode.id);
      
      console.log('Processing cost code:', costCode.code, 'existing:', !!existingLine);
      
      if (existingLine) {
        return {
          ...existingLine,
          cost_code: costCode
        };
      }
      
      // Create new budget line with zero amounts
      return {
        cost_code_id: costCode.id,
        budgeted_amount: 0,
        actual_amount: 0,
        committed_amount: 0,
        cost_code: costCode
      };
    });

    console.log('Setting', newBudgetLines.length, 'budget lines');
    setBudgetLines(newBudgetLines);
  };


  const updateBudgetLine = (index: number, field: keyof BudgetLine, value: any) => {
    const updated = [...budgetLines];
    updated[index] = { ...updated[index], [field]: value };
    setBudgetLines(updated);
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
    loadData();
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

    const parentBudget = budgetLines.find(b => b.id === parentBudgetId);
    if (!parentBudget) return;

    const { data: jobData } = await supabase
      .from('jobs')
      .select('company_id')
      .eq('id', jobId)
      .single();

    // Create child cost code
    const { data: newCostCode, error: costCodeError } = await supabase
      .from('cost_codes')
      .insert({
        job_id: jobId,
        code: childData.code,
        description: childData.description,
        parent_cost_code_id: parentBudget.cost_code_id,
        company_id: jobData?.company_id,
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

    // Create child budget entry
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
    loadData();
  };

  const saveBudget = async () => {
    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      
      // Only save non-dynamic budget lines (regular budgets)
      const regularBudgets = budgetLines.filter(line => !line.is_dynamic && !line.parent_budget_id);
      
      // Delete existing regular budget lines
      await supabase
        .from('job_budgets')
        .delete()
        .eq('job_id', jobId)
        .eq('is_dynamic', false)
        .is('parent_budget_id', null);

      if (regularBudgets.length > 0) {
        // Insert new budget lines
        const budgetInserts = regularBudgets.map(line => ({
          job_id: jobId,
          cost_code_id: line.cost_code_id,
          budgeted_amount: line.budgeted_amount,
          actual_amount: line.actual_amount || 0,
          committed_amount: line.committed_amount || 0,
          created_by: user.data.user?.id
        }));

        const { error } = await supabase
          .from('job_budgets')
          .insert(budgetInserts);

        if (error) throw error;
      }

      // Update job total budget (including dynamic budgets)
      const totalBudget = budgetLines
        .filter(line => !line.parent_budget_id) // Only top-level budgets
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

  const availableParentCostCodes = availableCostCodes.filter(cc => 
    !budgetLines.some(b => b.cost_code_id === cc.id && b.is_dynamic)
  );

  const dynamicBudgets = budgetLines.filter(b => b.is_dynamic);
  const regularBudgets = budgetLines.filter(b => !b.is_dynamic && !b.parent_budget_id);
  const getChildBudgets = (parentId: string) => budgetLines.filter(b => b.parent_budget_id === parentId);

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
        {/* Create Dynamic Budget Section */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Create Dynamic Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a dynamic budget for a parent cost code. Child codes will automatically roll up to this budget.
            </p>
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
            <Button onClick={handleCreateDynamicBudget} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Dynamic Budget
            </Button>
          </CardContent>
        </Card>

        {/* Unified Budget Display */}
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={saveBudget} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Budget'}
            </Button>
          </div>

          {/* Dynamic Budgets with nested children */}
          {dynamicBudgets.map(budget => {
            const summary = dynamicSummaries[budget.id!];
            const childBudgets = getChildBudgets(budget.id!);
            const isExpanded = expandedGroups.has(budget.id!);

            return (
              <Card key={budget.id} className={summary?.is_over_budget ? "border-destructive" : ""}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleGroup(budget.id!)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-70">
                        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{budget.cost_code?.code}</span>
                          <span>{budget.cost_code?.description}</span>
                          <Badge variant="secondary">Dynamic Budget</Badge>
                          {summary?.is_over_budget && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Over Budget
                            </Badge>
                          )}
                        </div>
                      </CollapsibleTrigger>
                    </div>
                    {summary && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm pl-7">
                        <div>
                          <div className="text-muted-foreground">Budget</div>
                          <div className="font-semibold">{formatCurrency(summary.dynamic_budget)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Actual</div>
                          <div className="font-semibold">{formatCurrency(summary.total_actual_from_children)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Committed</div>
                          <div className="font-semibold">{formatCurrency(summary.total_committed_from_children)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Remaining</div>
                          <div className={`font-semibold ${summary.remaining_budget < 0 ? 'text-destructive' : ''}`}>
                            {formatCurrency(summary.remaining_budget)}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-4">
                      {/* Child Cost Codes */}
                      {childBudgets.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cost Code</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Actual</TableHead>
                              <TableHead>Committed</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {childBudgets.map(child => (
                              <TableRow key={child.id}>
                                <TableCell>
                                  <span className="font-mono text-sm">{child.cost_code?.code}</span>
                                </TableCell>
                                <TableCell>{child.cost_code?.description}</TableCell>
                                <TableCell>{formatCurrency(child.actual_amount)}</TableCell>
                                <TableCell>{formatCurrency(child.committed_amount)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}

                      {/* Add Child Cost Code */}
                      <div className="border-t pt-4 space-y-4">
                        <Label className="text-sm font-medium">Add Child Cost Code</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm">Cost Code</Label>
                            <Input
                              value={newChildCode[budget.id!]?.code || ""}
                              onChange={(e) => setNewChildCode(prev => ({
                                ...prev,
                                [budget.id!]: { ...prev[budget.id!], code: e.target.value }
                              }))}
                              placeholder={`e.g., ${budget.cost_code?.code}.01`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Description</Label>
                            <Input
                              value={newChildCode[budget.id!]?.description || ""}
                              onChange={(e) => setNewChildCode(prev => ({
                                ...prev,
                                [budget.id!]: { ...prev[budget.id!], description: e.target.value }
                              }))}
                              placeholder="e.g., Materials"
                            />
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleCreateChildCostCode(budget.id!)}
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

          {/* Regular Budget Lines */}
          {regularBudgets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Regular Budget Lines</CardTitle>
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
                    {regularBudgets.map((line, index) => {
                      const actualIndex = budgetLines.findIndex(b => b.id === line.id);
                      return (
                        <TableRow key={line.id || index}>
                          <TableCell>
                            <span className="font-mono text-sm">{line.cost_code?.code}</span>
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
                              onChange={(value) => updateBudgetLine(actualIndex, 'budgeted_amount', parseFloat(value) || 0)}
                              className="w-32"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>{formatCurrency(line.actual_amount)}</TableCell>
                          <TableCell>{formatCurrency(line.committed_amount)}</TableCell>
                          <TableCell>
                            <span className={`${
                              (line.budgeted_amount - (line.actual_amount + line.committed_amount)) < 0 
                                ? 'text-destructive' 
                                : 'text-muted-foreground'
                            }`}>
                              {formatCurrency(line.budgeted_amount - (line.actual_amount + line.committed_amount))}
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
                No budget lines available. Select cost codes for this job or create dynamic budgets.
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