import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, BellRing, Mail, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { useVendorPortalData } from "@/hooks/useVendorPortalData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface BillConversationSummary {
  billId: string;
  invoiceNumber: string | null;
  jobName: string | null;
  status: string | null;
  latestMessageId: string;
  latestMessageAt: string;
  latestMessageContent: string;
  unreadCount: number;
}

export default function VendorPortalMessages() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { loading, messages } = useVendorPortalData();
  const focusMessageId = (location.state as { focusMessageId?: string } | null)?.focusMessageId || null;
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [billConversations, setBillConversations] = useState<BillConversationSummary[]>([]);

  const unreadCount = useMemo(
    () => messages.filter((message) => !message.read).length,
    [messages],
  );
  const unreadMessages = useMemo(
    () => messages.filter((message) => !message.read),
    [messages],
  );
  const recentMessages = useMemo(
    () => messages.filter((message) => message.read).slice(0, 8),
    [messages],
  );

  useEffect(() => {
    const loadBillConversations = async () => {
      if (!user?.id) {
        setBillConversations([]);
        return;
      }

      try {
        const { data: rows, error } = await supabase
          .from("messages")
          .select("id, thread_id, subject, content, read, created_at, from_user_id, to_user_id")
          .eq("attachment_type", "bill_vendor_thread")
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const latestByBill = new Map<string, BillConversationSummary>();
        const billIds = new Set<string>();

        ((rows || []) as any[]).forEach((row) => {
          const billId = String(row.thread_id || "").trim();
          if (!billId) return;
          billIds.add(billId);
          const existing = latestByBill.get(billId);
          const isUnreadForUser = row.to_user_id === user.id && row.read !== true;

          if (!existing) {
            latestByBill.set(billId, {
              billId,
              invoiceNumber: null,
              jobName: null,
              status: null,
              latestMessageId: String(row.id),
              latestMessageAt: String(row.created_at),
              latestMessageContent: String(row.content || ""),
              unreadCount: isUnreadForUser ? 1 : 0,
            });
            return;
          }

          existing.unreadCount += isUnreadForUser ? 1 : 0;
        });

        if (billIds.size > 0) {
          const { data: invoices, error: invoiceError } = await supabase
            .from("invoices")
            .select("id, invoice_number, status, jobs:job_id(name)")
            .in("id", Array.from(billIds));

          if (invoiceError) throw invoiceError;

          (invoices || []).forEach((invoice: any) => {
            const entry = latestByBill.get(String(invoice.id));
            if (!entry) return;
            entry.invoiceNumber = invoice.invoice_number || null;
            entry.status = invoice.status || null;
            entry.jobName = invoice.jobs?.name || null;
          });
        }

        setBillConversations(
          Array.from(latestByBill.values()).sort(
            (a, b) => new Date(b.latestMessageAt).getTime() - new Date(a.latestMessageAt).getTime(),
          ),
        );
      } catch (error) {
        console.error("VendorPortalMessages: failed loading bill conversations", error);
        setBillConversations([]);
      }
    };

    void loadBillConversations();
  }, [user?.id]);

  useEffect(() => {
    if (!focusMessageId) return;
    messageRefs.current[focusMessageId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [focusMessageId, messages]);

  if (loading) {
    return <PremiumLoadingScreen text="Loading messages..." />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" className="px-0" onClick={() => navigate("/vendor/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <Badge variant={unreadCount > 0 ? "default" : "secondary"}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Builder communications tied to your vendor portal will show here. New activity should also surface on your dashboard.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/15 bg-gradient-to-br from-background via-background to-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unread</p>
              <p className="mt-1 text-2xl font-bold">{unreadCount}</p>
            </div>
            <BellRing className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Messages</p>
              <p className="mt-1 text-2xl font-bold">{messages.length}</p>
            </div>
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
              <p className="mt-1 text-sm font-semibold">{unreadCount > 0 ? "Needs review" : "Caught up"}</p>
            </div>
            <Badge variant={unreadCount > 0 ? "default" : "secondary"}>
              {unreadCount > 0 ? "Action" : "Clear"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <MessageSquare className="mb-4 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No messages yet</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              When a builder sends you a direct portal message, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Bill Conversations</h2>
                <Badge variant={billConversations.some((conversation) => conversation.unreadCount > 0) ? "default" : "secondary"}>
                  {billConversations.length}
                </Badge>
              </div>
              {billConversations.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-sm text-muted-foreground">
                    No bill conversations yet.
                  </CardContent>
                </Card>
              ) : (
                billConversations.map((conversation) => (
                  <Card
                    key={conversation.billId}
                    className={conversation.unreadCount > 0 ? "border-primary/30 bg-primary/5" : ""}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="text-base">
                            {conversation.invoiceNumber || `Invoice ${conversation.billId.slice(0, 8)}`}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {conversation.jobName || "No job assigned"}
                            {conversation.status ? ` • ${conversation.status.replace(/_/g, " ")}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {conversation.unreadCount > 0 ? <Badge>{conversation.unreadCount} unread</Badge> : <Badge variant="secondary">Read</Badge>}
                          <Button size="sm" variant="outline" onClick={() => navigate(`/vendor/bills/${conversation.billId}`)}>
                            Open Bill
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-2 whitespace-pre-wrap text-sm text-foreground">
                        {conversation.latestMessageContent || "Open this bill to view the conversation."}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(conversation.latestMessageAt).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Unread Messages</h2>
                <Badge variant={unreadMessages.length > 0 ? "default" : "secondary"}>
                  {unreadMessages.length > 0 ? unreadMessages.length : "None"}
                </Badge>
              </div>
              {unreadMessages.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-sm text-muted-foreground">
                    No unread messages right now.
                  </CardContent>
                </Card>
              ) : unreadMessages.map((message) => (
                <Card
                  key={message.id}
                  ref={(element) => {
                    messageRefs.current[message.id] = element;
                  }}
                  className={focusMessageId === message.id ? "border-primary bg-primary/10 shadow-sm" : "border-primary/30 bg-primary/5"}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{message.subject || "Message"}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge>Unread</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{message.content || "No message content provided."}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              {recentMessages.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-sm text-muted-foreground">
                    No older messages yet.
                  </CardContent>
                </Card>
              ) : recentMessages.map((message) => (
                <Card
                  key={message.id}
                  ref={(element) => {
                    messageRefs.current[message.id] = element;
                  }}
                  className={focusMessageId === message.id ? "border-primary bg-primary/10 shadow-sm" : ""}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{message.subject || "Message"}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="secondary">Read</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{message.content || "No message content provided."}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="h-fit xl:sticky xl:top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Message Guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Bill-specific conversations now stay tied to the invoice. RFP-specific conversation still stays inside each RFP so the builder discussion remains tied to the bid.
              </p>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/vendor/rfps")}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Open RFPs
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/vendor/dashboard")}>
                  <Mail className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
