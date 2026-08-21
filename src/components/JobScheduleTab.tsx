import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Diamond,
  Link2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import UserAvatar from "@/components/UserAvatar";
import { useUserAvatars } from "@/hooks/useUserAvatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type ScheduleStatus = "not_started" | "ready" | "in_progress" | "blocked" | "completed" | "delayed";
type DependencyType = "fs" | "ss" | "ff" | "sf";
type ScheduleItemType = "activity" | "milestone";

interface JobScheduleItem {
  id: string;
  company_id: string;
  job_id: string;
  parent_item_id: string | null;
  linked_purchase_order_id: string | null;
  cost_code_id: string | null;
  item_type: ScheduleItemType;
  title: string;
  trade: string | null;
  status: ScheduleStatus;
  start_date: string | null;
  end_date: string | null;
  duration_days: number;
  percent_complete: number;
  sort_order: number;
  requires_purchase_order: boolean;
  notes: string | null;
  created_by: string | null;
}

interface JobScheduleDependency {
  id: string;
  company_id: string;
  job_id: string;
  predecessor_item_id: string;
  successor_item_id: string;
  dependency_type: DependencyType;
  lag_days: number;
}

interface PurchaseOrderOption {
  id: string;
  po_number: string;
  description: string | null;
  status: string;
}

interface CostCodeOption {
  id: string;
  code: string;
  description: string | null;
}

interface TeamMemberOption {
  user_id: string;
  name: string;
  role_name: string | null;
  source: "project_team" | "punch_clock";
}

interface DependencyDraft {
  dependency_type: DependencyType;
  lag_days: number;
}

interface DerivedScheduleItem extends JobScheduleItem {
  blockedByDependencies: boolean;
  blockedByPo: boolean;
  predecessorItems: JobScheduleItem[];
  isCritical: boolean;
  floatDays: number;
  assignedUsers: TeamMemberOption[];
}

interface PersistedScheduleItemPayload {
  id: string;
  company_id: string;
  job_id: string;
  parent_item_id: string | null;
  linked_purchase_order_id: string | null;
  cost_code_id: string | null;
  item_type: ScheduleItemType;
  title: string;
  trade: string | null;
  status: ScheduleStatus;
  start_date: string | null;
  end_date: string | null;
  duration_days: number;
  percent_complete: number;
  sort_order: number;
  requires_purchase_order: boolean;
  notes: string | null;
  created_by: string | null;
  updated_at?: string;
}

interface JobScheduleTabProps {
  jobId: string;
  companyId: string | null;
  canEdit: boolean;
  jobStartDate?: string | null;
  jobEndDate?: string | null;
}

const STATUS_OPTIONS: Array<{ value: ScheduleStatus; label: string }> = [
  { value: "not_started", label: "Not Started" },
  { value: "ready", label: "Ready" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
  { value: "delayed", label: "Delayed" },
];

const DEPENDENCY_OPTIONS: Array<{ value: DependencyType; label: string }> = [
  { value: "fs", label: "Finish to Start" },
  { value: "ss", label: "Start to Start" },
  { value: "ff", label: "Finish to Finish" },
  { value: "sf", label: "Start to Finish" },
];

const ITEM_TYPE_OPTIONS: Array<{ value: ScheduleItemType; label: string }> = [
  { value: "activity", label: "Activity" },
  { value: "milestone", label: "Milestone" },
];

const statusToneClass: Record<ScheduleStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  ready: "bg-sky-100 text-sky-800",
  in_progress: "bg-amber-100 text-amber-800",
  blocked: "bg-rose-100 text-rose-800",
  completed: "bg-emerald-100 text-emerald-800",
  delayed: "bg-orange-100 text-orange-800",
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  try {
    return startOfDay(parseISO(value));
  } catch {
    return null;
  }
}

function toIsoDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function formatDateLabel(value: string | null | undefined) {
  const parsed = parseDate(value);
  return parsed ? format(parsed, "MMM d") : "No date";
}

function getItemSpanDays(item: Pick<JobScheduleItem, "item_type" | "duration_days">) {
  return item.item_type === "milestone" ? 0 : Math.max(Number(item.duration_days || 1) - 1, 0);
}

function getComputedEndDate(startDate: Date, item: Pick<JobScheduleItem, "item_type" | "duration_days">) {
  return addDays(startDate, getItemSpanDays(item));
}

function buildGraph(dependencies: JobScheduleDependency[]) {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const dependency of dependencies) {
    const out = outgoing.get(dependency.predecessor_item_id) || [];
    out.push(dependency.successor_item_id);
    outgoing.set(dependency.predecessor_item_id, out);

    const inc = incoming.get(dependency.successor_item_id) || [];
    inc.push(dependency.predecessor_item_id);
    incoming.set(dependency.successor_item_id, inc);
  }
  return { outgoing, incoming };
}

function buildTopologicalOrder(items: JobScheduleItem[], dependencies: JobScheduleDependency[]) {
  const ids = new Set(items.map((item) => item.id));
  const outgoing = new Map<string, JobScheduleDependency[]>();
  const incomingCount = new Map<string, number>();

  for (const item of items) {
    outgoing.set(item.id, []);
    incomingCount.set(item.id, 0);
  }

  for (const dependency of dependencies) {
    if (!ids.has(dependency.predecessor_item_id) || !ids.has(dependency.successor_item_id)) continue;
    outgoing.get(dependency.predecessor_item_id)?.push(dependency);
    incomingCount.set(
      dependency.successor_item_id,
      (incomingCount.get(dependency.successor_item_id) || 0) + 1,
    );
  }

  const queue = items.filter((item) => (incomingCount.get(item.id) || 0) === 0).map((item) => item.id);
  const topo: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    topo.push(current);
    for (const dependency of outgoing.get(current) || []) {
      const nextCount = (incomingCount.get(dependency.successor_item_id) || 0) - 1;
      incomingCount.set(dependency.successor_item_id, nextCount);
      if (nextCount === 0) queue.push(dependency.successor_item_id);
    }
  }

  return topo.length === items.length ? topo : items.map((item) => item.id);
}

function wouldCreateCycle(
  items: JobScheduleItem[],
  dependencies: JobScheduleDependency[],
  successorId: string,
  predecessorIds: string[],
) {
  const filtered = dependencies.filter((dependency) => dependency.successor_item_id !== successorId);
  const next = [
    ...filtered,
    ...predecessorIds.map((predecessorId) => ({
      id: `${predecessorId}:${successorId}`,
      company_id: "",
      job_id: "",
      predecessor_item_id: predecessorId,
      successor_item_id: successorId,
      dependency_type: "fs" as DependencyType,
      lag_days: 0,
    })),
  ];

  const { outgoing } = buildGraph(next);
  const itemIds = new Set(items.map((item) => item.id));

  const visit = (nodeId: string, stack: Set<string>, seen: Set<string>): boolean => {
    if (stack.has(nodeId)) return true;
    if (seen.has(nodeId)) return false;
    seen.add(nodeId);
    stack.add(nodeId);
    for (const child of outgoing.get(nodeId) || []) {
      if (!itemIds.has(child)) continue;
      if (visit(child, stack, seen)) return true;
    }
    stack.delete(nodeId);
    return false;
  };

  for (const itemId of itemIds) {
    if (visit(itemId, new Set<string>(), new Set<string>())) return true;
  }
  return false;
}

function computeRequiredBounds(
  dependency: JobScheduleDependency,
  predecessor: JobScheduleItem,
): { minStart?: Date; minEnd?: Date } {
  const predecessorStart = parseDate(predecessor.start_date);
  const predecessorEnd = parseDate(predecessor.end_date) || (predecessorStart ? getComputedEndDate(predecessorStart, predecessor) : null);
  const lag = Number(dependency.lag_days || 0);
  if (!predecessorStart || !predecessorEnd) return {};

  switch (dependency.dependency_type) {
    case "fs":
      return { minStart: addDays(predecessorEnd, lag + 1) };
    case "ss":
      return { minStart: addDays(predecessorStart, lag) };
    case "ff":
      return { minEnd: addDays(predecessorEnd, lag) };
    case "sf":
      return { minEnd: addDays(predecessorStart, lag) };
    default:
      return {};
  }
}

function autoScheduleItems(
  sourceItems: JobScheduleItem[],
  dependencies: JobScheduleDependency[],
  fallbackStartDate?: string | null,
) {
  const itemMap = new Map(sourceItems.map((item) => [item.id, { ...item }]));
  const topo = buildTopologicalOrder(sourceItems, dependencies);

  for (const itemId of topo) {
    const item = itemMap.get(itemId);
    if (!item) continue;

    const relevantDeps = dependencies.filter((dependency) => dependency.successor_item_id === itemId);
    if (relevantDeps.length === 0) {
      const rootStart = parseDate(item.start_date) || parseDate(fallbackStartDate) || startOfDay(new Date());
      item.start_date = toIsoDate(rootStart);
      item.duration_days = item.item_type === "milestone" ? 0 : Math.max(Number(item.duration_days || 1), 1);
      item.end_date = toIsoDate(getComputedEndDate(rootStart, item));
      continue;
    }

    let requiredStart: Date | null = null;
    let requiredEnd: Date | null = null;
    for (const dependency of relevantDeps) {
      const predecessor = itemMap.get(dependency.predecessor_item_id);
      if (!predecessor) continue;
      const bounds = computeRequiredBounds(dependency, predecessor);
      if (bounds.minStart && (!requiredStart || bounds.minStart > requiredStart)) requiredStart = bounds.minStart;
      if (bounds.minEnd && (!requiredEnd || bounds.minEnd > requiredEnd)) requiredEnd = bounds.minEnd;
    }

    item.duration_days = item.item_type === "milestone" ? 0 : Math.max(Number(item.duration_days || 1), 1);
    const spanDays = getItemSpanDays(item);
    const currentStart = parseDate(item.start_date);
    const currentEnd = parseDate(item.end_date);

    let nextStart = currentStart;
    let nextEnd = currentEnd;

    if (requiredStart) nextStart = !nextStart || requiredStart > nextStart ? requiredStart : nextStart;
    if (requiredEnd) nextEnd = !nextEnd || requiredEnd > nextEnd ? requiredEnd : nextEnd;

    if (!nextStart && nextEnd) nextStart = addDays(nextEnd, -spanDays);
    if (nextStart && !nextEnd) nextEnd = getComputedEndDate(nextStart, item);
    if (nextStart && nextEnd && nextEnd < getComputedEndDate(nextStart, item)) nextEnd = getComputedEndDate(nextStart, item);
    if (requiredEnd && nextEnd && nextEnd < requiredEnd) {
      nextEnd = requiredEnd;
      nextStart = addDays(nextEnd, -spanDays);
    }
    if (requiredStart && nextStart && nextStart < requiredStart) {
      nextStart = requiredStart;
      nextEnd = getComputedEndDate(nextStart, item);
    }

    const resolvedStart = nextStart || parseDate(fallbackStartDate) || startOfDay(new Date());
    const resolvedEnd = item.item_type === "milestone"
      ? resolvedStart
      : (nextEnd && nextEnd >= resolvedStart ? nextEnd : getComputedEndDate(resolvedStart, item));

    item.start_date = toIsoDate(resolvedStart);
    item.end_date = toIsoDate(resolvedEnd);
  }

  return sourceItems.map((item) => itemMap.get(item.id) || item);
}

function computeCriticalPath(itemMap: Map<string, JobScheduleItem>, dependencies: JobScheduleDependency[]) {
  const outgoing = new Map<string, JobScheduleDependency[]>();
  const incomingCount = new Map<string, number>();

  for (const itemId of itemMap.keys()) {
    outgoing.set(itemId, []);
    incomingCount.set(itemId, 0);
  }

  for (const dependency of dependencies) {
    if (!itemMap.has(dependency.predecessor_item_id) || !itemMap.has(dependency.successor_item_id)) continue;
    outgoing.get(dependency.predecessor_item_id)?.push(dependency);
    incomingCount.set(dependency.successor_item_id, (incomingCount.get(dependency.successor_item_id) || 0) + 1);
  }

  const queue = Array.from(itemMap.keys()).filter((itemId) => (incomingCount.get(itemId) || 0) === 0);
  const topo: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    topo.push(current);
    for (const dependency of outgoing.get(current) || []) {
      const nextCount = (incomingCount.get(dependency.successor_item_id) || 0) - 1;
      incomingCount.set(dependency.successor_item_id, nextCount);
      if (nextCount === 0) queue.push(dependency.successor_item_id);
    }
  }

  const distance = new Map<string, number>();
  const previous = new Map<string, string | null>();
  for (const [itemId, item] of itemMap.entries()) {
    distance.set(itemId, item.item_type === "milestone" ? 0 : Math.max(item.duration_days || 1, 1));
    previous.set(itemId, null);
  }

  for (const itemId of topo) {
    const currentDistance = distance.get(itemId) || 0;
    for (const dependency of outgoing.get(itemId) || []) {
      const successor = itemMap.get(dependency.successor_item_id);
      if (!successor) continue;
      const successorDuration = successor.item_type === "milestone" ? 0 : Math.max(successor.duration_days || 1, 1);
      const candidate = currentDistance + successorDuration + Math.max(Number(dependency.lag_days || 0), 0);
      if (candidate > (distance.get(dependency.successor_item_id) || 0)) {
        distance.set(dependency.successor_item_id, candidate);
        previous.set(dependency.successor_item_id, itemId);
      }
    }
  }

  let endNode: string | null = null;
  let maxDistance = 0;
  for (const [itemId, value] of distance.entries()) {
    if (value >= maxDistance) {
      maxDistance = value;
      endNode = itemId;
    }
  }

  const criticalIds = new Set<string>();
  while (endNode) {
    criticalIds.add(endNode);
    endNode = previous.get(endNode) || null;
  }
  return criticalIds;
}

function computeFloatDays(itemMap: Map<string, JobScheduleItem>, dependencies: JobScheduleDependency[]) {
  const order = buildTopologicalOrder(Array.from(itemMap.values()), dependencies);
  const latestStart = new Map<string, Date>();
  const latestEnd = new Map<string, Date>();
  const outgoing = new Map<string, JobScheduleDependency[]>();

  for (const item of itemMap.values()) outgoing.set(item.id, []);
  for (const dependency of dependencies) {
    if (!itemMap.has(dependency.predecessor_item_id) || !itemMap.has(dependency.successor_item_id)) continue;
    outgoing.get(dependency.predecessor_item_id)?.push(dependency);
  }

  const endDates = Array.from(itemMap.values()).map((item) => parseDate(item.end_date)).filter((date): date is Date => Boolean(date));
  const projectFinish = endDates.length > 0
    ? endDates.reduce((acc, value) => (value > acc ? value : acc), endDates[0])
    : startOfDay(new Date());

  for (const itemId of [...order].reverse()) {
    const item = itemMap.get(itemId);
    if (!item) continue;
    const currentStart = parseDate(item.start_date) || projectFinish;
    const currentEnd = parseDate(item.end_date) || getComputedEndDate(currentStart, item);
    const successors = outgoing.get(itemId) || [];

    if (successors.length === 0) {
      latestEnd.set(itemId, projectFinish);
      latestStart.set(itemId, addDays(projectFinish, -getItemSpanDays(item)));
      continue;
    }

    let candidateLatestEnd: Date | null = null;
    for (const dependency of successors) {
      const successorLatestStart = latestStart.get(dependency.successor_item_id);
      const successorLatestEnd = latestEnd.get(dependency.successor_item_id);
      const lag = Number(dependency.lag_days || 0);
      let allowedEnd: Date | null = null;
      switch (dependency.dependency_type) {
        case "fs":
          if (successorLatestStart) allowedEnd = addDays(successorLatestStart, -(lag + 1));
          break;
        case "ss":
          if (successorLatestStart) allowedEnd = addDays(addDays(successorLatestStart, -lag), getItemSpanDays(item));
          break;
        case "ff":
          if (successorLatestEnd) allowedEnd = addDays(successorLatestEnd, -lag);
          break;
        case "sf":
          if (successorLatestEnd) allowedEnd = addDays(addDays(successorLatestEnd, -lag), getItemSpanDays(item));
          break;
      }
      if (allowedEnd && (!candidateLatestEnd || allowedEnd < candidateLatestEnd)) candidateLatestEnd = allowedEnd;
    }

    const finalLatestEnd = candidateLatestEnd || currentEnd;
    latestEnd.set(itemId, finalLatestEnd);
    latestStart.set(itemId, addDays(finalLatestEnd, -getItemSpanDays(item)));
  }

  const floatDays = new Map<string, number>();
  for (const [itemId, item] of itemMap.entries()) {
    const currentStart = parseDate(item.start_date);
    const latest = latestStart.get(itemId);
    floatDays.set(itemId, currentStart && latest ? Math.max(differenceInCalendarDays(latest, currentStart), 0) : 0);
  }
  return floatDays;
}

function toScheduleItemPayload(item: JobScheduleItem, overrides: Partial<PersistedScheduleItemPayload> = {}): PersistedScheduleItemPayload {
  return {
    id: item.id,
    company_id: item.company_id,
    job_id: item.job_id,
    parent_item_id: item.parent_item_id,
    linked_purchase_order_id: item.linked_purchase_order_id,
    cost_code_id: item.cost_code_id,
    item_type: item.item_type,
    title: item.title,
    trade: item.trade,
    status: item.status,
    start_date: item.start_date,
    end_date: item.end_date,
    duration_days: item.duration_days,
    percent_complete: item.percent_complete,
    sort_order: item.sort_order,
    requires_purchase_order: item.requires_purchase_order,
    notes: item.notes,
    created_by: item.created_by,
    ...overrides,
  };
}

export default function JobScheduleTab({ jobId, companyId, canEdit, jobStartDate, jobEndDate }: JobScheduleTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<JobScheduleItem[]>([]);
  const [dependencies, setDependencies] = useState<JobScheduleDependency[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderOption[]>([]);
  const [costCodes, setCostCodes] = useState<CostCodeOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string[]>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [dependencyDialogItemId, setDependencyDialogItemId] = useState<string | null>(null);
  const [dependencyDrafts, setDependencyDrafts] = useState<Record<string, DependencyDraft>>({});
  const [savingDependencies, setSavingDependencies] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const { avatarMap } = useUserAvatars(teamMembers.map((member) => member.user_id));

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!jobId) return;
      try {
        setLoading(true);
        const [itemsResult, dependenciesResult, poResult, teamResult, costCodeResult, assignmentsResult, timecardSettingsResult] = await Promise.all([
          (supabase as any).from("job_schedule_items").select("*").eq("job_id", jobId).order("sort_order", { ascending: true }).order("start_date", { ascending: true }),
          (supabase as any).from("job_schedule_dependencies").select("*").eq("job_id", jobId),
          supabase.from("purchase_orders").select("id, po_number, description, status").eq("job_id", jobId).order("po_number", { ascending: true }),
          (supabase as any)
            .from("job_project_directory")
            .select("linked_user_id, name, project_role:project_roles(name)")
            .eq("job_id", jobId)
            .eq("is_active", true)
            .eq("is_project_team_member", true)
            .not("linked_user_id", "is", null)
            .order("name"),
          supabase.from("cost_codes").select("id, code, description").eq("job_id", jobId).order("code", { ascending: true }),
          (supabase as any).from("job_schedule_item_assignments").select("schedule_item_id, user_id").eq("job_id", jobId),
          companyId
            ? supabase
                .from("employee_timecard_settings")
                .select("user_id, assigned_jobs")
                .eq("company_id", companyId)
            : Promise.resolve({ data: [], error: null } as const),
        ]);

        if (itemsResult.error) throw itemsResult.error;
        if (dependenciesResult.error) throw dependenciesResult.error;
        if (poResult.error) throw poResult.error;
        if (teamResult.error) throw teamResult.error;
        if (costCodeResult.error) throw costCodeResult.error;
        if (assignmentsResult.error) throw assignmentsResult.error;
        if (timecardSettingsResult.error) throw timecardSettingsResult.error;

        const punchClockUserIds = Array.from(
          new Set(
            (((timecardSettingsResult.data || []) as Array<{ user_id: string; assigned_jobs: string[] | null }>)
              .filter((row) => Array.isArray(row.assigned_jobs) && row.assigned_jobs.includes(jobId))
              .map((row) => String(row.user_id))
              .filter(Boolean))
          ),
        );

        const teamRows = ((teamResult.data || []) as any[]) || [];
        const existingTeamUserIds = new Set(teamRows.map((member) => String(member.linked_user_id)).filter(Boolean));
        const additionalPunchClockUserIds = punchClockUserIds.filter((userId) => !existingTeamUserIds.has(userId));

        let punchClockProfiles: Array<{ user_id: string; first_name: string | null; last_name: string | null; display_name: string | null }> = [];
        if (additionalPunchClockUserIds.length > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("user_id, first_name, last_name, display_name")
            .in("user_id", additionalPunchClockUserIds);

          if (profileError) throw profileError;
          punchClockProfiles = (profileData || []) as Array<{ user_id: string; first_name: string | null; last_name: string | null; display_name: string | null }>;
        }

        if (!ignore) {
          const normalizedItems = (((itemsResult.data || []) as JobScheduleItem[]) || []).map((item) => ({
            ...item,
            item_type: (item.item_type || "activity") as ScheduleItemType,
            cost_code_id: item.cost_code_id || null,
          }));
          const projectTeamOptions = teamRows.map((member) => [
            String(member.linked_user_id),
            {
              user_id: String(member.linked_user_id),
              name: String(member.name || "Unnamed team member"),
              role_name: member.project_role?.name ? String(member.project_role.name) : "Project Team",
              source: "project_team" as const,
            },
          ]);
          const punchClockOptions = punchClockProfiles.map((profile) => {
            const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
            return [
              String(profile.user_id),
              {
                user_id: String(profile.user_id),
                name: profile.display_name || fullName || "Unnamed employee",
                role_name: "Punch Clock Access",
                source: "punch_clock" as const,
              },
            ] as const;
          });
          const teamOptions = Array.from(new Map([...projectTeamOptions, ...punchClockOptions]).values()).sort((a, b) => a.name.localeCompare(b.name));
          const nextAssignmentMap: Record<string, string[]> = {};
          (((assignmentsResult.data || []) as any[]) || []).forEach((row) => {
            const key = String(row.schedule_item_id);
            if (!nextAssignmentMap[key]) nextAssignmentMap[key] = [];
            nextAssignmentMap[key].push(String(row.user_id));
          });
          setItems(normalizedItems);
          setDependencies(((dependenciesResult.data || []) as JobScheduleDependency[]) || []);
          setPurchaseOrders((poResult.data || []) as PurchaseOrderOption[]);
          setTeamMembers(teamOptions);
          setCostCodes((costCodeResult.data || []) as CostCodeOption[]);
          setAssignmentMap(nextAssignmentMap);
        }
      } catch (error: any) {
        console.error("Failed to load job schedule:", error);
        if (!ignore) {
          toast({ title: "Schedule unavailable", description: error?.message || "Could not load the job schedule.", variant: "destructive" });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    void load();
    return () => {
      ignore = true;
    };
  }, [jobId, toast]);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const dependencyGraph = useMemo(() => buildGraph(dependencies), [dependencies]);
  const criticalPathIds = useMemo(() => computeCriticalPath(itemMap, dependencies), [itemMap, dependencies]);
  const floatDaysMap = useMemo(() => computeFloatDays(itemMap, dependencies), [itemMap, dependencies]);

  const derivedItems = useMemo<DerivedScheduleItem[]>(() => {
    return items.map((item) => {
      const predecessorIds = dependencyGraph.incoming.get(item.id) || [];
      const predecessorItems = predecessorIds.map((predecessorId) => itemMap.get(predecessorId)).filter((value): value is JobScheduleItem => Boolean(value));
      const blockedByDependencies = predecessorItems.some((predecessor) => predecessor.status !== "completed");
      const blockedByPo = item.requires_purchase_order && !item.linked_purchase_order_id;
      const assignedUsers = (assignmentMap[item.id] || []).map((userId) => teamMembers.find((member) => member.user_id === userId)).filter((value): value is TeamMemberOption => Boolean(value));
      return {
        ...item,
        blockedByDependencies,
        blockedByPo,
        predecessorItems,
        isCritical: criticalPathIds.has(item.id),
        floatDays: floatDaysMap.get(item.id) || 0,
        assignedUsers,
      };
    });
  }, [items, dependencyGraph.incoming, itemMap, criticalPathIds, floatDaysMap, assignmentMap, teamMembers]);

  const selectedItem = useMemo(() => derivedItems.find((item) => item.id === selectedItemId) || null, [derivedItems, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) return;
    setSelectedAssignments(assignmentMap[selectedItemId] || []);
  }, [selectedItemId, assignmentMap]);

  const timelineRange = useMemo(() => {
    const parsedStarts = derivedItems.map((item) => parseDate(item.start_date)).filter((value): value is Date => Boolean(value));
    const parsedEnds = derivedItems.map((item) => parseDate(item.end_date)).filter((value): value is Date => Boolean(value));
    const fallbackStart = parseDate(jobStartDate) || startOfDay(new Date());
    const fallbackEnd = parseDate(jobEndDate) || addDays(fallbackStart, 30);
    const minDate = parsedStarts.length > 0 ? parsedStarts.reduce((acc, value) => (value < acc ? value : acc), parsedStarts[0]) : fallbackStart;
    const maxDate = parsedEnds.length > 0 ? parsedEnds.reduce((acc, value) => (value > acc ? value : acc), parsedEnds[0]) : fallbackEnd;
    const safeMax = maxDate < minDate ? addDays(minDate, 7) : maxDate;
    const totalDays = Math.max(differenceInCalendarDays(safeMax, minDate) + 1, 1);
    return { minDate, maxDate: safeMax, totalDays };
  }, [derivedItems, jobStartDate, jobEndDate]);

  const timelineTicks = useMemo(() => {
    const tickCount = Math.min(Math.max(timelineRange.totalDays, 7), 18);
    const step = Math.max(Math.ceil(timelineRange.totalDays / tickCount), 1);
    const ticks: Date[] = [];
    for (let offset = 0; offset < timelineRange.totalDays; offset += step) ticks.push(addDays(timelineRange.minDate, offset));
    if (ticks.length === 0) ticks.push(timelineRange.minDate);
    return ticks;
  }, [timelineRange]);

  const summary = useMemo(() => {
    const today = startOfDay(new Date());
    const blockedCount = derivedItems.filter((item) => item.blockedByDependencies || item.blockedByPo).length;
    const dueSoonCount = derivedItems.filter((item) => {
      const end = parseDate(item.end_date);
      return end && differenceInCalendarDays(end, today) <= 7 && differenceInCalendarDays(end, today) >= 0 && item.status !== "completed";
    }).length;
    const completedCount = derivedItems.filter((item) => item.status === "completed").length;
    const milestoneCount = derivedItems.filter((item) => item.item_type === "milestone").length;
    return { blockedCount, dueSoonCount, completedCount, milestoneCount };
  }, [derivedItems]);

  const persistAssignments = async (itemId: string, userIds: string[]) => {
    await (supabase as any).from("job_schedule_item_assignments").delete().eq("schedule_item_id", itemId);
    if (userIds.length === 0 || !companyId) {
      setAssignmentMap((current) => ({ ...current, [itemId]: [] }));
      return;
    }
    const rows = userIds.map((userId) => ({
      company_id: companyId,
      job_id: jobId,
      schedule_item_id: itemId,
      user_id: userId,
    }));
    const { error } = await (supabase as any).from("job_schedule_item_assignments").insert(rows);
    if (error) throw error;
    setAssignmentMap((current) => ({ ...current, [itemId]: userIds }));
  };

  const persistScheduledItems = async (scheduledItems: JobScheduleItem[], successTitle: string, successDescription: string) => {
    const { data, error } = await (supabase as any)
      .from("job_schedule_items")
      .upsert(scheduledItems.map((item) => toScheduleItemPayload(item, { updated_at: new Date().toISOString() })))
      .select("*")
      .order("sort_order", { ascending: true })
      .order("start_date", { ascending: true });
    if (error) throw error;
    setItems((((data || []) as JobScheduleItem[]) || []).map((item) => ({ ...item, item_type: (item.item_type || "activity") as ScheduleItemType, cost_code_id: item.cost_code_id || null })));
    toast({ title: successTitle, description: successDescription });
  };

  const openDependencyDialog = (itemId: string) => {
    const drafts: Record<string, DependencyDraft> = {};
    dependencies.filter((dependency) => dependency.successor_item_id === itemId).forEach((dependency) => {
      drafts[dependency.predecessor_item_id] = { dependency_type: dependency.dependency_type, lag_days: dependency.lag_days };
    });
    setDependencyDrafts(drafts);
    setDependencyDialogItemId(itemId);
  };

  const updateItem = (itemId: string, patch: Partial<JobScheduleItem>) => {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const handleOpenItem = (itemId: string) => {
    setSelectedItemId(itemId);
  };

  const saveItem = async (item: JobScheduleItem, assignedUserIds: string[]) => {
    try {
      setSavingItemId(item.id);
      const start = parseDate(item.start_date);
      const end = parseDate(item.end_date);
      const durationDays = item.item_type === "milestone" ? 0 : start && end ? Math.max(differenceInCalendarDays(end, start) + 1, 1) : Math.max(item.duration_days || 1, 1);
      const nextItem = {
        ...item,
        company_id: item.company_id || companyId,
        duration_days: durationDays,
        end_date: item.item_type === "milestone" && item.start_date ? item.start_date : item.end_date,
        percent_complete: Number.isFinite(Number(item.percent_complete)) ? Number(item.percent_complete) : 0,
      };
      const nextItems = items.map((row) => (row.id === item.id ? nextItem : row));
      const scheduledItems = autoScheduleItems(nextItems, dependencies, jobStartDate);
      await persistScheduledItems(scheduledItems, "Schedule item saved", `${item.title || "Activity"} was updated and successor dates were recalculated.`);
      await persistAssignments(item.id, assignedUserIds);
      setSelectedItemId(null);
    } catch (error: any) {
      console.error("Failed to save schedule item:", error);
      toast({ title: "Could not save activity", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSavingItemId(null);
    }
  };

  const addItem = async (itemType: ScheduleItemType = "activity") => {
    if (!companyId) {
      toast({ title: "Missing company", description: "This job is missing a company context.", variant: "destructive" });
      return;
    }
    try {
      const nextSort = items.length > 0 ? Math.max(...items.map((item) => item.sort_order || 0)) + 1 : 1;
      const fallbackStart = jobStartDate || format(new Date(), "yyyy-MM-dd");
      const payload = {
        company_id: companyId,
        job_id: jobId,
        item_type: itemType,
        title: `${itemType === "milestone" ? "New milestone" : "New activity"} ${items.length + 1}`,
        trade: "",
        status: "not_started",
        start_date: fallbackStart,
        end_date: fallbackStart,
        duration_days: itemType === "milestone" ? 0 : 1,
        percent_complete: 0,
        sort_order: nextSort,
        requires_purchase_order: false,
        notes: "",
        created_by: user?.id || null,
        cost_code_id: null,
      };
      const { data, error } = await (supabase as any).from("job_schedule_items").insert(payload).select("*").single();
      if (error) throw error;
      const next = { ...(data as JobScheduleItem), item_type: ((data as any).item_type || itemType) as ScheduleItemType, cost_code_id: (data as any).cost_code_id || null };
      setItems((current) => [...current, next]);
      setSelectedItemId(next.id);
      setSelectedAssignments([]);
      toast({ title: itemType === "milestone" ? "Milestone added" : "Activity added", description: `A new ${itemType} is ready to edit.` });
    } catch (error: any) {
      console.error("Failed to add schedule item:", error);
      toast({ title: `Could not add ${itemType}`, description: error?.message || "Please try again.", variant: "destructive" });
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      setDeletingItemId(itemId);
      const { error } = await (supabase as any).from("job_schedule_items").delete().eq("id", itemId);
      if (error) throw error;
      setItems((current) => current.filter((item) => item.id !== itemId));
      setDependencies((current) => current.filter((dependency) => dependency.predecessor_item_id !== itemId && dependency.successor_item_id !== itemId));
      setAssignmentMap((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
      if (selectedItemId === itemId) setSelectedItemId(null);
      toast({ title: "Activity removed", description: "The schedule item was deleted." });
    } catch (error: any) {
      console.error("Failed to delete schedule item:", error);
      toast({ title: "Could not delete activity", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setDeletingItemId(null);
    }
  };

  const saveDependencies = async () => {
    if (!dependencyDialogItemId || !companyId) return;
    const enabledPredecessors = Object.keys(dependencyDrafts);
    if (wouldCreateCycle(items, dependencies, dependencyDialogItemId, enabledPredecessors)) {
      toast({ title: "Dependency loop detected", description: "This change would create a circular dependency in the schedule.", variant: "destructive" });
      return;
    }
    try {
      setSavingDependencies(true);
      const existingForItem = dependencies.filter((dependency) => dependency.successor_item_id === dependencyDialogItemId);
      const predecessorIdsToDelete = existingForItem.filter((dependency) => !dependencyDrafts[dependency.predecessor_item_id]).map((dependency) => dependency.predecessor_item_id);
      if (predecessorIdsToDelete.length > 0) {
        const { error } = await (supabase as any).from("job_schedule_dependencies").delete().eq("successor_item_id", dependencyDialogItemId).in("predecessor_item_id", predecessorIdsToDelete);
        if (error) throw error;
      }
      const upserts = enabledPredecessors.map((predecessorId) => ({
        company_id: companyId,
        job_id: jobId,
        predecessor_item_id: predecessorId,
        successor_item_id: dependencyDialogItemId,
        dependency_type: dependencyDrafts[predecessorId].dependency_type,
        lag_days: Number(dependencyDrafts[predecessorId].lag_days || 0),
      }));
      let nextDependencies = dependencies.filter((dependency) => dependency.successor_item_id !== dependencyDialogItemId || !!dependencyDrafts[dependency.predecessor_item_id]);
      if (upserts.length > 0) {
        const { data, error } = await (supabase as any).from("job_schedule_dependencies").upsert(upserts, { onConflict: "predecessor_item_id,successor_item_id" }).select("*");
        if (error) throw error;
        const upsertedRows = (data || []) as JobScheduleDependency[];
        nextDependencies = [
          ...nextDependencies.filter((dependency) => !upsertedRows.some((row) => row.predecessor_item_id === dependency.predecessor_item_id && row.successor_item_id === dependency.successor_item_id)),
          ...upsertedRows,
        ];
      } else {
        nextDependencies = nextDependencies.filter((dependency) => dependency.successor_item_id !== dependencyDialogItemId);
      }
      const scheduledItems = autoScheduleItems(items, nextDependencies, jobStartDate);
      const { data: updatedItems, error: itemsError } = await (supabase as any)
        .from("job_schedule_items")
        .upsert(scheduledItems.map((item) => toScheduleItemPayload(item, { updated_at: new Date().toISOString() })))
        .select("*")
        .order("sort_order", { ascending: true })
        .order("start_date", { ascending: true });
      if (itemsError) throw itemsError;
      setDependencies(nextDependencies);
      setItems((((updatedItems || []) as JobScheduleItem[]) || []).map((item) => ({ ...item, item_type: (item.item_type || "activity") as ScheduleItemType, cost_code_id: item.cost_code_id || null })));
      setDependencyDialogItemId(null);
      toast({ title: "Dependencies updated", description: "The activity links were saved and successor dates were recalculated." });
    } catch (error: any) {
      console.error("Failed to save dependencies:", error);
      toast({ title: "Could not save dependencies", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSavingDependencies(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading job schedule
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Activities</div><div className="mt-2 text-3xl font-semibold">{derivedItems.length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Blocked</div><div className="mt-2 text-3xl font-semibold text-rose-600">{summary.blockedCount}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Due In 7 Days</div><div className="mt-2 text-3xl font-semibold text-amber-600">{summary.dueSoonCount}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Completed</div><div className="mt-2 text-3xl font-semibold text-emerald-600">{summary.completedCount}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Milestones</div><div className="mt-2 text-3xl font-semibold text-violet-600">{summary.milestoneCount}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5" />Job Schedule</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Click any activity bar to open its details. Assign project-team employees, link cost codes, and manage dependencies from the modal.</p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void addItem("milestone")}><Diamond className="h-4 w-4 mr-2" />Add Milestone</Button>
              <Button onClick={() => void addItem("activity")}><Plus className="h-4 w-4 mr-2" />Add Activity</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {derivedItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">No schedule activities yet. Add the first activity to build the project sequence and timeline.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[280px_1fr] border-b bg-muted/30">
                  <div className="px-4 py-3 text-sm font-medium">Activity Timeline</div>
                  <div className="relative px-4 py-3">
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                      {timelineTicks.map((tick) => <span key={tick.toISOString()}>{format(tick, "MMM d")}</span>)}
                    </div>
                  </div>
                </div>
                {derivedItems.map((item) => {
                  const start = parseDate(item.start_date) || timelineRange.minDate;
                  const end = parseDate(item.end_date) || getComputedEndDate(start, item);
                  const offset = Math.max(differenceInCalendarDays(start, timelineRange.minDate), 0);
                  const span = Math.max(differenceInCalendarDays(end, start) + 1, 1);
                  const left = `${(offset / timelineRange.totalDays) * 100}%`;
                  const width = `${Math.max((span / timelineRange.totalDays) * 100, 2)}%`;
                  const isBlocked = item.blockedByDependencies || item.blockedByPo;
                  return (
                    <div key={item.id} className="grid grid-cols-[280px_1fr] border-b last:border-b-0">
                      <button type="button" onClick={() => handleOpenItem(item.id)} className="px-4 py-3 text-left hover:bg-muted/40 transition-colors">
                        <div className="font-medium text-sm">{item.title}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.trade ? <Badge variant="outline">{item.trade}</Badge> : null}
                          {item.item_type === "milestone" ? <Badge variant="outline">Milestone</Badge> : null}
                          <Badge className={statusToneClass[item.status]}>{STATUS_OPTIONS.find((option) => option.value === item.status)?.label || item.status}</Badge>
                          {item.isCritical ? <Badge variant="destructive">Critical</Badge> : null}
                        </div>
                        {item.assignedUsers.length > 0 ? (
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{item.assignedUsers.map((member) => member.name).join(", ")}</div>
                        ) : null}
                      </button>
                      <button type="button" onClick={() => handleOpenItem(item.id)} className="relative px-4 py-4 hover:bg-muted/30 transition-colors">
                        <div className="absolute inset-y-0 left-4 right-4 rounded-md bg-muted/20" />
                        {item.item_type === "milestone" ? (
                          <div className="absolute top-1/2 -translate-y-1/2" style={{ left }}>
                            <div className={`${item.isCritical ? "text-rose-500" : isBlocked ? "text-amber-500" : "text-violet-500"}`}><Diamond className="h-6 w-6 fill-current" /></div>
                          </div>
                        ) : (
                          <div className={`absolute top-1/2 h-8 -translate-y-1/2 rounded-md px-3 py-1 text-xs font-medium text-white shadow-sm ${item.isCritical ? "bg-rose-500" : isBlocked ? "bg-amber-500" : item.status === "completed" ? "bg-emerald-500" : "bg-primary"}`} style={{ left, width }}>
                            <div className="flex h-full items-center justify-between gap-3 overflow-hidden whitespace-nowrap">
                              <span className="truncate">{formatDateLabel(item.start_date)} - {formatDateLabel(item.end_date)}</span>
                              <span>{Math.round(item.percent_complete)}%</span>
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItemId(null)}>
        <DialogContent className="max-w-4xl">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedItem.title || "Schedule Item"}</DialogTitle>
                <DialogDescription>Edit this schedule item, assign project team employees, attach a cost code, and manage its dependencies.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 xl:grid-cols-[2fr_180px_1fr_1fr_1fr]">
                <div className="space-y-2">
                  <Label>Activity</Label>
                  <Input value={selectedItem.title} onChange={(event) => updateItem(selectedItem.id, { title: event.target.value })} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={selectedItem.item_type} onValueChange={(value) => updateItem(selectedItem.id, { item_type: value as ScheduleItemType, duration_days: value === "milestone" ? 0 : Math.max(selectedItem.duration_days || 1, 1), end_date: value === "milestone" ? selectedItem.start_date : selectedItem.end_date })} disabled={!canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ITEM_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trade</Label>
                  <Input value={selectedItem.trade || ""} onChange={(event) => updateItem(selectedItem.id, { trade: event.target.value })} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input type="date" value={selectedItem.start_date || ""} onChange={(event) => updateItem(selectedItem.id, { start_date: event.target.value || null, end_date: selectedItem.item_type === "milestone" ? event.target.value || null : selectedItem.end_date })} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>End</Label>
                  <Input type="date" value={selectedItem.end_date || ""} onChange={(event) => updateItem(selectedItem.id, { end_date: event.target.value || null })} disabled={!canEdit || selectedItem.item_type === "milestone"} />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr] mt-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={selectedItem.status} onValueChange={(value) => updateItem(selectedItem.id, { status: value as ScheduleStatus })} disabled={!canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>% Complete</Label>
                  <Input type="number" min={0} max={100} value={Number(selectedItem.percent_complete || 0)} onChange={(event) => updateItem(selectedItem.id, { percent_complete: Number(event.target.value) })} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>Linked Purchase Order</Label>
                  <Select value={selectedItem.linked_purchase_order_id || "none"} onValueChange={(value) => updateItem(selectedItem.id, { linked_purchase_order_id: value === "none" ? null : value })} disabled={!canEdit}>
                    <SelectTrigger><SelectValue placeholder="No PO linked" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked PO</SelectItem>
                      {purchaseOrders.map((option) => <SelectItem key={option.id} value={option.id}>{option.po_number}{option.description ? ` - ${option.description}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cost Code</Label>
                  <Select value={selectedItem.cost_code_id || "none"} onValueChange={(value) => updateItem(selectedItem.id, { cost_code_id: value === "none" ? null : value })} disabled={!canEdit}>
                    <SelectTrigger><SelectValue placeholder="No cost code" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No cost code</SelectItem>
                      {costCodes.map((option) => <SelectItem key={option.id} value={option.id}>{option.code}{option.description ? ` - ${option.description}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 mt-2">
                <Label>Notes</Label>
                <Textarea value={selectedItem.notes || ""} onChange={(event) => updateItem(selectedItem.id, { notes: event.target.value })} rows={4} disabled={!canEdit} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_320px] mt-2">
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-medium">Employees Assigned</h4>
                      <p className="text-sm text-muted-foreground">Available employees include project-team members and anyone with punch clock access to this job.</p>
                    </div>
                    <Badge variant="outline">{selectedAssignments.length}</Badge>
                  </div>
                  <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
                    {teamMembers.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No employees with project or punch clock access were found for this job.</div>
                    ) : teamMembers.map((member) => {
                      const checked = selectedAssignments.includes(member.user_id);
                      return (
                        <label key={member.user_id} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                          <Checkbox
                            checked={checked}
                            disabled={!canEdit}
                            onCheckedChange={(nextChecked) => {
                              setSelectedAssignments((current) => nextChecked ? Array.from(new Set([...current, member.user_id])) : current.filter((value) => value !== member.user_id));
                            }}
                          />
                          <UserAvatar src={avatarMap[member.user_id]} name={member.name} className="h-10 w-10 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-sm">{member.name}</div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {member.role_name ? <div className="text-xs text-muted-foreground">{member.role_name}</div> : null}
                              {member.source === "punch_clock" ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Punch Clock</Badge> : null}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <h4 className="font-medium">Schedule Logic</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={statusToneClass[selectedItem.status]}>{STATUS_OPTIONS.find((option) => option.value === selectedItem.status)?.label || selectedItem.status}</Badge>
                    {selectedItem.item_type === "milestone" ? <Badge variant="outline">Milestone</Badge> : null}
                    {selectedItem.isCritical ? <Badge variant="destructive">Critical Path</Badge> : null}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Float: {selectedItem.floatDays} day{selectedItem.floatDays === 1 ? "" : "s"}</div>
                    <div>Duration: {selectedItem.item_type === "milestone" ? "Milestone" : `${selectedItem.duration_days} day${selectedItem.duration_days === 1 ? "" : "s"}`}</div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked={selectedItem.requires_purchase_order} disabled={!canEdit} onCheckedChange={(checked) => updateItem(selectedItem.id, { requires_purchase_order: Boolean(checked) })} />
                    Requires purchase order before work starts
                  </label>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Dependencies</div>
                    <div className="flex flex-wrap gap-2">
                      {dependencies.filter((dependency) => dependency.successor_item_id === selectedItem.id).length > 0 ? dependencies.filter((dependency) => dependency.successor_item_id === selectedItem.id).map((dependency) => {
                        const predecessor = itemMap.get(dependency.predecessor_item_id);
                        if (!predecessor) return null;
                        const dependencyLabel = DEPENDENCY_OPTIONS.find((option) => option.value === dependency.dependency_type)?.label || dependency.dependency_type.toUpperCase();
                        return <Badge key={dependency.id} variant="outline">{predecessor.title} · {dependencyLabel}{dependency.lag_days ? ` · Lag ${dependency.lag_days}d` : ""}</Badge>;
                      }) : <span className="text-sm text-muted-foreground">No predecessor links.</span>}
                    </div>
                    {canEdit && <Button type="button" variant="outline" onClick={() => openDependencyDialog(selectedItem.id)}><Link2 className="h-4 w-4 mr-2" />Manage Dependencies</Button>}
                  </div>
                  {(selectedItem.blockedByDependencies || selectedItem.blockedByPo) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />Currently blocked</div>
                      <div className="mt-1">{selectedItem.blockedByDependencies && selectedItem.blockedByPo ? "Predecessor work is incomplete and a required purchase order is still missing." : selectedItem.blockedByDependencies ? "At least one predecessor activity is not complete." : "A purchase order is required before this activity can start."}</div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                {canEdit && <Button variant="outline" onClick={() => void deleteItem(selectedItem.id)} disabled={deletingItemId === selectedItem.id}>{deletingItemId === selectedItem.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}Delete</Button>}
                <Button variant="outline" onClick={() => setSelectedItemId(null)}>Close</Button>
                {canEdit && <Button onClick={() => void saveItem(selectedItem, selectedAssignments)} disabled={savingItemId === selectedItem.id}>{savingItemId === selectedItem.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save Activity</Button>}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!dependencyDialogItemId} onOpenChange={(open) => !open && setDependencyDialogItemId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage Dependencies</DialogTitle>
            <DialogDescription>Choose which activities must happen before <span className="font-medium text-foreground">{dependencyDialogItemId ? itemMap.get(dependencyDialogItemId)?.title || "this activity" : "this activity"}</span>.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
            {items.filter((item) => item.id !== dependencyDialogItemId).map((item) => {
              const enabled = !!dependencyDrafts[item.id];
              const draft = dependencyDrafts[item.id] || { dependency_type: "fs" as DependencyType, lag_days: 0 };
              return (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <label className="inline-flex items-center gap-3">
                        <Checkbox checked={enabled} onCheckedChange={(checked) => setDependencyDrafts((current) => {
                          const next = { ...current };
                          if (!checked) {
                            delete next[item.id];
                            return next;
                          }
                          next[item.id] = current[item.id] || { dependency_type: "fs", lag_days: 0 };
                          return next;
                        })} />
                        <span className="font-medium">{item.title}</span>
                      </label>
                      <div className="text-sm text-muted-foreground">{item.trade || "No trade"} · {formatDateLabel(item.start_date)} to {formatDateLabel(item.end_date)}</div>
                    </div>
                    {enabled && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Dependency Type</Label>
                          <Select value={draft.dependency_type} onValueChange={(value) => setDependencyDrafts((current) => ({ ...current, [item.id]: { ...draft, dependency_type: value as DependencyType } }))}>
                            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{DEPENDENCY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Lag (days)</Label>
                          <Input type="number" value={draft.lag_days} onChange={(event) => setDependencyDrafts((current) => ({ ...current, [item.id]: { ...draft, lag_days: Number(event.target.value || 0) } }))} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDependencyDialogItemId(null)}>Cancel</Button>
            <Button onClick={() => void saveDependencies()} disabled={savingDependencies}>{savingDependencies ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}Save Dependencies</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
