import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle, XCircle, Clock, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface EmailHistory {
  id: string;
  recipient_email: string;
  subject: string;
  email_type: string;
  status: string;
  sent_at: string;
  error_message?: string | null;
}

export default function EmailHistoryPanel() {
  const { currentCompany } = useCompany();
  const [emailHistory, setEmailHistory] = useState<EmailHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEmailHistory = async () => {
      if (!currentCompany?.id) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("email_history")
          .select("*")
          .eq("company_id", currentCompany.id)
          .order("sent_at", { ascending: false })
          .limit(100);

        if (error) throw error;
        setEmailHistory((data as EmailHistory[]) || []);
      } catch (error) {
        console.error("Error loading email history:", error);
        setEmailHistory([]);
      } finally {
        setLoading(false);
      }
    };

    void loadEmailHistory();
  }, [currentCompany?.id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEmailTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      overdue_bills: "Overdue Bills",
      test: "Test Email",
      notification: "Notification",
      bill_payment: "Bill Payment",
      receipt_uploaded: "Receipt Upload",
      financial_overview: "Financial Overview",
      bill_approval_request: "Bill Approval Request",
      bill_coding_request: "Bill Coding Request",
      credit_card_coding_request: "Credit Card Coding Request",
    };
    return types[type] || type;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Email History
        </CardTitle>
        <p className="text-sm text-muted-foreground">View recently sent system emails for this company.</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading email history...</div>
        ) : emailHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No emails sent yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {emailHistory.map((email) => (
              <div
                key={email.id}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{email.subject}</h4>
                    {getStatusBadge(email.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="truncate">To: {email.recipient_email}</span>
                    <Badge variant="outline" className="text-xs">
                      {getEmailTypeLabel(email.email_type)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(email.sent_at).toLocaleString()}
                  </p>
                  {email.error_message && (
                    <p className="text-xs text-destructive mt-1">Error: {email.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
