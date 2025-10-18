import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Calculator, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CostDistribution {
  id: string;
  job_id: string;
  cost_code_id: string;
  amount: number;
  percentage: number;
  job_name?: string;
  cost_code_display?: string;
}

interface ReceiptCostDistributionProps {
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
}

export default function ReceiptCostDistribution({ 
  totalAmount, 
  companyId,
  initialDistribution = [], 
  onChange, 
  disabled = false 
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
const [categoryFilter, setCategoryFilter] = useState<Record<string, 'all' | 'material' | 'equipment' | 'sub' | 'other'>>({});

  useEffect(() => {
    loadJobs();
  }, [companyId]);

  useEffect(() => {
    onChange(distribution);
  }, [distribution]);

  const loadJobs = async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name');

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
      percentage: 0
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
      
      // If job changes, load cost codes and reset cost code selection
      if (field === 'job_id') {
        loadCostCodesForJob(value);
        updated.cost_code_id = '';
        const job = jobs.find(j => j.id === value);
        updated.job_name = job?.name;
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
                <Label className="text-xs">Job</Label>
                <Select
                  value={dist.job_id}
                  onValueChange={(value) => updateDistribution(dist.id, 'job_id', value)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-md z-50">
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Cost Code</Label>
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
                  <PopoverContent className="w-[400px] p-0 bg-popover border border-border shadow-md z-50" align="start">
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
                        <SelectContent className="z-50 bg-popover border border-border">
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="material">Material</SelectItem>
                          <SelectItem value="equipment">Equipment</SelectItem>
                          <SelectItem value="sub">Subcontract</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Command>
                      <CommandInput placeholder="Search cost codes..." className="h-8" />
                      <CommandEmpty>No cost code found.</CommandEmpty>
                      <CommandGroup className="max-h-[300px] overflow-auto">
                        {costCodesForJob.map((cc) => (
                        <CommandItem
                          key={cc.id}
                          value={`${cc.id}-${cc.code} ${cc.description}`}
                          onSelect={() => {
                            updateDistribution(dist.id, 'cost_code_id', cc.id);
                          }}
                          className="hover:bg-primary/10 hover:text-primary"
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
