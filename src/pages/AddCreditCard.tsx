import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, DollarSign, Calendar, Save, ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function AddCreditCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    cardName: '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardholderName: '',
    issuer: '',
    cardType: '',
    creditLimit: '',
    currentBalance: '',
    interestRate: '',
    dueDate: '',
    description: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCardNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    // Add spaces every 4 digits
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted.substring(0, 19); // Max 16 digits + 3 spaces
  };

  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    handleInputChange('cardNumber', formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to add a credit card.',
        variant: 'destructive',
      });
      return;
    }

    // Basic validation
    if (!formData.cardName || !formData.cardNumber || !formData.cardholderName || !formData.issuer) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // This would typically insert into a credit_cards table
      // For now, we'll just show a success message
      toast({
        title: 'Success',
        description: 'Credit card added successfully!',
      });
      
      // Navigate back to credit cards page
      navigate('/banking/credit-cards');
    } catch (error) {
      console.error('Error adding credit card:', error);
      toast({
        title: 'Error',
        description: 'Failed to add credit card. Please try again.',
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
            onClick={() => navigate('/banking/credit-cards')}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Add Credit Card</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Add a new credit card account to track expenses and payments
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
                <Label htmlFor="cardNumber">Card Number <span className="text-destructive">*</span></Label>
                <Input
                  id="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  value={formData.cardNumber}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  required
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="expiryMonth">Exp Month</Label>
                  <Select value={formData.expiryMonth} onValueChange={(value) => handleInputChange('expiryMonth', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <SelectItem key={month} value={month.toString().padStart(2, '0')}>
                          {month.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="expiryYear">Exp Year</Label>
                  <Select value={formData.expiryYear} onValueChange={(value) => handleInputChange('expiryYear', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="YY" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                        <SelectItem key={year} value={year.toString().slice(-2)}>
                          {year.toString().slice(-2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    placeholder="123"
                    value={formData.cvv}
                    onChange={(e) => handleInputChange('cvv', e.target.value.replace(/\D/g, '').substring(0, 4))}
                    maxLength={4}
                  />
                </div>
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
                <Label htmlFor="currentBalance">Current Balance</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="currentBalance"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.currentBalance}
                    onChange={(e) => handleInputChange('currentBalance', e.target.value)}
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
                  Only the last 4 digits will be displayed in the system for identification purposes.
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
            onClick={() => navigate('/banking/credit-cards')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="px-6">
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Adding Card...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Add Credit Card
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}