import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Calculator, Check, ChevronsUpDown, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface CostDistribution {
  id: string;
  job_id: string;
  cost_code_id: string;
  amount: number;
  percentage: number;
}

interface BillCostDistributionProps {
  totalAmount: number;
  companyId: string;
  initialDistribution?: CostDistribution[];
  onChange: (distribution: CostDistribution[]) => void;
  disabled?: boolean;
}

interface Job {
  id: string;
  name: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  type: string;
  is_dynamic_group: boolean | null;
  parent_cost_code_id: string | null;
}

interface ExpenseAccount {
  id: string;
  account_number: string;
  account_name: string;
}

export default function BillCostDistribution({ 
  totalAmount, 
  companyId,
  initialDistribution = [], 
  onChange, 
  disabled = false
}: BillCostDistributionProps) {
  const [distribution, setDistribution] = useState<CostDistribution[]>(
    initialDistribution.length > 0 
      ? initialDistribution 
      : [{ id: crypto.randomUUID(), job_id: "", cost_code_id: "", amount: totalAmount || 0, percentage: 100 }]
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<ExpenseAccount[]>([]);
  const [costCodesByJob, setCostCodesByJob] = useState<Record<string, CostCode[]>>({});
  const [loading, setLoading] = useState(true);
  const [openPopover, setOpenPopover] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, [companyId]);

  useEffect(() => {
    if (initialDistribution.length > 0) {
      setDistribution(initialDistribution.map(d => ({ ...d })));
      initialDistribution.forEach(d => { if (d.job_id) loadCostCodesForJob(d.job_id); });
    }
  }, []);

  useEffect(() => {
    onChange(distribution);
  }, [distribution]);

  const loadData = async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      const [jobsResult, expenseResult] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, name')
          .eq('company_id', companyId)
          .order('name'),
        supabase
          .from('chart_of_accounts')
          .select('id, account_number, account_name')
          .eq('company_id', companyId)
          .in('account_type', ['expense', 'cost_of_goods_sold', 'asset', 'other_expense'])
          .eq('is_active', true)
          .order('account_number')
      ]);

      if (jobsResult.data) setJobs(jobsResult.data);
      if (expenseResult.data) setExpenseAccounts(expenseResult.data);
    } finally {
      setLoading(false);
    }
  };

  const loadCostCodesForJob = async (jobId: string) => {
    if (!jobId || costCodesByJob[jobId]) return;

    // Load all active cost codes for the job (excluding dynamic groups, but including their children)
    const { data } = await supabase
      .from('cost_codes')
      .select('id, code, description, type, is_dynamic_group, parent_cost_code_id')
      .eq('job_id', jobId)
      .eq('is_active', true)
      .order('code');

    if (data) {
      // Filter out dynamic groups AND cost codes with no type (dynamic placeholders)
      const filteredCodes = data.filter(code => !code.is_dynamic_group && code.type);
      setCostCodesByJob(prev => ({ ...prev, [jobId]: filteredCodes }));
    }
  };

  // Get cost codes for a job
  const getJobCostCodes = (jobId: string): CostCode[] => {
    return costCodesByJob[jobId] || [];
  };

  const addDistribution = () => {
    setDistribution(prev => [
      ...prev,
      { id: crypto.randomUUID(), job_id: "", cost_code_id: "", amount: 0, percentage: 0 }
    ]);
  };

  const removeDistribution = (id: string) => {
    if (distribution.length <= 1) return;
    setDistribution(prev => prev.filter(d => d.id !== id));
  };

  const updateDistribution = (id: string, field: keyof CostDistribution, value: any) => {
    setDistribution(prev => prev.map(d => {
      if (d.id !== id) return d;
      const updated = { ...d, [field]: value };
      
      // Load cost codes when job is selected
      if (field === 'job_id' && value) {
        loadCostCodesForJob(value);
        updated.cost_code_id = ''; // Reset cost code when job changes
      }
      
      // Recalculate percentage when amount changes
      if (field === 'amount' && totalAmount > 0) {
        updated.percentage = (Number(value) / totalAmount) * 100;
      }
      
      // Recalculate amount when percentage changes
      if (field === 'percentage' && totalAmount > 0) {
        updated.amount = (Number(value) / 100) * totalAmount;
      }
      
      return updated;
    }));
  };

  const distributeEvenly = () => {
    if (distribution.length === 0 || totalAmount <= 0) return;
    const amountEach = totalAmount / distribution.length;
    const percentageEach = 100 / distribution.length;
    setDistribution(prev => prev.map(d => ({
      ...d,
      amount: Math.round(amountEach * 100) / 100,
      percentage: Math.round(percentageEach * 100) / 100
    })));
  };

  const totalDistributed = distribution.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalPercentage = distribution.reduce((sum, d) => sum + (Number(d.percentage) || 0), 0);
  const remaining = totalAmount - totalDistributed;
  const isOverAllocated = totalDistributed > totalAmount + 0.01;
  const isUnderAllocated = remaining > 0.01;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Cost Distribution
            <Badge variant="secondary" className="text-xs">
              {distribution.length} Line{distribution.length > 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={distributeEvenly}
              disabled={disabled || distribution.length === 0}
            >
              <Calculator className="h-4 w-4 mr-1" />
              Distribute Evenly
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDistribution}
              disabled={disabled}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Line
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {distribution.map((dist, index) => (
          <div key={dist.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Line {index + 1}</span>
              {distribution.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDistribution(dist.id)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Job/Control Selector */}
              <div className="space-y-2">
                <Label>Job / Control</Label>
                <Popover 
                  open={openPopover[`job-${dist.id}`]} 
                  onOpenChange={(open) => setOpenPopover(prev => ({ ...prev, [`job-${dist.id}`]: open }))}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      disabled={disabled}
                    >
                      {dist.job_id ? (
                        (() => {
                          const job = jobs.find(j => j.id === dist.job_id);
                          const expense = expenseAccounts.find(e => e.id === dist.job_id);
                          return job?.name || (expense ? `${expense.account_number} - ${expense.account_name}` : 'Select...');
                        })()
                      ) : (
                        "Select job or expense..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search jobs or expenses..." />
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandList>
                        {jobs.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Jobs</div>
                            {jobs.map(job => (
                              <CommandItem
                                key={job.id}
                                value={`job-${job.name}`}
                                onSelect={() => {
                                  updateDistribution(dist.id, 'job_id', job.id);
                                  setOpenPopover(prev => ({ ...prev, [`job-${dist.id}`]: false }));
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    dist.job_id === job.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {job.name}
                              </CommandItem>
                            ))}
                          </>
                        )}
                        {expenseAccounts.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">Expense Accounts</div>
                            {expenseAccounts.map(account => (
                              <CommandItem
                                key={account.id}
                                value={`expense-${account.account_number}-${account.account_name}`}
                                onSelect={() => {
                                  updateDistribution(dist.id, 'job_id', account.id);
                                  updateDistribution(dist.id, 'cost_code_id', '');
                                  setOpenPopover(prev => ({ ...prev, [`job-${dist.id}`]: false }));
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    dist.job_id === account.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {account.account_number} - {account.account_name}
                              </CommandItem>
                            ))}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Cost Code Selector - only show if a job is selected (not expense account) */}
              {dist.job_id && jobs.find(j => j.id === dist.job_id) && (
                <div className="space-y-2">
                  <Label>Cost Code</Label>
                  <Popover 
                    open={openPopover[`cc-${dist.id}`]} 
                    onOpenChange={(open) => setOpenPopover(prev => ({ ...prev, [`cc-${dist.id}`]: open }))}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        disabled={disabled}
                      >
                        {dist.cost_code_id ? (
                          (() => {
                            const codes = costCodesByJob[dist.job_id] || [];
                            const code = codes.find(c => c.id === dist.cost_code_id);
                            if (!code) return 'Select...';
                            return (
                              <span className="flex items-center gap-2">
                                <span>{code.code} - {code.description}</span>
                                {code.type && (
                                  <Badge variant="secondary" className="text-xs capitalize">
                                    {code.type}
                                  </Badge>
                                )}
                              </span>
                            );
                          })()
                        ) : (
                          "Select cost code..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search cost codes..." />
                        <CommandEmpty>No cost codes found.</CommandEmpty>
                        <CommandList>
                          {getJobCostCodes(dist.job_id).map(code => (
                            <CommandItem
                              key={code.id}
                              value={`${code.code} ${code.description} ${code.type || ''}`}
                              onSelect={() => {
                                updateDistribution(dist.id, 'cost_code_id', code.id);
                                setOpenPopover(prev => ({ ...prev, [`cc-${dist.id}`]: false }));
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  dist.cost_code_id === code.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex items-center gap-2 flex-1">
                                <span className="flex-1">{code.code} - {code.description}</span>
                                {code.type && (
                                  <Badge variant="secondary" className="text-xs capitalize ml-auto">
                                    {code.type}
                                  </Badge>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Amount and Percentage */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <CurrencyInput
                  value={String(dist.amount || '')}
                  onChange={(value) => updateDistribution(dist.id, 'amount', parseFloat(value) || 0)}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label>Percentage</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={dist.percentage || ''}
                    onChange={(e) => updateDistribution(dist.id, 'percentage', parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Distribution Summary */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Bill Amount:</span>
            <span className="font-medium">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Total Distributed:</span>
            <span className={`font-medium ${isOverAllocated ? 'text-destructive' : ''}`}>
              ${totalDistributed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Total Percentage:</span>
            <span className="font-medium">{totalPercentage.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-sm font-medium border-t pt-2">
            <span>Remaining:</span>
            <span className={isOverAllocated ? 'text-destructive' : (isUnderAllocated ? 'text-warning' : 'text-success')}>
              ${Math.abs(remaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Validation Warnings */}
        {isOverAllocated && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              Distribution exceeds bill amount by ${Math.abs(remaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
        {!isOverAllocated && isUnderAllocated && (
          <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning rounded-lg">
            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
            <p className="text-sm text-warning">
              ${Math.abs(remaining).toLocaleString(undefined, { minimumFractionDigits: 2 })} remaining to be distributed
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
