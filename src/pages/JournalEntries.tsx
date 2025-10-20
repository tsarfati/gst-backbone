import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, 
  Plus, 
  Search, 
  Calendar,
  DollarSign,
  Edit,
  Trash2,
  Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AccountingJobCostSelector from "@/components/AccountingJobCostSelector";

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
}

interface JournalEntryLine {
  line_type: 'controller' | 'job';
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description: string;
  job_id?: string;
  cost_code_id?: string;
}

export default function JournalEntries() {
  const [searchTerm, setSearchTerm] = useState("");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { line_type: 'controller', account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
    { line_type: 'controller', account_id: '', debit_amount: 0, credit_amount: 0, description: '' }
  ]);

  useEffect(() => {
    const loadAccounts = async () => {
      const { data } = await supabase
        .from('chart_of_accounts')
        .select('id, account_number, account_name, account_type, normal_balance')
        .eq('is_active', true)
        .eq('account_type', 'Expense')
        .order('account_number');
      setAccounts(data || []);
    };
    loadAccounts();
  }, []);

  const addLine = () => {
    setLines(prev => [
      ...prev,
      { line_type: 'controller', account_id: '', debit_amount: 0, credit_amount: 0, description: '' }
    ]);
  };

  const updateLine = (index: number, updates: Partial<JournalEntryLine>) => {
    setLines(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates } as JournalEntryLine;
      return next;
    });
  };

  const journalEntries: any[] = [];

  const filteredEntries = journalEntries.filter(entry => {
    return entry?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           entry?.reference?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal Entries</h1>
          <p className="text-muted-foreground">
            Create and manage accounting journal entries
          </p>
        </div>
        <Button asChild>
          <Link to="/banking/journal-entries/new">
            <Plus className="h-4 w-4 mr-2" />
            New Journal Entry
          </Link>
        </Button>
      </div>

      {/* Quick Entry Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick Journal Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" placeholder="Entry reference..." />
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Journal entry description..." />
          </div>

          <div className="space-y-4">
            {lines.map((line, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div>
                    <Label>Account Type</Label>
                    <Select 
                      value={line.line_type}
                      onValueChange={(value: 'controller' | 'job') =>
                        updateLine(index, {
                          line_type: value,
                          job_id: value === 'controller' ? undefined : line.job_id,
                          cost_code_id: value === 'controller' ? undefined : line.cost_code_id,
                          account_id: value === 'job' ? '' : line.account_id,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="controller">Controller</SelectItem>
                        <SelectItem value="job">Job</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {line.line_type === 'controller' ? (
                    <div className="md:col-span-2">
                      <Label>Expense Account</Label>
                      <Select
                        value={line.account_id}
                        onValueChange={(value) => updateLine(index, { account_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select expense account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.account_number} - {account.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="md:col-span-2">
                      <AccountingJobCostSelector
                        selectedJobId={line.job_id}
                        selectedCostCodeId={line.cost_code_id}
                        onJobChange={(jobId) => updateLine(index, { job_id: jobId })}
                        onCostCodeChange={(costCodeId) => updateLine(index, { cost_code_id: costCodeId })}
                        showCreateButton={false}
                      />
                    </div>
                  )}

                  <div>
                    <Label>Debit</Label>
                    <CurrencyInput
                      value={line.debit_amount.toString()}
                      onChange={(value) => updateLine(index, { debit_amount: parseFloat(value) || 0, credit_amount: 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Credit</Label>
                    <CurrencyInput
                      value={line.credit_amount.toString()}
                      onChange={(value) => updateLine(index, { credit_amount: parseFloat(value) || 0, debit_amount: 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder="Line description"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={addLine}>
                <Plus className="h-4 w-4 mr-2" />
                Add Line
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search journal entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Journal Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Journal Entry History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No journal entries found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "Try adjusting your search"
                  : "Start by creating your first journal entry"
                }
              </p>
              <Button asChild>
                <Link to="/banking/journal-entries/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Journal Entry
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                        {entry.date}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{entry.reference}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <DollarSign className="h-3 w-3 mr-1 text-muted-foreground" />
                        {entry.debit || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <DollarSign className="h-3 w-3 mr-1 text-muted-foreground" />
                        {entry.credit || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded ${
                        entry.status === "posted" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {entry.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}