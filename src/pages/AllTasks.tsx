import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckSquare, ChevronDown, Plus, Search, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import TaskCard, { type TaskCardData } from "@/components/TaskCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";

type TaskListView = "list" | "compact" | "super-compact";
type TaskSortColumn = "title" | "project" | "priority" | "due" | "completion" | "status";
type TaskSortDirection = "asc" | "desc";

const TASK_VIEW_STORAGE_KEY = "all-tasks-default-view";
const TASK_DEFAULT_VIEW: TaskListView = "compact";

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
  created_by: string | null;
  leader_user_id: string | null;
  jobs?: { name: string } | null;
};

const TASK_VIEW_OPTIONS: Array<{ value: TaskListView; label: string }> = [
  { value: "list", label: "List" },
  { value: "compact", label: "Compact List" },
  { value: "super-compact", label: "Super Compact List" },
];

const getPriorityRank = (priority: string) => {
  switch (priority) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
};

const getStatusRank = (status: string) => {
  switch (status) {
    case "completed":
      return 4;
    case "in_progress":
      return 3;
    case "on_hold":
      return 2;
    case "not_started":
      return 1;
    default:
      return 0;
  }
};

const getPriorityBadgeVariant = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "destructive" as const;
    case "high":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 border-green-200";
    case "in_progress":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "on_hold":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export default function AllTasks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<TaskListView>(() => {
    if (typeof window === "undefined") return TASK_DEFAULT_VIEW;
    const storedView = window.localStorage.getItem(TASK_VIEW_STORAGE_KEY);
    return storedView === "compact" || storedView === "super-compact" || storedView === "list" ? storedView : TASK_DEFAULT_VIEW;
  });
  const [defaultView, setDefaultView] = useState<TaskListView>(() => {
    if (typeof window === "undefined") return TASK_DEFAULT_VIEW;
    const storedView = window.localStorage.getItem(TASK_VIEW_STORAGE_KEY);
    return storedView === "compact" || storedView === "super-compact" || storedView === "list" ? storedView : TASK_DEFAULT_VIEW;
  });
  const [sortColumn, setSortColumn] = useState<TaskSortColumn>("due");
  const [sortDirection, setSortDirection] = useState<TaskSortDirection>("asc");

  useEffect(() => {
    if (currentCompany) {
      void loadTasks();
      void loadProjects();
    }
  }, [currentCompany?.id, user?.id]);

  const loadTasks = async () => {
    if (!currentCompany || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: sharedJobAccessRows, error: sharedJobAccessError } = await supabase
        .from("user_job_access")
        .select("job_id")
        .eq("user_id", user.id);
      if (sharedJobAccessError) throw sharedJobAccessError;

      const sharedJobIds = Array.from(new Set((sharedJobAccessRows || []).map((row: any) => String(row.job_id || "")).filter(Boolean)));

      const baseTaskQuery = supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, is_due_asap, completion_percentage, job_id, created_by, leader_user_id, company_id, jobs(name)")
        .order("created_at", { ascending: false });

      const taskQuery = sharedJobIds.length > 0
        ? baseTaskQuery.or(`company_id.eq.${currentCompany.id},job_id.in.(${sharedJobIds.join(",")})`)
        : baseTaskQuery.eq("company_id", currentCompany.id);

      const { data: taskRows, error: taskError } = await taskQuery;
      if (taskError) throw taskError;

      const companyVisibleTasks = (taskRows || []) as TaskRow[];
      const companyVisibleTaskIds = companyVisibleTasks.map((task) => task.id);

      const { data: assigneeRows } = companyVisibleTaskIds.length > 0
        ? await supabase
            .from("task_assignees")
            .select("task_id, user_id")
            .in("task_id", companyVisibleTaskIds)
        : { data: [] as any[], error: null };

      const involvedTaskIds = new Set(
        ((assigneeRows || []) as any[])
          .filter((row) => String(row.user_id || "") === user.id)
          .map((row) => String(row.task_id || "")),
      );

      const visibleTasks = companyVisibleTasks.filter((task) =>
        task.created_by === user.id ||
        task.leader_user_id === user.id ||
        involvedTaskIds.has(task.id),
      );

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
    const { data: sharedJobAccessRows } = await supabase
      .from("user_job_access")
      .select("job_id")
      .eq("user_id", user?.id || "");

    const sharedJobIds = Array.from(new Set((sharedJobAccessRows || []).map((row: any) => String(row.job_id || "")).filter(Boolean)));

    const baseJobsQuery = supabase
      .from("jobs")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    const jobsQuery = sharedJobIds.length > 0
      ? baseJobsQuery.or(`company_id.eq.${currentCompany.id},id.in.(${sharedJobIds.join(",")})`)
      : baseJobsQuery.eq("company_id", currentCompany.id);

    const { data } = await jobsQuery;
    setProjects(data || []);
  };

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const haystack = `${task.title} ${task.description || ""} ${task.project_name || ""}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesProject =
      selectedProject === "all" ||
      projects.find((project) => project.id === selectedProject)?.name === task.project_name;
    return matchesSearch && matchesProject;
  }), [tasks, searchTerm, selectedProject, projects]);

  const sortedTasks = useMemo(() => {
    const nextTasks = [...filteredTasks];
    nextTasks.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "project":
          comparison = (a.project_name || "").localeCompare(b.project_name || "");
          break;
        case "priority":
          comparison = getPriorityRank(a.priority) - getPriorityRank(b.priority);
          break;
        case "status":
          comparison = getStatusRank(a.status) - getStatusRank(b.status);
          break;
        case "completion":
          comparison = a.completion_percentage - b.completion_percentage;
          break;
        case "due": {
          const aValue = a.is_due_asap ? Number.NEGATIVE_INFINITY : a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
          const bValue = b.is_due_asap ? Number.NEGATIVE_INFINITY : b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
          comparison = aValue - bValue;
          break;
        }
      }

      return sortDirection === "asc" ? comparison : comparison * -1;
    });
    return nextTasks;
  }, [filteredTasks, sortColumn, sortDirection]);

  const handleSelectView = (nextView: TaskListView) => {
    setViewMode(nextView);
  };

  const handleSetDefaultViewForOption = (nextView: TaskListView) => {
    window.localStorage.setItem(TASK_VIEW_STORAGE_KEY, nextView);
    setDefaultView(nextView);
  };

  const handleSort = (column: TaskSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  };

  const renderSortIcon = (column: TaskSortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const renderTaskTable = (superCompact: boolean) => (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>
              <button type="button" className="inline-flex items-center gap-1 font-medium hover:bg-transparent" onClick={() => handleSort("title")}>
                Task
                <Badge variant="outline" className="ml-1">
                  {filteredTasks.length}
                </Badge>
                {renderSortIcon("title")}
              </button>
            </TableHead>
            <TableHead>
              <button type="button" className="inline-flex items-center gap-1 font-medium hover:bg-transparent" onClick={() => handleSort("project")}>
                Project
                {renderSortIcon("project")}
              </button>
            </TableHead>
            <TableHead>
              <button type="button" className="inline-flex items-center gap-1 font-medium hover:bg-transparent" onClick={() => handleSort("priority")}>
                Priority
                {renderSortIcon("priority")}
              </button>
            </TableHead>
            {!superCompact && (
              <TableHead>
                <button type="button" className="inline-flex items-center gap-1 font-medium hover:bg-transparent" onClick={() => handleSort("status")}>
                  Status
                  {renderSortIcon("status")}
                </button>
              </TableHead>
            )}
            <TableHead>
              <button type="button" className="inline-flex items-center gap-1 font-medium hover:bg-transparent" onClick={() => handleSort("due")}>
                Due
                {renderSortIcon("due")}
              </button>
            </TableHead>
            <TableHead>
              <button type="button" className="inline-flex items-center gap-1 font-medium hover:bg-transparent" onClick={() => handleSort("completion")}>
                Progress
                {renderSortIcon("completion")}
              </button>
            </TableHead>
            {!superCompact && <TableHead>Task Team</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTasks.map((task) => (
            <TableRow
              key={task.id}
              className="group cursor-pointer"
              onClick={() => navigate(`/tasks/${task.id}`)}
            >
              <TableCell className="max-w-[320px] border-y border-transparent transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
                <div className="min-w-0">
                  <div className="truncate font-medium">{task.title}</div>
                  {!superCompact && task.description ? (
                    <div className="truncate text-xs text-muted-foreground">{task.description}</div>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap border-y border-transparent text-sm text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
                {task.project_name || "No project"}
              </TableCell>
              <TableCell className="border-y border-transparent transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
                <Badge variant={getPriorityBadgeVariant(task.priority)} className="text-[11px] uppercase">
                  {task.priority.replace("_", " ")}
                </Badge>
              </TableCell>
              {!superCompact && (
                <TableCell className="border-y border-transparent transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
                  <span className={`rounded-md border px-2 py-1 text-[11px] font-medium uppercase ${getStatusBadgeClass(task.status)}`}>
                    {task.status.replace("_", " ")}
                  </span>
                </TableCell>
              )}
              <TableCell className="whitespace-nowrap border-y border-transparent text-sm transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
                {task.is_due_asap ? "ASAP" : task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "No due date"}
              </TableCell>
              <TableCell className="whitespace-nowrap border-y border-transparent text-sm font-medium transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
                {task.completion_percentage}%
              </TableCell>
              {!superCompact && (
                <TableCell className="border-y border-transparent transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
                  {task.assignees.length > 0 ? (
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="flex -space-x-2">
                        {task.assignees.slice(0, 4).map((person) => (
                          <Avatar key={person.id} className="h-7 w-7 border-2 border-background">
                            <AvatarImage src={person.avatar_url || undefined} alt={person.name} />
                            <AvatarFallback>{person.name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <span className="truncate text-sm text-muted-foreground">
                        {task.assignees.map((person) => person.name).join(", ")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No one assigned</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-full xl:w-[240px]">
            <SelectValue placeholder="Filter by project" />
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-between xl:w-[220px]">
              {TASK_VIEW_OPTIONS.find((option) => option.value === viewMode)?.label || "View by"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px]">
            <DropdownMenuLabel>View by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TASK_VIEW_OPTIONS.map((option) => {
              const isDefault = defaultView === option.value;
              const isSelected = viewMode === option.value;
              return (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={() => handleSelectView(option.value)}
                  className="flex items-center justify-between gap-3"
                >
                  <span className={isSelected ? "font-medium" : ""}>{option.label}</span>
                  <button
                    type="button"
                    className="inline-flex items-center"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleSetDefaultViewForOption(option.value);
                    }}
                    title={isDefault ? "Default view" : "Set as default view"}
                  >
                    <Star className={`h-4 w-4 ${isDefault ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <AddTaskDialog
          onTaskCreated={async () => {
            setSearchTerm("");
            setSelectedProject("all");
            await loadTasks();
          }}
        >
          <Button className="xl:ml-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </AddTaskDialog>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center"><span className="loading-dots">Loading tasks</span></CardContent>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No tasks found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search criteria" : "No tasks to display"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <div className="space-y-4">
          {sortedTasks.map((task) => (
            <TaskCard key={task.id} task={task} view={viewMode} onClick={() => navigate(`/tasks/${task.id}`)} />
          ))}
        </div>
      ) : viewMode === "compact" ? (
        renderTaskTable(false)
      ) : (
        renderTaskTable(true)
      )}
    </div>
  );
}
