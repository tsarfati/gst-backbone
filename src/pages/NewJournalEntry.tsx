import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { 
  ArrowLeft,
  Plus, 
  Trash2,
  Check,
  ChevronsUpDown,
  Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
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
  type?: string;
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

export default function NewJournalEntry() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<Record<string, CostCode[]>>({});
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { line_type: 'controller', account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
    { line_type: 'controller', account_id: '', debit_amount: 0, credit_amount: 0, description: '' }
  ]);
  const [openPopovers, setOpenPopovers] = useState<Record<number, { jobControl: boolean; costCode: boolean }>>({});

  // Separate accounts: Jobs (5000-5999 by numeric prefix) vs other accounts
  const getNumericPrefix = (v: string) => {
    const m = (v || '').match(/^\d+/);
    return m ? parseInt(m[0], 10) : NaN;
  };
  const jobAccounts = accounts.filter(a => {
    const num = getNumericPrefix(a.account_number);
    return !Number.isNaN(num) && num >= 5000 && num <= 5999;
  });
  const otherAccounts = accounts.filter(a => {
    const num = getNumericPrefix(a.account_number);
    return Number.isNaN(num) || num < 5000 || num > 5999;
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!currentCompany?.id) return;

        // Load jobs
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, name')
          .eq('company_id', currentCompany.id)
          .order('name');

        if (jobsError) {
          console.error('Error loading jobs:', jobsError);
        } else {
          setJobs((jobsData as any) || []);
        }

        // Load accounts
        const { data: accountsData, error: accountsError } = await supabase
          .from('chart_of_accounts')
          .select('id, account_number, account_name, account_type, normal_balance')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true)
          .order('account_number');

        if (accountsError) {
          console.error('Error loading accounts:', accountsError);
        } else {
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

    const { data, error } = await supabase
      .from('cost_codes')
      .select('id, code, description, type')
      .eq('job_id', jobId)
      .eq('company_id', currentCompany?.id || '')
      .eq('is_active', true)
      .eq('is_dynamic_group', false)
      .not('type', 'is', null)
      .order('code');
    
    if (error) {
      console.error('Error loading cost codes:', error);
    } else {
      setCostCodes(prev => ({ ...prev, [jobId]: (data as any) || [] }));
    }
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

  const calculateTotals = () => {
    const totalDebits = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
    return { totalDebits, totalCredits, difference: totalDebits - totalCredits };
  };

  const { totalDebits, totalCredits, difference } = calculateTotals();
  const isBalanced = Math.abs(difference) < 0.01;

  const handleSave = async () => {
    if (!currentCompany?.id) {
      toast({
        title: "Error",
        description: "No company selected",
        variant: "destructive",
      });
      return;
    }

    // Validate balance
    if (!isBalanced) {
      toast({
        title: "Unbalanced Entry",
        description: `Debits ($${totalDebits.toFixed(2)}) must equal Credits ($${totalCredits.toFixed(2)})`,
        variant: "destructive",
      });
      return;
    }

    // Validate all lines have required fields
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.line_type === 'controller' && !line.account_id) {
        toast({
          title: "Missing Account",
          description: `Line ${i + 1} requires an account selection`,
          variant: "destructive",
        });
        return;
      }
      if (line.line_type === 'job' && (!line.job_id || !line.cost_code_id)) {
        toast({
          title: "Missing Job/Cost Code",
          description: `Line ${i + 1} requires both job and cost code`,
          variant: "destructive",
        });
        return;
      }
      if (line.debit_amount === 0 && line.credit_amount === 0) {
        toast({
          title: "Missing Amount",
          description: `Line ${i + 1} must have a debit or credit amount`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Create the journal entry record
      const { data: entryData, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          description: description || 'Journal entry',
          entry_date: entryDate,
          reference: reference,
          total_debit: totalDebits,
          total_credit: totalCredits,
          status: 'posted',
          created_by: userData.user.id,
          company_id: currentCompany.id
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Prepare lines with proper account_id
      const linesToInsert = [];
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        let accountId = line.account_id;
        
        // For job-type lines, get account_id from cost_code
        if (line.line_type === 'job' && line.cost_code_id) {
          const { data: costCodeData, error: costCodeError } = await supabase
            .from('cost_codes')
            .select('code, description, chart_account_id')
            .eq('id', line.cost_code_id)
            .single();
          
          if (costCodeError) {
            throw new Error(`Failed to load cost code information for line ${index + 1}`);
          }
          
          if (!costCodeData?.chart_account_id) {
            throw new Error(`Cost code "${costCodeData?.code || 'Unknown'}" on line ${index + 1} is not linked to a chart account. Please update the cost code settings.`);
          }
          
          accountId = costCodeData.chart_account_id;
        }
        
        if (!accountId) {
          throw new Error(`Line ${index + 1} is missing account information. Please select a valid account or cost code.`);
        }
        
        linesToInsert.push({
          journal_entry_id: entryData.id,
          account_id: accountId,
          job_id: line.job_id ?? null,
          cost_code_id: line.cost_code_id ?? null,
          debit_amount: line.debit_amount || 0,
          credit_amount: line.credit_amount || 0,
          description: line.description || '',
          billable: false,
          markup_percentage: 0,
          billable_amount: 0,
          line_order: index + 1
        });
      }

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesToInsert);

      if (linesError) {
        // If lines fail to insert, delete the journal entry header
        await supabase
          .from('journal_entries')
          .delete()
          .eq('id', entryData.id);
        throw linesError;
      }

      toast({
        title: "Success",
        description: "Journal entry saved successfully",
      });
      
      navigate('/banking/journal-entries');
    } catch (error) {
      console.error('Error saving journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to save journal entry",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/banking/journal-entries')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">New Journal Entry</h1>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Journal Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input 
                id="date" 
                type="date" 
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input 
                id="reference" 
                placeholder="Entry reference..." 
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              placeholder="Journal entry description..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
                            ? (() => {
                                const account = accounts.find(a => a.id === line.account_id);
                                if (!account) return 'Select job or account';
                                const num = parseInt(account.account_number);
                                // For job accounts (5000-5999), show name only
                                if (num >= 5000 && num <= 5999) {
                                  return account.account_name;
                                }
                                // For other accounts, show number - name
                                return `${account.account_number} - ${account.account_name}`;
                              })()
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
                                    key={job.id}
                                    value={job.name}
                                    onSelect={() => {
                                      updateLine(index, {
                                        line_type: 'job',
                                        job_id: job.id,
                                        account_id: '',
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
                                        line.line_type === 'job' && line.job_id === job.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {job.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                            {jobs.length > 0 && otherAccounts.length > 0 && <CommandSeparator />}
                            {otherAccounts.length > 0 && (
                              <CommandGroup heading="Accounts">
                                {otherAccounts.map((account) => (
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
                      onOpenChange={(open) => {
                        setOpenPopovers(prev => ({ 
                          ...prev, 
                          [index]: { ...prev[index], costCode: open } 
                        }));
                        if (open && line.line_type === 'job' && line.job_id && !costCodes[line.job_id]) {
                          loadCostCodesForJob(line.job_id);
                        }
                      }}
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
                                return code ? `${code.code} - ${code.description} - ${code.type}` : 'Select cost code';
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
                                  value={`${code.code} ${code.description} ${code.type}`}
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
                                  {code.code} - {code.description} - {code.type}
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

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex items-center gap-4">
                <span className="text-sm">Total Debits: <span className="font-semibold">${totalDebits.toFixed(2)}</span></span>
                <span className="text-sm">Total Credits: <span className="font-semibold">${totalCredits.toFixed(2)}</span></span>
                <Badge variant={isBalanced ? "default" : "destructive"}>
                  {isBalanced ? "Balanced" : `Out of Balance: $${Math.abs(difference).toFixed(2)}`}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
                <Button 
                  type="button" 
                  onClick={handleSave}
                  disabled={!isBalanced || lines.length < 2}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save & Post
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
