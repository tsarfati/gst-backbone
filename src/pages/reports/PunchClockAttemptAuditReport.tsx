import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Download, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceLabel } from "@/lib/distanceUnits";

type AuditRow = {
  id: string;
  company_id: string;
  created_at: string;
  user_id?: string | null;
  pin_employee_id?: string | null;
  job_id?: string | null;
  attempted_action?: string | null;
  action?: string | null;
  outcome?: string | null;
  block_reason?: string | null;
  reason?: string | null;
  distance_from_job_meters?: number | null;
  distance_meters?: number | null;
  allowed_limit_meters?: number | null;
  punch_in_distance_limit_meters?: number | null;
  metadata?: any;
  [key: string]: any;
};

type EmployeeOption = { value: string; label: string };
type JobOption = { value: string; label: string };

const DEFAULT_ACTION = "punch_in";
const DEFAULT_OUTCOME = "blocked";
const BLOCK_REASON_OPTIONS = [
  "out_of_range",
  "job_missing_coordinates",
  "location_unavailable",
  "location_permission_denied",
  "location_timeout",
];

const startOfTodayIso = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

const numOrNull = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const getAction = (row: AuditRow) => {
  const raw = (row.attempted_action || row.action || "").toString().toLowerCase();
  if (raw === "in") return "punch_in";
  if (raw === "out") return "punch_out";
  return raw;
};
const getOutcome = (row: AuditRow) => {
  const raw = (row.outcome || "").toString().toLowerCase();
  if (raw) return raw;
  // Backward compatibility: legacy table only stored blocked attempts and had no `outcome` column.
  if (row.block_reason || row.reason) return "blocked";
  return "";
};
const getBlockReason = (row: AuditRow) => (row.block_reason || row.reason || "").toString().toLowerCase();
const getDistance = (row: AuditRow) =>
  numOrNull(row.distance_from_job_meters) ??
  numOrNull(row.distance_meters) ??
  numOrNull(row.metadata?.distance_from_job_meters) ??
  null;
const getAllowedLimit = (row: AuditRow) =>
  numOrNull(row.allowed_limit_meters) ??
  numOrNull(row.punch_in_distance_limit_meters) ??
  numOrNull(row.metadata?.allowed_limit_meters) ??
  numOrNull(row.metadata?.punch_in_distance_limit_meters) ??
  null;

export default function PunchClockAttemptAuditReport() {
  const navigate = useNavigate();
  const { currentCompany, userCompanies } = useCompany();
  const { profile } = useAuth();
  const { settings: appSettings } = useSettings();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [pinEmployeeNames, setPinEmployeeNames] = useState<Record<string, string>>({});
  const [jobNames, setJobNames] = useState<Record<string, string>>({});

  const [dateFrom, setDateFrom] = useState(daysAgoIso(14));
  const [dateTo, setDateTo] = useState(startOfTodayIso());
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [blockReasonFilter, setBlockReasonFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>(DEFAULT_OUTCOME);
  const [actionFilter, setActionFilter] = useState<string>(DEFAULT_ACTION);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const distanceUnit = appSettings.distanceUnit ?? "meters";

  const companyRole = useMemo(
    () => userCompanies.find((c) => c.company_id === currentCompany?.id)?.role?.toLowerCase() || null,
    [userCompanies, currentCompany?.id]
  );
  const profileRole = (profile?.role || "").toLowerCase();
  const canView = useMemo(() => {
    if (["super_admin", "postgres", "admin"].includes(profileRole)) return true;
    return !!companyRole && ["admin", "company_admin", "controller", "project_manager", "owner"].includes(companyRole);
  }, [companyRole, profileRole]);

  const resolveLookups = async (auditRows: AuditRow[]) => {
    const userIds = Array.from(new Set(auditRows.map((r) => r.user_id).filter(Boolean))) as string[];
    const pinIds = Array.from(new Set(auditRows.map((r) => r.pin_employee_id).filter(Boolean))) as string[];
    const jobIds = Array.from(new Set(auditRows.map((r) => r.job_id).filter(Boolean))) as string[];

    try {
      if (userIds.length) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, display_name, first_name, last_name")
          .in("user_id", userIds);
        const map: Record<string, string> = {};
        (data || []).forEach((p: any) => {
          map[p.user_id] =
            p.display_name ||
            [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
            p.user_id;
        });
        setProfileNames((prev) => ({ ...prev, ...map }));
      }

      if (pinIds.length) {
        const { data } = await supabase
          .from("pin_employees" as any)
          .select("id, display_name, first_name, last_name")
          .in("id", pinIds);
        const map: Record<string, string> = {};
        (data || []).forEach((p: any) => {
          map[p.id] =
            p.display_name ||
            [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
            p.id;
        });
        setPinEmployeeNames((prev) => ({ ...prev, ...map }));
      }

      if (jobIds.length) {
        const { data } = await supabase.from("jobs").select("id, name").in("id", jobIds);
        const map: Record<string, string> = {};
        (data || []).forEach((j: any) => {
          map[j.id] = j.name || j.id;
        });
        setJobNames((prev) => ({ ...prev, ...map }));
      }
    } catch (e) {
      console.warn("Failed resolving audit lookup names:", e);
    }
  };

  const fetchAuditRows = async () => {
    if (!currentCompany?.id || !canView) return;
    setLoading(true);
    try {
      const fromIso = dateFrom ? `${dateFrom}T00:00:00.000Z` : null;
      const toIso = dateTo ? `${dateTo}T23:59:59.999Z` : null;

      let query = supabase
        .from("punch_clock_attempt_audit" as any)
        .select("*", { count: "exact" })
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (fromIso) query = query.gte("created_at", fromIso);
      if (toIso) query = query.lte("created_at", toIso);

      const { data, error, count } = await query;
      if (error) throw error;

      const nextRows = ((data || []) as any[]).map((r) => r as AuditRow);
      setRows(nextRows);
      setTotalCount(count || nextRows.length);
      setPage(1);
      void resolveLookups(nextRows);
    } catch (error: any) {
      console.error("Error fetching punch clock attempt audit:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load punch clock attempt audit events",
        variant: "destructive",
      });
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentCompany?.id && canView) {
      void fetchAuditRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id, canView, dateFrom, dateTo]);

  const getEmployeeLabel = (row: AuditRow) => {
    if (row.user_id) return profileNames[row.user_id] || `User ${row.user_id.slice(0, 8)}`;
    if (row.pin_employee_id) return pinEmployeeNames[row.pin_employee_id] || `PIN ${row.pin_employee_id.slice(0, 8)}`;
    return "Unknown";
  };

  const getEmployeeKey = (row: AuditRow) => (row.user_id ? `u:${row.user_id}` : row.pin_employee_id ? `p:${row.pin_employee_id}` : "unknown");
  const getJobLabel = (row: AuditRow) => (row.job_id ? jobNames[row.job_id] || row.job_id : "No job");

  const employeeOptions = useMemo<EmployeeOption[]>(() => {
    const seen = new Map<string, string>();
    rows.forEach((row) => {
      const key = getEmployeeKey(row);
      if (key === "unknown") return;
      seen.set(key, getEmployeeLabel(row));
    });
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [rows, profileNames, pinEmployeeNames]);

  const jobOptions = useMemo<JobOption[]>(() => {
    const seen = new Map<string, string>();
    rows.forEach((row) => {
      if (!row.job_id) return;
      seen.set(row.job_id, getJobLabel(row));
    });
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [rows, jobNames]);

  const availableActions = useMemo(() => {
    return Array.from(new Set(rows.map(getAction).filter(Boolean))).sort();
  }, [rows]);

  const availableOutcomes = useMemo(() => {
    return Array.from(new Set(rows.map(getOutcome).filter(Boolean))).sort();
  }, [rows]);

  const availableBlockReasons = useMemo(() => {
    return Array.from(new Set(rows.map(getBlockReason).filter(Boolean))).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (employeeFilter !== "all" && getEmployeeKey(row) !== employeeFilter) return false;
      if (jobFilter !== "all" && (row.job_id || "none") !== jobFilter) return false;
      if (blockReasonFilter !== "all" && getBlockReason(row) !== blockReasonFilter) return false;
      if (outcomeFilter !== "all" && getOutcome(row) !== outcomeFilter) return false;
      if (actionFilter !== "all" && getAction(row) !== actionFilter) return false;
      return true;
    });
  }, [rows, employeeFilter, jobFilter, blockReasonFilter, outcomeFilter, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const blocked = filteredRows.filter((r) => getOutcome(r) === "blocked");
    const byReason = (reason: string) => blocked.filter((r) => getBlockReason(r) === reason).length;
    const topEmployees = Array.from(
      blocked.reduce((m, r) => {
        const key = getEmployeeKey(r);
        m.set(key, (m.get(key) || 0) + 1);
        return m;
      }, new Map<string, number>())
    )
      .filter(([k]) => k !== "unknown")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({
        key,
        count,
        label: employeeOptions.find((e) => e.value === key)?.label || key,
      }));

    return {
      blockedTotal: blocked.length,
      outOfRange: byReason("out_of_range"),
      missingJobCoordinates: byReason("job_missing_coordinates"),
      locationUnavailable: byReason("location_unavailable") + byReason("location_permission_denied") + byReason("location_timeout"),
      topEmployees,
    };
  }, [filteredRows, employeeOptions]);

  const exportCsv = () => {
    const headers = [
      "Timestamp",
      "Employee",
      "Employee Type",
      "Action",
      "Outcome",
      "Block Reason",
      "Job",
      "Distance (m)",
      "Allowed Limit (m)",
    ];

    const lines = filteredRows.map((r) => [
      r.created_at,
      getEmployeeLabel(r),
      r.user_id ? "user" : r.pin_employee_id ? "pin" : "unknown",
      getAction(r),
      getOutcome(r),
      getBlockReason(r),
      getJobLabel(r),
      getDistance(r) ?? "",
      getAllowedLimit(r) ?? "",
    ]);

    const csv = [headers, ...lines]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `punch-clock-attempt-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium">Access Restricted</p>
                <p className="text-sm text-muted-foreground">
                  Admins and managers only can view Punch Clock attempt audit events.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/employees/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Punch Clock Attempt Audit</h1>
          <p className="text-muted-foreground mt-1">
            Blocked punch-in attempts and geofence-related audit events for {currentCompany?.display_name || currentCompany?.name || "current company"}
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filteredRows.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Newest first. Date range is server-filtered; other filters are applied client-side.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Date From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Date To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Employee</label>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger><SelectValue placeholder="All employees" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employeeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Job</label>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger><SelectValue placeholder="All jobs" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All jobs</SelectItem>
                  {jobOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Action</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {[...new Set([DEFAULT_ACTION, ...availableActions])].filter(Boolean).map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Outcome</label>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outcomes</SelectItem>
                  {[...new Set([DEFAULT_OUTCOME, ...availableOutcomes])].filter(Boolean).map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Block Reason</label>
              <Select value={blockReasonFilter} onValueChange={setBlockReasonFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reasons</SelectItem>
                  {[...new Set([...BLOCK_REASON_OPTIONS, ...availableBlockReasons])].filter(Boolean).map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Blocked Punch-ins</div><div className="text-2xl font-bold">{summary.blockedTotal}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Out of Range</div><div className="text-2xl font-bold">{summary.outOfRange}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Missing Job Coordinates</div><div className="text-2xl font-bold">{summary.missingJobCoordinates}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Location Unavailable</div><div className="text-2xl font-bold">{summary.locationUnavailable}</div></CardContent></Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground mb-1">Top Employees (Blocked)</div>
            {summary.topEmployees.length ? (
              <div className="space-y-1">
                {summary.topEmployees.slice(0, 3).map((e) => (
                  <div key={e.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{e.label}</span>
                    <Badge variant="outline">{e.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">None</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Attempt Events</CardTitle>
          <CardDescription>
            Showing {filteredRows.length} filtered row{filteredRows.length === 1 ? "" : "s"} ({rows.length} loaded / {totalCount} total in date range)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading attempt audit events…</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No punch clock attempts found for selected filters</p>
          ) : (
            <div className="space-y-3">
              <div className="max-h-[55vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Block Reason</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Distance ({distanceUnit === "feet" ? "ft" : "m"})</TableHead>
                      <TableHead className="text-right">Allowed ({distanceUnit === "feet" ? "ft" : "m"})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {row.created_at ? format(new Date(row.created_at), "MMM d, yyyy h:mm:ss a") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{getEmployeeLabel(row)}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.user_id ? "User" : row.pin_employee_id ? "PIN Employee" : "Unknown"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{getAction(row) || "—"}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={getOutcome(row) === "blocked" ? "destructive" : "secondary"}>
                            {getOutcome(row) || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[14rem] truncate">{getBlockReason(row) || "—"}</TableCell>
                        <TableCell className="max-w-[16rem] truncate">{getJobLabel(row)}</TableCell>
                        <TableCell className="text-right">
                          {getDistance(row) == null ? "—" : formatDistanceLabel(getDistance(row) as number, distanceUnit, { compact: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          {getAllowedLimit(row) == null ? "—" : formatDistanceLabel(getAllowedLimit(row) as number, distanceUnit, { compact: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
