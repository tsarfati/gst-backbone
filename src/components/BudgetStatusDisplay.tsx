import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, DollarSign, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BudgetStatusDisplayProps {
  jobId: string;
  costCodeId: string;
  billAmount?: string | number;
  showWarning?: boolean;
  className?: string;
}

interface BudgetData {
  budgeted_amount: number;
  actual_amount: number;
  committed_amount: number;
}

export default function BudgetStatusDisplay({
  jobId,
  costCodeId,
  billAmount,
  showWarning = true,
  className = ""
}: BudgetStatusDisplayProps) {
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (jobId && costCodeId) {
      loadBudgetData();
    } else {
      setBudgetData(null);
    }
  }, [jobId, costCodeId]);

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_budgets')
        .select('budgeted_amount, actual_amount, committed_amount')
        .eq('job_id', jobId)
        .eq('cost_code_id', costCodeId)
        .maybeSingle();

      if (error) throw error;
      setBudgetData(data);
    } catch (error) {
      console.error('Error loading budget data:', error);
      setBudgetData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !budgetData) {
    return null;
  }

  const budgeted = budgetData.budgeted_amount || 0;
  const spent = budgetData.actual_amount || 0;
  const committed = budgetData.committed_amount || 0;
  const remaining = budgeted - spent - committed;
  const billAmt = typeof billAmount === 'string' ? parseFloat(billAmount) || 0 : billAmount || 0;
  const remainingAfterBill = remaining - billAmt;
  const isOverBudget = remainingAfterBill < 0;
  const spentPercentage = budgeted > 0 ? ((spent + committed) / budgeted) * 100 : 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Budgeted:
          </span>
          <span className="font-medium">
            ${budgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Spent/Committed:
          </span>
          <div className="flex items-center gap-2">
            <span className="font-medium">
              ${(spent + committed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {budgeted > 0 && (
              <Badge 
                variant={spentPercentage > 100 ? "destructive" : spentPercentage > 90 ? "warning" : "secondary"}
                className="text-xs"
              >
                {spentPercentage.toFixed(0)}%
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pt-1 border-t">
          <span className="text-muted-foreground font-medium">Remaining:</span>
          <span className={`font-medium ${remaining < 0 ? 'text-destructive' : remaining < budgeted * 0.1 ? 'text-warning' : 'text-success'}`}>
            ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {showWarning && billAmt > 0 && isOverBudget && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            This bill of ${billAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })} will exceed the budget by ${Math.abs(remainingAfterBill).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </AlertDescription>
        </Alert>
      )}
      {showWarning && billAmt > 0 && !isOverBudget && remainingAfterBill < budgeted * 0.1 && (
        <Alert className="py-2 bg-warning/10 border-warning">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm text-warning">
            Only ${remainingAfterBill.toLocaleString(undefined, { minimumFractionDigits: 2 })} will remain after this bill
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
