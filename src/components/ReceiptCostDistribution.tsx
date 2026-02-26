import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Calculator, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";

interface CostDistribution {
  id: string;
  job_id: string;
  cost_code_id: string;
  amount: number;
  percentage: number;
  job_name?: string;
  cost_code_display?: string;
  chart_account_id?: string;
}

interface ReceiptCostDistributionProps {
  totalAmount: number;
  companyId: string;
  initialDistribution?: CostDistribution[];
  onChange: (distribution: CostDistribution[]) => void;
  disabled?: boolean;
  expenseAccounts?: ExpenseAccount[];
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
}

interface ExpenseAccount {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
}

export default function ReceiptCostDistribution({ 
  totalAmount, 
  companyId,
  initialDistribution = [], 
  onChange, 
  disabled = false,
  expenseAccounts = []
}: ReceiptCostDistributionProps) {
  const { toast } = useToast();
  const [distribution, setDistribution] = useState<CostDistribution[]>(
    initialDistribution.length > 0 
      ? initialDistribution 
      : [{ id: crypto.randomUUID(), job_id: "", cost_code_id: "", amount: totalAmount || 0, percentage: 100 }]
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodesByJob, setCostCodesByJob] = useState<Record<string, CostCode[]>>({});
const [loading, setLoading] = useState(true);
const [categoryFilter, setCategoryFilter] = useState<Record<string, 'all' | 'labor' | 'material' | 'equipment' | 'sub' | 'other'>>({});
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();

  useEffect(() => {
    if (websiteJobAccessLoading) return;
    loadJobs();
  }, [companyId, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  // Sync only once when modal opens with initial data
  useEffect(() => {
    if (!initialDistribution) return;
    if (initialDistribution.length > 0) {
      setDistribution(initialDistribution.map(d => ({ ...d })));
      initialDistribution.forEach(d => { if (d.job_id) loadCostCodesForJob(d.job_id); });
    } else {
      setDistribution([{ id: crypto.randomUUID(), job_id: "", cost_code_id: "", amount: totalAmount || 0, percentage: 100 }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onChange(distribution);
  }, [distribution]);

  const loadJobs = async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      let jobsQuery = supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', companyId);
      if (!isPrivileged) {
        jobsQuery = jobsQuery.in('id', allowedJobIds.length ? allowedJobIds : ['00000000-0000-0000-0000-000000000000']);
      }
      const { data, error } = await jobsQuery.order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCostCodesForJob = async (jobId: string) => {
    if (!jobId || costCodesByJob[jobId]) return;

    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .eq('is_dynamic_group', false)
        .neq('type', 'dynamic_group')
        .neq('type', 'dynamic_parent')
        .order('code');

      if (error) throw error;
      setCostCodesByJob(prev => ({
        ...prev,
        [jobId]: data || []
      }));
    } catch (error) {
      console.error('Error loading cost codes:', error);
      toast({
        title: "Error",
        description: "Failed to load cost codes",
        variant: "destructive",
      });
    }
  };

  const addDistribution = () => {
    const newDistribution: CostDistribution = {
      id: crypto.randomUUID(),
      job_id: '',
      cost_code_id: '',
      amount: 0,
      percentage: 0,
      chart_account_id: ''
    };
    setDistribution(prev => [...prev, newDistribution]);
  };

  const removeDistribution = (id: string) => {
    if (distribution.length === 1) {
      toast({
        title: "Cannot remove",
        description: "At least one distribution item is required",
        variant: "destructive",
      });
      return;
    }
    setDistribution(prev => prev.filter(d => d.id !== id));
  };

  const updateDistribution = (id: string, field: keyof CostDistribution, value: any) => {
    setDistribution(prev => prev.map(d => {
      if (d.id !== id) return d;
      
      const updated = { ...d, [field]: value };
      
      // If job_or_account changes (special field for Job/Control dropdown)
      if (field === 'job_id' && value.startsWith) {
        const [type, itemId] = value.split('_');
        if (type === 'job') {
          updated.job_id = itemId;
          updated.chart_account_id = '';
          loadCostCodesForJob(itemId);
          updated.cost_code_id = '';
          const job = jobs.find(j => j.id === itemId);
          updated.job_name = job?.name;
        } else if (type === 'account') {
          updated.chart_account_id = itemId;
          updated.job_id = '';
          updated.cost_code_id = '';
          updated.job_name = '';
        }
      }
      // Regular job_id update (backward compatibility)
      else if (field === 'job_id' && value && !value.startsWith) {
        loadCostCodesForJob(value);
        updated.cost_code_id = '';
        const job = jobs.find(j => j.id === value);
        updated.job_name = job?.name;
        updated.chart_account_id = '';
      }
      
      // If cost code changes, update display
      if (field === 'cost_code_id' && d.job_id) {
        const costCodes = costCodesByJob[d.job_id] || [];
        const costCode = costCodes.find(cc => cc.id === value);
        if (costCode) {
          updated.cost_code_display = `${costCode.code} - ${costCode.description}`;
        }
      }
      
      // If amount changes, recalculate percentage
      if (field === 'amount' && totalAmount > 0) {
        updated.percentage = (parseFloat(value) / totalAmount) * 100;
      }
      
      // If percentage changes, recalculate amount
      if (field === 'percentage' && totalAmount > 0) {
        updated.amount = (totalAmount * parseFloat(value)) / 100;
      }

      return updated;
    }));
  };

  const distributeEvenly = () => {
    if (distribution.length === 0) return;
    
    const amountPerDistribution = totalAmount / distribution.length;
    const percentagePerDistribution = 100 / distribution.length;
    
    setDistribution(prev => prev.map(d => ({
      ...d,
      amount: amountPerDistribution,
      percentage: percentagePerDistribution
    })));
  };

  const totalDistributed = distribution.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalPercentage = distribution.reduce((sum, d) => sum + (d.percentage || 0), 0);
  const remaining = totalAmount - totalDistributed;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Cost Distribution</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={distributeEvenly}
              disabled={disabled || distribution.length === 0 || !totalAmount}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Distribute Evenly
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDistribution}
              disabled={disabled}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {distribution.map((dist, index) => {
          const rawCostCodesForJob = dist.job_id ? (costCodesByJob[dist.job_id] || []) : [];
          const filterCat = categoryFilter[dist.id] || 'all';
          const costCodesForJob = rawCostCodesForJob.filter(cc => filterCat === 'all' ? true : ((cc.type || 'other') === filterCat));
          return (
            <div key={dist.id} className="p-4 border rounded-lg space-y-3 bg-accent/10">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Item #{index + 1}</h4>
                {distribution.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDistribution(dist.id)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div>
                <Label className="text-xs">Job/Control *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      disabled={disabled}
                      className="w-full h-8 justify-between text-xs font-normal"
                    >
                      {dist.job_id 
                        ? jobs.find(j => j.id === dist.job_id)?.name || 'Select job or expense account'
                        : dist.chart_account_id
                          ? (() => {
                              const account = expenseAccounts.find(a => a.id === dist.chart_account_id);
                              return account ? `${account.account_number} - ${account.account_name}` : 'Select job or expense account';
                            })()
                          : 'Select job or expense account'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 z-[1000] bg-background shadow-lg border" onWheel={(e) => e.stopPropagation()}>
                    <Command>
                      <CommandInput placeholder="Search jobs or accounts..." />
                      <CommandList className="max-h-72 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                        <CommandEmpty>No results found.</CommandEmpty>
                        {jobs.length > 0 && (
                          <CommandGroup heading="Jobs">
                            {jobs.map((job) => (
                              <CommandItem
                                key={`job_${job.id}`}
                                value={job.name}
                                onSelect={() => updateDistribution(dist.id, 'job_id', `job_${job.id}`)}
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
                          </CommandGroup>
                        )}
                        {expenseAccounts.length > 0 && (
                          <CommandGroup heading="Expense Accounts">
                            {expenseAccounts.map((account) => (
                              <CommandItem
                                key={`account_${account.id}`}
                                value={`${account.account_number} ${account.account_name}`}
                                onSelect={() => updateDistribution(dist.id, 'job_id', `account_${account.id}`)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    dist.chart_account_id === account.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {account.account_number} - {account.account_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {dist.job_id && (
              <div>
                <Label className="text-xs">Cost Code *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      disabled={disabled || !dist.job_id}
                      className={cn(
                        "w-full h-8 justify-between text-xs font-normal transition-colors hover:bg-primary/10 hover:text-primary",
                        !dist.cost_code_id && "text-muted-foreground"
                      )}
                    >
                      {dist.cost_code_id
                        ? (() => {
                            const selected = costCodesForJob.find((cc) => cc.id === dist.cost_code_id);
                            return selected ? `${selected.code} - ${selected.description}` : "Select cost code";
                          })()
                        : dist.job_id ? "Select cost code" : "Select job first"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 bg-popover border border-border shadow-md z-50" align="start" onWheel={(e) => e.stopPropagation()}>
                    {/* Category Filter */}
                    <div className="p-2 border-b bg-card flex items-center gap-2">
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={filterCat}
                        onValueChange={(value) => setCategoryFilter(prev => ({ ...prev, [dist.id]: value as any }))}
                      >
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent className="z-50 bg-popover border border-border max-h-[200px] overflow-y-auto">
                          <SelectItem value="all" className="hover:bg-primary/10 hover:text-primary">All</SelectItem>
                          <SelectItem value="labor" className="hover:bg-primary/10 hover:text-primary">Labor</SelectItem>
                          <SelectItem value="material" className="hover:bg-primary/10 hover:text-primary">Material</SelectItem>
                          <SelectItem value="equipment" className="hover:bg-primary/10 hover:text-primary">Equipment</SelectItem>
                          <SelectItem value="sub" className="hover:bg-primary/10 hover:text-primary">Subcontract</SelectItem>
                          <SelectItem value="other" className="hover:bg-primary/10 hover:text-primary">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Command>
                      <CommandInput placeholder="Search cost codes..." className="h-8" />
                      <CommandEmpty>No cost code found.</CommandEmpty>
                      <CommandGroup className="max-h-[300px] overflow-auto" onWheel={(e) => e.stopPropagation()}>
                        {costCodesForJob.map((cc) => (
                        <CommandItem
                          key={cc.id}
                          value={`${cc.id}-${cc.code} ${cc.description}`}
                          onSelect={() => {
                            updateDistribution(dist.id, 'cost_code_id', cc.id);
                          }}
                          className="hover:bg-primary/10 hover:text-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                        >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                dist.cost_code_id === cc.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="text-xs">
                              {cc.code} - {cc.description}
                              {cc.type && (
                                <span className="text-muted-foreground ml-1">
                                  ({cc.type.charAt(0).toUpperCase() + cc.type.slice(1)})
                                </span>
                              )}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Amount</Label>
                  <CurrencyInput
                    value={dist.amount?.toString() || ''}
                    onChange={(value) => updateDistribution(dist.id, 'amount', parseFloat(value) || 0)}
                    placeholder="0.00"
                    disabled={disabled}
                    className="h-8"
                  />
                </div>

                <div>
                  <Label className="text-xs">Percentage</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={dist.percentage?.toFixed(2) || ''}
                      onChange={(e) => updateDistribution(dist.id, 'percentage', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      disabled={disabled}
                      className="h-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Summary */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Total Distributed</p>
              <p className="font-semibold">${totalDistributed.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Percentage</p>
              <p className="font-semibold">{totalPercentage.toFixed(2)}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Remaining</p>
              <p className={`font-semibold ${Math.abs(remaining) < 0.01 ? 'text-success' : 'text-warning'}`}>
                ${remaining.toFixed(2)}
              </p>
              {Math.abs(remaining) > 0.01 && (
                <Badge variant={remaining < 0 ? 'destructive' : 'secondary'} className="text-xs">
                  {remaining < 0 ? 'Over' : 'Under'}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
