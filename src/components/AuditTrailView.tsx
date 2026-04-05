import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { History, User, Edit, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCompanyDateTime } from '@/utils/companyTimeZone';

interface AuditTrailEntry {
  id: string;
  change_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  reason?: string;
  created_at: string;
  changed_by: string;
  profiles?: {
    display_name: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

interface ChangeRequestSummary {
  id: string;
  requested_at?: string;
  created_at?: string;
  original_punch_in_time?: string | null;
  original_punch_out_time?: string | null;
  original_job_id?: string | null;
  original_cost_code_id?: string | null;
  proposed_punch_in_time?: string | null;
  proposed_punch_out_time?: string | null;
  proposed_job_id?: string | null;
  proposed_cost_code_id?: string | null;
}

interface AuditTrailViewProps {
  timeCardId: string;
}

export default function AuditTrailView({ timeCardId }: AuditTrailViewProps) {
  const { settings } = useSettings();
  const companyTimeZone = settings.timeZone;
  const [auditEntries, setAuditEntries] = useState<AuditTrailEntry[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequestSummary[]>([]);
  const [jobs, setJobs] = useState<Record<string, { name: string }>>({});
  const [costCodes, setCostCodes] = useState<Record<string, { code: string; description: string }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (timeCardId) {
      loadAuditTrail();
    }
  }, [timeCardId]);

  const loadAuditTrail = async () => {
    if (!timeCardId) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('time_card_audit_trail')
        .select(`
          *
        `)
        .eq('time_card_id', timeCardId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading audit trail:', error);
        return;
      }

      // Manually fetch display names and avatars for changed_by users from both profiles and PIN employees
      const changedByIds = Array.from(new Set(data?.map(entry => entry.changed_by).filter(Boolean))) as string[];
      let nameMap: Record<string, { display_name: string; first_name?: string; last_name?: string; avatar_url?: string }> = {};

      if (changedByIds.length > 0) {
        const profilesRes = await supabase.from('profiles').select('user_id, display_name, first_name, last_name, avatar_url').in('user_id', changedByIds);

        if (profilesRes.data) {
          profilesRes.data.forEach((p) => {
            nameMap[p.user_id] = { 
              display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown User',
              first_name: p.first_name,
              last_name: p.last_name,
              avatar_url: p.avatar_url
            };
          });
        }
      }

      // Combine audit entries with name data
      const entriesWithProfiles = (data || []).map(entry => ({
        ...entry,
        profiles: nameMap[entry.changed_by] || { display_name: 'Unknown User', avatar_url: undefined }
      }));

      setAuditEntries(entriesWithProfiles);

      const { data: timeCardData } = await supabase
        .from('time_cards')
        .select('job_id, cost_code_id, company_id')
        .eq('id', timeCardId)
        .maybeSingle();

      const { data: changeRequestData } = await supabase
        .from('time_card_change_requests')
        .select('id, requested_at, created_at, original_punch_in_time, original_punch_out_time, original_job_id, original_cost_code_id, proposed_punch_in_time, proposed_punch_out_time, proposed_job_id, proposed_cost_code_id')
        .eq('time_card_id', timeCardId)
        .order('requested_at', { ascending: false })
        .order('created_at', { ascending: false });

      setChangeRequests(changeRequestData || []);

      const jobIds = Array.from(
        new Set(
          [
            timeCardData?.job_id,
            ...(changeRequestData || []).map((request) => request.original_job_id),
            ...(changeRequestData || []).map((request) => request.proposed_job_id),
            ...((data || []).flatMap((entry) => [entry.old_value, entry.new_value])),
          ].filter((value): value is string => Boolean(value) && /^[0-9a-f-]{36}$/i.test(String(value)))
        )
      );

      const costCodeIds = Array.from(
        new Set(
          [
            timeCardData?.cost_code_id,
            ...(changeRequestData || []).map((request) => request.original_cost_code_id),
            ...(changeRequestData || []).map((request) => request.proposed_cost_code_id),
            ...((data || []).flatMap((entry) => [entry.old_value, entry.new_value])),
          ].filter((value): value is string => Boolean(value) && /^[0-9a-f-]{36}$/i.test(String(value)))
        )
      );

      if (jobIds.length > 0) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, name')
          .in('id', jobIds);
        const jobMap: Record<string, { name: string }> = {};
        (jobsData || []).forEach((job) => {
          jobMap[job.id] = { name: job.name };
        });
        setJobs(jobMap);
      } else {
        setJobs({});
      }

      if (costCodeIds.length > 0) {
        const { data: costCodeData } = await supabase
          .from('cost_codes')
          .select('id, code, description')
          .in('id', costCodeIds);
        const costCodeMap: Record<string, { code: string; description: string }> = {};
        (costCodeData || []).forEach((costCode) => {
          costCodeMap[costCode.id] = {
            code: costCode.code,
            description: costCode.description,
          };
        });
        setCostCodes(costCodeMap);
      } else {
        setCostCodes({});
      }
    } catch (error) {
      console.error('Error loading audit trail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'update':
        return <Edit className="h-4 w-4 text-blue-500" />;
      case 'approve':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'reject':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <History className="h-4 w-4 text-gray-500" />;
    }
  };

  const getChangeTypeBadge = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return <Badge variant="default">Created</Badge>;
      case 'update':
        return <Badge variant="secondary">Updated</Badge>;
      case 'approve':
      case 'approved':
        return <Badge variant="default">Approved</Badge>;
      case 'reject':
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'change_requested':
        return <Badge className="bg-amber-500">Change Requested</Badge>;
      case 'change_request_approved':
        return <Badge className="bg-green-500">Change Approved</Badge>;
      case 'change_request_rejected':
        return <Badge variant="destructive">Change Denied</Badge>;
      default:
        return <Badge variant="outline">{changeType.replace(/_/g, ' ')}</Badge>;
    }
  };

  const formatFieldName = (fieldName?: string) => {
    if (!fieldName) return '';
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDateTime = (dateTime: string) => {
    return formatCompanyDateTime(dateTime, companyTimeZone);
  };

  const getClosestChangeRequest = (createdAt: string) => {
    if (changeRequests.length === 0) return null;

    const target = new Date(createdAt).getTime();
    return changeRequests.reduce<ChangeRequestSummary | null>((closest, request) => {
      const requestTime = new Date(request.requested_at || request.created_at || createdAt).getTime();
      if (!closest) return request;
      const closestTime = new Date(closest.requested_at || closest.created_at || createdAt).getTime();
      return Math.abs(requestTime - target) < Math.abs(closestTime - target) ? request : closest;
    }, null);
  };

  const getRequestedChanges = (request: ChangeRequestSummary | null) => {
    if (!request) return [];

    const changes: Array<{ label: string; value: string }> = [];

    if (request.proposed_punch_in_time) {
      changes.push({
        label: 'Requested Punch In',
        value: formatCompanyDateTime(request.proposed_punch_in_time, companyTimeZone),
      });
    }

    if (request.proposed_punch_out_time) {
      changes.push({
        label: 'Requested Punch Out',
        value: formatCompanyDateTime(request.proposed_punch_out_time, companyTimeZone),
      });
    }

    if (request.proposed_job_id) {
      const proposedJobName = jobs[request.proposed_job_id]?.name || request.proposed_job_id;
      changes.push({
        label: 'Requested Job',
        value: proposedJobName,
      });
    }

    if (request.proposed_cost_code_id) {
      const proposedCostCode = costCodes[request.proposed_cost_code_id];
      changes.push({
        label: 'Requested Cost Code',
        value: proposedCostCode
          ? `${proposedCostCode.code} - ${proposedCostCode.description}`
          : request.proposed_cost_code_id,
      });
    }

    return changes;
  };

  const formatAuditValue = (fieldName: string | undefined, value: string | undefined) => {
    if (!value) return value;

    const normalizedField = String(fieldName || "").toLowerCase();
    if (normalizedField === 'job_id') {
      return jobs[value]?.name || value;
    }
    if (normalizedField === 'cost_code' || normalizedField === 'cost_code_id') {
      const costCode = costCodes[value];
      return costCode ? `${costCode.code} - ${costCode.description}` : value;
    }
    const isTimeField = normalizedField === "punch_in_time" || normalizedField === "punch_out_time";
    const looksLikeIsoTimestamp =
      /\d{4}-\d{2}-\d{2}[ t]\d{2}:\d{2}/i.test(value) ||
      /\+\d{2}$/.test(value) ||
      value.endsWith("Z");

    if (!isTimeField && !looksLikeIsoTimestamp) {
      return value;
    }

    const parsed = new Date(value.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return formatCompanyDateTime(parsed, companyTimeZone);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div><span className="loading-dots">Loading audit trail</span></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Audit Trail ({auditEntries.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {auditEntries.length === 0 ? (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            No audit entries found
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {auditEntries.map((entry, index) => (
                <div key={entry.id}>
                  {(() => {
                    const matchingChangeRequest = entry.change_type === 'change_requested'
                      ? getClosestChangeRequest(entry.created_at)
                      : null;
                    const requestedChanges = getRequestedChanges(matchingChangeRequest);

                    return (
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src={entry.profiles?.avatar_url} />
                      <AvatarFallback>
                        {entry.profiles?.first_name?.[0]}{entry.profiles?.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getChangeTypeBadge(entry.change_type)}
                        <span className="text-sm font-medium">
                          {entry.profiles?.display_name || 'Unknown User'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(entry.created_at)}
                        </span>
                      </div>
                      
                      {/* Special handling for change request entries */}
                      {entry.change_type === 'change_requested' && (
                        <div className="text-sm mt-1">
                          <p className="text-muted-foreground">Requested a change to this time card</p>
                          {entry.reason && (
                            <div className="mt-1 text-xs">
                              <span className="font-medium">Reason:</span> {entry.reason}
                            </div>
                          )}
                          {requestedChanges.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {requestedChanges.map((change) => (
                                <div key={change.label} className="rounded border bg-background/50 p-2">
                                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{change.label}</div>
                                  <div className="text-sm">{change.value}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {['punch_in', 'punch_out'].includes(entry.change_type) && entry.field_name && (
                        <div className="text-sm mt-1">
                          <span className="font-medium">{formatFieldName(entry.field_name)}</span>
                          <div className="mt-1 rounded border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-2 text-xs">
                            <span className="text-muted-foreground">Recorded:</span>{' '}
                            {entry.new_value ? formatAuditValue(entry.field_name, entry.new_value) : 'Not available'}
                          </div>
                        </div>
                      )}
                      
                      {entry.change_type === 'change_request_approved' && (
                        <div className="text-sm mt-1">
                          <p className="text-muted-foreground">Approved the requested changes</p>
                          {entry.reason && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {entry.reason}
                            </div>
                          )}
                          {/* Show field changes for approved requests */}
                          {entry.field_name && (entry.old_value || entry.new_value) && (
                            <div className="mt-2">
                              <span className="font-medium text-xs">{formatFieldName(entry.field_name)}</span>
                              <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">From:</span>
                                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-2 mt-1">
                                    {entry.old_value ? formatAuditValue(entry.field_name, entry.old_value) : <span className="text-muted-foreground italic">None</span>}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">To:</span>
                                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-2 mt-1">
                                    {entry.new_value ? formatAuditValue(entry.field_name, entry.new_value) : <span className="text-muted-foreground italic">None</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {entry.change_type === 'change_request_rejected' && (
                        <div className="text-sm mt-1">
                          <p className="text-muted-foreground">Denied the requested changes</p>
                          {entry.reason && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {entry.reason}
                            </div>
                          )}
                          {/* Show what was rejected */}
                          {entry.field_name && (entry.old_value || entry.new_value) && (
                            <div className="mt-2">
                              <span className="font-medium text-xs">{formatFieldName(entry.field_name)}</span>
                              <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">From:</span>
                                  <div className="bg-muted border rounded p-2 mt-1">
                                    {entry.old_value ? formatAuditValue(entry.field_name, entry.old_value) : <span className="text-muted-foreground italic">None</span>}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">To (Rejected):</span>
                                  <div className="bg-muted border rounded p-2 mt-1 opacity-60">
                                    {entry.new_value ? formatAuditValue(entry.field_name, entry.new_value) : <span className="text-muted-foreground italic">None</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Regular field changes */}
                      {entry.field_name && !['change_requested', 'change_request_approved', 'change_request_rejected', 'punch_in', 'punch_out'].includes(entry.change_type) && (
                        <div className="text-sm">
                          <span className="font-medium">{formatFieldName(entry.field_name)}</span>
                          {(entry.old_value || entry.new_value) && (
                            <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">From:</span>
                                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-2 mt-1">
                                  {entry.old_value ? formatAuditValue(entry.field_name, entry.old_value) : <span className="text-muted-foreground italic">None</span>}
                                </div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">To:</span>
                                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-2 mt-1">
                                  {entry.new_value ? formatAuditValue(entry.field_name, entry.new_value) : <span className="text-muted-foreground italic">None</span>}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Show reason for other types if not already shown */}
                      {entry.reason && !['change_requested', 'change_request_approved', 'change_request_rejected'].includes(entry.change_type) && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <span className="font-medium">Reason:</span> {entry.reason}
                        </div>
                      )}
                    </div>
                  </div>
                    );
                  })()}
                  {index < auditEntries.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
