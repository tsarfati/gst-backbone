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
    if (selectedCostCodes.length >= 0) {
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

      if (codesError) throw codesError;

      // Load existing budget lines WITH cost code data
      const { data: budgetData, error: budgetError } = await supabase
        .from('job_budgets')
        .select(`
          id,
          job_id,
          cost_code_id,
          budgeted_amount,
          actual_amount,
          committed_amount,
          created_at,
          updated_at,
          cost_codes (
            id,
            code,
            description,
            type
          )
        `)
        .eq('job_id', id);

      if (budgetError) throw budgetError;

      // Set cost codes first
      setSelectedCostCodes(codes || []);
      
      // If we have budget data, use it directly (it already has cost_codes joined)
      if (budgetData && budgetData.length > 0) {
        setBudgetLines(budgetData.map(bd => ({
          id: bd.id,
          cost_code_id: bd.cost_code_id,
          budgeted_amount: bd.budgeted_amount,
          actual_amount: bd.actual_amount,
          committed_amount: bd.committed_amount,
          cost_code: bd.cost_codes
        })));
      } else {
        // If no budget data, create empty lines for all cost codes
        setBudgetLines((codes || []).map(code => ({
          cost_code_id: code.id,
          budgeted_amount: 0,
          actual_amount: 0,
          committed_amount: 0,
          cost_code: code
        })));
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
    setBudgetLines(currentLines => {
      // If no cost codes selected, preserve existing lines (don't clear)
      if (selectedCostCodes.length === 0) {
        return currentLines;
      }

      // Remove budget lines for cost codes that are no longer selected
      const filteredLines = currentLines.filter(line => 
        selectedCostCodes.some(code => code.id === line.cost_code_id)
      );

      // Add missing lines for newly selected cost codes
      const missingLines = selectedCostCodes
        .filter(code => !filteredLines.some(line => line.cost_code_id === code.id))
        .map(code => ({
          cost_code_id: code.id,
          budgeted_amount: 0,
          actual_amount: 0,
          committed_amount: 0,
          cost_code: code
        }));

      return [...filteredLines, ...missingLines];
    });
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

      // Prepare cost code mapping to ensure job-specific cost codes
      const { data: codeRecords, error: codesFetchError } = await supabase
        .from('cost_codes')
        .select('id, code, type, job_id, description, company_id')
        .in('id', budgetLines.map(l => l.cost_code_id));
      if (codesFetchError) throw codesFetchError;

      const { data: jobCodes, error: jobCodesError } = await supabase
        .from('cost_codes')
        .select('id, code, type')
        .eq('job_id', id);
      if (jobCodesError) throw jobCodesError;

      const jobCodeIndex = new Map<string, string>();
      (jobCodes || []).forEach(jc => jobCodeIndex.set(`${jc.code}|${jc.type}`, jc.id));

      // Resolve to job-specific cost code ids (create if missing)
      const resolvedIds: Record<string, string> = {};
      for (const rec of codeRecords || []) {
        if (rec.job_id) {
          resolvedIds[rec.id] = rec.id;
          continue;
        }
        const key = `${rec.code}|${rec.type}`;
        const existingJobCodeId = jobCodeIndex.get(key);
        if (existingJobCodeId) {
          resolvedIds[rec.id] = existingJobCodeId;
          continue;
        }
        // Create a job-specific cost code cloned from the master
        const { data: created, error: createErr } = await supabase
          .from('cost_codes')
          .insert({
            code: rec.code,
            description: rec.description,
            type: rec.type,
            company_id: rec.company_id,
            job_id: id,
            is_active: true,
            created_by: user.data.user?.id,
          })
          .select('id')
          .maybeSingle();
        if (createErr) throw createErr;
        if (created?.id) {
          jobCodeIndex.set(key, created.id);
          resolvedIds[rec.id] = created.id;
        }
      }

      // Insert new budget lines using resolved job-specific cost code ids
      const budgetInserts = budgetLines.map(line => ({
        job_id: id,
        cost_code_id: resolvedIds[line.cost_code_id] || line.cost_code_id,
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
      <div className="p-4 md:p-6">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading job data...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Job not found</p>
          <Button onClick={() => navigate("/jobs")}>Return to Jobs</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/jobs/${id}/edit`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cost Codes & Budget</h1>
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
                              type="text"
                              value={line.budgeted_amount ? line.budgeted_amount.toLocaleString('en-US') : ''}
                              onChange={(e) => {
                                const value = e.target.value.replace(/,/g, '');
                                updateBudgetLine(index, 'budgeted_amount', parseFloat(value) || 0);
                              }}
                              className="w-32 text-right"
                              placeholder="0"
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
                              type="text"
                              value={line.budgeted_amount ? line.budgeted_amount.toLocaleString('en-US') : ''}
                              onChange={(e) => {
                                const value = e.target.value.replace(/,/g, '');
                                updateBudgetLine(index, 'budgeted_amount', parseFloat(value) || 0);
                              }}
                              className="w-28 text-right text-sm"
                              placeholder="0"
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
