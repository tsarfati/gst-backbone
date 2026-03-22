import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Search, Calendar, Users, BarChart3 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { canAccessAssignedJobOnly } from "@/utils/jobAccess";
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

export default function ProjectTasks() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (currentCompany && !websiteJobAccessLoading) {
      void loadTasks();
      void loadProjects();
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

  const loadProjects = async () => {
    if (!currentCompany) return;
    const { data } = await supabase
      .from("jobs")
      .select("id, name")
      .eq("company_id", currentCompany.id)
      .eq("is_active", true);
    const visibleProjects = isPrivileged
      ? (data || [])
      : (data || []).filter((project: any) => allowedJobIds.includes(project.id));
    setProjects(visibleProjects);
  };

  const filteredTasks = tasks.filter((task) => {
    const haystack = `${task.title} ${task.description || ""} ${task.project_name || ""}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesProject = selectedProject === "all" || projects.find((project) => project.id === selectedProject)?.name === task.project_name;
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesProject && matchesStatus;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Target className="h-7 w-7" />
            Project Tasks
          </h1>
        </div>
        <AddTaskDialog onTaskCreated={loadTasks} />
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search project tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-full lg:w-[250px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{filteredTasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{filteredTasks.filter((task) => task.status === "completed").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{filteredTasks.filter((task) => task.status === "in_progress").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold">{projects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Project Tasks
            <Badge variant="outline" className="ml-2">
              {filteredTasks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading || websiteJobAccessLoading ? (
            <div className="py-8 text-center"><span className="loading-dots">Loading project tasks</span></div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-8 text-center">
              <Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No project tasks found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Try adjusting your search criteria" : "No project tasks to display"}
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
