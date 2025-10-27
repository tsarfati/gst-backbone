import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CreditCard, Upload, FileText, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreditCardPaymentModal } from "@/components/CreditCardPaymentModal";
import { useCreditCardBalance } from "@/hooks/useCreditCardBalance";

export default function CreditCardDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [creditCard, setCreditCard] = useState<any>(null);
  const [statements, setStatements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingStatement, setUploadingStatement] = useState(false);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [statementNotes, setStatementNotes] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
   const [statementsOpen, setStatementsOpen] = useState(false);

  const { balance: computedBalance, loading: balanceLoading, refresh: refreshBalance } = useCreditCardBalance(id, creditCard?.liability_account_id);

  useEffect(() => {
    if (id && currentCompany) {
      fetchCreditCardDetails();
      fetchStatements();
    }
  }, [id, currentCompany]);

  const fetchCreditCardDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("id", id)
        .eq("company_id", currentCompany?.id)
        .single();

      if (error) throw error;
      setCreditCard(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStatements = async () => {
    try {
      const { data, error } = await supabase
        .from("credit_card_statements")
        .select("*")
        .eq("credit_card_id", id)
        .order("statement_date", { ascending: false });

      if (error) throw error;
      setStatements(data || []);
    } catch (error: any) {
      console.error("Error fetching statements:", error);
    }
  };

  const handleStatementUpload = async () => {
    if (!statementFile || !currentCompany) return;

    setUploadingStatement(true);
    try {
      const fileExt = statementFile.name.split('.').pop();
      const fileName = `${currentCompany.id}/${Date.now()}_${statementFile.name}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("credit-card-statements")
        .upload(fileName, statementFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("credit-card-statements")
        .getPublicUrl(fileName);

      const statementDate = new Date();
      const { error: insertError } = await supabase
        .from("credit_card_statements")
        .insert({
          credit_card_id: id,
          company_id: currentCompany.id,
          statement_date: statementDate.toISOString().split('T')[0],
          statement_month: statementDate.getMonth() + 1,
          statement_year: statementDate.getFullYear(),
          file_url: publicUrl,
          file_name: statementFile.name,
          file_size: statementFile.size,
          display_name: statementFile.name,
          notes: statementNotes,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Statement uploaded successfully",
      });

      setStatementFile(null);
      setStatementNotes("");
      fetchStatements();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingStatement(false);
    }
  };

  const handleDeleteStatement = async (statementId: string, fileUrl: string) => {
    try {
      const filePath = fileUrl.split('/').slice(-2).join('/');
      
      await supabase.storage
        .from("credit-card-statements")
        .remove([filePath]);

      const { error } = await supabase
        .from("credit_card_statements")
        .delete()
        .eq("id", statementId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Statement deleted successfully",
      });

      fetchStatements();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!creditCard) {
    return <div className="flex items-center justify-center h-screen">Credit card not found</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/payables/credit-cards")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            {creditCard.card_name}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowPaymentModal(true)}>
            <DollarSign className="h-4 w-4 mr-2" />
            Make Payment
          </Button>
          <Button onClick={() => navigate(`/payables/credit-cards/${id}/transactions`)}>
            <FileText className="h-4 w-4 mr-2" />
            View Transactions
          </Button>
        </div>
      </div>

      {/* Card Details Section */}
      <Card>
        <CardHeader>
          <CardTitle>Card Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <Label className="text-muted-foreground">Credit Limit</Label>
                <p className="text-2xl font-bold mt-1">
                  ${Number(creditCard.credit_limit || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <Label className="text-muted-foreground">Current Balance</Label>
                <p className="text-2xl font-bold text-destructive mt-1">
                  ${Number(balanceLoading ? 0 : computedBalance || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  (Charges - Payments)
                </p>
              </div>
              <div className="text-center">
                <Label className="text-muted-foreground">Available Credit</Label>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  ${(Number(creditCard.credit_limit || 0) - Number(balanceLoading ? 0 : computedBalance || 0)).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <Label>Card Name</Label>
              <p className="text-lg font-semibold">{creditCard.card_name}</p>
            </div>
            <div>
              <Label>Cardholder</Label>
              <p>{creditCard.cardholder_name}</p>
            </div>
            <div>
              <Label>Card Number</Label>
              <p>**** **** **** {creditCard.card_number_last_four}</p>
            </div>
            <div>
              <Label>Issuer</Label>
              <p>{creditCard.issuer}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statements Section - Collapsible */}
      <Card>
        <Collapsible open={statementsOpen} onOpenChange={setStatementsOpen}>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <CardTitle className="flex items-center gap-2">
                  Statements
                  {statementsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </CardTitle>
                <Dialog>
                  <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Statement
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Statement</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Statement File</Label>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setStatementFile(e.target.files?.[0] || null)}
                        />
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <Textarea
                          value={statementNotes}
                          onChange={(e) => setStatementNotes(e.target.value)}
                          placeholder="Optional notes about this statement"
                        />
                      </div>
                      <Button
                        onClick={handleStatementUpload}
                        disabled={!statementFile || uploadingStatement}
                        className="w-full"
                      >
                        {uploadingStatement ? "Uploading..." : "Upload Statement"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {statements.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No statements uploaded yet</p>
              ) : (
                <div className="space-y-2">
                  {statements.map((statement) => (
                    <div
                      key={statement.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{statement.display_name || statement.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(statement.statement_date).toLocaleDateString()} - 
                          {statement.notes && ` ${statement.notes}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(statement.file_url, '_blank')}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteStatement(statement.id, statement.file_url)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <CreditCardPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        creditCardId={id!}
        onPaymentComplete={() => {
          fetchCreditCardDetails();
          refreshBalance();
        }}
      />
    </div>
  );
}
