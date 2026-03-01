import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  PieChart,
  Building,
  Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface AccountSummary {
  account_type: string;
  total_balance: number;
  account_count: number;
}

interface JobCost {
  job_id: string;
  job_name: string;
  total_cost: number;
  total_billable: number;
  profit_margin: number;
}

interface TrialBalance {
  account_number: string;
  account_name: string;
  account_type: string;
  debit_balance: number;
  credit_balance: number;
}

export default function AccountingDashboard() {
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([]);
  const [jobCosts, setJobCosts] = useState<JobCost[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadAccountingData();
  }, []);

  const loadAccountingData = async () => {
    try {
      setLoading(true);

      // Load account summaries
      const { data: accountData, error: accountError } = await supabase
        .from('chart_of_accounts')
        .select('account_type, current_balance, is_active')
        .eq('is_active', true);

      if (accountError) throw accountError;

      const summaries = accountData?.reduce((acc: any[], account) => {
        const existing = acc.find(a => a.account_type === account.account_type);
        if (existing) {
          existing.total_balance += account.current_balance || 0;
          existing.account_count += 1;
        } else {
          acc.push({
            account_type: account.account_type,
            total_balance: account.current_balance || 0,
            account_count: 1
          });
        }
        return acc;
      }, []) || [];

      setAccountSummaries(summaries);

      // Load job costs
      const { data: jobCostData, error: jobCostError } = await supabase
        .from('job_cost_summary')
        .select('*')
        .not('job_id', 'is', null);

      if (jobCostError) throw jobCostError;

      const jobSummaries = jobCostData?.reduce((acc: any[], item) => {
        const existing = acc.find(j => j.job_id === item.job_id);
        if (existing) {
          existing.total_cost += item.total_cost || 0;
          existing.total_billable += item.total_billable || 0;
        } else {
          acc.push({
            job_id: item.job_id,
            job_name: item.job_name,
            total_cost: item.total_cost || 0,
            total_billable: item.total_billable || 0,
            profit_margin: 0
          });
        }
        return acc;
      }, []) || [];

      // Calculate profit margins
      jobSummaries.forEach(job => {
        if (job.total_billable > 0) {
          job.profit_margin = ((job.total_billable - job.total_cost) / job.total_billable) * 100;
        }
      });

      setJobCosts(jobSummaries);

      // Load trial balance
      const { data: trialBalanceData, error: trialBalanceError } = await supabase
        .from('chart_of_accounts')
        .select('account_number, account_name, account_type, current_balance, normal_balance')
        .eq('is_active', true)
        .order('account_number');

      if (trialBalanceError) throw trialBalanceError;

      const trialBalanceFormatted = trialBalanceData?.map(account => ({
        account_number: account.account_number,
        account_name: account.account_name,
        account_type: account.account_type,
        debit_balance: account.normal_balance === 'debit' ? (account.current_balance || 0) : 0,
        credit_balance: account.normal_balance === 'credit' ? (account.current_balance || 0) : 0
      })) || [];

      setTrialBalance(trialBalanceFormatted);

    } catch (error) {
      console.error('Error loading accounting data:', error);
      toast({
        title: "Error",
        description: "Failed to load accounting data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'asset': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'liability': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'equity': return <PieChart className="h-4 w-4 text-blue-500" />;
      case 'revenue': return <DollarSign className="h-4 w-4 text-emerald-500" />;
      case 'expense': return <FileText className="h-4 w-4 text-orange-500" />;
      case 'cost_of_goods_sold': return <Building className="h-4 w-4 text-purple-500" />;
      default: return <Calculator className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Calculator className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading accounting data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounting Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/accounting/journal-entries')}>
            <Plus className="h-4 w-4 mr-2" />
            New Journal Entry
          </Button>
          <Button variant="outline" onClick={() => navigate('/accounting/chart-of-accounts')}>
            Chart of Accounts
          </Button>
        </div>
      </div>

      {/* Account Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {accountSummaries.map((summary) => (
          <Card key={summary.account_type}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                {getAccountTypeIcon(summary.account_type)}
                <Badge variant="secondary">{summary.account_count}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground capitalize">
                  {summary.account_type.replace('_', ' ')}
                </p>
                <p className="text-lg font-semibold">
                  {formatCurrency(Math.abs(summary.total_balance))}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="job-costs" className="space-y-4">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="job-costs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors">Job Costs</TabsTrigger>
          <TabsTrigger value="trial-balance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors">Trial Balance</TabsTrigger>
          <TabsTrigger value="reports" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="job-costs">
          <Card>
            <CardHeader>
              <CardTitle>Job Cost Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {jobCosts.length === 0 ? (
                <div className="text-center py-8">
                  <Building className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Job Costs Found</h3>
                  <p className="text-muted-foreground">
                    Start creating journal entries with job assignments to see cost analysis
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Name</TableHead>
                      <TableHead>Total Costs</TableHead>
                      <TableHead>Total Billable</TableHead>
                      <TableHead>Profit Margin</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobCosts.map((job) => (
                      <TableRow key={job.job_id}>
                        <TableCell className="font-medium">{job.job_name}</TableCell>
                        <TableCell>{formatCurrency(job.total_cost)}</TableCell>
                        <TableCell>{formatCurrency(job.total_billable)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={job.profit_margin >= 0 ? "default" : "destructive"}
                          >
                            {job.profit_margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate(`/jobs/${job.job_id}/cost-analysis`)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial-balance">
          <Card>
            <CardHeader>
              <CardTitle>Trial Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account #</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialBalance.map((account) => (
                    <TableRow key={account.account_number}>
                      <TableCell className="font-mono">{account.account_number}</TableCell>
                      <TableCell>{account.account_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getAccountTypeIcon(account.account_type)}
                          <span className="capitalize">
                            {account.account_type.replace('_', ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {account.debit_balance > 0 ? formatCurrency(account.debit_balance) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {account.credit_balance > 0 ? formatCurrency(account.credit_balance) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(trialBalance.reduce((sum, acc) => sum + acc.debit_balance, 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(trialBalance.reduce((sum, acc) => sum + acc.credit_balance, 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Profit & Loss</h3>
                <p className="text-sm text-muted-foreground">
                  Income statement by job and period
                </p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-6 text-center">
                <Building className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Balance Sheet</h3>
                <p className="text-sm text-muted-foreground">
                  Financial position snapshot
                </p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-6 text-center">
                <PieChart className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Job Profitability</h3>
                <p className="text-sm text-muted-foreground">
                  Detailed job cost analysis
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}