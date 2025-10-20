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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { 
  FileText, 
  Plus, 
  Search, 
  Calendar,
  DollarSign,
  Edit,
  Trash2,
  Eye,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
}

interface Job {
  id: string;
  name: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  category: string;
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
  const { currentCompany } = useCompany();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<Record<string, CostCode[]>>({});
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { line_type: 'controller', account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
    { line_type: 'controller', account_id: '', debit_amount: 0, credit_amount: 0, description: '' }
  ]);
  const [openPopovers, setOpenPopovers] = useState<Record<number, { jobControl: boolean; costCode: boolean }>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!currentCompany?.id) {
          console.log('No current company, skipping load');
          return;
        }

        console.log('Loading data for company:', currentCompany.id);

        // Load jobs for this company (active first if status exists)
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, name')
          .eq('company_id', currentCompany.id)
          .order('name');

        if (jobsError) {
          console.error('Error loading jobs:', jobsError);
        } else {
          console.log('Loaded jobs:', jobsData?.length);
          setJobs((jobsData as any) || []);
        }

        // Load expense accounts for this company
        const { data: accountsData, error: accountsError } = await supabase
          .from('chart_of_accounts')
          .select('id, account_number, account_name, account_type, normal_balance')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true)
          .eq('account_type', 'Expense')
          .order('account_number');

        if (accountsError) {
          console.error('Error loading accounts:', accountsError);
        } else {
          console.log('Loaded accounts:', accountsData?.length);
          setAccounts((accountsData as any) || []);
        }
      } catch (error) {
        console.error('Error in loadData:', error);
      }
    };
    loadData();
  }, [currentCompany?.id]);

  const loadCostCodesForJob = async (jobId: string) => {
    if (costCodes[jobId]) return;

    const { data } = await supabase
      .from('cost_codes')
      .select('id, code, description, category')
      .eq('job_id', jobId)
      .eq('company_id', currentCompany?.id || '')
      .eq('is_active', true)
      .order('code');
    
    setCostCodes(prev => ({ ...prev, [jobId]: (data as any) || [] }));
  };

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

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, i) => i !== index));
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
                  <div className="md:col-span-2">
                    <Label>Job/Control</Label>
                    <Popover 
                      open={openPopovers[index]?.jobControl} 
                      onOpenChange={(open) => setOpenPopovers(prev => ({ 
                        ...prev, 
                        [index]: { ...prev[index], jobControl: open } 
                      }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                        >
                          {line.line_type === 'job' && line.job_id 
                            ? jobs.find(j => j.id === line.job_id)?.name
                            : line.account_id
                            ? accounts.find(a => a.id === line.account_id)
                              ? `${accounts.find(a => a.id === line.account_id)?.account_number} - ${accounts.find(a => a.id === line.account_id)?.account_name}`
                              : 'Select job or account'
                            : 'Select job or account'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0">
                        <Command>
                          <CommandInput placeholder="Search jobs or accounts..." />
                          <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            {jobs.length > 0 && (
                              <CommandGroup heading="Jobs">
                                {jobs.map((job) => (
                                  <CommandItem
                                    key={`job-${job.id}`}
                                    value={job.name}
                                    onSelect={() => {
                                      updateLine(index, {
                                        line_type: 'job',
                                        job_id: job.id,
                                        account_id: '',
                                        cost_code_id: undefined
                                      });
                                      loadCostCodesForJob(job.id);
                                      setOpenPopovers(prev => ({ 
                                        ...prev, 
                                        [index]: { ...prev[index], jobControl: false } 
                                      }));
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        line.line_type === 'job' && line.job_id === job.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {job.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                            {jobs.length > 0 && accounts.length > 0 && <CommandSeparator />}
                            {accounts.length > 0 && (
                              <CommandGroup heading="Expense Accounts">
                                {accounts.map((account) => (
                                  <CommandItem
                                    key={account.id}
                                    value={`${account.account_number} ${account.account_name}`}
                                    onSelect={() => {
                                      updateLine(index, {
                                        line_type: 'controller',
                                        account_id: account.id,
                                        job_id: undefined,
                                        cost_code_id: undefined
                                      });
                                      setOpenPopovers(prev => ({ 
                                        ...prev, 
                                        [index]: { ...prev[index], jobControl: false } 
                                      }));
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        line.line_type === 'controller' && line.account_id === account.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {account.account_number} - {account.account_name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>Cost Code</Label>
                    <Popover 
                      open={openPopovers[index]?.costCode} 
                      onOpenChange={(open) => setOpenPopovers(prev => ({ 
                        ...prev, 
                        [index]: { ...prev[index], costCode: open } 
                      }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          disabled={line.line_type !== 'job' || !line.job_id}
                        >
                          {line.cost_code_id && line.job_id
                            ? (() => {
                                const code = (costCodes[line.job_id] || []).find(c => c.id === line.cost_code_id);
                                return code ? `${code.category} - ${code.code} - ${code.description}` : 'Select cost code';
                              })()
                            : 'Select cost code'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0">
                        <Command>
                          <CommandInput placeholder="Search cost codes..." />
                          <CommandList>
                            <CommandEmpty>No cost codes found.</CommandEmpty>
                            <CommandGroup>
                              {line.job_id && (costCodes[line.job_id] || []).map((code) => (
                                <CommandItem
                                  key={code.id}
                                  value={`${code.category} ${code.code} ${code.description}`}
                                  onSelect={() => {
                                    updateLine(index, { cost_code_id: code.id });
                                    setOpenPopovers(prev => ({ 
                                      ...prev, 
                                      [index]: { ...prev[index], costCode: false } 
                                    }));
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      line.cost_code_id === code.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {code.category} - {code.code} - {code.description}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

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
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 2}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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