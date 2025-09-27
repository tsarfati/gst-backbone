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
  Settings,
  Banknote
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  account_category?: string;
  normal_balance: string;
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [csvUploadDialogOpen, setCsvUploadDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
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
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
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
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({
          account_number: editingAccount.account_number,
          account_name: editingAccount.account_name,
          account_type: editingAccount.account_type,
          account_category: editingAccount.account_category || null,
          normal_balance: editingAccount.normal_balance
        })
        .eq('id', editingAccount.id);

      if (error) throw error;

      toast({
        title: "Account Updated",
        description: "Chart of account has been updated successfully",
      });

      setEditDialogOpen(false);
      setEditingAccount(null);
      loadAccounts();
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
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Validate headers
      const requiredHeaders = ['account_number', 'account_name', 'account_type'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        toast({
          title: "Invalid CSV format",
          description: `Missing required columns: ${missingHeaders.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const accountsToInsert = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const account: any = {};
        
        headers.forEach((header, index) => {
          account[header] = values[index];
        });

        if (account.account_number && account.account_name && account.account_type) {
          accountsToInsert.push({
            account_number: account.account_number,
            account_name: account.account_name,
            account_type: account.account_type,
            account_category: account.account_category || null,
            normal_balance: account.normal_balance || 'debit',
            current_balance: parseFloat(account.current_balance || '0'),
            is_system_account: false,
            is_active: true,
            created_by: userData.user?.id
          });
        }
      }

      if (accountsToInsert.length > 0) {
        const { error } = await supabase
          .from('chart_of_accounts')
          .insert(accountsToInsert);

        if (error) throw error;

        toast({
          title: "CSV Uploaded Successfully",
          description: `${accountsToInsert.length} accounts imported`,
        });

        setCsvUploadDialogOpen(false);
        setCsvFile(null);
        loadAccounts();
      }
    } catch (error) {
      console.error('Error uploading CSV:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload CSV file",
        variant: "destructive",
      });
    }
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
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts ({filteredAccounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account #</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Normal Balance</TableHead>
                <TableHead className="text-right">Current Balance</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-mono">{account.account_number}</TableCell>
                  <TableCell className="font-medium">{account.account_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getAccountTypeColor(account.account_type)}>
                      <span className="flex items-center space-x-1">
                        {getAccountTypeIcon(account.account_type)}
                        <span>{accountTypes.find(t => t.value === account.account_type)?.label}</span>
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {account.account_category ? 
                      account.account_category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) 
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {account.normal_balance === 'debit' ? 'Debit' : 'Credit'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(account.current_balance)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingAccount(account);
                          setEditDialogOpen(true);
                        }}
                        disabled={account.is_system_account}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!account.is_system_account && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deactivate Account</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to deactivate this account? This action will hide it from the chart of accounts but preserve historical data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteAccount(account.id)}>
                                Deactivate
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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