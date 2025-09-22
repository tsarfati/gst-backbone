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
  selectedCostCodes: CostCode[];
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

export default function JobBudgetManager({ jobId, jobName, selectedCostCodes }: JobBudgetManagerProps) {
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [jobId]);

  useEffect(() => {
    // Auto-populate budget lines for selected cost codes
    populateBudgetLines();
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
            description
          )
        `)
        .eq('job_id', jobId);

      if (budgetError) throw budgetError;

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

  const populateBudgetLines = () => {
    if (selectedCostCodes.length === 0) {
      setBudgetLines([]);
      return;
    }

    const newBudgetLines: BudgetLine[] = selectedCostCodes.map(costCode => {
      // Check if we already have a budget line for this cost code
      const existingLine = budgetLines.find(bl => bl.cost_code_id === costCode.id);
      
      if (existingLine) {
        return {
          ...existingLine,
          cost_code: costCode
        };
      }
      
      // Create new budget line
      return {
        cost_code_id: costCode.id,
        budgeted_amount: 0,
        actual_amount: 0,
        committed_amount: 0,
        cost_code: costCode
      };
    });

    setBudgetLines(newBudgetLines);
  };


  const updateBudgetLine = (index: number, field: keyof BudgetLine, value: any) => {
    const updated = [...budgetLines];
    updated[index] = { ...updated[index], [field]: value };
    setBudgetLines(updated);
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
          <Button onClick={saveBudget} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Budget'}
          </Button>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetLines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <span className="font-mono text-sm">
                      {line.cost_code?.code}
                    </span>
                  </TableCell>
                  <TableCell>
                    {line.cost_code?.description}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={line.budgeted_amount}
                      onChange={(e) => updateBudgetLine(index, 'budgeted_amount', parseFloat(e.target.value) || 0)}
                      className="w-32"
                      placeholder="0.00"
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
                </TableRow>
              ))}
              {budgetLines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No budget lines available. Select cost codes for this job to create budget lines.
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