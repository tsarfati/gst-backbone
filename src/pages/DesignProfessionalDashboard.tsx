import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, ClipboardList, FileCheck, Loader2, MessageSquare, CheckSquare, Clock } from "lucide-react";

const safeParseNotes = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, any>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export default function DesignProfessionalDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [jobCount, setJobCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [rfiCount, setRfiCount] = useState(0);
  const [submittalCount, setSubmittalCount] = useState(0);
  const [recentTasks, setRecentTasks] = useState<Array<{ id: string; title: string; due_date: string | null; status: string }>>([]);
  const [recentMessages, setRecentMessages] = useState<Array<{ id: string; subject: string | null; created_at: string }>>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user?.id || !currentCompany?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [
          pendingRequestRes,
          ownedJobsRes,
          sharedJobsRes,
          taskRowsRes,
          taskAssigneesRes,
          messagesRes,
          rfiRes,
          submittalRes,
        ] = await Promise.all([
          supabase
            .from("company_access_requests")
            .select("company_id, notes, status")
            .eq("user_id", user.id)
            .eq("status", "pending"),
          supabase.from("jobs").select("id").eq("company_id", currentCompany.id),
          supabase.from("user_job_access").select("job_id").eq("user_id", user.id),
          supabase
            .from("tasks")
            .select("id, title, due_date, status, created_by, leader_user_id, company_id, job_id")
            .order("created_at", { ascending: false }),
          supabase.from("task_assignees").select("task_id, user_id"),
          supabase.rpc("get_user_messages", {
            p_user_id: user.id,
            p_company_id: currentCompany.id,
          }),
          supabase
            .from("rfis")
            .select("id", { count: "exact", head: true })
            .or(`assigned_to.eq.${user.id},company_id.eq.${currentCompany.id}`),
          supabase
            .from("submittals")
            .select("id", { count: "exact", head: true })
            .or(`assigned_to.eq.${user.id},company_id.eq.${currentCompany.id}`),
        ]);

        if (pendingRequestRes.error) throw pendingRequestRes.error;
        if (ownedJobsRes.error) throw ownedJobsRes.error;
        if (sharedJobsRes.error) throw sharedJobsRes.error;
        if (taskRowsRes.error) throw taskRowsRes.error;
        if (taskAssigneesRes.error) throw taskAssigneesRes.error;
        if (messagesRes.error) throw messagesRes.error;
        if (rfiRes.error) throw rfiRes.error;
        if (submittalRes.error) throw submittalRes.error;

        const pendingInviteTotal = (pendingRequestRes.data || []).reduce((count: number, row: any) => {
          const parsed = safeParseNotes(row.notes);
          if (String(parsed?.requestedRole || "").toLowerCase() !== "design_professional") return count;
          if (Array.isArray(parsed?.pendingJobInvites)) return count + parsed.pendingJobInvites.length;
          return parsed?.invitedJobId ? count + 1 : count;
        }, 0);
        setPendingInviteCount(pendingInviteTotal);

        const combinedJobIds = new Set<string>([
          ...((ownedJobsRes.data || []) as any[]).map((row: any) => String(row.id)),
          ...((sharedJobsRes.data || []) as any[]).map((row: any) => String(row.job_id)),
        ]);
        setJobCount(combinedJobIds.size);

        const involvedTaskIds = new Set(
          ((taskAssigneesRes.data || []) as any[])
            .filter((row) => String(row.user_id || "") === user.id)
            .map((row) => String(row.task_id || "")),
        );

        const visibleTasks = ((taskRowsRes.data || []) as any[]).filter((task) =>
          task.created_by === user.id ||
          task.leader_user_id === user.id ||
          involvedTaskIds.has(String(task.id))
        );
        setTaskCount(visibleTasks.length);
        setRecentTasks(
          visibleTasks.slice(0, 5).map((task) => ({
            id: String(task.id),
            title: String(task.title || "Untitled Task"),
            due_date: task.due_date || null,
            status: String(task.status || "not_started"),
          }))
        );

        const allMessages = ((messagesRes.data || []) as any[])
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setMessageCount(allMessages.filter((row: any) => row.to_user_id === user.id && row.read !== true).length);
        setRecentMessages(
          allMessages.slice(0, 5).map((message: any) => ({
            id: String(message.id),
            subject: message.subject || null,
            created_at: String(message.created_at),
          }))
        );

        setRfiCount(rfiRes.count || 0);
        setSubmittalCount(submittalRes.count || 0);
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {profile?.display_name || profile?.first_name || "Design Professional"}! 👋
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Briefcase className="h-4 w-4 text-muted-foreground" /><div><div className="text-xs text-muted-foreground">Jobs</div><div className="text-2xl font-semibold">{loading ? '…' : jobCount}</div></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><CheckSquare className="h-4 w-4 text-muted-foreground" /><div><div className="text-xs text-muted-foreground">Tasks</div><div className="text-2xl font-semibold">{loading ? '…' : taskCount}</div></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><MessageSquare className="h-4 w-4 text-muted-foreground" /><div><div className="text-xs text-muted-foreground">Unread Messages</div><div className="text-2xl font-semibold">{loading ? '…' : messageCount}</div></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><ClipboardList className="h-4 w-4 text-muted-foreground" /><div><div className="text-xs text-muted-foreground">RFIs</div><div className="text-2xl font-semibold">{loading ? '…' : rfiCount}</div></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><FileCheck className="h-4 w-4 text-muted-foreground" /><div><div className="text-xs text-muted-foreground">Submittals</div><div className="text-2xl font-semibold">{loading ? '…' : submittalCount}</div></div></div></CardContent></Card>
      </div>

      {pendingInviteCount > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Pending Job Invitations</CardTitle>
            <Badge>New</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              You have {pendingInviteCount} pending job invitation{pendingInviteCount === 1 ? "" : "s"} waiting for acceptance.
            </p>
            <Button variant="outline" onClick={() => navigate("/design-professional/jobs")}>
              Review Invitations
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-8">
          {loading ? (
            <div className="flex items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading dashboard...
            </div>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">Open your jobs from the left navigation.</p>
                <p className="text-sm text-muted-foreground">
                  Shared project access and task visibility will appear throughout the workspace automatically.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/design-professional/jobs")}>
                Open Jobs
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Upcoming Tasks</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate("/design-professional/tasks")}>Open Tasks</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assigned tasks yet.</p>
            ) : (
              recentTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{task.status.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" />Recent Messages</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate("/design-professional/messages")}>Open Messages</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent messages.</p>
            ) : (
              recentMessages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => navigate(`/design-professional/messages?thread=${encodeURIComponent(message.id)}`)}
                  className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-muted/40"
                >
                  <p className="truncate text-sm font-medium">{message.subject || "(No Subject)"}</p>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(message.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
