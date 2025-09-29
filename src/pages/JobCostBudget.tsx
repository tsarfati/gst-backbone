import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Loader2, Grid3X3, List, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import JobCostCodeSelector from "@/components/JobCostCodeSelector";
import { formatCurrency } from "@/utils/formatNumber";

type ViewType = "compact" | "super-compact";

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
  cost_code?: CostCode;
}

export default function JobCostBudget() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewType, setViewType] = useState<ViewType>("compact");
  const [selectedCostCodes, setSelectedCostCodes] = useState<CostCode[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [activeTab, setActiveTab] = useState('budget');

  const isPlanning = job?.status === 'planning';
  const canEdit = isPlanning;

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (selectedCostCodes.length > 0) {
      populateBudgetLines();
    }
  }, [selectedCostCodes]);

  const loadData = async () => {
    try {
      // Load job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (jobError) throw jobError;
      setJob(jobData);

      // Load cost codes for this job
      const { data: codes, error: codesError } = await supabase
        .from('cost_codes')
        .select('id, code, description, type, job_id, company_id, is_active')
        .eq('job_id', id)
        .eq('is_active', true);

      if (!codesError && codes) {
        setSelectedCostCodes(codes);
      }

      // Load existing budget lines
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
        .eq('job_id', id);

      if (!budgetError && budgetData) {
        setBudgetLines(budgetData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load job data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const populateBudgetLines = () => {
    const newBudgetLines: BudgetLine[] = selectedCostCodes.map(costCode => {
      const existingLine = budgetLines.find(bl => bl.cost_code_id === costCode.id);
      
      if (existingLine) {
        return {
          ...existingLine,
          cost_code: costCode
        };
      }
      
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
    if (!canEdit) {
      toast({
        title: "Permission Denied",
        description: "Budget can only be edited when job is in Planning status",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      
      // Delete existing budget lines
      await supabase
        .from('job_budgets')
        .delete()
        .eq('job_id', id);

      // Insert new budget lines
      const budgetInserts = budgetLines.map(line => ({
        job_id: id,
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
        .eq('id', id);

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

  const totalBudget = budgetLines.reduce((sum, line) => sum + (line.budgeted_amount || 0), 0);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading job data...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Job not found</p>
          <Button onClick={() => navigate("/jobs")}>Return to Jobs</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/jobs/${id}/edit`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cost Codes & Budget</h1>
            <p className="text-muted-foreground">
              {job.name} • Status: <span className="font-semibold capitalize">{job.status}</span>
              {!isPlanning && <span className="ml-2 text-xs">(Read-only)</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 border border-border rounded-md p-1">
            <Button
              variant={viewType === "compact" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewType("compact")}
              className="h-8 w-8 p-0"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewType === "super-compact" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewType("super-compact")}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {!isPlanning && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Budget and cost codes can only be edited when the job is in Planning status. Contact an administrator to change the job status.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="cost-codes">Cost Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="budget" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Job Budget</span>
                <Button onClick={saveBudget} disabled={saving || !canEdit}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Budget'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    {viewType === "compact" && (
                      <>
                        <TableHead>Cost Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Budgeted</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Committed</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                      </>
                    )}
                    {viewType === "super-compact" && (
                      <>
                        <TableHead>Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetLines.map((line, index) => (
                    <TableRow key={index}>
                      {viewType === "compact" && (
                        <>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {line.cost_code?.code}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              {line.cost_code?.description}
                              {line.cost_code?.type && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({line.cost_code.type})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={line.budgeted_amount}
                              onChange={(e) => updateBudgetLine(index, 'budgeted_amount', parseFloat(e.target.value) || 0)}
                              className="w-32 text-right"
                              placeholder="0.00"
                              disabled={!canEdit}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(line.actual_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(line.committed_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`${
                              (line.budgeted_amount - (line.actual_amount + line.committed_amount)) < 0 
                                ? 'text-destructive' 
                                : 'text-muted-foreground'
                            }`}>
                              {formatCurrency(line.budgeted_amount - (line.actual_amount + line.committed_amount))}
                            </span>
                          </TableCell>
                        </>
                      )}
                      {viewType === "super-compact" && (
                        <>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {line.cost_code?.code}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {line.cost_code?.description}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={line.budgeted_amount}
                              onChange={(e) => updateBudgetLine(index, 'budgeted_amount', parseFloat(e.target.value) || 0)}
                              className="w-28 text-right text-sm"
                              placeholder="0.00"
                              disabled={!canEdit}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`text-sm ${
                              (line.budgeted_amount - (line.actual_amount + line.committed_amount)) < 0 
                                ? 'text-destructive font-semibold' 
                                : 'text-muted-foreground'
                            }`}>
                              {formatCurrency(line.budgeted_amount - (line.actual_amount + line.committed_amount))}
                            </span>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {budgetLines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={viewType === "compact" ? 6 : 4} className="text-center text-muted-foreground">
                        No budget lines available. Add cost codes in the Cost Codes tab.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              <div className="flex justify-end p-4 border-t mt-4">
                <div className="text-lg font-semibold">
                  Total Budget: {formatCurrency(totalBudget)}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost-codes" className="mt-6">
          <JobCostCodeSelector
            jobId={id}
            selectedCostCodes={selectedCostCodes}
            onSelectedCostCodesChange={setSelectedCostCodes}
            disabled={!canEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
