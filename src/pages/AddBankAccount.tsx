import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building, DollarSign, CreditCard, Save, ArrowLeft, Eye, EyeOff, Calendar } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function AddBankAccount() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    routingNumber: '',
    bankName: '',
    accountType: '',
    initialBalance: '',
    balanceDate: new Date().toISOString().split('T')[0],
    description: '',
    bankFeeAccountId: '',
  });
  
  const [chartAccounts, setChartAccounts] = useState<Array<{ id: string; account_number: string; account_name: string }>>([]);
  
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showRoutingNumber, setShowRoutingNumber] = useState(false);
  
  const canViewSensitiveData = profile && ['admin', 'controller'].includes(profile.role);

  useEffect(() => {
    loadChartAccounts();
  }, [currentCompany]);

  const loadChartAccounts = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, account_number, account_name')
        .eq('company_id', currentCompany.id)
        .eq('account_type', 'expense')
        .eq('is_active', true)
        .order('account_number');
      
      if (error) throw error;
      setChartAccounts(data || []);
    } catch (error) {
      console.error('Error loading chart accounts:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to add a bank account.',
        variant: 'destructive',
      });
      return;
    }

    // Basic validation
    if (!formData.accountName || !formData.bankName || !formData.accountType) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      if (!currentCompany?.id) {
        throw new Error('Company not found. Please ensure you are associated with a company.');
      }

      // Insert bank account - this will automatically create the associated cash account
      const { error } = await supabase
        .from('bank_accounts')
        .insert({
          account_name: formData.accountName,
          account_number: formData.accountNumber || null,
          routing_number: formData.routingNumber || null,
          bank_name: formData.bankName,
          account_type: formData.accountType,
          initial_balance: parseFloat(formData.initialBalance) || 0,
          balance_date: formData.balanceDate,
          description: formData.description || null,
          bank_fee_account_id: formData.bankFeeAccountId || null,
          company_id: currentCompany.id,
          created_by: user.id
        });

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Bank account and associated cash account created successfully!',
      });
      
      // Navigate back to bank accounts page
      navigate('/banking/accounts');
    } catch (error) {
      console.error('Error adding bank account:', error);
      toast({
        title: 'Error',
        description: 'Failed to add bank account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/banking/accounts')}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Building className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Add Bank Account</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Connect a new bank account to your financial system
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Details */}
        <Card className="shadow-elevation-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name <span className="text-destructive">*</span></Label>
                <Input
                  id="accountName"
                  placeholder="e.g., Business Checking"
                  value={formData.accountName}
                  onChange={(e) => handleInputChange('accountName', e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type <span className="text-destructive">*</span></Label>
                <Select value={formData.accountType} onValueChange={(value) => handleInputChange('accountType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="money-market">Money Market</SelectItem>
                    <SelectItem value="credit-line">Line of Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <div className="relative">
                  <Input
                    id="accountNumber"
                    type={showAccountNumber ? "text" : "password"}
                    placeholder="Enter account number"
                    value={formData.accountNumber}
                    onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                  />
                  {canViewSensitiveData && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowAccountNumber(!showAccountNumber)}
                    >
                      {showAccountNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                {!canViewSensitiveData && formData.accountNumber && (
                  <p className="text-xs text-muted-foreground">
                    Account Number: ****{formData.accountNumber.slice(-4)}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="routingNumber">Routing Number</Label>
                <div className="relative">
                  <Input
                    id="routingNumber"
                    type={showRoutingNumber ? "text" : "password"}
                    placeholder="9-digit routing number"
                    value={formData.routingNumber}
                    onChange={(e) => handleInputChange('routingNumber', e.target.value)}
                    maxLength={9}
                  />
                  {canViewSensitiveData && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowRoutingNumber(!showRoutingNumber)}
                    >
                      {showRoutingNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                {!canViewSensitiveData && formData.routingNumber && (
                  <p className="text-xs text-muted-foreground">
                    Routing Number: ****{formData.routingNumber.slice(-4)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Information */}
        <Card className="shadow-elevation-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Bank Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name <span className="text-destructive">*</span></Label>
                <Input
                  id="bankName"
                  placeholder="e.g., Chase, Wells Fargo, Bank of America"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="initialBalance">Initial Balance</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="initialBalance"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.initialBalance}
                    onChange={(e) => handleInputChange('initialBalance', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="balanceDate">Balance Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="balanceDate"
                    type="date"
                    value={formData.balanceDate}
                    onChange={(e) => handleInputChange('balanceDate', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Additional notes about this account..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bankFeeAccountId">Bank Fee GL Account (Optional)</Label>
              <Select value={formData.bankFeeAccountId || undefined} onValueChange={(value) => handleInputChange('bankFeeAccountId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select expense account for bank fees (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  {chartAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_number} - {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select which expense account to use when recording bank fees for ACH or Wire payments
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Note */}
        <Card className="bg-muted/30 border-warning/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-warning/20 rounded-full mt-1">
                <Building className="h-4 w-4 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Security Notice</h3>
                <p className="text-sm text-muted-foreground">
                  Your banking information is encrypted and stored securely. We recommend using read-only access 
                  when possible and regularly reviewing your connected accounts.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/banking/accounts')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="px-6">
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Adding Account...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Add Account
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}