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
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const [requests, setRequests] = useState<CodingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const displayLimit = 5;

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
              card_name,
              company_id
            )
          )
        `)
        .eq("requested_coder_id", user?.id)
        .eq("status", "pending")
        .eq("credit_card_transactions.credit_cards.company_id", currentCompany?.id)
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

  const visibleRequests = requests.slice(0, displayLimit);

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
        <div className="space-y-2">
          {visibleRequests.map((request) => (
            <div
              key={request.id}
              className="px-3 py-2 rounded-md border bg-card hover:bg-primary/5 hover:border-primary hover:shadow-md cursor-pointer transition-all duration-200 group"
              onClick={() => handleOpenTransaction(request.transaction_id)}
            >
              <div className="flex items-center gap-3 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium min-w-[120px] truncate group-hover:text-primary transition-colors">
                  {request.credit_card_transactions.credit_cards.card_name}
                </span>
                <span className="truncate flex-1 text-muted-foreground">
                  {request.credit_card_transactions.description}
                  {request.credit_card_transactions.merchant_name
                    ? ` • ${request.credit_card_transactions.merchant_name}`
                    : ""}
                </span>
                <span className="font-medium whitespace-nowrap">
                  ${Number(request.credit_card_transactions.amount).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(request.credit_card_transactions.transaction_date).toLocaleDateString()}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap truncate max-w-[180px]">
                  {request.profiles.first_name} {request.profiles.last_name}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
                  {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                </span>
              </div>
              {request.message && (
                <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">
                  "{request.message}"
                </p>
              )}
            </div>
          ))}
          {requests.length >= displayLimit && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/payables/credit-cards')}
            >
              View All Credit Card Requests Needing Action
            </Button>
          )}
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
