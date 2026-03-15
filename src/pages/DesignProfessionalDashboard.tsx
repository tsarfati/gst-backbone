import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, ClipboardList, FileCheck, Loader2, MessageSquare } from "lucide-react";

type JobCountRow = { id: string };
type SharedJobCountRow = { job_id: string };
type MessageRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject: string | null;
  content: string | null;
  read: boolean | null;
  created_at: string;
};

export default function DesignProfessionalDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [jobCount, setJobCount] = useState(0);
  const [rfiCount, setRfiCount] = useState(0);
  const [submittalCount, setSubmittalCount] = useState(0);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user?.id || !currentCompany?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [ownedJobsRes, sharedJobsRes, rfiRes, submittalRes, messageRpcRes] = await Promise.all([
          supabase.from("jobs").select("id").eq("company_id", currentCompany.id),
          supabase.from("user_job_access").select("job_id").eq("user_id", user.id),
          supabase
            .from("rfis")
            .select("id", { count: "exact", head: true })
            .or(`assigned_to.eq.${user.id},company_id.eq.${currentCompany.id}`),
          supabase
            .from("submittals")
            .select("id", { count: "exact", head: true })
            .or(`assigned_to.eq.${user.id},company_id.eq.${currentCompany.id}`),
          supabase.rpc("get_user_messages", {
            p_user_id: user.id,
            p_company_id: currentCompany.id,
          }),
        ]);

        if (ownedJobsRes.error) throw ownedJobsRes.error;
        if (sharedJobsRes.error) throw sharedJobsRes.error;
        if (rfiRes.error) throw rfiRes.error;
        if (submittalRes.error) throw submittalRes.error;
        if (messageRpcRes.error) throw messageRpcRes.error;

        const ownedJobs = (ownedJobsRes.data || []) as JobCountRow[];
        const sharedJobs = (sharedJobsRes.data || []) as SharedJobCountRow[];
        const combinedJobIds = new Set<string>([
          ...ownedJobs.map((row) => row.id),
          ...sharedJobs.map((row) => row.job_id),
        ]);
        setJobCount(combinedJobIds.size);
        setRfiCount(rfiRes.count || 0);
        setSubmittalCount(submittalRes.count || 0);

        const allMessages = ((messageRpcRes.data || []) as MessageRow[])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setMessages(allMessages.slice(0, 6));
        setUnreadMessages(
          allMessages.filter((row) => row.to_user_id === user.id && row.read !== true).length,
        );
      } catch (error: any) {
        console.error("Failed to load design professional dashboard:", error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load dashboard.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [user?.id, currentCompany?.id]);

  const counters = useMemo(
    () => [
      { label: "Jobs", value: jobCount, icon: Briefcase, onClick: () => navigate("/design-professional/jobs") },
      { label: "RFIs", value: rfiCount, icon: ClipboardList, onClick: () => navigate("/design-professional/jobs/rfis") },
      { label: "Submittals", value: submittalCount, icon: FileCheck, onClick: () => navigate("/design-professional/jobs/submittals") },
    ],
    [jobCount, rfiCount, submittalCount, navigate],
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Design Professional Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {profile?.display_name || "Design Professional"}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {counters.map((counter) => (
          <button
            key={counter.label}
            type="button"
            onClick={counter.onClick}
            className="text-left"
          >
            <Card className="h-full hover:border-primary/50 hover:bg-primary/5 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <counter.icon className="h-4 w-4 text-muted-foreground" />
                  {counter.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : counter.value}
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Unread: {loading ? "..." : unreadMessages}</Badge>
            <Button size="sm" variant="outline" onClick={() => navigate("/messages")}>
              Open Messages
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <span className="loading-dots">Loading messages</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No messages yet</div>
          ) : (
            messages.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => navigate(`/messages?thread=${encodeURIComponent(message.id)}`)}
                className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{message.subject || "(No Subject)"}</p>
                    <p className="text-xs text-muted-foreground truncate">{message.content || ""}</p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(message.created_at).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
