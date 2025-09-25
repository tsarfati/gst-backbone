import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ArrowLeft,
  Plus, 
  Edit, 
  TrendingUp, 
  TrendingDown, 
  PieChart,
  DollarSign,
  FileText,
  Building
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

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
  { value: 'cost_of_goods_sold', label: 'Cost of Goods Sold' }
];

const accountCategories: Record<string, string[]> = {
  asset: ['current_assets', 'fixed_assets', 'other_assets'],
  liability: ['current_liabilities', 'long_term_liabilities'],
  equity: ['equity'],
  revenue: ['operating_revenue', 'other_revenue'],
  expense: ['operating_expenses', 'other_expenses'],
  cost_of_goods_sold: ['direct_costs', 'indirect_costs']
};

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    account_number: '',
    account_name: '',
    account_type: '',
    account_category: '',
    normal_balance: '',
    parent_account_id: ''
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    filterAccounts();
  }, [accounts, searchTerm, selectedType]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
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

  const filterAccounts = () => {
    let filtered = accounts;

    if (searchTerm) {
      filtered = filtered.filter(account =>
        account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.account_number.includes(searchTerm)
      );
    }

    if (selectedType && selectedType !== 'all') {
      filtered = filtered.filter(account => account.account_type === selectedType);
    }

    setFilteredAccounts(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const user = await supabase.auth.getUser();
      
      if (editingAccount) {
        const { error } = await supabase
          .from('chart_of_accounts')
          .update({
            ...formData,
            parent_account_id: formData.parent_account_id || null
          })
          .eq('id', editingAccount.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Account updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('chart_of_accounts')
          .insert({
            ...formData,
            created_by: user.data.user?.id,
            parent_account_id: formData.parent_account_id || null
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Account created successfully",
        });
      }

      setDialogOpen(false);
      setEditingAccount(null);
      setFormData({
        account_number: '',
        account_name: '',
        account_type: '',
        account_category: '',
        normal_balance: '',
        parent_account_id: ''
      });
      loadAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      toast({
        title: "Error",
        description: "Failed to save account",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      account_number: account.account_number,
      account_name: account.account_name,
      account_type: account.account_type,
      account_category: account.account_category || '',
      normal_balance: account.normal_balance,
      parent_account_id: account.parent_account_id || ''
    });
    setDialogOpen(true);
  };

  const handleAccountTypeChange = (accountType: string) => {
    setFormData(prev => ({
      ...prev,
      account_type: accountType,
      account_category: '',
      normal_balance: ['asset', 'expense', 'cost_of_goods_sold'].includes(accountType) ? 'debit' : 'credit'
    }));
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'asset': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'liability': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'equity': return <PieChart className="h-4 w-4 text-blue-500" />;
      case 'revenue': return <DollarSign className="h-4 w-4 text-emerald-500" />;
      case 'expense': return <FileText className="h-4 w-4 text-orange-500" />;
      case 'cost_of_goods_sold': return <Building className="h-4 w-4 text-purple-500" />;
      default: return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

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
            <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
            <p className="text-muted-foreground">Manage your accounting structure</p>
          </div>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingAccount(null);
              setFormData({
                account_number: '',
                account_name: '',
                account_type: '',
                account_category: '',
                normal_balance: '',
                parent_account_id: ''
              });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Edit Account' : 'Add New Account'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="normal_balance">Normal Balance</Label>
                  <Select 
                    value={formData.normal_balance} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, normal_balance: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="account_name">Account Name</Label>
                <Input
                  id="account_name"
                  value={formData.account_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, account_name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="account_type">Account Type</Label>
                <Select 
                  value={formData.account_type} 
                  onValueChange={handleAccountTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.account_type && (
                <div>
                  <Label htmlFor="account_category">Category</Label>
                  <Select 
                    value={formData.account_category} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, account_category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accountCategories[formData.account_type]?.map(category => (
                        <SelectItem key={category} value={category}>
                          {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="parent_account">Parent Account (Optional)</Label>
                <Select 
                  value={formData.parent_account_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, parent_account_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter(acc => acc.account_type === formData.account_type && acc.id !== editingAccount?.id)
                      .map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_number} - {account.account_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingAccount ? 'Update' : 'Create'} Account
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {accountTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                <TableHead>Balance</TableHead>
                <TableHead>Normal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account.id}>
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
                  <TableCell className="capitalize">
                    {account.account_category?.replace('_', ' ')}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(Math.abs(account.current_balance))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.normal_balance === 'debit' ? 'default' : 'secondary'}>
                      {account.normal_balance}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {account.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      {account.is_system_account && (
                        <Badge variant="outline">System</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(account)}
                      disabled={account.is_system_account}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}