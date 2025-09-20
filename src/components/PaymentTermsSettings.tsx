import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function PaymentTermsSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<string[]>(['asap', '15', '30']);
  const [newTerm, setNewTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPaymentTermsOptions();
  }, [user]);

  const fetchPaymentTermsOptions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('payment_terms_options')
        .eq('company_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching payment terms options:', error);
        return;
      }

      if (data?.payment_terms_options) {
        setPaymentTermsOptions(data.payment_terms_options);
      }
    } catch (error) {
      console.error('Error fetching payment terms options:', error);
    }
  };

  const savePaymentTermsOptions = async (options: string[]) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          company_id: user.id,
          payment_terms_options: options
        });

      if (error) throw error;

      toast({
        title: "Payment Terms Updated",
        description: "Payment terms options have been successfully updated.",
      });
    } catch (error) {
      console.error('Error saving payment terms options:', error);
      toast({
        title: "Error",
        description: "Failed to save payment terms options",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addPaymentTerm = () => {
    if (!newTerm.trim()) return;
    
    const updatedOptions = [...paymentTermsOptions, newTerm.trim()];
    setPaymentTermsOptions(updatedOptions);
    savePaymentTermsOptions(updatedOptions);
    setNewTerm('');
  };

  const removePaymentTerm = (termToRemove: string) => {
    const updatedOptions = paymentTermsOptions.filter(term => term !== termToRemove);
    setPaymentTermsOptions(updatedOptions);
    savePaymentTermsOptions(updatedOptions);
  };

  const getDisplayText = (option: string) => {
    switch (option) {
      case 'asap':
        return 'ASAP';
      case '15':
        return 'Net 15';
      case '30':
        return 'Net 30';
      default:
        return `Net ${option}`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Terms Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {paymentTermsOptions.map((term) => (
            <Badge key={term} variant="secondary" className="text-sm px-3 py-1">
              {getDisplayText(term)}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-2 hover:bg-destructive/20"
                onClick={() => removePaymentTerm(term)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="new-term" className="sr-only">Add payment term</Label>
            <Input
              id="new-term"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="Enter payment term (e.g., 45 for Net 45)"
              onKeyPress={(e) => e.key === 'Enter' && addPaymentTerm()}
            />
          </div>
          <Button 
            onClick={addPaymentTerm} 
            disabled={!newTerm.trim() || loading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Term
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          These payment terms will be available when creating or editing vendors. Use "asap" for immediate payment, 
          or numbers for Net terms (e.g., "15" for Net 15 days).
        </p>
      </CardContent>
    </Card>
  );
}