import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, DollarSign, Save, ArrowLeft, Shield } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

export default function CreditCardEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liabilityAccounts, setLiabilityAccounts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    cardName: '',
    cardNumber: '',
    cardholderName: '',
    issuer: '',
    cardType: '',
    creditLimit: '',
    interestRate: '',
    dueDate: '',
    description: '',
    liabilityAccountId: '',
  });

  useEffect(() => {
    if (id && currentCompany) {
      fetchCreditCard();
      fetchLiabilityAccounts();
    }
  }, [id, currentCompany]);

  const fetchCreditCard = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('id', id)
        .eq('company_id', currentCompany?.id)
        .single();

      if (error) throw error;

      setFormData({
        cardName: data.card_name || '',
        cardNumber: `**** **** **** ${data.card_number_last_four}`,
        cardholderName: data.cardholder_name || '',
        issuer: data.issuer || '',
        cardType: data.card_type || '',
        creditLimit: data.credit_limit?.toString() || '',
        interestRate: data.interest_rate?.toString() || '',
        dueDate: data.due_date || '',
        description: data.description || '',
        liabilityAccountId: data.liability_account_id || '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLiabilityAccounts = async () => {
    if (!currentCompany) return;
    
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('account_type', 'liability')
      .eq('is_active', true)
      .order('account_number');
      
    setLiabilityAccounts(data || []);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to edit a credit card.',
        variant: 'destructive',
      });
      return;
    }

    // Basic validation
    if (!formData.cardName || !formData.cardholderName || !formData.issuer || !formData.liabilityAccountId) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields including liability account.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('credit_cards')
        .update({
          card_name: formData.cardName,
          cardholder_name: formData.cardholderName,
          issuer: formData.issuer,
          card_type: formData.cardType || null,
          credit_limit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
          interest_rate: formData.interestRate ? parseFloat(formData.interestRate) : null,
          due_date: formData.dueDate || null,
          liability_account_id: formData.liabilityAccountId,
          description: formData.description || null,
        })
        .eq('id', id)
        .eq('company_id', currentCompany!.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Credit card updated successfully!',
      });
      
      navigate(`/payables/credit-cards/${id}`);
    } catch (error) {
      console.error('Error updating credit card:', error);
      toast({
        title: 'Error',
        description: 'Failed to update credit card. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(`/payables/credit-cards/${id}`)}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Edit Credit Card</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Update credit card information
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card Details */}
        <Card className="shadow-elevation-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Card Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cardName">Card Name <span className="text-destructive">*</span></Label>
                <Input
                  id="cardName"
                  placeholder="e.g., Business Rewards Card"
                  value={formData.cardName}
                  onChange={(e) => handleInputChange('cardName', e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cardholderName">Cardholder Name <span className="text-destructive">*</span></Label>
                <Input
                  id="cardholderName"
                  placeholder="Name as it appears on card"
                  value={formData.cardholderName}
                  onChange={(e) => handleInputChange('cardholderName', e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  value={formData.cardNumber}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Card number cannot be changed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card className="shadow-elevation-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issuer">Card Issuer/Bank <span className="text-destructive">*</span></Label>
                <Input
                  id="issuer"
                  placeholder="e.g., Chase, American Express, Capital One"
                  value={formData.issuer}
                  onChange={(e) => handleInputChange('issuer', e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cardType">Card Type</Label>
                <Select value={formData.cardType} onValueChange={(value) => handleInputChange('cardType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select card type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visa">Visa</SelectItem>
                    <SelectItem value="mastercard">Mastercard</SelectItem>
                    <SelectItem value="amex">American Express</SelectItem>
                    <SelectItem value="discover">Discover</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="creditLimit">Credit Limit</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="creditLimit"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.creditLimit}
                    onChange={(e) => handleInputChange('creditLimit', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="interestRate">Interest Rate (%)</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.interestRate}
                  onChange={(e) => handleInputChange('interestRate', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dueDate">Payment Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="liabilityAccount">Liability Account <span className="text-destructive">*</span></Label>
                <Select value={formData.liabilityAccountId} onValueChange={(value) => handleInputChange('liabilityAccountId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select liability account" />
                  </SelectTrigger>
                  <SelectContent>
                    {liabilityAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_number} - {account.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the liability account this credit card should be associated with
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Additional notes about this credit card..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/20 rounded-full mt-1">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Security & Privacy</h3>
                <p className="text-sm text-muted-foreground">
                  Your card information is encrypted using industry-standard security measures. 
                  The card number cannot be changed for security reasons.
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
            onClick={() => navigate(`/payables/credit-cards/${id}`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="px-6">
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
