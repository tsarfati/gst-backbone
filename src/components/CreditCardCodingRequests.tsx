import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertCircle } from "lucide-react";
import { CreditCardTransactionModal } from "./CreditCardTransactionModal";

interface CodingRequest {
  id: string;
  transaction_id: string;
  requested_by: string;
  status: string;
  message: string;
  created_at: string;
  credit_card_transactions: {
    description: string;
    merchant_name: string;
    amount: number;
    transaction_date: string;
    credit_card_id: string;
    credit_cards: {
      card_name: string;
    };
  };
  profiles: {
    first_name: string;
    last_name: string;
  };
}

export default function CreditCardCodingRequests() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [requests, setRequests] = useState<CodingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (user && currentCompany) {
      fetchCodingRequests();
    }
  }, [user, currentCompany]);

  const fetchCodingRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("credit_card_coding_requests")
        .select(`
          *,
          credit_card_transactions!inner(
            description,
            merchant_name,
            amount,
            transaction_date,
            credit_card_id,
            credit_cards!inner(
              card_name
            )
          )
        `)
        .eq("requested_coder_id", user?.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch requester profiles separately
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", request.requested_by)
            .single();

          return {
            ...request,
            profiles: profile || { first_name: "Unknown", last_name: "User" },
          };
        })
      );

      setRequests(requestsWithProfiles);
    } catch (error: any) {
      console.error("Error fetching coding requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("credit_card_coding_requests")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Coding request marked as complete",
      });

      fetchCodingRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenTransaction = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setShowModal(true);
  };

  if (loading) {
    return null;
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Credit Card Coding Requests
          <Badge variant="destructive" className="ml-2">
            {requests.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {request.credit_card_transactions.credit_cards.card_name}
                  </span>
                </div>
                <p className="text-sm font-semibold mb-1">
                  {request.credit_card_transactions.description}
                </p>
                {request.credit_card_transactions.merchant_name && (
                  <p className="text-sm text-muted-foreground">
                    {request.credit_card_transactions.merchant_name}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span>
                    ${Number(request.credit_card_transactions.amount).toLocaleString()}
                  </span>
                  <span>
                    {new Date(request.credit_card_transactions.transaction_date).toLocaleDateString()}
                  </span>
                  <span>
                    Requested by: {request.profiles.first_name} {request.profiles.last_name}
                  </span>
                </div>
                {request.message && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    "{request.message}"
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={() => handleOpenTransaction(request.transaction_id)}
                >
                  Code Transaction
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMarkComplete(request.id)}
                >
                  Mark Complete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {selectedTransactionId && (
        <CreditCardTransactionModal
          open={showModal}
          onOpenChange={setShowModal}
          transactionId={selectedTransactionId}
          onComplete={fetchCodingRequests}
        />
      )}
    </Card>
  );
}
