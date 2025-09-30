import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CostDistribution {
  id?: string;
  cost_code_id: string;
  amount: number;
  percentage: number;
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
  const [loading, setLoading] = useState(true);

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

      // Load cost codes for this job
      const { data: costCodesData, error: costCodesError } = await supabase
        .from('cost_codes')
        .select('id, code, description')
        .or(`job_id.eq.${jobId},job_id.is.null`)
        .eq('is_active', true)
        .order('code');

      if (costCodesError) throw costCodesError;
      setCostCodes(costCodesData || []);

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
      percentage: 0
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
      
      // If amount changes, recalculate percentage
      if (field === 'amount' && contractAmount > 0) {
        updated.percentage = (parseFloat(value) / contractAmount) * 100;
      }
      
      // If percentage changes, recalculate amount
      if (field === 'percentage' && contractAmount > 0) {
        updated.amount = (contractAmount * parseFloat(value)) / 100;
      }

      return updated;
    }));
  };

  const distributeEvenly = () => {
    if (distribution.length === 0) return;
    
    const amountPerDistribution = contractAmount / distribution.length;
    const percentagePerDistribution = 100 / distribution.length;
    
    setDistribution(prev => prev.map(d => ({
      ...d,
      amount: amountPerDistribution,
      percentage: percentagePerDistribution
    })));
  };

  const totalDistributed = distribution.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalPercentage = distribution.reduce((sum, d) => sum + (d.percentage || 0), 0);
  const remaining = contractAmount - totalDistributed;

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
        <div className="space-y-2">
          {distribution.map((dist, index) => {
            const costCode = costCodes.find(cc => cc.id === dist.cost_code_id);
            return (
              <div key={dist.id} className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
                <div className="flex-1 grid grid-cols-4 gap-3 items-center">
                  <div className="col-span-2">
                    <Select
                      value={dist.cost_code_id}
                      onValueChange={(value) => updateDistribution(dist.id!, 'cost_code_id', value)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select cost code" />
                      </SelectTrigger>
                      <SelectContent>
                        {costCodes.map((costCode) => (
                          <SelectItem key={costCode.id} value={costCode.id}>
                            {costCode.code} - {costCode.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <CurrencyInput
                      value={dist.amount?.toString() || ''}
                      onChange={(value) => updateDistribution(dist.id!, 'amount', parseFloat(value) || 0)}
                      placeholder="0.00"
                      disabled={disabled}
                      className="h-8"
                    />
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={dist.percentage?.toFixed(1) || ''}
                      onChange={(e) => updateDistribution(dist.id!, 'percentage', parseFloat(e.target.value) || 0)}
                      placeholder="0.0"
                      disabled={disabled}
                      className="h-8"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                
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
            );
          })}
        </div>
      )}

      {/* Compact Summary */}
      <div className="flex items-center justify-between text-sm bg-muted/50 p-3 rounded-md">
        <div className="flex gap-4">
          <span>
            <span className="text-muted-foreground">Total:</span>{" "}
            <span className="font-medium">${totalDistributed.toLocaleString()}</span>
          </span>
          <span>
            <span className="text-muted-foreground">%:</span>{" "}
            <span className="font-medium">{totalPercentage.toFixed(1)}%</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Remaining:</span>
          <span className={`font-medium ${remaining < 0 ? 'text-destructive' : remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            ${remaining.toLocaleString()}
          </span>
          {Math.abs(remaining) > 0.01 && (
            <Badge variant={remaining < 0 ? 'destructive' : 'secondary'} className="text-xs">
              {remaining < 0 ? 'Over' : 'Under'}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}