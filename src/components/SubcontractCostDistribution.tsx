import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calculator, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CostDistribution {
  id?: string;
  cost_code_id: string;
  amount: number;
  description?: string;
  cost_code_description?: string;
}

interface SubcontractCostDistributionProps {
  contractAmount: number;
  jobId: string;
  initialDistribution?: CostDistribution[];
  onChange: (distribution: CostDistribution[]) => void;
  disabled?: boolean;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  type: string;
}

interface JobBudget {
  id: string;
  cost_code_id: string;
  budgeted_amount: number;
  actual_amount: number;
  committed_amount: number;
}

export default function SubcontractCostDistribution({ 
  contractAmount, 
  jobId,
  initialDistribution = [], 
  onChange, 
  disabled = false 
}: SubcontractCostDistributionProps) {
  const { toast } = useToast();
  const [distribution, setDistribution] = useState<CostDistribution[]>(initialDistribution);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [jobBudgets, setJobBudgets] = useState<JobBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdowns, setOpenDropdowns] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadCostCodes();
  }, [jobId]);

  useEffect(() => {
    onChange(distribution);
  }, [distribution, onChange]);

  const loadCostCodes = async () => {
    if (!jobId) return;

    try {
      setLoading(true);

      // Load cost codes for this job (subcontractor category only)
      const { data: costCodesData, error: costCodesError } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('job_id', jobId)
        .eq('type', 'sub') // Only subcontractor cost codes
        .eq('is_active', true)
        .eq('is_dynamic_group', false)
        .order('code');

      // Load job budgets for budget validation
      const { data: budgetData, error: budgetError } = await supabase
        .from('job_budgets')
        .select('id, cost_code_id, budgeted_amount, actual_amount, committed_amount')
        .eq('job_id', jobId);

      if (costCodesError) throw costCodesError;
      if (budgetError) throw budgetError;
      
      setCostCodes(costCodesData || []);
      setJobBudgets(budgetData || []);

    } catch (error) {
      console.error('Error loading cost codes:', error);
      toast({
        title: "Error",
        description: "Failed to load cost codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addDistribution = () => {
    const newId = `temp-${Date.now()}`;
    const newDistribution: CostDistribution = {
      id: newId,
      cost_code_id: '',
      amount: 0,
      description: ''
    };
    setDistribution(prev => [...prev, newDistribution]);
  };

  const removeDistribution = (id: string) => {
    setDistribution(prev => prev.filter(d => d.id !== id));
  };

  const updateDistribution = (id: string, field: keyof CostDistribution, value: any) => {
    setDistribution(prev => prev.map(d => {
      if (d.id !== id) return d;
      
      const updated = { ...d, [field]: value };
      return updated;
    }));
  };

  const distributeEvenly = () => {
    if (distribution.length === 0) return;
    
    const amountPerDistribution = contractAmount / distribution.length;
    
    setDistribution(prev => prev.map(d => ({
      ...d,
      amount: amountPerDistribution
    })));
  };

  const totalDistributed = distribution.reduce((sum, d) => sum + (d.amount || 0), 0);
  const remaining = contractAmount - totalDistributed;

  // Helper function to get budget warning for a cost code
  const getBudgetWarning = (costCodeId: string, amount: number) => {
    const budget = jobBudgets.find(b => b.cost_code_id === costCodeId);
    if (!budget) return null;
    
    const availableBudget = budget.budgeted_amount - budget.actual_amount - budget.committed_amount;
    if (amount > availableBudget) {
      return {
        type: 'over-budget' as const,
        message: `Exceeds available budget by $${(amount - availableBudget).toLocaleString()}`,
        availableBudget
      };
    }
    return null;
  };

  if (loading) {
    return <div className="text-center text-muted-foreground py-4">Loading cost codes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold">Cost Code Distribution</h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={distributeEvenly}
            disabled={disabled || distribution.length === 0}
          >
            <Calculator className="h-4 w-4 mr-1" />
            Even
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addDistribution}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {distribution.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">
          <p>No cost code distributions added yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {distribution.map((dist, index) => {
            const costCode = costCodes.find(cc => cc.id === dist.cost_code_id);
            return (
              <div key={dist.id} className="p-4 border rounded-md bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Distribution #{index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDistribution(dist.id!)}
                    disabled={disabled}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Cost Code</Label>
                    <Popover 
                      open={openDropdowns[dist.id!] || false} 
                      onOpenChange={(open) => setOpenDropdowns(prev => ({ ...prev, [dist.id!]: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openDropdowns[dist.id!] || false}
                          className="w-full justify-between h-8"
                          disabled={disabled}
                        >
                          {dist.cost_code_id
                            ? costCodes.find((cc) => cc.id === dist.cost_code_id)?.code
                            : "Select cost code..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0 bg-background border shadow-md z-50">
                        <Command>
                          <CommandInput placeholder="Search cost codes..." className="h-9" />
                          <CommandList>
                            <CommandEmpty>No cost codes found.</CommandEmpty>
                            <CommandGroup>
                              {costCodes.map((costCode) => (
                                <CommandItem
                                  key={costCode.id}
                                  value={`${costCode.code} ${costCode.description}`}
                                  onSelect={() => {
                                    updateDistribution(dist.id!, 'cost_code_id', costCode.id);
                                    setOpenDropdowns(prev => ({ ...prev, [dist.id!]: false }));
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      dist.cost_code_id === costCode.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="font-medium text-sm">{costCode.code}</span>
                                    <span className="text-sm text-muted-foreground flex-1">{costCode.description}</span>
                                    <Badge variant="secondary" className="text-xs">{costCode.type}</Badge>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div>
                    <Label className="text-xs">Amount</Label>
                    <CurrencyInput
                      value={dist.amount?.toString() || ''}
                      onChange={(value) => updateDistribution(dist.id!, 'amount', parseFloat(value) || 0)}
                      placeholder="0.00"
                      disabled={disabled}
                      className="h-8"
                    />
                    {/* Budget warning */}
                    {dist.cost_code_id && dist.amount > 0 && (() => {
                      const warning = getBudgetWarning(dist.cost_code_id, dist.amount);
                      if (warning) {
                        return (
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="destructive" className="text-xs">
                              Budget Warning
                            </Badge>
                            <span className="text-xs text-destructive">{warning.message}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={dist.description || ''}
                    onChange={(e) => updateDistribution(dist.id!, 'description', e.target.value)}
                    placeholder="Enter description for this cost item..."
                    disabled={disabled}
                    className="h-8"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compact Summary */}
      <div className="flex items-center justify-between text-sm bg-muted/50 p-3 rounded-md">
        <div>
          <span className="text-muted-foreground">Total Distributed:</span>{" "}
          <span className="font-medium">${totalDistributed.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Remaining:</span>
          <span className={`font-medium ${remaining < 0 ? 'text-destructive' : remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            ${remaining.toLocaleString()}
          </span>
          {Math.abs(remaining) > 0.01 && (
            <Badge variant={remaining < 0 ? 'destructive' : 'secondary'} className="text-xs">
              {remaining < 0 ? 'Over-allocated' : 'Under-allocated'}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}