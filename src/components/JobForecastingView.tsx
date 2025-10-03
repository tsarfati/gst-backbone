import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calendar, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/utils/formatNumber";
import { differenceInDays, format } from "date-fns";

interface Job {
  budget_total?: number;
  start_date?: string;
  end_date?: string;
}

interface BudgetData {
  total_budgeted: number;
  total_actual: number;
  total_committed: number;
}

export default function JobForecastingView() {
  const { id } = useParams();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForecastData();
  }, [id]);

  const loadForecastData = async () => {
    if (!id) return;

    try {
      // Load job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('budget_total, start_date, end_date')
        .eq('id', id)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // Load budget summary
      const { data: budgets, error: budgetError } = await supabase
        .from('job_budgets')
        .select('budgeted_amount, actual_amount, committed_amount')
        .eq('job_id', id);

      if (budgetError) throw budgetError;

      const summary = budgets?.reduce(
        (acc, curr) => ({
          total_budgeted: acc.total_budgeted + Number(curr.budgeted_amount || 0),
          total_actual: acc.total_actual + Number(curr.actual_amount || 0),
          total_committed: acc.total_committed + Number(curr.committed_amount || 0),
        }),
        { total_budgeted: 0, total_actual: 0, total_committed: 0 }
      );

      setBudgetData(summary || { total_budgeted: 0, total_actual: 0, total_committed: 0 });
    } catch (error) {
      console.error('Error loading forecast data:', error);
      toast({
        title: "Error",
        description: "Failed to load forecast data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading forecast...</div>;
  }

  const totalBudget = job?.budget_total || budgetData?.total_budgeted || 0;
  const totalSpent = (budgetData?.total_actual || 0) + (budgetData?.total_committed || 0);
  const remaining = totalBudget - totalSpent;
  const percentSpent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Timeline calculations
  const today = new Date();
  const startDate = job?.start_date ? new Date(job.start_date) : null;
  const endDate = job?.end_date ? new Date(job.end_date) : null;
  
  let totalDays = 0;
  let daysElapsed = 0;
  let daysRemaining = 0;
  let percentComplete = 0;

  if (startDate && endDate) {
    totalDays = differenceInDays(endDate, startDate);
    daysElapsed = differenceInDays(today, startDate);
    daysRemaining = differenceInDays(endDate, today);
    percentComplete = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  }

  // Budget vs Timeline variance
  const variance = percentComplete - percentSpent;
  const isOnTrack = Math.abs(variance) < 10; // Within 10% is considered on track
  const isOverBudget = percentSpent > percentComplete + 10;
  const isUnderBudget = percentSpent < percentComplete - 10;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Budget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(totalBudget)}</div>
          </CardContent>
        </Card>

        {/* Spent + Committed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spent + Committed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(totalSpent)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {percentSpent.toFixed(1)}% of budget
            </p>
          </CardContent>
        </Card>

        {/* Remaining Budget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            {remaining >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${formatNumber(Math.abs(remaining))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {remaining >= 0 ? 'Under budget' : 'Over budget'}
            </p>
          </CardContent>
        </Card>

        {/* Days Remaining */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysRemaining > 0 ? daysRemaining : 0}</div>
            {endDate && (
              <p className="text-xs text-muted-foreground mt-1">
                End: {format(endDate, 'MMM dd, yyyy')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Budget Progress
            {isOverBudget && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Over Budget
              </Badge>
            )}
            {isOnTrack && <Badge variant="default">On Track</Badge>}
            {isUnderBudget && (
              <Badge variant="secondary">
                <TrendingUp className="h-3 w-3 mr-1" />
                Under Budget
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={Math.min(percentSpent, 100)} className="h-4" />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>Spent: {percentSpent.toFixed(1)}%</span>
            <span>Remaining: {(100 - percentSpent).toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Progress */}
      {startDate && endDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={Math.min(percentComplete, 100)} className="h-4" />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>Elapsed: {percentComplete.toFixed(1)}%</span>
              <span>Remaining: {(100 - percentComplete).toFixed(1)}%</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Start:</span>
                <span className="ml-2 font-medium">{format(startDate, 'MMM dd, yyyy')}</span>
              </div>
              <div>
                <span className="text-muted-foreground">End:</span>
                <span className="ml-2 font-medium">{format(endDate, 'MMM dd, yyyy')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={`h-2 w-2 rounded-full mt-2 ${isOverBudget ? 'bg-red-500' : isOnTrack ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <div className="flex-1">
              <h4 className="font-medium">Budget vs Timeline Variance</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {isOverBudget && "Budget is being spent faster than project timeline suggests. Review spending and adjust forecasts."}
                {isOnTrack && "Budget expenditure is aligned with project timeline. Project is on track."}
                {isUnderBudget && "Budget is being spent slower than project timeline. Consider if work is behind schedule."}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground mt-1" />
            <div className="flex-1">
              <h4 className="font-medium">Projected Final Cost</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Based on current spending rate: ${formatNumber(percentComplete > 0 ? (totalSpent / percentComplete) * 100 : totalBudget)}
              </p>
            </div>
          </div>

          {endDate && daysRemaining > 0 && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-1" />
              <div className="flex-1">
                <h4 className="font-medium">Daily Burn Rate</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Average: ${formatNumber(daysElapsed > 0 ? totalSpent / daysElapsed : 0)}/day
                  {remaining > 0 && daysRemaining > 0 && (
                    <> • Allowed: ${formatNumber(remaining / daysRemaining)}/day to stay on budget</>
                  )}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
