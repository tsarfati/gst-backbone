import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface Transaction {
  id: string;
  date: string;
  type: 'bill' | 'timecard';
  description: string;
  vendor_name?: string;
  employee_name?: string;
  cost_code: string;
  cost_code_description: string;
  class?: string;
  amount: number;
  status?: string;
}

export default function ProjectCostTransactionHistory() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [groupBy, setGroupBy] = useState<"cost_code" | "class">("cost_code");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [costCodes, setCostCodes] = useState<any[]>([]);

  useEffect(() => {
    loadJobs();
  }, [currentCompany]);

  useEffect(() => {
    if (selectedJob) {
      loadCostCodes();
      loadTransactions();
    }
  }, [selectedJob, startDate, endDate]);

  const loadJobs = async () => {
    if (!currentCompany) return;

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, status')
        .eq('company_id', currentCompany.id)
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast.error("Failed to load jobs");
    }
  };

  const loadCostCodes = async () => {
    if (!selectedJob) return;

    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('job_id', selectedJob)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error loading cost codes:', error);
    }
  };

  const loadTransactions = async () => {
    if (!selectedJob) return;

    setLoading(true);
    try {
      const allTransactions: Transaction[] = [];

      // Build date filters
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = `AND issue_date >= '${startDate}' AND issue_date <= '${endDate}'`;
      } else if (startDate) {
        dateFilter = `AND issue_date >= '${startDate}'`;
      } else if (endDate) {
        dateFilter = `AND issue_date <= '${endDate}'`;
      }

      // Load Bills (Invoices)
      let billQuery = supabase
        .from('invoices')
        .select(`
          id,
          issue_date,
          invoice_number,
          description,
          amount,
          status,
          cost_code_id,
          vendor:vendors(name),
          cost_code:cost_codes(code, description, type)
        `)
        .eq('job_id', selectedJob)
        .neq('status', 'rejected')
        .order('issue_date', { ascending: false });

      if (startDate) billQuery = billQuery.gte('issue_date', startDate);
      if (endDate) billQuery = billQuery.lte('issue_date', endDate);

      const { data: bills, error: billsError } = await billQuery;

      if (!billsError && bills) {
        allTransactions.push(...bills.map(bill => ({
          id: bill.id,
          date: bill.issue_date,
          type: 'bill' as const,
          description: bill.description || bill.invoice_number || 'Bill',
          vendor_name: bill.vendor?.name,
          cost_code: bill.cost_code?.code || 'Uncoded',
          cost_code_description: bill.cost_code?.description || '',
          class: bill.cost_code?.type,
          amount: bill.amount,
          status: bill.status
        })));
      }

      // Load Time Cards
      let timeQuery = supabase
        .from('time_cards')
        .select(`
          id,
          punch_in_time,
          total_hours,
          overtime_hours,
          status,
          cost_code_id,
          profiles:user_id(first_name, last_name),
          cost_code:cost_codes(code, description, type)
        `)
        .eq('job_id', selectedJob)
        .order('punch_in_time', { ascending: false });

      if (startDate) timeQuery = timeQuery.gte('punch_in_time', startDate);
      if (endDate) timeQuery = timeQuery.lte('punch_in_time', endDate);

      const { data: timecards, error: timeError } = await timeQuery;

      if (!timeError && timecards) {
        allTransactions.push(...timecards.map(tc => {
          const profile = tc.profiles as any;
          const costCode = tc.cost_code as any;
          return {
            id: tc.id,
            date: tc.punch_in_time.split('T')[0],
            type: 'timecard' as const,
            description: `${tc.total_hours}hrs${tc.overtime_hours ? ` (${tc.overtime_hours} OT)` : ''}`,
            employee_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
            cost_code: costCode?.code || 'Uncoded',
            cost_code_description: costCode?.description || '',
            class: costCode?.type,
            amount: 0, // Labor cost not tracked in this view
            status: tc.status
          };
        }));
      }

      // Sort by date descending
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error("Failed to load transactions");
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bill':
        return <Badge variant="outline">Bill</Badge>;
      case 'timecard':
        return <Badge variant="secondary">Time</Badge>;
      default:
        return null;
    }
  };

  const getGroupedTransactions = () => {
    if (groupBy === "cost_code") {
      const grouped = transactions.reduce((acc, t) => {
        const key = t.cost_code;
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
      }, {} as Record<string, Transaction[]>);
      return grouped;
    } else {
      const grouped = transactions.reduce((acc, t) => {
        const key = t.class || 'Unclassified';
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
      }, {} as Record<string, Transaction[]>);
      return grouped;
    }
  };

  const calculateTotal = (transactions: Transaction[]) => {
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  };

  const exportToCSV = () => {
    const csvContent = [
      ['Date', 'Type', 'Description', 'Vendor/Employee', 'Cost Code', 'Cost Code Description', 'Class', 'Amount', 'Status'].join(','),
      ...transactions.map(t => [
        t.date,
        t.type,
        `"${t.description}"`,
        `"${t.vendor_name || t.employee_name || ''}"`,
        t.cost_code,
        `"${t.cost_code_description}"`,
        t.class || '',
        t.amount,
        t.status || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-cost-history-${selectedJob}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/construction/reports")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Project Cost Transaction History</h1>
            <p className="text-muted-foreground">Detailed cost transaction history by job</p>
          </div>
        </div>
        {transactions.length > 0 && (
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Job</Label>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Group By</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "cost_code" | "class")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cost_code">Cost Code</SelectItem>
                  <SelectItem value="class">Class</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">Loading transactions...</div>
          </CardContent>
        </Card>
      ) : !selectedJob ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Select a job to view cost transactions</p>
            </div>
          </CardContent>
        </Card>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No transactions found for the selected filters</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(getGroupedTransactions()).map(([groupKey, groupTransactions]) => {
            const firstTransaction = groupTransactions[0];
            let displayLabel = groupKey;
            
            if (groupBy === "cost_code" && firstTransaction?.cost_code_description) {
              displayLabel = `${groupKey} - ${firstTransaction.cost_code_description}`;
            }
            
            return (
              <Card key={groupKey}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {groupBy === "cost_code" ? `Cost Code: ${displayLabel}` : `Class: ${groupKey}`}
                    </CardTitle>
                    <Badge variant="outline">
                      Total: {formatCurrency(calculateTotal(groupTransactions))}
                    </Badge>
                  </div>
                </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor/Employee</TableHead>
                      {groupBy === "class" && <TableHead>Cost Code</TableHead>}
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{format(new Date(transaction.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{getTypeIcon(transaction.type)}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>{transaction.vendor_name || transaction.employee_name || '—'}</TableCell>
                        {groupBy === "class" && (
                          <TableCell>
                            <div>
                              <div className="font-medium">{transaction.cost_code}</div>
                              {transaction.cost_code_description && (
                                <div className="text-xs text-muted-foreground">
                                  {transaction.cost_code_description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-right font-medium">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>
                          {transaction.status && (
                            <Badge variant="outline" className="capitalize">
                              {transaction.status.replace('_', ' ')}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            );
          })}

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Transactions</p>
                  <p className="text-2xl font-bold">{transactions.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bills</p>
                  <p className="text-2xl font-bold">
                    {transactions.filter(t => t.type === 'bill').length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time Cards</p>
                  <p className="text-2xl font-bold">
                    {transactions.filter(t => t.type === 'timecard').length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(calculateTotal(transactions))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
