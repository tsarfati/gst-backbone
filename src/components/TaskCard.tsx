import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronRight, FolderKanban } from "lucide-react";
import { format } from "date-fns";

export interface TaskCardPerson {
  id: string;
  name: string;
  avatar_url?: string | null;
}

export interface TaskCardData {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  completion_percentage: number;
  due_date?: string | null;
  is_due_asap?: boolean;
  project_name?: string | null;
  assignees: TaskCardPerson[];
}

interface TaskCardProps {
  task: TaskCardData;
  onClick: () => void;
  view?: "list" | "compact" | "super-compact";
}

const getPriorityVariant = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "destructive" as const;
    case "high":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

const getStatusClass = (status: string) => {
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

const getProgressBarClass = (percentage: number) => {
  if (percentage >= 80) return "bg-green-500";
  if (percentage >= 50) return "bg-blue-500";
  if (percentage >= 25) return "bg-yellow-500";
  return "bg-slate-300";
};

export default function TaskCard({ task, onClick, view = "list" }: TaskCardProps) {
  const isCompact = view === "compact";
  const isSuperCompact = view === "super-compact";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border bg-card text-left transition-colors hover:border-primary hover:bg-primary/5 ${
        isSuperCompact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`min-w-0 flex-1 ${isSuperCompact ? "space-y-2" : isCompact ? "space-y-2.5" : "space-y-3"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{task.title}</h3>
            <Badge variant={getPriorityVariant(task.priority)} className="text-[11px] uppercase">
              {task.priority.replace("_", " ")}
            </Badge>
            <span className={`rounded-md border px-2 py-1 text-[11px] font-medium uppercase ${getStatusClass(task.status)}`}>
              {task.status.replace("_", " ")}
            </span>
            <Badge variant="outline" className="text-[11px]">
              {task.completion_percentage}% complete
            </Badge>
          </div>

          {!isSuperCompact && task.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
          ) : null}

          <div className={`grid text-sm text-muted-foreground md:grid-cols-2 ${isSuperCompact ? "gap-2" : "gap-3"}`}>
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              <span>{task.project_name || "No project"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{task.is_due_asap ? "ASAP" : task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "No due date"}</span>
            </div>
          </div>

          <div className={isSuperCompact ? "space-y-2" : "space-y-3"}>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Progress</span>
                <span>{task.completion_percentage}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className={`h-2 rounded-full ${getProgressBarClass(task.completion_percentage)}`}
                  style={{ width: `${task.completion_percentage}%` }}
                />
              </div>
            </div>

            {task.assignees.length > 0 ? (
              <div className={`flex flex-wrap ${isSuperCompact ? "gap-1.5" : "gap-2"}`}>
                {task.assignees.map((person) => (
                  <div key={person.id} className={`flex items-center rounded-full border ${isSuperCompact ? "gap-1.5 px-2 py-1" : "gap-2 px-2 py-1"}`}>
                    <Avatar className={isSuperCompact ? "h-5 w-5" : "h-6 w-6"}>
                      <AvatarImage src={person.avatar_url || undefined} alt={person.name} />
                      <AvatarFallback>{person.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className={`${isSuperCompact ? "text-[11px]" : "text-xs"} font-medium text-foreground`}>{person.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No one assigned yet</p>
            )}
          </div>
        </div>

        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
    </button>
  );
}
