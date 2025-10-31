import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AccrualAccountingSettings() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [useAccrualAccounting, setUseAccrualAccounting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchSettings();
    }
  }, [currentCompany?.id]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_settings')
        .select('use_accrual_accounting')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUseAccrualAccounting((data as any).use_accrual_accounting || false);
      }
    } catch (error) {
      console.error('Error fetching accrual accounting settings:', error);
      toast({
        title: "Error",
        description: "Failed to load accounting method settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccrualAccounting = async (checked: boolean) => {
    try {
      setUpdating(true);
      setUseAccrualAccounting(checked);

      const { error } = await supabase
        .from('company_settings')
        .upsert({
          company_id: currentCompany.id,
          use_accrual_accounting: checked,
        } as any, {
          onConflict: 'company_id'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Accounting method changed to ${checked ? 'Accrual' : 'Cash'} basis.`,
      });
    } catch (error) {
      console.error('Error updating accrual accounting setting:', error);
      setUseAccrualAccounting(!checked);
      toast({
        title: "Error",
        description: "Failed to update accounting method.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accounting Method</CardTitle>
          <CardDescription>
            Choose between cash and accrual accounting methods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounting Method</CardTitle>
        <CardDescription>
          Choose between cash and accrual accounting methods
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Changing the accounting method will only affect newly approved bills.
            Existing bills and payments will not be modified.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="accrual-accounting" className="text-base font-semibold">
              Use Accrual Accounting
            </Label>
            <p className="text-sm text-muted-foreground">
              {useAccrualAccounting ? (
                <>
                  <strong>Accrual Basis:</strong> Bills are recorded to the General Ledger when approved, 
                  recognizing expenses when incurred rather than when paid.
                </>
              ) : (
                <>
                  <strong>Cash Basis:</strong> Bills are recorded to the General Ledger only when paid, 
                  recognizing expenses when cash changes hands.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center">
            {updating && <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />}
            <Switch
              id="accrual-accounting"
              checked={useAccrualAccounting}
              onCheckedChange={handleToggleAccrualAccounting}
              disabled={updating}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg bg-muted/50 p-4">
          <h4 className="font-semibold text-sm">How it works:</h4>
          
          {useAccrualAccounting ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground">When a bill is approved:</p>
                <ul className="list-disc list-inside text-muted-foreground ml-2 space-y-1">
                  <li>Debit: Job's Expense Account</li>
                  <li>Credit: Accounts Payable</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">When the bill is paid:</p>
                <ul className="list-disc list-inside text-muted-foreground ml-2 space-y-1">
                  <li>Debit: Accounts Payable</li>
                  <li>Credit: Cash/Bank Account</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-foreground">When a bill is approved:</p>
                <ul className="list-disc list-inside text-muted-foreground ml-2">
                  <li>No journal entry is created</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">When the bill is paid:</p>
                <ul className="list-disc list-inside text-muted-foreground ml-2 space-y-1">
                  <li>Debit: Accounts Payable</li>
                  <li>Credit: Cash/Bank Account</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
