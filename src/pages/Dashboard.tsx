import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import DashboardCustomizer from '@/components/DashboardCustomizer';
import { Receipt, Clock, CheckCircle, DollarSign, Settings, Bell, MessageSquare, X, FileText, AlertTriangle, Users, TrendingUp, BarChart3 } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useActionPermissions } from '@/hooks/useActionPermissions';
import { useDashboardPermissions } from '@/hooks/useDashboardPermissions';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';
import { canAccessAssignedJobOnly, canAccessJobIds } from '@/utils/jobAccess';
import BillsNeedingCoding from '@/components/BillsNeedingCoding';
import CreditCardCodingRequests from '@/components/CreditCardCodingRequests';
import UserAvatar from '@/components/UserAvatar';
import MessageThreadView from '@/components/MessageThreadView';
import {
  hydrateNonDirectMessageReadsFromServer,
  isNonDirectMessageReadStored,
  persistNonDirectMessageReadEverywhere,
} from '@/utils/nonDirectMessageRead';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

interface NotificationEntityContext {
  bids: Set<string>;
  rfps: Set<string>;
  jobs: Set<string>;
  invoices: Set<string>;
  companies: Set<string>;
}

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject: string;
  content: string;
  read: boolean;
  created_at: string;
  thread_id?: string;
  is_reply?: boolean;
  message_source?:
    | 'direct'
    | 'bill_communication'
    | 'receipt_message'
    | 'credit_card_transaction_communication'
    | 'bid_intercompany_communication';
  source_record_id?: string;
  target_path?: string;
  from_profile?: {
    display_name: string;
    avatar_url?: string | null;
  };
}

interface NotificationSettingsRow {
  in_app_enabled?: boolean | null;
  chat_channel_notifications?: boolean | null;
}

interface Job {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface DashboardSettings {
  show_stats: boolean;
  show_recent_activity: boolean;
  show_active_jobs: boolean;
  show_notifications: boolean;
  show_messages: boolean;
  show_bills: boolean;
  // Financial Management
  show_bills_overview: boolean;
  show_payment_status: boolean;
  show_invoice_summary: boolean;
  show_budget_tracking: boolean;
  // Time Tracking
  show_punch_clock_status: boolean;
  show_timesheet_approval: boolean;
  show_overtime_alerts: boolean;
  show_employee_attendance: boolean;
  // Project Management
  show_project_progress: boolean;
  show_task_deadlines: boolean;
  show_resource_allocation: boolean;
}

function ActiveJobsList() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      if (!currentCompany) return;
      
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, name, status, created_at')
          .eq('company_id', currentCompany.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        const visibleJobs = (data || []).filter((job) =>
          canAccessAssignedJobOnly([job.id], isPrivileged, allowedJobIds),
        );
        setJobs(visibleJobs);
      } catch (error) {
        console.error('Error fetching active jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!websiteJobAccessLoading) {
      fetchJobs();
    }
  }, [currentCompany, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Active Jobs
          <Badge variant="secondary">{jobs.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading || websiteJobAccessLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground"><span className="loading-dots">Loading</span></p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No active jobs</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-3 rounded-lg border bg-card hover:bg-primary/10 hover:border-primary cursor-pointer transition-colors"
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{job.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                </div>
              </div>
            ))}
            {jobs.length >= 10 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => navigate('/jobs')}
              >
                View All Jobs
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const { currentCompany, switchCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const permissions = useActionPermissions();
  const dashboardPermissions = useDashboardPermissions();
  const activeCompanyRole = useActiveCompanyRole();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showThreadView, setShowThreadView] = useState(false);
  const [jobTeamJobIds, setJobTeamJobIds] = useState<string[]>([]);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({
    show_stats: true,
    show_recent_activity: true,
    show_active_jobs: true,
    show_notifications: true,
    show_messages: true,
    show_bills: true,
    // Financial Management
    show_bills_overview: false,
    show_payment_status: false,
    show_invoice_summary: false,
    show_budget_tracking: false,
    // Time Tracking
    show_punch_clock_status: false,
    show_timesheet_approval: false,
    show_overtime_alerts: false,
    show_employee_attendance: false,
    // Project Management
    show_project_progress: false,
    show_task_deadlines: false,
    show_resource_allocation: false,
  });

  // Stats data
  const [uncodedReceiptsCount, setUncodedReceiptsCount] = useState(0);
  const [totalReceiptsCount, setTotalReceiptsCount] = useState(0);
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [pendingBillsTotal, setPendingBillsTotal] = useState(0);

  const isNonDirectMessageRead = (message: Pick<Message, "message_source" | "source_record_id" | "id">) => {
    if (!message.message_source || message.message_source === "direct") return false;
    return isNonDirectMessageReadStored(message, user?.id, currentCompany?.id);
  };

  const persistNonDirectMessageRead = (message: Pick<Message, "message_source" | "source_record_id" | "id">) => {
    if (!message.message_source || message.message_source === "direct") return;
    return persistNonDirectMessageReadEverywhere(message, user?.id, currentCompany?.id);
  };

  const wasMentionedInMessage = (content: string) => {
    if (!user) return false;
    const text = (content || "").toLowerCase();
    if (!text.includes("@")) return false;

    const nameTokens = new Set<string>();
    const displayName = (profile as any)?.display_name?.trim();
    const firstName = (profile as any)?.first_name?.trim();
    const lastName = (profile as any)?.last_name?.trim();
    const emailName = (user.email || "").split("@")[0]?.trim();

    if (displayName) nameTokens.add(displayName.toLowerCase());
    if (firstName) nameTokens.add(firstName.toLowerCase());
    if (lastName) nameTokens.add(lastName.toLowerCase());
    if (firstName && lastName) nameTokens.add(`${firstName} ${lastName}`.toLowerCase());
    if (emailName) nameTokens.add(emailName.toLowerCase());

    return Array.from(nameTokens).some((token) => text.includes(`@${token}`));
  };

  const extractNotificationEntityContext = (notification: Notification): NotificationEntityContext => {
    const rawType = String(notification.type || '').trim();
    const targetPath = rawType.startsWith('mention:')
      ? rawType.replace('mention:', '')
      : rawType.startsWith('/')
        ? rawType
        : '';

    const context: NotificationEntityContext = {
      bids: new Set<string>(),
      rfps: new Set<string>(),
      jobs: new Set<string>(),
      invoices: new Set<string>(),
      companies: new Set<string>(),
    };

    if (targetPath) {
      try {
        const targetUrl = new URL(targetPath, window.location.origin);
        const companyId = targetUrl.searchParams.get('company');
        if (companyId) context.companies.add(companyId);
      } catch {
        // Notification targets can be legacy type strings; ignore URL parsing failures.
      }
    }

    if (rawType.startsWith('bid:new:')) {
      const bidId = rawType.split(':')[2];
      if (bidId) context.bids.add(bidId);
    }

    const cleanedPath = targetPath.split('?')[0];
    const bidMatch = cleanedPath.match(/^\/construction\/bids\/([^/]+)/);
    if (bidMatch?.[1]) context.bids.add(bidMatch[1]);

    const rfpMatch = cleanedPath.match(/^\/construction\/rfps\/([^/]+)/);
    if (rfpMatch?.[1]) context.rfps.add(rfpMatch[1]);

    const jobMatch = cleanedPath.match(/^\/jobs\/([^/]+)/);
    if (jobMatch?.[1]) context.jobs.add(jobMatch[1]);

    const invoiceMatch = cleanedPath.match(/^\/(?:invoices|bills)\/([^/]+)/);
    if (invoiceMatch?.[1]) context.invoices.add(invoiceMatch[1]);

    return context;
  };

  const loadJobTeamJobIds = async (): Promise<string[]> => {
    if (!user || !currentCompany) return [];

    try {
      const [directoryRes, projectManagerRes, assistantPmRes, employeeSettingsRes] = await Promise.all([
        supabase
          .from('job_project_directory')
          .select('job_id')
          .eq('company_id', currentCompany.id)
          .eq('linked_user_id', user.id)
          .eq('is_active', true)
          .eq('is_project_team_member', true),
        supabase
          .from('jobs')
          .select('id')
          .eq('company_id', currentCompany.id)
          .eq('project_manager_user_id', user.id),
        supabase
          .from('job_assistant_managers')
          .select('job_id, jobs!inner(company_id)')
          .eq('user_id', user.id)
          .eq('jobs.company_id', currentCompany.id),
        supabase
          .from('employee_timecard_settings')
          .select('assigned_jobs')
          .eq('company_id', currentCompany.id)
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const teamJobIds = new Set<string>();

      (directoryRes.data || []).forEach((row: any) => {
        if (row?.job_id) teamJobIds.add(String(row.job_id));
      });

      (projectManagerRes.data || []).forEach((row: any) => {
        if (row?.id) teamJobIds.add(String(row.id));
      });

      (assistantPmRes.data || []).forEach((row: any) => {
        if (row?.job_id) teamJobIds.add(String(row.job_id));
      });

      (((employeeSettingsRes.data as any)?.assigned_jobs) || []).forEach((jobId: string) => {
        if (jobId) teamJobIds.add(String(jobId));
      });

      const nextJobIds = Array.from(teamJobIds);
      setJobTeamJobIds(nextJobIds);
      return nextJobIds;
    } catch (error) {
      console.error('Error loading job team membership:', error);
      setJobTeamJobIds([]);
      return [];
    }
  };

  useEffect(() => {
    if (user && currentCompany && !websiteJobAccessLoading) {
      void (async () => {
        await hydrateNonDirectMessageReadsFromServer(user.id, currentCompany.id);
        const freshJobTeamJobIds = await loadJobTeamJobIds();
        fetchNotifications(freshJobTeamJobIds);
        fetchMessages(freshJobTeamJobIds);
        fetchDashboardSettings();
        fetchDashboardStats();
      })();
    }
  }, [user, currentCompany, activeCompanyRole, profile?.role, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  const fetchDashboardStats = async () => {
    if (!currentCompany) return;

    try {
      // Fetch uncoded receipts count
      const { data: uncodedData, error: uncodedError } = await supabase
        .from('receipts')
        .select('id, job_id')
        .eq('company_id', currentCompany.id)
        .eq('status', 'uncoded');
      
      if (!uncodedError) {
        const visibleUncoded = (uncodedData || []).filter((row: any) =>
          canAccessJobIds([row.job_id], isPrivileged, allowedJobIds),
        );
        setUncodedReceiptsCount(visibleUncoded.length);
      }

      // Fetch total receipts count
      const { data: totalData, error: totalError } = await supabase
        .from('receipts')
        .select('id, job_id')
        .eq('company_id', currentCompany.id);
      
      if (!totalError) {
        const visibleReceipts = (totalData || []).filter((row: any) =>
          canAccessAssignedJobOnly([row.job_id], isPrivileged, allowedJobIds),
        );
        setTotalReceiptsCount(visibleReceipts.length);
      }

      // Fetch active jobs count
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('status', 'active');
      
      if (!jobsError) {
        const visibleJobs = (jobsData || []).filter((row: any) =>
          canAccessAssignedJobOnly([row.id], isPrivileged, allowedJobIds),
        );
        setActiveJobsCount(visibleJobs.length);
      }

      // Fetch pending bills total
      const { data: pendingBills, error: billsError } = await supabase
        .from('invoices')
        .select('amount, job_id, vendors!inner(company_id)')
        .eq('vendors.company_id', currentCompany.id)
        .in('status', ['pending_approval', 'pending_coding']);
      
      if (!billsError && pendingBills) {
        const visibleBills = pendingBills.filter((bill: any) =>
          canAccessAssignedJobOnly([bill.job_id], isPrivileged, allowedJobIds),
        );
        const total = visibleBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
        setPendingBillsTotal(total);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchNotifications = async (teamJobIdsOverride?: string[]) => {
    if (!user || !currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      const rawNotifications = (data || []) as Notification[];
      const notificationContexts = rawNotifications.map((notification) => ({
        notification,
        context: extractNotificationEntityContext(notification),
      }));

      const bidIds = Array.from(new Set(
        notificationContexts.flatMap(({ context }) => Array.from(context.bids))
      ));
      const rfpIds = Array.from(new Set(
        notificationContexts.flatMap(({ context }) => Array.from(context.rfps))
      ));
      const jobIds = Array.from(new Set(
        notificationContexts.flatMap(({ context }) => Array.from(context.jobs))
      ));
      const invoiceIds = Array.from(new Set(
        notificationContexts.flatMap(({ context }) => Array.from(context.invoices))
      ));

      const [bidsRes, rfpsRes, jobsRes, invoicesRes] = await Promise.all([
        bidIds.length > 0
          ? supabase
              .from('bids')
              .select('id, company_id, rfp:rfps!inner(job_id)')
              .in('id', bidIds)
          : Promise.resolve({ data: [], error: null }),
        rfpIds.length > 0
          ? supabase
              .from('rfps')
              .select('id, company_id, job_id')
              .in('id', rfpIds)
          : Promise.resolve({ data: [], error: null }),
        jobIds.length > 0
          ? supabase
              .from('jobs')
              .select('id, company_id')
              .in('id', jobIds)
          : Promise.resolve({ data: [], error: null }),
        invoiceIds.length > 0
          ? supabase
              .from('invoices')
              .select('id, company_id, job_id')
              .in('id', invoiceIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if ((bidsRes as any).error) throw (bidsRes as any).error;
      if ((rfpsRes as any).error) throw (rfpsRes as any).error;
      if ((jobsRes as any).error) throw (jobsRes as any).error;
      if ((invoicesRes as any).error) throw (invoicesRes as any).error;

      const bidMap = new Map<string, { company_id: string; job_id: string | null }>(
        (((bidsRes as any).data) || []).map((row: any) => [
          String(row.id),
          {
            company_id: String(row.company_id),
            job_id: row?.rfp?.job_id ? String(row.rfp.job_id) : null,
          },
        ]),
      );
      const rfpMap = new Map<string, { company_id: string; job_id: string | null }>(
        (((rfpsRes as any).data) || []).map((row: any) => [
          String(row.id),
          {
            company_id: String(row.company_id),
            job_id: row?.job_id ? String(row.job_id) : null,
          },
        ]),
      );
      const jobMap = new Map<string, { company_id: string }>(
        (((jobsRes as any).data) || []).map((row: any) => [
          String(row.id),
          { company_id: String(row.company_id) },
        ]),
      );
      const invoiceMap = new Map<string, { company_id: string; job_id: string | null }>(
        (((invoicesRes as any).data) || []).map((row: any) => [
          String(row.id),
          {
            company_id: String(row.company_id),
            job_id: row?.job_id ? String(row.job_id) : null,
          },
        ]),
      );

      const jobTeamJobIdSet = new Set(teamJobIdsOverride ?? jobTeamJobIds);
      const companyScopedNotifications = notificationContexts.filter(({ notification, context }) => {
        const hasScopedEntity =
          context.bids.size > 0 ||
          context.rfps.size > 0 ||
          context.jobs.size > 0 ||
          context.invoices.size > 0 ||
          context.companies.size > 0;

        if (!hasScopedEntity) {
          return true;
        }

        const bidEntries = Array.from(context.bids).map((bidId) => bidMap.get(bidId)).filter(Boolean);
        const rfpEntries = Array.from(context.rfps).map((rfpId) => rfpMap.get(rfpId)).filter(Boolean);
        const jobEntries = Array.from(context.jobs).map((jobId) => ({
          company_id: jobMap.get(jobId)?.company_id,
          job_id: jobId,
        })).filter((entry) => Boolean(entry.company_id));
        const invoiceEntries = Array.from(context.invoices).map((invoiceId) => invoiceMap.get(invoiceId)).filter(Boolean);
        const companyEntries = Array.from(context.companies).map((companyId) => ({
          company_id: companyId,
          job_id: null,
        }));

        const scopedEntries = [...bidEntries, ...rfpEntries, ...jobEntries, ...invoiceEntries, ...companyEntries] as Array<{ company_id: string; job_id: string | null | undefined }>;

        if (scopedEntries.length === 0) {
          return false;
        }

        const inCurrentCompany = scopedEntries.some((entry) => entry.company_id === currentCompany.id);
        if (!inCurrentCompany) {
          return false;
        }

        const requiresJobTeam = scopedEntries.some((entry) => entry.job_id);
        if (!requiresJobTeam) {
          return true;
        }

        return scopedEntries.some((entry) => entry.job_id && jobTeamJobIdSet.has(String(entry.job_id)));
      }).map(({ notification }) => notification);

      const approverRole = String(activeCompanyRole || profile?.role || '').toLowerCase();
      const canApproveIntake = ['admin', 'company_admin', 'owner', 'controller', 'super_admin'].includes(approverRole);
      // Legacy intake notifications are noisy/stale; rely on live intake summary instead.
      let baseNotifications = companyScopedNotifications.filter((notification) => {
        const rawType = String(notification.type || '').trim().toLowerCase();
        return rawType !== 'intake_queue' && rawType !== 'intake_queue_summary';
      });

      // Hide stale intake notifications for users who are no longer pending approval.
      if (currentCompany) {
        const intakeUserIds = Array.from(new Set(
          baseNotifications
            .map((notification) => {
              const type = String(notification.type || '');
              if (!type.startsWith('intake_queue:')) return null;
              const [, pendingUserId] = type.split(':');
              return pendingUserId || null;
            })
            .filter(Boolean) as string[],
        ));

        if (intakeUserIds.length > 0) {
          const { data: pendingRequests } = await supabase
            .from('company_access_requests')
            .select('user_id')
            .eq('company_id', currentCompany.id)
            .eq('status', 'pending')
            .in('user_id', intakeUserIds);

          const requestPendingSet = new Set((pendingRequests || []).map((row: any) => row.user_id));
          const requestPendingIds = Array.from(requestPendingSet);

          let pendingUserIdSet = requestPendingSet;
          if (requestPendingIds.length > 0) {
            const { data: pendingProfiles } = await supabase
              .from('profiles')
              .select('user_id')
              .eq('status', 'pending')
              .in('user_id', requestPendingIds);
            pendingUserIdSet = new Set((pendingProfiles || []).map((row: any) => row.user_id));
          }

          baseNotifications = baseNotifications.filter((notification) => {
            const type = String(notification.type || '');
            if (!type.startsWith('intake_queue:')) return true;
            const [, pendingUserId] = type.split(':');
            return !!pendingUserId && pendingUserIdSet.has(pendingUserId);
          });
        }
      }

      if (!currentCompany || !canApproveIntake) {
        setNotifications(baseNotifications.slice(0, 5));
        return;
      }

      const { data: settingsRow } = await supabase
        .from('notification_settings')
        .select('in_app_enabled, intake_queue_requests')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      const inAppEnabled = (settingsRow as any)?.in_app_enabled !== false;
      const intakeEnabled = (settingsRow as any)?.intake_queue_requests !== false;

      if (!inAppEnabled || !intakeEnabled) {
        setNotifications(baseNotifications.slice(0, 5));
        return;
      }

      const { data: pendingRows, error: pendingRowsError } = await supabase
        .from('company_access_requests')
        .select('id, user_id')
        .eq('company_id', currentCompany.id)
        .eq('status', 'pending');

      if (pendingRowsError) throw pendingRowsError;

      const pendingUserIds = Array.from(new Set((pendingRows || []).map((r: any) => r.user_id).filter(Boolean)));
      let pendingCount = 0;

      if (pendingUserIds.length > 0) {
        const { data: pendingProfiles, error: pendingProfilesError } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('status', 'pending')
          .in('user_id', pendingUserIds);

        if (pendingProfilesError) throw pendingProfilesError;
        const pendingProfileSet = new Set((pendingProfiles || []).map((p: any) => p.user_id));
        pendingCount = (pendingRows || []).filter((row: any) => pendingProfileSet.has(row.user_id)).length;
      }

      const hasPendingIntake = pendingCount > 0;
      if (!hasPendingIntake) {
        setNotifications(baseNotifications.slice(0, 5));
        return;
      }

      const summaryNotification: Notification = {
        id: 'intake-queue-summary',
        title: 'Intake Queue Pending',
        message: `${pendingCount} user${pendingCount === 1 ? '' : 's'} waiting for approval in Intake Queue.`,
        type: 'intake_queue_summary',
        read: false,
        created_at: new Date().toISOString(),
      };

      setNotifications([summaryNotification, ...baseNotifications].slice(0, 5));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchMessages = async (teamJobIdsOverride?: string[]) => {
    if (!user || !currentCompany) return;
    
    try {
      // Fetch direct messages
      const { data: directMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('to_user_id', user.id)
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (messagesError) throw messagesError;

      const { data: notificationSettings } = await supabase
        .from('notification_settings')
        .select('in_app_enabled, chat_channel_notifications')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      const showMentionedNonDirectMessages =
        (notificationSettings as NotificationSettingsRow | null)?.in_app_enabled !== false &&
        (notificationSettings as NotificationSettingsRow | null)?.chat_channel_notifications !== false;
      
      // Fetch bill communications for dashboard
      const { data: billComms, error: billCommsError } = await supabase
        .from('bill_communications')
        .select('id, bill_id, user_id, message, created_at, invoices!inner(id, status, company_id)')
        .eq('company_id', currentCompany.id)
        .eq('invoices.company_id', currentCompany.id)
        // Hide messages for bills that are fully closed out (e.g. paid/processed).
        .in('invoices.status', ['pending', 'pending_approval', 'pending_coding', 'approved', 'pending_payment'])
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (billCommsError) {
        console.error('Error fetching messages:', billCommsError);
      }

      // Fetch receipt messages for dashboard
      const { data: receiptComms, error: receiptCommsError } = await supabase
        .from('receipt_messages')
        .select('id, receipt_id, from_user_id, message, created_at, receipts!inner(company_id)')
        .eq('receipts.company_id', currentCompany.id)
        .neq('from_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (receiptCommsError) {
        console.error('Error fetching receipt messages:', receiptCommsError);
      }

      // Fetch credit card transaction communications for dashboard
      const { data: creditCardComms, error: creditCardCommsError } = await supabase
        .from('credit_card_transaction_communications')
        .select(`
          id,
          transaction_id,
          user_id,
          message,
          created_at,
          credit_card_transactions!inner(credit_card_id)
        `)
        .eq('company_id', currentCompany.id)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (creditCardCommsError) {
        console.error('Error fetching credit card communications:', creditCardCommsError);
      }

      // Fetch bid intercompany communications (team notes) for dashboard
      const { data: bidTeamComms, error: bidTeamCommsError } = await supabase
        .from('bid_communications')
        .select(`
          id,
          bid_id,
          user_id,
          message,
          created_at,
          bids!inner(
            id,
            company_id,
            rfp:rfps!inner(job_id)
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('message_type', 'intercompany')
        .eq('bids.company_id', currentCompany.id)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (bidTeamCommsError) {
        console.error('Error fetching bid team communications:', bidTeamCommsError);
      }
      
      // Fetch profiles separately for bill communications
      const billCommsWithProfiles = await Promise.all(
        (billComms || []).map(async (msg: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, first_name, last_name, avatar_url')
            .eq('user_id', msg.user_id)
            .single();
          return { ...msg, profiles: profile };
        })
      );

      // Fetch profiles separately for receipt messages
      const receiptCommsWithProfiles = await Promise.all(
        (receiptComms || []).map(async (msg: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, first_name, last_name, avatar_url')
            .eq('user_id', msg.from_user_id)
            .single();
          return { ...msg, profiles: profile };
        })
      );

      // Fetch profiles separately for credit card transaction communications
      const creditCardCommsWithProfiles = await Promise.all(
        (creditCardComms || []).map(async (msg: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, first_name, last_name, avatar_url')
            .eq('user_id', msg.user_id)
            .single();
          return { ...msg, profiles: profile };
        })
      );

      // Fetch profiles separately for bid team communications
      const bidTeamCommsWithProfiles = await Promise.all(
        (bidTeamComms || []).map(async (msg: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, first_name, last_name, avatar_url')
            .eq('user_id', msg.user_id)
            .single();
          return { ...msg, profiles: profile };
        })
      );

      // Fetch sender profiles for direct messages
      const messagesWithProfiles = await Promise.all(
        (directMessages || []).map(async (message) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', message.from_user_id)
            .single();
          
          return {
            ...message,
            message_source: 'direct' as const,
            from_profile: profile
          };
        })
      );

      // Format bill communications
      const formattedBillComms = (billCommsWithProfiles || [])
        .filter((comm: any) => showMentionedNonDirectMessages && wasMentionedInMessage(comm.message || ""))
        .map((comm: any) => ({
        id: comm.id,
        from_user_id: comm.user_id,
        to_user_id: user.id,
        subject: `Bill Discussion`,
        content: comm.message,
        created_at: comm.created_at,
        read: isNonDirectMessageRead({
          id: comm.id,
          message_source: 'bill_communication',
          source_record_id: comm.id,
        }),
        is_reply: false,
        message_source: 'bill_communication' as const,
        source_record_id: comm.id,
        target_path: `/invoices/${comm.bill_id}`,
        from_profile: {
          display_name: comm.profiles?.display_name || 
            `${comm.profiles?.first_name || ''} ${comm.profiles?.last_name || ''}`.trim() || 
            'Team Member',
          avatar_url: comm.profiles?.avatar_url || null,
        }
      }));

      // Format receipt messages
      const formattedReceiptComms = (receiptCommsWithProfiles || [])
        .filter((comm: any) => showMentionedNonDirectMessages && wasMentionedInMessage(comm.message || ""))
        .map((comm: any) => ({
        id: comm.id,
        from_user_id: comm.from_user_id,
        to_user_id: user.id,
        subject: `Receipt Coding`,
        content: comm.message,
        created_at: comm.created_at,
        read: isNonDirectMessageRead({
          id: comm.id,
          message_source: 'receipt_message',
          source_record_id: comm.id,
        }),
        is_reply: false,
        message_source: 'receipt_message' as const,
        source_record_id: comm.id,
        target_path: `/uncoded?receiptId=${encodeURIComponent(comm.receipt_id)}`,
        from_profile: {
          display_name: comm.profiles?.display_name ||
            `${comm.profiles?.first_name || ''} ${comm.profiles?.last_name || ''}`.trim() ||
            'Team Member',
          avatar_url: comm.profiles?.avatar_url || null,
        }
      }));

      // Format credit card transaction communications
      const formattedCreditCardComms = (creditCardCommsWithProfiles || [])
        .filter((comm: any) => showMentionedNonDirectMessages && wasMentionedInMessage(comm.message || ""))
        .map((comm: any) => {
        const creditCardId = Array.isArray(comm.credit_card_transactions)
          ? comm.credit_card_transactions[0]?.credit_card_id
          : comm.credit_card_transactions?.credit_card_id;
        return {
          id: comm.id,
          from_user_id: comm.user_id,
          to_user_id: user.id,
          subject: `Credit Card Coding`,
          content: comm.message,
          created_at: comm.created_at,
          read: isNonDirectMessageRead({
            id: comm.id,
            message_source: 'credit_card_transaction_communication',
            source_record_id: comm.id,
          }),
          is_reply: false,
          message_source: 'credit_card_transaction_communication' as const,
          source_record_id: comm.id,
          target_path: creditCardId
            ? `/payables/credit-cards/${creditCardId}/transactions?transactionId=${encodeURIComponent(comm.transaction_id)}`
            : '/payables/credit-cards',
          from_profile: {
            display_name: comm.profiles?.display_name ||
              `${comm.profiles?.first_name || ''} ${comm.profiles?.last_name || ''}`.trim() ||
              'Team Member',
            avatar_url: comm.profiles?.avatar_url || null,
          }
        };
      });

      // Format bid team communications (only users connected to the bid's job)
      const jobTeamJobIdSet = new Set(teamJobIdsOverride ?? jobTeamJobIds);
      const formattedBidTeamComms = (bidTeamCommsWithProfiles || [])
        .filter((comm: any) => {
          const jobId = comm?.bids?.rfp?.job_id || null;
          return !!jobId && jobTeamJobIdSet.has(String(jobId));
        })
        .filter((comm: any) => showMentionedNonDirectMessages && wasMentionedInMessage(comm.message || ""))
        .map((comm: any) => ({
          id: comm.id,
          from_user_id: comm.user_id,
          to_user_id: user.id,
          subject: `Bid Team Notes`,
          content: comm.message,
          created_at: comm.created_at,
          read: isNonDirectMessageRead({
            id: comm.id,
            message_source: 'bid_intercompany_communication',
            source_record_id: comm.id,
          }),
          is_reply: false,
          message_source: 'bid_intercompany_communication' as const,
          source_record_id: comm.id,
          target_path: `/construction/bids/${comm.bid_id}?messageId=${encodeURIComponent(comm.id)}&messageSource=bid_intercompany_communication`,
          from_profile: {
            display_name: comm.profiles?.display_name ||
              `${comm.profiles?.first_name || ''} ${comm.profiles?.last_name || ''}`.trim() ||
              'Team Member',
            avatar_url: comm.profiles?.avatar_url || null,
          }
        }));
      
      // Combine and sort by date
      const allMessages = [
        ...messagesWithProfiles,
        ...formattedBillComms,
        ...formattedReceiptComms,
        ...formattedCreditCardComms,
        ...formattedBidTeamComms,
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      setMessages(allMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const openMessageThread = (message: Message) => {
    setSelectedMessage(message);
    setShowThreadView(true);
  };

  const markLocalMessageRead = async (message: Message) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, read: true } : m)),
    );
    await persistNonDirectMessageRead(message);
  };

  const closeMessageThread = () => {
    setShowThreadView(false);
    setSelectedMessage(null);
  };

  const fetchDashboardSettings = async () => {
    if (!user || !currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('dashboard_settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setDashboardSettings({
          show_stats: data.show_stats,
          show_recent_activity: data.show_recent_activity,
          show_active_jobs: data.show_active_jobs,
          show_notifications: data.show_notifications,
          show_messages: data.show_messages,
          show_bills: data.show_invoices ?? true,
          // Financial Management
          show_bills_overview: data.show_bills_overview ?? false,
          show_payment_status: data.show_payment_status ?? false,
          show_invoice_summary: data.show_invoice_summary ?? false,
          show_budget_tracking: data.show_budget_tracking ?? false,
          // Time Tracking
          show_punch_clock_status: data.show_punch_clock_status ?? false,
          show_timesheet_approval: data.show_timesheet_approval ?? false,
          show_overtime_alerts: data.show_overtime_alerts ?? false,
          show_employee_attendance: data.show_employee_attendance ?? false,
          // Project Management
          show_project_progress: data.show_project_progress ?? false,
          show_task_deadlines: data.show_task_deadlines ?? false,
          show_resource_allocation: data.show_resource_allocation ?? false,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard settings:', error);
    }
  };

  const updateDashboardSettings = async (settings: Partial<DashboardSettings>) => {
    if (!user || !currentCompany) return;
    
    try {
      const { error } = await supabase
        .from('dashboard_settings')
        .upsert({
          user_id: user.id,
          company_id: currentCompany.id,
          ...dashboardSettings,
          ...settings,
        });

      if (error) throw error;
      
      setDashboardSettings(prev => ({ ...prev, ...settings }));
      toast({
        title: 'Settings Updated',
        description: 'Dashboard preferences saved successfully',
      });
    } catch (error) {
      console.error('Error updating dashboard settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update dashboard settings',
        variant: 'destructive',
      });
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    if (notificationId === 'intake-queue-summary') {
      navigate('/settings/users');
      return;
    }
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getNotificationPath = (notification: Notification): string | null => {
    const rawType = String(notification.type || '').trim();
    const loweredType = rawType.toLowerCase();
    const title = String(notification.title || '');
    const message = String(notification.message || '');
    const combined = `${title} ${message}`.toLowerCase();

    if (notification.id === 'intake-queue-summary') return '/settings/users?tab=intake-queue';
    if (loweredType === 'intake_queue') {
      return '/settings/users?tab=intake-queue';
    }
    if (rawType.startsWith('intake_queue:')) {
      const [, pendingUserId] = rawType.split(':');
      if (pendingUserId) return `/settings/users/${pendingUserId}`;
      return '/settings/users?tab=intake-queue';
    }
    if (rawType.startsWith('mention:')) {
      return rawType.replace('mention:', '') || null;
    }

    // Backward compatibility: allow notifications.type to be a direct app path.
    if (rawType.startsWith('/')) {
      return rawType;
    }

    // Known communication-related notification fallbacks.
    if (loweredType.includes('message') || loweredType.includes('chat')) {
      return '/team-chat';
    }
    if (combined.includes('team chat') || combined.includes('mentioned you')) {
      return '/team-chat';
    }
    if (combined.includes('direct message') || combined.includes('new message')) {
      return '/messages';
    }
    if (loweredType.includes('bill') || combined.includes('bill discussion') || combined.includes('invoice')) {
      return '/invoices';
    }
    if (loweredType.includes('task') || combined.includes('task')) {
      return '/tasks';
    }
    return null;
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }
    const targetPath = getNotificationPath(notification);
    if (targetPath) {
      try {
        const targetUrl = new URL(targetPath, window.location.origin);
        const targetCompanyId = targetUrl.searchParams.get('company');
        if (targetCompanyId && targetCompanyId !== currentCompany?.id) {
          await switchCompany(targetCompanyId);
        }
      } catch {
        // Relative paths without query context can navigate normally.
      }
      navigate(targetPath);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message?.message_source && message.message_source !== 'direct') {
      await markLocalMessageRead(message);
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId);

      if (error) throw error;
      
      setMessages(prev => 
        prev.map(m => m.id === messageId ? { ...m, read: true } : m)
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const markConversationAsRead = async (message: Message) => {
    if (!user) return;
    if (message.message_source && message.message_source !== 'direct') {
      await markLocalMessageRead(message);
      return;
    }

    const senderId = message.from_user_id;

    try {
      // Mark all unread direct messages from this sender as read for current user.
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('from_user_id', senderId)
        .eq('to_user_id', user.id)
        .eq('read', false);

      // Immediately clear unread entries from this sender in dashboard state.
      setMessages((prev) =>
        prev.map((m) =>
          m.from_user_id === senderId && m.to_user_id === user.id
            ? { ...m, read: true }
            : m
        )
      );
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  const unreadMessages = messages.filter((m) => !m.read);

  const getMessageBadgeLabel = (message: Message): string => {
    switch (message.message_source) {
      case 'bill_communication':
        return 'Bill Discussion';
      case 'receipt_message':
        return 'Receipt Coding';
      case 'credit_card_transaction_communication':
        return 'CC Coding';
      case 'bid_intercompany_communication':
        return 'Bid Team Notes';
      case 'direct':
      default:
        return 'Direct Message';
    }
  };

  // Filter stats based on permissions
  const allStats = [
    {
      title: "Uncoded Receipts",
      value: uncodedReceiptsCount.toString(),
      icon: Clock,
      variant: "warning" as const,
      href: "/uncoded",
      visible: permissions.canViewReceipts(),
    },
    {
      title: "Total Receipts",
      value: totalReceiptsCount.toString(),
      icon: Receipt,
      variant: "default" as const,
      href: "/receipts",
      visible: permissions.canViewReceipts(),
    },
    {
      title: "Active Jobs",
      value: activeJobsCount.toString(),
      icon: CheckCircle,
      variant: "secondary" as const,
      href: "/jobs",
      visible: permissions.canViewJobs(),
    },
    {
      title: "Pending Bills",
      value: `$${pendingBillsTotal.toFixed(2)}`,
      icon: DollarSign,
      variant: "destructive" as const,
      href: "/invoices",
      visible: permissions.canViewBills(),
    },
  ];

  const stats = allStats.filter(stat => stat.visible);

  const handleStatClick = (href: string) => {
    navigate(href);
  };

  return (
    <div className="p-6">
      {/* Welcome text always appears above banner when banner exists */}
      {settings.dashboardBanner && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {profile?.display_name || profile?.first_name || 'User'}! 👋
          </h1>
        </div>
      )}
      
      {settings.dashboardBanner && (
        <div className="mb-6 relative rounded-lg overflow-hidden">
          <img 
            src={settings.dashboardBanner} 
            alt="Dashboard Banner" 
            className="w-full h-48 object-cover"
          />
        </div>
      )}
      
      <div className="mb-6 flex items-center justify-between">
        {!settings.dashboardBanner && (
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {profile?.display_name || profile?.first_name || 'User'}! 👋
            </h1>
          </div>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Customize
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dashboard Settings</DialogTitle>
              <DialogDescription>
                Choose what sections you want to see on your dashboard
              </DialogDescription>
            </DialogHeader>
            <DashboardCustomizer 
              onSettingsChange={updateDashboardSettings}
              currentSettings={dashboardSettings}
            />
          </DialogContent>
        </Dialog>
      </div>

      {dashboardSettings.show_stats && dashboardPermissions.canViewSection('stats') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <Card 
              key={stat.title} 
              className="hover-stat animate-fade-in"
              onClick={() => handleStatClick(stat.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <Badge variant={stat.variant} className="mt-2">
                  {stat.variant === "warning" && "Needs Attention"}
                  {stat.variant === "secondary" && "Up to Date"}
                  {stat.variant === "destructive" && "Overdue"}
                  {stat.variant === "default" && "Active"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Notifications and Messages Row */}
      {((dashboardSettings.show_notifications && dashboardPermissions.canViewSection('notifications')) || 
        (dashboardSettings.show_messages && dashboardPermissions.canViewSection('messages'))) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {dashboardSettings.show_notifications && dashboardPermissions.canViewSection('notifications') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                  {notifications.filter(n => !n.read).length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {notifications.filter(n => !n.read).length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {notifications.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No notifications
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 rounded-lg border ${
                          !notification.read ? 'bg-accent' : 'bg-background'
                        } ${getNotificationPath(notification) ? 'cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{notification.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {!notification.read && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationAsRead(notification.id);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {dashboardSettings.show_messages && dashboardPermissions.canViewSection('messages') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Unread Messages
                  {unreadMessages.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {unreadMessages.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unreadMessages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No unread messages
                  </p>
                ) : (
                  <div className="space-y-2">
                    {unreadMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`px-3 py-2 rounded-lg border cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors ${
                          !message.read ? 'bg-accent/70 border-primary/30' : 'bg-background'
                        }`}
                        onClick={async () => {
                          await markConversationAsRead(message);
                          if (message.message_source === 'direct' || !message.message_source) {
                            openMessageThread(message);
                            return;
                          }

                          if (message.target_path) {
                            navigate(message.target_path);
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <UserAvatar
                            src={message.from_profile?.avatar_url || undefined}
                            name={message.from_profile?.display_name || "User"}
                            className="h-9 w-9 shrink-0"
                            fallbackClassName="text-xs"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium text-sm truncate">
                                    {message.from_profile?.display_name || 'Unknown'}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
                                    {getMessageBadgeLabel(message)}
                                  </Badge>
                                  {!message.read && (
                                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate mt-0.5">
                                  {message.content}
                                </p>
                              </div>
                              <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">
                                {new Date(message.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {!message.read && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 shrink-0"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await markMessageAsRead(message.id);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <MessageThreadView
        message={selectedMessage as any}
        isOpen={showThreadView}
        onClose={closeMessageThread}
        onMessageSent={fetchMessages}
      />

      {/* Bills Needing Approval or Coding - Show based on permissions */}
      {((dashboardPermissions.canViewSection('bills_overview') || dashboardPermissions.canViewSection('credit_card_coding')) && 
        (profile?.role === 'project_manager' || profile?.role === 'admin' || profile?.role === 'controller')) && (
        <div className="mb-8 space-y-4">
          {dashboardPermissions.canViewSection('bills_overview') && <BillsNeedingCoding limit={5} />}
          {dashboardPermissions.canViewSection('credit_card_coding') && <CreditCardCodingRequests />}
        </div>
      )}

      {/* Bill Management Section */}
      {dashboardSettings.show_bills && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Bill Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">No bill data to display</p>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" size="sm">
                  View All Bills
                </Button>
                <Button variant="outline" size="sm">
                  Create Bill
                </Button>
                <Button variant="outline" size="sm">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Follow Up Overdue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Financial Management Sections */}
      {dashboardSettings.show_bills_overview && dashboardPermissions.canViewSection('bills_overview') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bills Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-warning/10 p-4 rounded-lg">
                <h4 className="font-semibold text-warning">Pending Approval</h4>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Bills awaiting review</p>
              </div>
              <div className="bg-destructive/10 p-4 rounded-lg">
                <h4 className="font-semibold text-destructive">Overdue</h4>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Past due bills</p>
              </div>
              <div className="bg-success/10 p-4 rounded-lg">
                <h4 className="font-semibold text-success">Paid This Month</h4>
                <p className="text-2xl font-bold">$0</p>
                <p className="text-sm text-muted-foreground">Total processed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_payment_status && dashboardPermissions.canViewSection('payment_status') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-accent rounded-lg">
                <span>Total Outstanding</span>
                <span className="font-bold text-lg">$0.00</span>
              </div>
              <div className="flex justify-between items-center p-3 border rounded-lg">
                <span>Scheduled Payments</span>
                <span className="font-medium">0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_invoice_summary && dashboardPermissions.canViewSection('invoice_summary') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoice Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-primary">0</p>
                <p className="text-sm text-muted-foreground">Invoices Generated</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold text-success">$0</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_budget_tracking && dashboardPermissions.canViewSection('budget_tracking') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Budget Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Project Budget Utilization</span>
                  <span>0%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Tracking Sections */}
      {dashboardSettings.show_punch_clock_status && dashboardPermissions.canViewSection('punch_clock') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Punch Clock Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-success/10 p-4 rounded-lg">
                <h4 className="font-semibold text-success">Currently Punched In</h4>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Active employees</p>
              </div>
              <div className="bg-primary/10 p-4 rounded-lg">
                <h4 className="font-semibold text-primary">Total Hours Today</h4>
                <p className="text-2xl font-bold">0.0</p>
                <p className="text-sm text-muted-foreground">Company-wide</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => navigate("/punch-clock/dashboard")} variant="outline" className="flex-1">
                <Clock className="h-4 w-4 mr-2" />
                Punch Clock Dashboard
              </Button>
              <Button onClick={() => navigate("/time-sheets")} className="flex-1">
                <Clock className="h-4 w-4 mr-2" />
                Time Sheets
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_timesheet_approval && dashboardPermissions.canViewSection('timesheet_approval') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Timesheet Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-2xl font-bold text-warning">0</p>
              <p className="text-sm text-muted-foreground">Timesheets pending approval</p>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_overtime_alerts && dashboardPermissions.canViewSection('overtime_alerts') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Overtime Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Employees over 40hrs this week</span>
                <Badge variant="warning">0</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Overtime hours this week</span>
                <span className="font-medium">0.0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_employee_attendance && dashboardPermissions.canViewSection('employee_attendance') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-success">0</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
              <div>
                <p className="text-lg font-bold text-warning">0</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">0</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Management Sections */}
      {dashboardSettings.show_project_progress && dashboardPermissions.canViewSection('project_progress') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Project Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Active Projects</span>
                <span className="font-bold">0</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Completion</span>
                  <span>0%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-success h-2 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_task_deadlines && dashboardPermissions.canViewSection('task_deadlines') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Task Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-lg">
                <span>Overdue Tasks</span>
                <Badge variant="destructive">0</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-warning/10 rounded-lg">
                <span>Due This Week</span>
                <Badge variant="warning">0</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardSettings.show_resource_allocation && dashboardPermissions.canViewSection('resource_allocation') && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Resource Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <p className="text-lg font-bold">0</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <p className="text-lg font-bold">0%</p>
                <p className="text-xs text-muted-foreground">Utilization</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {((dashboardSettings.show_recent_activity) || 
        (dashboardSettings.show_active_jobs && dashboardPermissions.canViewSection('active_jobs'))) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dashboardSettings.show_recent_activity && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              </CardContent>
            </Card>
          )}

          {dashboardSettings.show_active_jobs && dashboardPermissions.canViewSection('active_jobs') && <ActiveJobsList />}
        </div>
      )}
    </div>
  );
}
