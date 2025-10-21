import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  Plus, 
  Save, 
  Trash2, 
  Calculator,
  FileText,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
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
  billable: boolean;
  markup_percentage: number;
  billable_amount: number;
  line_order: number;
}

export default function NewJournalEntry() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentCompany } = useCompany();

  const [journalEntry, setJournalEntry] = useState({
    description: '',
    entry_date: new Date().toISOString().split('T')[0],
    reference: ''
  });

  const [lines, setLines] = useState<JournalEntryLine[]>([
    {
      line_type: 'controller',
      account_id: '',
      debit_amount: 0,
      credit_amount: 0,
      description: '',
      billable: false,
      markup_percentage: 0,
      billable_amount: 0,
      line_order: 1
    },
    {
      line_type: 'controller',
      account_id: '',
      debit_amount: 0,
      credit_amount: 0,
      description: '',
      billable: false,
      markup_percentage: 0,
      billable_amount: 0,
      line_order: 2
    }
  ]);

  useEffect(() => {
    if (currentCompany?.id) {
      loadAccounts();
    }
  }, [currentCompany?.id]);

  const loadAccounts = async () => {
    try {
      if (!currentCompany?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, account_number, account_name, account_type, normal_balance')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('account_number');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load chart of accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Separate job accounts (5000-5999) from other accounts
  const jobAccounts = accounts.filter(a => {
    const num = parseInt(a.account_number);
    return num >= 5000 && num <= 5999;
  });
  const otherAccounts = accounts.filter(a => {
    const num = parseInt(a.account_number);
    return num < 5000 || num > 5999;
  });

  const addLine = () => {
    const newLine: JournalEntryLine = {
      line_type: 'controller',
      account_id: '',
      debit_amount: 0,
      credit_amount: 0,
      description: journalEntry.description,
      billable: false,
      markup_percentage: 0,
      billable_amount: 0,
      line_order: lines.length + 1
    };
    setLines((prev) => [...prev, newLine]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      toast({
        title: "Cannot Remove",
        description: "A journal entry must have at least 2 lines",
        variant: "destructive",
      });
      return;
    }
    const newLines = lines.filter((_, i) => i !== index);
    newLines.forEach((line, i) => {
      line.line_order = i + 1;
    });
    setLines(newLines);
  };

  const updateLine = (index: number, updates: Partial<JournalEntryLine>) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], ...updates };
    setLines(newLines);
  };

  const calculateTotals = () => {
    const totalDebits = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
    return { totalDebits, totalCredits, difference: totalDebits - totalCredits };
  };

  const handleSave = async () => {
    // Validate minimum lines
    if (lines.length < 2) {
      toast({
        title: "Entry Needs Two Lines",
        description: "A journal entry must have at least 2 lines.",
        variant: "destructive",
      });
      return;
    }

    // Validate each line requirements
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const displayIndex = i + 1;
      if (line.line_type === 'controller') {
        if (!line.account_id) {
          toast({
            title: `Line ${displayIndex}: Missing account`,
            description: "Select an account for controller lines.",
            variant: "destructive",
          });
          return;
        }
      } else {
        if (!line.job_id || !line.cost_code_id) {
          toast({
            title: `Line ${displayIndex}: Select job and cost code`,
            description: "Job lines require both a job and a cost code.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    const { totalDebits, totalCredits, difference } = calculateTotals();
    if (Math.abs(difference) > 0.01) {
      toast({
        title: "Unbalanced Entry",
        description: "Total debits must equal total credits",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user || !currentCompany?.id) {
        throw new Error('No user or company');
      }

      const { data: entryData, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          ...journalEntry,
          total_debit: totalDebits,
          total_credit: totalCredits,
          status: 'posted',
          created_by: user.data.user.id,
          company_id: currentCompany.id
        })
        .select()
        .single();

      if (entryError) throw entryError;

      const linesToInsert = lines.map((line) => ({
        journal_entry_id: entryData.id,
        account_id: line.account_id,
        job_id: line.job_id || null,
        cost_code_id: line.cost_code_id || null,
        debit_amount: line.debit_amount || 0,
        credit_amount: line.credit_amount || 0,
        description: line.description || '',
        billable: line.billable ?? false,
        markup_percentage: line.markup_percentage ?? 0,
        billable_amount: line.billable_amount ?? 0,
        line_order: line.line_order
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      toast({
        title: "Success",
        description: "Journal entry created successfully",
      });

      navigate('/accounting');
    } catch (error) {
      console.error('Error saving journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to save journal entry",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const { totalDebits, totalCredits, difference } = calculateTotals();
  const isBalanced = Math.abs(difference) < 0.01;

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/accounting')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">New Journal Entry</h1>
            <p className="text-muted-foreground">Create a new dual-entry journal entry</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !isBalanced}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save & Post'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entry Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="entry_date">Date</Label>
              <Input
                id="entry_date"
                type="date"
                value={journalEntry.entry_date}
                onChange={(e) => setJournalEntry(prev => ({ ...prev, entry_date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={journalEntry.reference}
                onChange={(e) => setJournalEntry(prev => ({ ...prev, reference: e.target.value }))}
                placeholder="Reference number"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={journalEntry.description}
                onChange={(e) => setJournalEntry(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Entry description"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-4">
              <span>Total Debits: ${totalDebits.toFixed(2)}</span>
              <span>Total Credits: ${totalCredits.toFixed(2)}</span>
            </div>
            <Badge variant={isBalanced ? "default" : "destructive"}>
              {isBalanced ? "Balanced" : `Difference: $${Math.abs(difference).toFixed(2)}`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Journal Entry Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Journal Entry Lines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lines.map((line, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                  <div>
                    <Label>Type</Label>
                    <Select 
                      value={line.line_type} 
                      onValueChange={(value: 'controller' | 'job') => updateLine(index, { 
                        line_type: value,
                        job_id: value === 'controller' ? undefined : line.job_id,
                        cost_code_id: value === 'controller' ? undefined : line.cost_code_id
                      })}
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
                      <Label>Account</Label>
                      <Select 
                        value={line.account_id} 
                        onValueChange={(value) => updateLine(index, { account_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {jobAccounts.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">JOBS</div>
                              {jobAccounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.account_name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {jobAccounts.length > 0 && otherAccounts.length > 0 && (
                            <div className="my-1 border-t" />
                          )}
                          {otherAccounts.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Accounts</div>
                              {otherAccounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.account_number} - {account.account_name}
                                </SelectItem>
                              ))}
                            </>
                          )}
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
                      onChange={(value) => updateLine(index, { 
                        debit_amount: parseFloat(value) || 0,
                        credit_amount: 0
                      })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Credit</Label>
                    <CurrencyInput
                      value={line.credit_amount.toString()}
                      onChange={(value) => updateLine(index, { 
                        credit_amount: parseFloat(value) || 0,
                        debit_amount: 0
                      })}
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
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={line.billable}
                      onCheckedChange={(checked) => updateLine(index, { billable: checked as boolean })}
                    />
                    <Label>Billable</Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLine(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Button type="button" variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}