import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus, Search } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { canAccessAssignedJobOnly } from "@/utils/jobAccess";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import TaskCard, { type TaskCardData } from "@/components/TaskCard";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  is_due_asap: boolean | null;
  completion_percentage: number;
  job_id: string | null;
  jobs?: { name: string } | null;
};

export default function AllTasks() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "not_started" | "in_progress" | "completed" | "on_hold">("all");

  useEffect(() => {
    if (currentCompany && !websiteJobAccessLoading) {
      void loadTasks();
    }
  }, [currentCompany?.id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  const loadTasks = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const { data: taskRows, error: taskError } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, is_due_asap, completion_percentage, job_id, jobs(name)")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      if (taskError) throw taskError;

      const visibleTasks = ((taskRows || []) as TaskRow[]).filter((task) =>
        canAccessAssignedJobOnly([task.job_id], isPrivileged, allowedJobIds),
      );
      const taskIds = visibleTasks.map((task) => task.id);

      const { data: assigneeRows } = taskIds.length > 0
        ? await supabase
            .from("task_assignees")
            .select("task_id, user_id")
            .in("task_id", taskIds)
        : { data: [] as any[], error: null };

      const userIds = Array.from(
        new Set(((assigneeRows || []) as any[]).map((row) => String(row.user_id || "")).filter(Boolean)),
      );
      const { data: profileRows } = userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("user_id, display_name, first_name, last_name, avatar_url")
            .in("user_id", userIds)
        : { data: [] as any[] };

      const profileMap = new Map(
        (profileRows || []).map((profile: any) => [
          String(profile.user_id),
          {
            id: String(profile.user_id),
            name: String(profile.display_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown User"),
            avatar_url: profile.avatar_url || null,
          },
        ]),
      );

      const assigneeMap = new Map<string, TaskCardData["assignees"]>();
      ((assigneeRows || []) as any[]).forEach((row) => {
        const list = assigneeMap.get(String(row.task_id)) || [];
        const profile = profileMap.get(String(row.user_id));
        if (profile) list.push(profile);
        assigneeMap.set(String(row.task_id), list);
      });

      setTasks(
        visibleTasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          completion_percentage: Number(task.completion_percentage || 0),
          due_date: task.due_date,
          is_due_asap: Boolean(task.is_due_asap),
          project_name: task.jobs?.name || null,
          assignees: assigneeMap.get(task.id) || [],
        })),
      );
    } catch (error) {
      console.error("Error loading tasks:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const haystack = `${task.title} ${task.description || ""} ${task.project_name || ""}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "all" || task.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CheckSquare className="h-7 w-7" />
            All Tasks
          </h1>
        </div>
        <AddTaskDialog onTaskCreated={loadTasks}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </AddTaskDialog>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "all", label: "All Tasks" },
                { value: "not_started", label: `To Do (${tasks.filter((t) => t.status === "not_started").length})` },
                { value: "in_progress", label: `In Progress (${tasks.filter((t) => t.status === "in_progress").length})` },
                { value: "completed", label: `Completed (${tasks.filter((t) => t.status === "completed").length})` },
                { value: "on_hold", label: `On Hold (${tasks.filter((t) => t.status === "on_hold").length})` },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={filter === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(option.value as typeof filter)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {filter === "all" ? "All Tasks" : filter.replace("_", " ")}
            <Badge variant="outline" className="ml-2">
              {filteredTasks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading || websiteJobAccessLoading ? (
            <div className="py-8 text-center"><span className="loading-dots">Loading tasks</span></div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-8 text-center">
              <CheckSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No tasks found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Try adjusting your search criteria" : "No tasks to display"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => navigate(`/tasks/${task.id}`)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
