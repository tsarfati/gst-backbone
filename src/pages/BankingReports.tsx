import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  BarChart3, 
  Download, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  PieChart,
  FileText,
  Star,
  ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export default function BankingReports() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("1month");
  const [loading, setLoading] = useState(true);
  
  // Metrics state
  const [totalCash, setTotalCash] = useState(0);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const [journalEntryCount, setJournalEntryCount] = useState(0);
  const [accountCount, setAccountCount] = useState(0);

  useEffect(() => {
    if (currentCompany) {
      loadReportData();
    }
  }, [currentCompany, selectedPeriod]);

  const getPeriodDates = () => {
    const now = new Date();
    let startDate = now;
    
    switch (selectedPeriod) {
      case "1week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "1month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "3months":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "6months":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case "1year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }
    
    return { startDate, endDate: now };
  };

  const loadReportData = async () => {
    if (!currentCompany) return;
    
    setLoading(true);
    try {
      const { startDate, endDate } = getPeriodDates();
      
      // Get total cash from chart of accounts (cash accounts)
      const { data: cashAccounts } = await supabase
        .from('chart_of_accounts')
        .select('current_balance')
        .eq('company_id', currentCompany.id)
        .eq('account_type', 'cash')
        .eq('is_active', true);
      
      const cashTotal = cashAccounts?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) || 0;
      setTotalCash(cashTotal);
      setAccountCount(cashAccounts?.length || 0);
      
      // Get journal entry lines for cash accounts in period
      const { data: cashAccountIds } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('account_type', 'cash')
        .eq('is_active', true);
      
      if (cashAccountIds && cashAccountIds.length > 0) {
        const accountIds = cashAccountIds.map(a => a.id);
        
        const { data: journalLines } = await supabase
          .from('journal_entry_lines')
          .select(`
            debit_amount,
            credit_amount,
            journal_entries!inner(entry_date, status)
          `)
          .in('account_id', accountIds)
          .eq('journal_entries.status', 'posted')
          .gte('journal_entries.entry_date', startDate.toISOString())
          .lte('journal_entries.entry_date', endDate.toISOString());
        
        const deposits = journalLines?.reduce((sum, line) => sum + (line.debit_amount || 0), 0) || 0;
        const withdrawals = journalLines?.reduce((sum, line) => sum + (line.credit_amount || 0), 0) || 0;
        
        setTotalDeposits(deposits);
        setTotalWithdrawals(withdrawals);
      }
      
      // Get journal entry count
      const { count: jeCount } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id)
        .gte('entry_date', startDate.toISOString())
        .lte('entry_date', endDate.toISOString());
      
      setJournalEntryCount(jeCount || 0);
      
    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const accountingReports = [
    { name: "Account Totals", category: "accounts" },
    { name: "Balance Sheet", category: "accounts" },
    { name: "Balance Sheet - Comparative", category: "accounts" },
    { name: "Balance Sheet - Property Comparison", category: "accounts" },
    { name: "Bank Account Activity", category: "accounts" },
    { name: "Bank Account Association", category: "accounts" },
    { name: "Cash Flow", category: "cashflow" },
    { name: "Cash Flow - 12 Month", category: "cashflow" },
    { name: "Cash Flow - Property Comparison", category: "cashflow" },
    { name: "Cash Flow Detail", category: "cashflow" },
    { name: "Chart of Accounts", category: "accounts" },
    { name: "Expense Distribution", category: "expenses" },
    { name: "General Ledger", category: "ledger" },
    { name: "Income Statement", category: "income" },
    { name: "Income Statement - 12 Month", category: "income" },
    { name: "Income Statement - Comparative", category: "income" },
    { name: "Income Statement - Property Comparison", category: "income" },
    { name: "Income Statement (Date Range)", category: "income" },
    { name: "Loans", category: "liabilities" },
    { name: "Trial Balance", category: "accounts" },
    { name: "Trial Balance by Property", category: "accounts" },
    { name: "Trust Account Balance", category: "accounts" },
    { name: "Trust Account Detail", category: "accounts" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Banking Reports</h1>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1week">Last Week</SelectItem>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cash</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCash)}</div>
            <div className="flex items-center text-sm mt-2">
              <span className="text-muted-foreground">{accountCount} active accounts</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDeposits)}</div>
            <p className="text-xs text-muted-foreground mt-2">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalWithdrawals)}</div>
            <p className="text-xs text-muted-foreground mt-2">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDeposits - totalWithdrawals)}</div>
            <p className="text-xs text-muted-foreground mt-2">Deposits - Withdrawals</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Transaction Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Journal Entries</span>
                <Badge variant="secondary">{journalEntryCount}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bank Accounts</span>
                <Badge variant="secondary">{accountCount}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Period Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Period</span>
                <span className="text-sm font-medium">
                  {selectedPeriod === "1week" && "Last 7 days"}
                  {selectedPeriod === "1month" && "Last 30 days"}
                  {selectedPeriod === "3months" && "Last 90 days"}
                  {selectedPeriod === "6months" && "Last 180 days"}
                  {selectedPeriod === "1year" && "Last 365 days"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cash Flow</span>
                <span className={`text-sm font-medium ${totalDeposits - totalWithdrawals >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalDeposits - totalWithdrawals >= 0 ? 'Positive' : 'Negative'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Balance</span>
                <span className="text-sm font-medium">{formatCurrency(totalCash)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounting Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Accounting Reports</CardTitle>
          <p className="text-sm text-muted-foreground">Generate detailed financial reports</p>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="accounts">
              <AccordionTrigger>
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Account Reports
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  {accountingReports.filter(r => r.category === 'accounts').map((report, idx) => (
                    <Button key={idx} variant="outline" className="justify-between h-auto py-3">
                      <span className="text-sm">{report.name}</span>
                      <div className="flex items-center gap-2">
                        <Star className="h-3 w-3 text-muted-foreground" />
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cashflow">
              <AccordionTrigger>
                <div className="flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Cash Flow Reports
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  {accountingReports.filter(r => r.category === 'cashflow').map((report, idx) => (
                    <Button key={idx} variant="outline" className="justify-between h-auto py-3">
                      <span className="text-sm">{report.name}</span>
                      <div className="flex items-center gap-2">
                        <Star className="h-3 w-3 text-muted-foreground" />
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="income">
              <AccordionTrigger>
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Income Statement Reports
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  {accountingReports.filter(r => r.category === 'income').map((report, idx) => (
                    <Button key={idx} variant="outline" className="justify-between h-auto py-3">
                      <span className="text-sm">{report.name}</span>
                      <div className="flex items-center gap-2">
                        <Star className="h-3 w-3 text-muted-foreground" />
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="expenses">
              <AccordionTrigger>
                <div className="flex items-center">
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Expense Reports
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  {accountingReports.filter(r => r.category === 'expenses').map((report, idx) => (
                    <Button key={idx} variant="outline" className="justify-between h-auto py-3">
                      <span className="text-sm">{report.name}</span>
                      <div className="flex items-center gap-2">
                        <Star className="h-3 w-3 text-muted-foreground" />
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ledger">
              <AccordionTrigger>
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  General Ledger Reports
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  {accountingReports.filter(r => r.category === 'ledger').map((report, idx) => {
                    const isGeneralLedger = report.name === "General Ledger";
                    return (
                      <Button 
                        key={idx} 
                        variant="outline" 
                        className="justify-between h-auto py-3"
                        onClick={() => {
                          if (isGeneralLedger) {
                            window.location.href = "/banking/general-ledger";
                          }
                        }}
                      >
                        <span className="text-sm">{report.name}</span>
                        <div className="flex items-center gap-2">
                          {isGeneralLedger && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="liabilities">
              <AccordionTrigger>
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Liabilities & Loans
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  {accountingReports.filter(r => r.category === 'liabilities').map((report, idx) => (
                    <Button key={idx} variant="outline" className="justify-between h-auto py-3">
                      <span className="text-sm">{report.name}</span>
                      <div className="flex items-center gap-2">
                        <Star className="h-3 w-3 text-muted-foreground" />
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}