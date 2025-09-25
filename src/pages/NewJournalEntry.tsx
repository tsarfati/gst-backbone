import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import AccountingJobCostSelector from "@/components/AccountingJobCostSelector";

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
}

interface JournalEntryLine {
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

  const [journalEntry, setJournalEntry] = useState({
    description: '',
    entry_date: new Date().toISOString().split('T')[0],
    reference: ''
  });

  const [lines, setLines] = useState<JournalEntryLine[]>([
    {
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
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, account_number, account_name, account_type, normal_balance')
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

  const addLine = () => {
    const newLine: JournalEntryLine = {
      account_id: '',
      debit_amount: 0,
      credit_amount: 0,
      description: journalEntry.description,
      billable: false,
      markup_percentage: 0,
      billable_amount: 0,
      line_order: lines.length + 1
    };
    setLines([...lines, newLine]);
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

      const { data: entryData, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          ...journalEntry,
          total_debit: totalDebits,
          total_credit: totalCredits,
          status: 'posted',
          created_by: user.data.user?.id
        })
        .select()
        .single();

      if (entryError) throw entryError;

      const linesToInsert = lines.map(line => ({
        ...line,
        journal_entry_id: entryData.id,
        job_id: line.job_id || null,
        cost_code_id: line.cost_code_id || null
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

interface JournalLine {
  id: string;
  accountId: string;
  accountName: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
}

export default function NewJournalEntry() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [entryData, setEntryData] = useState({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
  });

  const [lines, setLines] = useState<JournalLine[]>([]);
  const [currentLine, setCurrentLine] = useState({
    accountId: '',
    accountName: '',
    description: '',
    debitAmount: '',
    creditAmount: '',
  });

  // Mock chart of accounts - in a real app, this would come from the database
  const accounts = [
    { id: 'cash', name: '1000 - Cash' },
    { id: 'checking', name: '1010 - Checking Account' },
    { id: 'ar', name: '1200 - Accounts Receivable' },
    { id: 'inventory', name: '1300 - Inventory' },
    { id: 'equipment', name: '1500 - Equipment' },
    { id: 'ap', name: '2000 - Accounts Payable' },
    { id: 'revenue', name: '4000 - Revenue' },
    { id: 'expenses', name: '5000 - Operating Expenses' },
    { id: 'cogs', name: '5100 - Cost of Goods Sold' },
  ];

  const handleEntryDataChange = (field: string, value: string) => {
    setEntryData(prev => ({ ...prev, [field]: value }));
  };

  const handleCurrentLineChange = (field: string, value: string) => {
    setCurrentLine(prev => ({ ...prev, [field]: value }));
    
    // Auto-populate account name when account is selected
    if (field === 'accountId') {
      const account = accounts.find(acc => acc.id === value);
      if (account) {
        setCurrentLine(prev => ({ ...prev, accountName: account.name }));
      }
    }
  };

  const addLine = () => {
    if (!currentLine.accountId) {
      toast({
        title: 'Validation Error',
        description: 'Please select an account.',
        variant: 'destructive',
      });
      return;
    }

    const debit = parseFloat(currentLine.debitAmount) || 0;
    const credit = parseFloat(currentLine.creditAmount) || 0;

    if (debit === 0 && credit === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter either a debit or credit amount.',
        variant: 'destructive',
      });
      return;
    }

    if (debit > 0 && credit > 0) {
      toast({
        title: 'Validation Error',
        description: 'A line cannot have both debit and credit amounts.',
        variant: 'destructive',
      });
      return;
    }

    const newLine: JournalLine = {
      id: Date.now().toString(),
      accountId: currentLine.accountId,
      accountName: currentLine.accountName,
      description: currentLine.description || entryData.description,
      debitAmount: debit,
      creditAmount: credit,
    };

    setLines(prev => [...prev, newLine]);
    
    // Reset current line
    setCurrentLine({
      accountId: '',
      accountName: '',
      description: '',
      debitAmount: '',
      creditAmount: '',
    });
  };

  const removeLine = (id: string) => {
    setLines(prev => prev.filter(line => line.id !== id));
  };

  const calculateTotals = () => {
    const totalDebits = lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const totalCredits = lines.reduce((sum, line) => sum + line.creditAmount, 0);
    return { totalDebits, totalCredits };
  };

  const isBalanced = () => {
    const { totalDebits, totalCredits } = calculateTotals();
    return Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a journal entry.',
        variant: 'destructive',
      });
      return;
    }

    // Validation
    if (!entryData.date || !entryData.description) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in the date and description.',
        variant: 'destructive',
      });
      return;
    }

    if (lines.length < 2) {
      toast({
        title: 'Validation Error',
        description: 'A journal entry must have at least 2 lines.',
        variant: 'destructive',
      });
      return;
    }

    if (!isDraft && !isBalanced()) {
      toast({
        title: 'Validation Error',
        description: 'Debits and credits must be equal to post the entry.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // This would typically create the journal entry and lines in the database
      const status = isDraft ? 'draft' : 'posted';
      
      toast({
        title: 'Success',
        description: `Journal entry ${isDraft ? 'saved as draft' : 'posted'} successfully!`,
      });
      
      // Navigate back to journal entries page
      navigate('/banking/journal-entries');
    } catch (error) {
      console.error('Error creating journal entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to create journal entry. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const { totalDebits, totalCredits } = calculateTotals();
  const difference = totalDebits - totalCredits;

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
    </div>
  );
}
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/banking/journal-entries')}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">New Journal Entry</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Create a new accounting journal entry with debits and credits
        </p>
      </div>

      {/* Entry Header */}
      <Card className="shadow-elevation-md mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Entry Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date <span className="text-destructive">*</span></Label>
              <Input
                id="date"
                type="date"
                value={entryData.date}
                onChange={(e) => handleEntryDataChange('date', e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                placeholder="Enter reference number..."
                value={entryData.reference}
                onChange={(e) => handleEntryDataChange('reference', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
              <Input
                id="description"
                placeholder="Entry description..."
                value={entryData.description}
                onChange={(e) => handleEntryDataChange('description', e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Line */}
      <Card className="shadow-elevation-md mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Journal Line
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="account">Account</Label>
              <Select value={currentLine.accountId} onValueChange={(value) => handleCurrentLineChange('accountId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lineDescription">Description</Label>
              <Input
                id="lineDescription"
                placeholder="Line description..."
                value={currentLine.description}
                onChange={(e) => handleCurrentLineChange('description', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="debit">Debit Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="debit"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={currentLine.debitAmount}
                  onChange={(e) => handleCurrentLineChange('debitAmount', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="credit">Credit Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="credit"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={currentLine.creditAmount}
                  onChange={(e) => handleCurrentLineChange('creditAmount', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Button onClick={addLine} className="h-10">
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Journal Lines */}
      <Card className="shadow-elevation-md mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Journal Lines
            </span>
            <div className="text-sm font-normal">
              {lines.length} line{lines.length !== 1 ? 's' : ''}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No lines added yet. Add your first journal entry line above.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.accountName}</TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="text-right">
                        {line.debitAmount > 0 ? `$${line.debitAmount.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.creditAmount > 0 ? `$${line.creditAmount.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Totals */}
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Total Debits:</span>
                    <span className="font-semibold">${totalDebits.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Credits:</span>
                    <span className="font-semibold">${totalCredits.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Difference:</span>
                    <span className={`font-bold ${Math.abs(difference) < 0.01 ? 'text-success' : 'text-destructive'}`}>
                      ${Math.abs(difference).toFixed(2)}
                    </span>
                  </div>
                  {Math.abs(difference) >= 0.01 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Entry must be balanced before posting
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button 
          variant="outline" 
          onClick={() => navigate('/banking/journal-entries')}
        >
          Cancel
        </Button>
        <Button 
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={isLoading || lines.length < 2}
        >
          Save as Draft
        </Button>
        <Button 
          onClick={() => handleSubmit(false)}
          disabled={isLoading || !isBalanced()}
          className="px-6"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              Posting Entry...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Post Entry
            </>
          )}
        </Button>
      </div>
    </div>
  );
}