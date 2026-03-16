import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Link2,
  MapPin,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Briefcase,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type CalendarVisibility = "private" | "attendees" | "company" | "job";
type CalendarEventType = "meeting" | "site_visit" | "inspection" | "deadline" | "reminder" | "task" | "other";
type CalendarSyncState = "pending" | "synced" | "conflict" | "error";

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  visibility: CalendarVisibility;
  event_type: CalendarEventType;
  status: string;
  job_id: string | null;
  google_meet_url: string | null;
  create_google_meet: boolean;
  sync_state: CalendarSyncState;
  jobs?: {
    id: string;
    name: string;
    project_number: string | null;
  } | null;
};

type JobOption = {
  id: string;
  name: string;
  project_number: string | null;
};

type CalendarConnection = {
  id: string;
  provider_account_email: string | null;
  sync_enabled: boolean;
  meet_enabled: boolean;
  last_sync_at: string | null;
};

type EventFormState = {
  id: string | null;
  title: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  visibility: CalendarVisibility;
  eventType: CalendarEventType;
  jobId: string;
  createGoogleMeet: boolean;
};

const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "10:00";

const VISIBILITY_OPTIONS: Array<{ value: CalendarVisibility; label: string }> = [
  { value: "private", label: "Private" },
  { value: "attendees", label: "Attendees" },
  { value: "company", label: "Company" },
  { value: "job", label: "Project / Job" },
];

const EVENT_TYPE_OPTIONS: Array<{ value: CalendarEventType; label: string }> = [
  { value: "meeting", label: "Meeting" },
  { value: "site_visit", label: "Site Visit" },
  { value: "inspection", label: "Inspection" },
  { value: "deadline", label: "Deadline" },
  { value: "reminder", label: "Reminder" },
  { value: "task", label: "Task" },
  { value: "other", label: "Other" },
];

const getEmptyFormState = (selectedDate: Date): EventFormState => ({
  id: null,
  title: "",
  description: "",
  location: "",
  date: format(selectedDate, "yyyy-MM-dd"),
  startTime: DEFAULT_START_TIME,
  endTime: DEFAULT_END_TIME,
  allDay: false,
  visibility: "private",
  eventType: "meeting",
  jobId: "none",
  createGoogleMeet: false,
});

const toDateInputValue = (value: Date) => format(value, "yyyy-MM-dd");

const toTimeInputValue = (value: Date) => format(value, "HH:mm");

const getBadgeVariant = (eventType: CalendarEventType) => {
  switch (eventType) {
    case "deadline":
      return "warning";
    case "inspection":
      return "info";
    case "task":
      return "secondary";
    case "site_visit":
      return "outline";
    default:
      return "default";
  }
};

const buildLocalIso = (dateValue: string, timeValue: string) => new Date(`${dateValue}T${timeValue}:00`).toISOString();

export default function CalendarPage() {
  const { currentCompany, loading: companyLoading } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | CalendarVisibility>("all");
  const [syncFilter, setSyncFilter] = useState<"all" | CalendarSyncState>("all");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(getEmptyFormState(new Date()));

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const gridStart = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const gridEnd = useMemo(() => endOfWeek(monthEnd), [monthEnd]);
  const calendarDays = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridEnd, gridStart]);

  const fetchCalendarData = async () => {
    if (!currentCompany?.id || !user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const calendarQuery = (supabase as any)
        .from("calendar_events")
        .select("id,title,description,location,start_at,end_at,all_day,visibility,event_type,status,job_id,google_meet_url,create_google_meet,sync_state,jobs(id,name,project_number)")
        .eq("company_id", currentCompany.id)
        .eq("is_deleted", false)
        .gte("start_at", gridStart.toISOString())
        .lte("start_at", gridEnd.toISOString())
        .order("start_at", { ascending: true });

      const jobsQuery = (supabase as any)
        .from("jobs")
        .select("id,name,project_number")
        .eq("company_id", currentCompany.id)
        .order("name", { ascending: true });

      const connectionQuery = (supabase as any)
        .from("user_calendar_connections")
        .select("id,provider_account_email,sync_enabled,meet_enabled,last_sync_at")
        .eq("user_id", user.id)
        .eq("provider", "google")
        .maybeSingle();

      const [{ data: eventRows, error: eventError }, { data: jobRows, error: jobsError }, { data: connectionRow, error: connectionError }] =
        await Promise.all([calendarQuery, jobsQuery, connectionQuery]);

      if (eventError) throw eventError;
      if (jobsError) throw jobsError;
      if (connectionError) throw connectionError;

      setEvents((eventRows || []) as CalendarEvent[]);
      setJobs((jobRows || []) as JobOption[]);
      setConnection((connectionRow || null) as CalendarConnection | null);
    } catch (err: any) {
      console.error("Failed to load calendar data", err);
      setError(err?.message || "Unable to load the calendar right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCalendarData();
  }, [currentCompany?.id, user?.id, gridStart.getTime(), gridEnd.getTime()]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (visibilityFilter !== "all" && event.visibility !== visibilityFilter) return false;
      if (syncFilter !== "all" && event.sync_state !== syncFilter) return false;
      return true;
    });
  }, [events, syncFilter, visibilityFilter]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      const key = format(parseISO(event.start_at), "yyyy-MM-dd");
      const bucket = map.get(key) || [];
      bucket.push(event);
      map.set(key, bucket);
    }
    return map;
  }, [filteredEvents]);

  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter((event) => isSameDay(parseISO(event.start_at), selectedDate));
  }, [filteredEvents, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return filteredEvents
      .filter((event) => parseISO(event.end_at) >= now)
      .slice(0, 6);
  }, [filteredEvents]);

  const openCreateDialog = (date = selectedDate) => {
    setForm(getEmptyFormState(date));
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    const start = parseISO(event.start_at);
    const end = parseISO(event.end_at);
    setForm({
      id: event.id,
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      date: toDateInputValue(start),
      startTime: toTimeInputValue(start),
      endTime: toTimeInputValue(end),
      allDay: event.all_day,
      visibility: event.visibility,
      eventType: event.event_type,
      jobId: event.job_id || "none",
      createGoogleMeet: event.create_google_meet,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentCompany?.id || !user?.id) return;

    if (!form.title.trim()) {
      setFormError("Event title is required.");
      return;
    }

    if (form.visibility === "job" && form.jobId === "none") {
      setFormError("Select a job when using Project / Job visibility.");
      return;
    }

    const startAt = form.allDay ? buildLocalIso(form.date, "00:00") : buildLocalIso(form.date, form.startTime);
    const endAt = form.allDay ? buildLocalIso(form.date, "23:59") : buildLocalIso(form.date, form.endTime);

    if (new Date(endAt) < new Date(startAt)) {
      setFormError("End time must be after the start time.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        company_id: currentCompany.id,
        owner_user_id: user.id,
        created_by: user.id,
        updated_by: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        start_at: startAt,
        end_at: endAt,
        all_day: form.allDay,
        visibility: form.visibility,
        event_type: form.eventType,
        job_id: form.jobId === "none" ? null : form.jobId,
        create_google_meet: form.createGoogleMeet,
        sync_state: "pending",
      };

      if (form.id) {
        const { error: updateError } = await (supabase as any)
          .from("calendar_events")
          .update(payload)
          .eq("id", form.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await (supabase as any).from("calendar_events").insert(payload);
        if (insertError) throw insertError;
      }

      setDialogOpen(false);
      await fetchCalendarData();
      toast({
        title: form.id ? "Event updated" : "Event created",
        description: form.id ? "Your calendar event has been updated." : "Your calendar event has been added.",
      });
    } catch (err: any) {
      console.error("Failed to save calendar event", err);
      setFormError(err?.message || "Unable to save this event right now.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;

    setDeleting(true);
    setFormError(null);
    try {
      const { error: deleteError } = await (supabase as any)
        .from("calendar_events")
        .delete()
        .eq("id", form.id);
      if (deleteError) throw deleteError;

      setDialogOpen(false);
      await fetchCalendarData();
      toast({
        title: "Event deleted",
        description: "The calendar event has been removed.",
      });
    } catch (err: any) {
      console.error("Failed to delete calendar event", err);
      setFormError(err?.message || "Unable to delete this event right now.");
    } finally {
      setDeleting(false);
    }
  };

  if (companyLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading calendar...</div>;
  }

  if (!currentCompany) {
    return <div className="p-6 text-sm text-muted-foreground">Select a company to view calendar events.</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          </div>
          <p className="text-muted-foreground">
            Manage personal, company, and job-linked events for {currentCompany.display_name || currentCompany.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void fetchCalendarData()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setSettingsDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button onClick={() => openCreateDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
                  <CardDescription>Click a day to review events or start a new one.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth((value) => subMonths(value, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth((value) => addMonths(value, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Select value={visibilityFilter} onValueChange={(value) => setVisibilityFilter(value as "all" | CalendarVisibility)}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All visibility</SelectItem>
                    {VISIBILITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={syncFilter} onValueChange={(value) => setSyncFilter(value as "all" | CalendarSyncState)}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Sync status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sync states</SelectItem>
                    <SelectItem value="pending">Pending sync</SelectItem>
                    <SelectItem value="synced">Synced</SelectItem>
                    <SelectItem value="conflict">Conflict</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                  <div key={label} className="py-1">
                    {label}
                  </div>
                ))}
              </div>

              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => {
                    const dayKey = format(day, "yyyy-MM-dd");
                    const dayEvents = eventsByDay.get(dayKey) || [];

                    return (
                      <button
                        key={dayKey}
                        type="button"
                        onClick={() => setSelectedDate(day)}
                        onDoubleClick={() => {
                          setSelectedDate(day);
                          openCreateDialog(day);
                        }}
                        className={cn(
                          "min-h-[128px] rounded-xl border p-2 text-left transition hover:border-primary/40 hover:bg-accent/40",
                          !isSameMonth(day, currentMonth) && "bg-muted/30 text-muted-foreground",
                          isSameDay(day, selectedDate) && "border-primary bg-primary/5",
                          isToday(day) && "ring-1 ring-primary/30",
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className={cn("text-sm font-semibold", isToday(day) && "text-primary")}>
                            {format(day, "d")}
                          </span>
                          {dayEvents.length > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {dayEvents.length}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation();
                                setSelectedDate(day);
                                openEditDialog(event);
                              }}
                              className="rounded-md bg-background/80 px-2 py-1 text-[11px] leading-tight shadow-sm"
                            >
                              <div className="truncate font-medium">{event.title}</div>
                              <div className="truncate text-muted-foreground">
                                {event.all_day ? "All day" : format(parseISO(event.start_at), "h:mm a")}
                              </div>
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[11px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>{format(selectedDate, "EEEE, MMMM d")}</CardTitle>
                <CardDescription>{selectedDayEvents.length} event{selectedDayEvents.length === 1 ? "" : "s"} on this day</CardDescription>
              </div>
              <Button size="sm" onClick={() => openCreateDialog(selectedDate)}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDayEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No events scheduled. Double-click the date on the calendar or use Add to create one.
                </div>
              ) : (
                selectedDayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => openEditDialog(event)}
                    className="w-full rounded-xl border p-4 text-left transition hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{event.title}</h3>
                          <Badge variant={getBadgeVariant(event.event_type)}>{event.event_type.replace("_", " ")}</Badge>
                          <Badge variant="outline">{event.visibility}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {event.all_day ? "All day" : `${format(parseISO(event.start_at), "h:mm a")} - ${format(parseISO(event.end_at), "h:mm a")}`}
                          </span>
                          {event.jobs?.name && (
                            <span className="inline-flex items-center gap-1">
                              <Briefcase className="h-4 w-4" />
                              {event.jobs.project_number ? `${event.jobs.project_number} · ` : ""}
                              {event.jobs.name}
                            </span>
                          )}
                          {event.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {event.location}
                            </span>
                          )}
                        </div>
                        {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
                      </div>
                      {event.google_meet_url && (
                        <a
                          href={event.google_meet_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(clickEvent) => clickEvent.stopPropagation()}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          <Link2 className="h-4 w-4" />
                          Meet Link
                        </a>
                      )}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming</CardTitle>
              <CardDescription>The next events from the current filtered view.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events in this range.</p>
              ) : (
                upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      const start = parseISO(event.start_at);
                      setCurrentMonth(startOfMonth(start));
                      setSelectedDate(start);
                      openEditDialog(event);
                    }}
                    className="w-full rounded-lg border p-3 text-left transition hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {format(parseISO(event.start_at), "EEE, MMM d")}
                      {event.all_day ? " · All day" : ` · ${format(parseISO(event.start_at), "h:mm a")}`}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Event" : "New Event"}</DialogTitle>
            <DialogDescription>Create personal, shared, or job-linked events for your team.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="calendar-title">Title</Label>
              <Input
                id="calendar-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Site walk, design review, permit deadline..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="calendar-date">Date</Label>
                <Input
                  id="calendar-date"
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>All Day</Label>
                <div className="flex h-10 items-center gap-2 rounded-md border px-3">
                  <Checkbox
                    checked={form.allDay}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, allDay: checked === true }))}
                  />
                  <span className="text-sm text-muted-foreground">Hide start/end times for this event.</span>
                </div>
              </div>
            </div>

            {!form.allDay && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="calendar-start-time">Start Time</Label>
                  <Input
                    id="calendar-start-time"
                    type="time"
                    value={form.startTime}
                    onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="calendar-end-time">End Time</Label>
                  <Input
                    id="calendar-end-time"
                    type="time"
                    value={form.endTime}
                    onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Event Type</Label>
                <Select value={form.eventType} onValueChange={(value) => setForm((current) => ({ ...current, eventType: value as CalendarEventType }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Visibility</Label>
                <Select value={form.visibility} onValueChange={(value) => setForm((current) => ({ ...current, visibility: value as CalendarVisibility }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Linked Job</Label>
                <Select value={form.jobId} onValueChange={(value) => setForm((current) => ({ ...current, jobId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="No linked job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked job</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.project_number ? `${job.project_number} · ` : ""}
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="calendar-location">Location</Label>
                <Input
                  id="calendar-location"
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  placeholder="Office, jobsite, call details..."
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="calendar-description">Description</Label>
              <Textarea
                id="calendar-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Notes, agenda, prep items, or design review context."
              />
            </div>

            <div className="flex items-center gap-2 rounded-lg border p-3">
              <Checkbox
                checked={form.createGoogleMeet}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, createGoogleMeet: checked === true }))}
              />
              <div>
                <div className="text-sm font-medium">Request Google Meet link</div>
                <div className="text-sm text-muted-foreground">
                  The link will populate once the Google Calendar sync functions are deployed and connected.
                </div>
              </div>
            </div>

            {formError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}
          </div>

          <DialogFooter className="items-center justify-between gap-2 sm:justify-between">
            <div className="flex items-center gap-2">
              {form.id && (
                <Button variant="destructive" onClick={() => void handleDelete()} disabled={saving || deleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving || deleting}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving || deleting}>
                {saving ? "Saving..." : form.id ? "Save Changes" : "Create Event"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Calendar Settings</DialogTitle>
            <DialogDescription>
              Manage Google Calendar and future third-party calendar sync connections here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Card>
              <CardHeader>
                <CardTitle>Google Calendar</CardTitle>
                <CardDescription>Connection status for sync and Google Meet generation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {connection ? (
                  <>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium">{connection.provider_account_email || "Connected account"}</div>
                        <div className="text-muted-foreground">
                          {connection.sync_enabled ? "Sync enabled" : "Sync disabled"}
                          {connection.last_sync_at ? ` · Last sync ${format(parseISO(connection.last_sync_at), "MMM d, h:mm a")}` : ""}
                        </div>
                      </div>
                      <Badge variant={connection.sync_enabled ? "success" : "secondary"}>
                        {connection.sync_enabled ? "Connected" : "Paused"}
                      </Badge>
                    </div>
                    <div className="rounded-lg border border-dashed p-3 text-muted-foreground">
                      {connection.meet_enabled
                        ? "Google Meet links can be requested on meeting events. Server-side sync still needs to be deployed for links to populate automatically."
                        : "Google Meet creation is disabled for this account."}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed p-3 text-muted-foreground">
                    No Google Calendar account is connected yet. OAuth connection and sync controls can be built here next.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Roadmap</CardTitle>
                <CardDescription>Reserved for future calendar sync setup.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-lg border border-dashed p-4">
                  This settings area is now the home for Google Calendar, Outlook, Apple Calendar, default sync direction, default calendar selection, and sync conflict handling.
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
