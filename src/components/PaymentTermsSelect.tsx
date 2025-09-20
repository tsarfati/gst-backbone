import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PaymentTermsSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

export default function PaymentTermsSelect({ value, onValueChange }: PaymentTermsSelectProps) {
  const { user } = useAuth();
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<string[]>(['asap', '15', '30']);

  useEffect(() => {
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

    fetchPaymentTermsOptions();
  }, [user]);

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
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select payment terms" />
      </SelectTrigger>
      <SelectContent>
        {paymentTermsOptions.map((option) => (
          <SelectItem key={option} value={option}>
            {getDisplayText(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}