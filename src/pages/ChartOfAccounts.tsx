import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Edit, 
  Trash2,
  TrendingUp, 
  TrendingDown, 
  PieChart,
  DollarSign,
  FileText,
  Building,
  Loader2,
  Search,
  Upload,
  Download,
  Settings,
  Banknote,
  Link,
  Pencil
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import AccountAssociationSettings from "@/components/AccountAssociationSettings";
import ChartOfAccountsViewSelector from "@/components/ChartOfAccountsViewSelector";
import { ChartOfAccountsListView, ChartOfAccountsCompactView, ChartOfAccountsSuperCompactView } from "@/components/ChartOfAccountsViews";
import { useChartOfAccountsViewPreference } from "@/hooks/useChartOfAccountsViewPreference";
import Papa from 'papaparse';

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  account_category: string | null;
  normal_balance: string | null;
  current_balance: number;
  is_system_account: boolean;
  is_active: boolean;
  parent_account_id?: string;
}

const accountTypes = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
  { value: 'cost_of_goods_sold', label: 'Cost of Goods Sold' },
  { value: 'cash', label: 'Cash' }
];

const accountCategories: Record<string, string[]> = {
  asset: ['current_assets', 'fixed_assets', 'other_assets'],
  liability: ['current_liabilities', 'long_term_liabilities'],
  equity: ['owners_equity', 'retained_earnings'],
  revenue: ['operating_revenue', 'other_revenue'],
  expense: ['operating_expenses', 'administrative_expenses', 'job_costs'],
  cost_of_goods_sold: ['direct_costs', 'materials', 'labor'],
  cash: ['cash_accounts', 'bank_accounts', 'petty_cash']
};

export default function ChartOfAccounts() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { currentView, setCurrentView, setDefaultView, isDefault } = useChartOfAccountsViewPreference();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [csvUploadDialogOpen, setCsvUploadDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [associationsDialogOpen, setAssociationsDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [jobAssociationRange, setJobAssociationRange] = useState({ start: '5000', end: '5999' });

  const [newAccount, setNewAccount] = useState({
    account_number: '',
    account_name: '',
    account_type: '',
    account_category: '',
    normal_balance: 'debit'
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
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

  const handleAddAccount = async () => {
    if (!newAccount.account_number || !newAccount.account_name || !newAccount.account_type) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('chart_of_accounts')
        .insert({
          account_number: newAccount.account_number,
          account_name: newAccount.account_name,
          account_type: newAccount.account_type,
          account_category: newAccount.account_category || null,
          normal_balance: newAccount.normal_balance,
          current_balance: 0,
          is_system_account: false,
          is_active: true,
          company_id: currentCompany?.id || '',
          created_by: userData.user?.id
        });

      if (error) throw error;

      toast({
        title: "Account Added",
        description: "Chart of account has been added successfully",
      });

      setNewAccount({
        account_number: '',
        account_name: '',
        account_type: '',
        account_category: '',
        normal_balance: 'debit'
      });
      setAddDialogOpen(false);
      loadAccounts();
    } catch (error) {
      console.error('Error adding account:', error);
      toast({
        title: "Error",
        description: "Failed to add account",
        variant: "destructive",
      });
    }
  };

  const handleEditAccount = async () => {
    if (!editingAccount) return;

    try {
      const isCashType = editingAccount.account_type === 'cash';
      
      const updateData = {
        account_number: editingAccount.account_number,
        account_name: editingAccount.account_name,
        account_type: isCashType ? 'asset' : editingAccount.account_type,
        account_category: isCashType ? 'cash_accounts' : editingAccount.account_category,
        normal_balance: editingAccount.normal_balance
      };
      
      const { error } = await supabase
        .from('chart_of_accounts')
        .update(updateData)
        .eq('id', editingAccount.id);

      if (error) throw error;

      toast({
        title: "Account Updated",
        description: "Chart of account has been updated successfully",
      });

      setEditDialogOpen(false);
      setEditingAccount(null);
      await loadAccounts(); // Ensure we wait for reload
    } catch (error) {
      console.error('Error updating account:', error);
      toast({
        title: "Error", 
        description: "Failed to update account",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({ is_active: false })
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: "Account Deactivated",
        description: "Chart of account has been deactivated",
      });

      loadAccounts();
    } catch (error) {
      console.error('Error deactivating account:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate account",
        variant: "destructive",
      });
    }
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'asset': return <TrendingUp className="h-4 w-4" />;
      case 'liability': return <TrendingDown className="h-4 w-4" />;
      case 'equity': return <PieChart className="h-4 w-4" />;
      case 'revenue': return <DollarSign className="h-4 w-4" />;
      case 'expense': return <FileText className="h-4 w-4" />;
      case 'cost_of_goods_sold': return <Building className="h-4 w-4" />;
      case 'cash': return <Banknote className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'asset': return 'bg-green-100 text-green-800';
      case 'liability': return 'bg-red-100 text-red-800';
      case 'equity': return 'bg-blue-100 text-blue-800';
      case 'revenue': return 'bg-purple-100 text-purple-800';
      case 'expense': return 'bg-orange-100 text-orange-800';
      case 'cost_of_goods_sold': return 'bg-yellow-100 text-yellow-800';
      case 'cash': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.account_number.includes(searchTerm);
    const matchesType = filterType === 'all' || account.account_type === filterType;
    return matchesSearch && matchesType;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();

      // Parse with Papa to handle quoted fields and BOMs
      const parsed = await new Promise<Papa.ParseResult<Record<string, any>>>((resolve, reject) => {
        Papa.parse<Record<string, any>>(csvFile, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.replace(/^\uFEFF/, '').trim().toLowerCase(),
          complete: (results) => resolve(results),
          error: (err) => reject(err),
        });
      });

      if (!parsed.data || parsed.data.length === 0) {
        toast({ title: "Invalid CSV", description: "No data rows found", variant: "destructive" });
        return;
      }

      const requiredHeaders = ['account_number', 'account_name', 'account_type'];
      const headers = Object.keys(parsed.data[0] || {});
      const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast({
          title: "Invalid CSV format",
          description: `Missing required columns: ${missingHeaders.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      const validAccountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense', 'cost_of_goods_sold', 'cash'];
      const accountsToInsert: any[] = [];
      const invalidRows: string[] = [];

      parsed.data.forEach((row, idx) => {
        const rowIndex = idx + 2; // account for header row
        const account_number = String(row.account_number ?? '').trim();
        const account_name = String(row.account_name ?? '').trim();
        const account_type_raw = String(row.account_type ?? '').trim().toLowerCase();
        const account_category = row.account_category ? String(row.account_category).trim() : null;
        const normal_balance = (String(row.normal_balance ?? 'debit').trim().toLowerCase() === 'credit') ? 'credit' : 'debit';
        const current_balance = Number.parseFloat(String(row.current_balance ?? '0')) || 0;

        if (!account_number || !account_name || !account_type_raw) {
          // Skip empty/incomplete lines silently
          return;
        }

        if (!validAccountTypes.includes(account_type_raw)) {
          invalidRows.push(`Row ${rowIndex}: Invalid account_type "${row.account_type}". Must be one of: ${validAccountTypes.join(', ')}`);
          return;
        }

          const isCashType = account_type_raw === 'cash';

          accountsToInsert.push({
            account_number,
            account_name,
            // Map 'cash' to 'asset' to satisfy DB check constraints but preserve category
            account_type: isCashType ? 'asset' : account_type_raw,
            account_category: account_category || (isCashType ? 'cash_accounts' : null),
            normal_balance,
            current_balance,
            is_system_account: false,
            is_active: true,
            company_id: currentCompany?.id || '',
            created_by: userData.user?.id,
          });
      });

      if (invalidRows.length > 0) {
        toast({
          title: "CSV Validation Errors",
          description: `${invalidRows.length} invalid rows found. First error: ${invalidRows[0]}`,
          variant: "destructive",
        });
        return;
      }

      if (accountsToInsert.length === 0) {
        toast({ title: "No valid rows", description: "Nothing to import", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from('chart_of_accounts').insert(accountsToInsert);
      if (error) throw error;

      toast({
        title: "CSV Uploaded Successfully",
        description: `${accountsToInsert.length} accounts imported`,
      });

      setCsvUploadDialogOpen(false);
      setCsvFile(null);
      loadAccounts();
    } catch (error: any) {
      console.error('Error uploading CSV:', error);
      toast({
        title: "Upload Error",
        description: error?.message || "Failed to upload CSV file",
        variant: "destructive",
      });
    }
  };

  const downloadCsvTemplate = () => {
    const csvContent = "account_number,account_name,account_type,account_category,normal_balance,current_balance\n1000,Cash,cash,cash_accounts,debit,5000.00\n1100,Accounts Receivable,asset,current_assets,debit,2500.00\n2000,Accounts Payable,liability,current_liabilities,credit,1500.00\n3000,Equity,equity,equity,credit,10000.00\n4000,Revenue,revenue,operating_revenue,credit,15000.00\n5000,Expenses,expense,operating_expenses,debit,3000.00";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart_of_accounts_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportChartOfAccounts = () => {
    if (filteredAccounts.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no accounts to export",
        variant: "destructive"
      });
      return;
    }

    const csvContent = [
      "account_number,account_name,account_type,account_category,normal_balance,current_balance",
      ...filteredAccounts.map(account => 
        `"${account.account_number}","${account.account_name}","${account.account_type}","${account.account_category || ''}","${account.normal_balance}",${account.current_balance}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart_of_accounts_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${filteredAccounts.length} accounts`,
    });
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading chart of accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your company's chart of accounts</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={associationsDialogOpen} onOpenChange={setAssociationsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Link className="h-4 w-4 mr-2" />
                Account Associations
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Account Associations</DialogTitle>
              </DialogHeader>
              <AccountAssociationSettings />
            </DialogContent>
          </Dialog>
          
          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Chart of Accounts Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Job Association Account Range</Label>
                  <p className="text-sm text-muted-foreground">
                    Define which account numbers are designated for job cost associations
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="range-start">Start</Label>
                      <Input
                        id="range-start"
                        value={jobAssociationRange.start}
                        onChange={(e) => setJobAssociationRange({ ...jobAssociationRange, start: e.target.value })}
                        placeholder="5000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="range-end">End</Label>
                      <Input
                        id="range-end"
                        value={jobAssociationRange.end}
                        onChange={(e) => setJobAssociationRange({ ...jobAssociationRange, end: e.target.value })}
                        placeholder="5999"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    setSettingsDialogOpen(false);
                    toast({
                      title: "Settings Saved",
                      description: "Chart of accounts settings have been saved",
                    });
                  }}>
                    Save Settings
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={csvUploadDialogOpen} onOpenChange={setCsvUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Chart of Accounts CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csv-file">CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={downloadCsvTemplate}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Required columns: account_number, account_name, account_type
                    <br />
                    Optional: account_category, normal_balance, current_balance
                  </p>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setCsvUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCsvUpload} disabled={!csvFile}>
                    Upload CSV
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number *</Label>
                  <Input
                    id="account_number"
                    value={newAccount.account_number}
                    onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
                    placeholder="e.g., 1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_name">Account Name *</Label>
                  <Input
                    id="account_name"
                    value={newAccount.account_name}
                    onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                    placeholder="e.g., Cash"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_type">Account Type *</Label>
                  <Select value={newAccount.account_type} onValueChange={(value) => setNewAccount({ ...newAccount, account_type: value, account_category: '' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {newAccount.account_type && (
                  <div className="space-y-2">
                    <Label htmlFor="account_category">Category</Label>
                    <Select value={newAccount.account_category} onValueChange={(value) => setNewAccount({ ...newAccount, account_category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {accountCategories[newAccount.account_type]?.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="normal_balance">Normal Balance</Label>
                <Select value={newAccount.normal_balance} onValueChange={(value) => setNewAccount({ ...newAccount, normal_balance: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddAccount}>
                  Add Account
                </Button>
              </div>
            </div>
            </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {accountTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={exportChartOfAccounts}
              disabled={filteredAccounts.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Accounts ({filteredAccounts.length})</CardTitle>
            <ChartOfAccountsViewSelector
              currentView={currentView}
              onViewChange={setCurrentView}
              onSetDefault={() => {
                setDefaultView();
                toast({
                  title: "Default View Set",
                  description: "Your view preference has been saved",
                });
              }}
              isDefault={isDefault}
            />
          </div>
        </CardHeader>
        <CardContent>
          {currentView === 'list' && (
            <ChartOfAccountsListView
              accounts={filteredAccounts}
              onEdit={(account) => {
                const accountForEditing = {
                  ...account,
                  account_type: account.account_type === 'asset' && account.account_category === 'cash_accounts' ? 'cash' : account.account_type
                };
                setEditingAccount(accountForEditing);
                setEditDialogOpen(true);
              }}
              formatCurrency={formatCurrency}
              getAccountTypeIcon={getAccountTypeIcon}
            />
          )}

          {currentView === 'compact' && (
            <ChartOfAccountsCompactView
              accounts={filteredAccounts}
              onEdit={(account) => {
                const accountForEditing = {
                  ...account,
                  account_type: account.account_type === 'asset' && account.account_category === 'cash_accounts' ? 'cash' : account.account_type
                };
                setEditingAccount(accountForEditing);
                setEditDialogOpen(true);
              }}
              formatCurrency={formatCurrency}
              getAccountTypeIcon={getAccountTypeIcon}
            />
          )}

          {currentView === 'super-compact' && (
            <ChartOfAccountsSuperCompactView
              accounts={filteredAccounts}
              onEdit={(account) => {
                const accountForEditing = {
                  ...account,
                  account_type: account.account_type === 'asset' && account.account_category === 'cash_accounts' ? 'cash' : account.account_type
                };
                setEditingAccount(accountForEditing);
                setEditDialogOpen(true);
              }}
              formatCurrency={formatCurrency}
              getAccountTypeIcon={getAccountTypeIcon}
            />
          )}

          {filteredAccounts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No accounts found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingAccount && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_account_number">Account Number</Label>
                  <Input
                    id="edit_account_number"
                    value={editingAccount.account_number}
                    onChange={(e) => setEditingAccount({ ...editingAccount, account_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_account_name">Account Name</Label>
                  <Input
                    id="edit_account_name"
                    value={editingAccount.account_name}
                    onChange={(e) => setEditingAccount({ ...editingAccount, account_name: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_account_type">Account Type</Label>
                  <Select value={editingAccount.account_type} onValueChange={(value) => setEditingAccount({ ...editingAccount, account_type: value, account_category: '' })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit_account_category">Category</Label>
                  <Select value={editingAccount.account_category || ''} onValueChange={(value) => setEditingAccount({ ...editingAccount, account_category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountCategories[editingAccount.account_type]?.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_normal_balance">Normal Balance</Label>
                <Select value={editingAccount.normal_balance} onValueChange={(value) => setEditingAccount({ ...editingAccount, normal_balance: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditAccount}>
                  Update Account
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}