import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface JobBudgetManagerProps {
  jobId: string;
  jobName?: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
}

interface BudgetLine {
  id?: string;
  cost_code_id: string;
  budgeted_amount: number;
  actual_amount: number;
  committed_amount: number;
  cost_code?: CostCode;
}

export default function JobBudgetManager({ jobId, jobName }: JobBudgetManagerProps) {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    try {
      // Load cost codes
      const { data: costCodesData, error: costCodesError } = await supabase
        .from('cost_codes')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (costCodesError) throw costCodesError;

      // Load existing budget lines
      const { data: budgetData, error: budgetError } = await supabase
        .from('job_budgets')
        .select(`
          *,
          cost_codes (
            id,
            code,
            description
          )
        `)
        .eq('job_id', jobId);

      if (budgetError) throw budgetError;

      setCostCodes(costCodesData || []);
      setBudgetLines(budgetData || []);
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

  const addBudgetLine = () => {
    const availableCostCode = costCodes.find(cc => 
      !budgetLines.some(bl => bl.cost_code_id === cc.id)
    );
    
    if (!availableCostCode) {
      toast({
        title: "No Available Cost Codes",
        description: "All cost codes have been added to the budget",
        variant: "destructive",
      });
      return;
    }

    setBudgetLines([...budgetLines, {
      cost_code_id: availableCostCode.id,
      budgeted_amount: 0,
      actual_amount: 0,
      committed_amount: 0,
      cost_code: availableCostCode
    }]);
  };

  const updateBudgetLine = (index: number, field: keyof BudgetLine, value: any) => {
    const updated = [...budgetLines];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'cost_code_id') {
      const costCode = costCodes.find(cc => cc.id === value);
      updated[index].cost_code = costCode;
    }
    
    setBudgetLines(updated);
  };

  const removeBudgetLine = (index: number) => {
    setBudgetLines(budgetLines.filter((_, i) => i !== index));
  };

  const saveBudget = async () => {
    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      
      // Delete existing budget lines
      await supabase
        .from('job_budgets')
        .delete()
        .eq('job_id', jobId);

      // Insert new budget lines
      const budgetInserts = budgetLines.map(line => ({
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

      // Update job total budget
      const totalBudget = budgetLines.reduce((sum, line) => sum + (line.budgeted_amount || 0), 0);
      await supabase
        .from('jobs')
        .update({ budget_total: totalBudget })
        .eq('id', jobId);

      toast({
        title: "Success",
        description: "Budget saved successfully",
      });

      loadData(); // Reload to get IDs
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

  const totalBudget = budgetLines.reduce((sum, line) => sum + (line.budgeted_amount || 0), 0);

  if (loading) {
    return <div>Loading budget data...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Job Budget - {jobName}</span>
          <div className="flex gap-2">
            <Button onClick={addBudgetLine} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
            <Button onClick={saveBudget} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Budget'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cost Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Budgeted Amount</TableHead>
                <TableHead>Actual Amount</TableHead>
                <TableHead>Committed Amount</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetLines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <select
                      value={line.cost_code_id}
                      onChange={(e) => updateBudgetLine(index, 'cost_code_id', e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      {costCodes.map(cc => (
                        <option key={cc.id} value={cc.id}>
                          {cc.code}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    {line.cost_code?.description || costCodes.find(cc => cc.id === line.cost_code_id)?.description}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={line.budgeted_amount}
                      onChange={(e) => updateBudgetLine(index, 'budgeted_amount', parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    ${(line.actual_amount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    ${(line.committed_amount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <span className={`${
                      (line.budgeted_amount - (line.actual_amount + line.committed_amount)) < 0 
                        ? 'text-destructive' 
                        : 'text-muted-foreground'
                    }`}>
                      ${(line.budgeted_amount - (line.actual_amount + line.committed_amount)).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeBudgetLine(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {budgetLines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No budget lines added. Click "Add Line" to start building your budget.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          <div className="flex justify-end p-4 border-t">
            <div className="text-lg font-semibold">
              Total Budget: ${totalBudget.toFixed(2)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}