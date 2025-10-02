import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  account_type: string;
  current_balance: number;
  is_active: boolean;
  routing_number?: string;
  description?: string;
  created_at: string;
}

export default function BankAccountDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBankAccount();
  }, [id, currentCompany]);

  const loadBankAccount = async () => {
    if (!currentCompany || !id) return;
    
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', id)
        .eq('company_id', currentCompany.id)
        .single();

      if (error) throw error;
      setAccount(data);
    } catch (error) {
      console.error('Error loading bank account:', error);
      toast({
        title: "Error",
        description: "Failed to load bank account details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading bank account...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Bank account not found</p>
          <Button onClick={() => navigate('/banking/accounts')} className="mt-4">
            Back to Bank Accounts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/banking/accounts')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bank Accounts
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{account.account_name}</h1>
            <p className="text-muted-foreground">{account.bank_name}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate(`/banking/reconcile?account=${account.id}`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Reconcile
            </Button>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Account Name</p>
                <p className="font-medium">{account.account_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bank Name</p>
                <p className="font-medium">{account.bank_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Number</p>
                <p className="font-medium">
                  {account.account_number ? `****${account.account_number.slice(-4)}` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Routing Number</p>
                <p className="font-medium">{account.routing_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Type</p>
                <Badge variant="outline" className="capitalize">
                  {account.account_type.replace('-', ' ')}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={account.is_active ? "default" : "secondary"}>
                  {account.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            {account.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{account.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(account.current_balance)}</div>
            <p className="text-sm text-muted-foreground mt-1">
              As of {new Date().toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
