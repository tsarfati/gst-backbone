import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";

interface CostDistribution {
  id?: string;
  cost_code_id: string;
  amount: number;
  percentage: number;
  cost_code_description?: string;
}

interface JobCostingDistributionProps {
  contractAmount: number;
  jobId: string;
  costCodeType?: 'material' | 'sub';
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

export default function JobCostingDistribution({ 
  contractAmount, 
  jobId,
  costCodeType = 'material',
  initialDistribution = [], 
  onChange, 
  disabled = false 
}: JobCostingDistributionProps) {
  const { toast } = useToast();
  const [distribution, setDistribution] = useState<CostDistribution[]>(initialDistribution);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [jobId]);

  useEffect(() => {
    onChange(distribution);
  }, [distribution, onChange]);

  const loadData = async () => {
    if (!jobId) return;

    try {
      setLoading(true);

      // Load cost codes for this job filtered by type
      const { data: costCodesData, error: costCodesError } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('job_id', jobId)
        .eq('type', costCodeType)
        .eq('is_active', true)
        .order('code');

      if (costCodesError) throw costCodesError;
      setCostCodes(costCodesData || []);

    } catch (error) {
      console.error('Error loading data:', error);
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
          <CardTitle>Job Costing Distribution</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={distributeEvenly}
              disabled={disabled || distribution.length === 0}
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
              Add Distribution
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {distribution.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No cost distributions added yet.</p>
            <p className="text-sm">Click "Add Distribution" to allocate contract amounts to specific jobs and cost codes.</p>
          </div>
        ) : (
          <>
            {distribution.map((dist, index) => (
              <div key={dist.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Distribution #{index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDistribution(dist.id!)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div>
                  <Label>Cost Code</Label>
                  <Select
                    value={dist.cost_code_id}
                    onValueChange={(value) => updateDistribution(dist.id!, 'cost_code_id', value)}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a cost code" />
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Amount</Label>
                    <CurrencyInput
                      value={dist.amount?.toString() || ''}
                      onChange={(value) => updateDistribution(dist.id!, 'amount', parseFloat(value) || 0)}
                      placeholder="0.00"
                      disabled={disabled}
                    />
                  </div>

                  <div>
                    <Label>Percentage</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={dist.percentage?.toFixed(2) || ''}
                        onChange={(e) => updateDistribution(dist.id!, 'percentage', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        disabled={disabled}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Total Distributed</p>
                  <p className="font-semibold">${totalDistributed.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Percentage</p>
                  <p className="font-semibold">{totalPercentage.toFixed(2)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Remaining</p>
                  <p className={`font-semibold ${remaining < 0 ? 'text-destructive' : remaining > 0 ? 'text-warning' : 'text-success'}`}>
                    ${remaining.toLocaleString()}
                  </p>
                  {Math.abs(remaining) > 0.01 && (
                    <Badge variant={remaining < 0 ? 'destructive' : 'secondary'} className="text-xs">
                      {remaining < 0 ? 'Over-allocated' : 'Under-allocated'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}