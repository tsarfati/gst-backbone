import { useState, useEffect } from 'react';
import { resolveStorageUrl } from '@/utils/storageUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, FileText, Download, Plus, Clock, Loader2, User, Eye, List, LayoutGrid, Settings, AlertTriangle, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Camera, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import TimeCardDetailView from '@/components/TimeCardDetailView';
import EditTimeCardDialog from '@/components/EditTimeCardDialog';
import TimeSheetsViewSelector, { TimeSheetsViewType } from '@/components/TimeSheetsViewSelector';
import { useTimeSheetsViewPreference } from '@/hooks/useTimeSheetsViewPreference';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';
import { canAccessAssignedJobOnly } from '@/utils/jobAccess';

interface TimeCard {
  id: string;
  user_id: string;
  job_id: string;
  cost_code_id: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  overtime_hours: number;
  status: string;
  break_minutes: number;
  notes?: string;
  requires_approval?: boolean;
  distance_warning?: boolean;
  low_location_confidence?: boolean;
  created_via_punch_clock?: boolean;
  punch_in_photo_url?: string | null;
  punch_out_photo_url?: string | null;
  punch_in_accuracy_meters?: number | null;
  punch_out_accuracy_meters?: number | null;
  punch_in_location_lat?: number | null;
  punch_in_location_lng?: number | null;
  punch_out_location_lat?: number | null;
  punch_out_location_lng?: number | null;
  over_12h?: boolean;
  over_24h?: boolean;
  jobs?: { name: string } | null;
  cost_codes?: { code: string; description: string } | null;
  profiles?: { first_name: string; last_name: string; display_name: string } | null;
}

type SortField = 'employee' | 'job' | 'date' | 'hours' | 'status' | 'overtime';
type SortDirection = 'asc' | 'desc';

type SupabaseTimeCard = {
  id: string;
  user_id: string;
  job_id: string;
  cost_code_id: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  overtime_hours: number;
  status: string;
  break_minutes: number;
  notes?: string | null;
  punch_in_photo_url?: string | null;
  punch_out_photo_url?: string | null;
  punch_in_accuracy_meters?: number | null;
  punch_out_accuracy_meters?: number | null;
  punch_in_location_lat?: number | null;
  punch_in_location_lng?: number | null;
  punch_out_location_lat?: number | null;
  punch_out_location_lng?: number | null;
  low_location_confidence?: boolean | null;
  jobs?: { name: string } | null;
  cost_codes?: { code: string; description: string } | null;
  profiles?: { first_name: string; last_name: string; display_name: string } | null;
}

export default function TimeSheets() {
  const [timeCards, setTimeCards] = useState<TimeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Array<{id: string, name: string}>>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedTimeCardId, setSelectedTimeCardId] = useState<string>('');
  const [showDetailView, setShowDetailView] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteTimeCardId, setDeleteTimeCardId] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFromInput, setDateFromInput] = useState<string>('');
  const [dateToInput, setDateToInput] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const { profile, user } = useAuth();
  const { currentCompany, userCompanies } = useCompany();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  const navigate = useNavigate();
  
  // Use view preference hook with local storage
  const viewPreference = useTimeSheetsViewPreference('timesheet-view', 'list');
  const currentView = viewPreference.currentView;

  const companyRole = userCompanies.find(c => c.company_id === currentCompany?.id)?.role;
  const isManager = ['admin', 'controller', 'project_manager', 'manager'].includes((companyRole || '') as string);
  const isCompleteDateInput = (value: string) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value);
  const commitDateFilter = (field: 'from' | 'to') => {
    const value = field === 'from' ? dateFromInput : dateToInput;
    if (!isCompleteDateInput(value)) return;

    if (field === 'from') {
      setDateFrom(value);
    } else {
      setDateTo(value);
    }
  };

  useEffect(() => {
    if (currentCompany?.id && !websiteJobAccessLoading) {
      if (isManager) {
        loadEmployees();
      }
    }
  }, [user, profile, currentCompany?.id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  useEffect(() => {
    if (selectedEmployeeId && !websiteJobAccessLoading) {
      loadTimeCards();
    }
  }, [selectedEmployeeId, dateFrom, dateTo, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  const loadEmployees = async () => {
    if (!user || !currentCompany?.id) return;

    try {
      // Get all employees for this company
      const { data: companyUsers } = await supabase
        .from('user_company_access')
        .select('user_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      const userIds = (companyUsers || []).map((u: any) => u.user_id);
      if (userIds.length === 0) {
        setEmployees([]);
        return;
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name')
        .in('user_id', userIds);

      const list: Array<{id: string, name: string}> = [];

      for (const p of (profilesData || [])) {
        const name = p.display_name || (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name || p.last_name || 'Unknown');
        list.push({ id: p.user_id, name });
      }

      list.sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(list);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const maybeBackfillCostCodes = async () => {
    // Backfill disabled - historical punch records don't have cost codes
    // Future punches will have cost codes saved correctly
    return;
  };

  const loadTimeCards = async () => {
    if (!user || !currentCompany?.id || websiteJobAccessLoading) return;

    await maybeBackfillCostCodes();

    try {
      setLoading(true);
      
      // Load punch clock settings to check flagging rules
      const { data: punchSettings } = await supabase
        .from('job_punch_clock_settings')
        .select('flag_timecards_over_12hrs, flag_timecards_over_24hrs')
        .eq('company_id', currentCompany.id)
        .is('job_id', null)
        .maybeSingle();
      
      const flagOver12 = punchSettings?.flag_timecards_over_12hrs ?? true;
      const flagOver24 = punchSettings?.flag_timecards_over_24hrs ?? true;
      
      let query = supabase
        .from('time_cards')
        .select(`
          id,
          user_id,
          job_id,
          cost_code_id,
          punch_in_time,
          punch_out_time,
          total_hours,
          overtime_hours,
          status,
          break_minutes,
          notes,
          punch_in_photo_url,
          punch_out_photo_url,
          deleted_at
        `)
        .eq('company_id', currentCompany.id)
        .is('deleted_at', null);

      if (!isPrivileged) {
        if (allowedJobIds.length === 0) {
          setTimeCards([]);
          setLoading(false);
          return;
        }
        query = query.in('job_id', allowedJobIds);
      }

      if (dateFrom) {
        const fromDate = new Date(`${dateFrom}T00:00:00`);
        if (!Number.isNaN(fromDate.getTime())) {
          query = query.gte('punch_in_time', fromDate.toISOString());
        }
      }

      if (dateTo) {
        const toDate = new Date(`${dateTo}T23:59:59.999`);
        if (!Number.isNaN(toDate.getTime())) {
          query = query.lte('punch_in_time', toDate.toISOString());
        }
      }

      // Filter records based on user role and selection
      if (!isManager) {
        query = query.eq('user_id', user.id);
      } else if (selectedEmployeeId && selectedEmployeeId !== 'all') {
        query = query.eq('user_id', selectedEmployeeId);
      }

      const queryUrl = (query as any)?.url;
      if (queryUrl?.searchParams?.get('order')) {
        queryUrl.searchParams.delete('order');
      }

      const { data: timeCardData, error } = await query;

      if (error) {
        console.error('Error loading time cards:', error);
        toast({
          title: 'Error',
          description: (error as any)?.message || 'Failed to load time sheets',
          variant: 'destructive',
        });
        return;
      }

      // If a specific employee is selected and there are no time cards, check if there are punches today
      if (isManager && selectedEmployeeId && selectedEmployeeId !== 'all' && (!timeCardData || timeCardData.length === 0)) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const { data: punchesToday } = await supabase
          .from('punch_records')
          .select('id')
          .eq('company_id', currentCompany.id)
          .eq('user_id', selectedEmployeeId)
          .gte('punch_time', startOfDay.toISOString())
          .lte('punch_time', endOfDay.toISOString())
          .limit(1);
        if ((punchesToday || []).length > 0) {
          toast({
            title: 'Punches detected',
            description: 'Punches were recorded today but no time card was created yet. Ensure punch out or manual entry.',
          });
        }
      }

      // Get unique user IDs, job IDs, and cost code IDs
      const userIds = [...new Set((timeCardData || []).map(tc => tc.user_id))];
      const jobIds = [...new Set((timeCardData || []).map(tc => tc.job_id).filter(Boolean))];
      const costCodeIds = [...new Set((timeCardData || []).map(tc => tc.cost_code_id).filter(Boolean))];

      // Fetch related data separately
      const [profilesData, jobsData, costCodesData] = await Promise.all([
        userIds.length > 0 ? supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name')
          .in('user_id', userIds) : Promise.resolve({ data: [] }),
        jobIds.length > 0 ? supabase
          .from('jobs')
          .select('id, name')
          .in('id', jobIds)
          .eq('company_id', currentCompany.id) : Promise.resolve({ data: [] }),
        costCodeIds.length > 0 ? supabase
          .from('cost_codes')
          .select('id, code, description')
          .in('id', costCodeIds)
          : Promise.resolve({ data: [] })
      ]);

      // Create lookup maps
      const profilesMap = new Map((profilesData.data || []).map(p => [p.user_id, p]));
      const jobsMap = new Map((jobsData.data || []).map(j => [j.id, j]));
      const costCodesMap = new Map((costCodesData.data || []).map(c => [c.id, c]));

      // Transform data with relationships and apply flagging
      const transformedData: TimeCard[] = (timeCardData || [])
        .filter((tc: any) => canAccessAssignedJobOnly([tc.job_id], isPrivileged, allowedJobIds))
        .map(tc => {
        const profile = profilesMap.get(tc.user_id);
        const job = jobsMap.get(tc.job_id);
        const costCode = costCodesMap.get(tc.cost_code_id);

        const employeeData = profile;
        
        // Check if time card should be flagged
        const over24 = flagOver24 && tc.total_hours > 24;
        const over12 = flagOver12 && tc.total_hours > 12 && tc.total_hours <= 24;
        const shouldFlag = over24 || over12;

        return {
          ...tc,
          low_location_confidence: tc.low_location_confidence ?? false,
          punch_in_photo_url: tc.punch_in_photo_url,
          punch_out_photo_url: tc.punch_out_photo_url,
          requires_approval: shouldFlag || tc.status === 'pending',
          over_12h: over12,
          over_24h: over24,
          jobs: job ? { name: job.name } : null,
          cost_codes: costCode ? { code: costCode.code, description: costCode.description } : null,
          profiles: employeeData ? {
            first_name: employeeData.first_name,
            last_name: employeeData.last_name,
            display_name: employeeData.display_name
          } : null
        };
      });

      const sortedData = [...transformedData].sort(
        (a, b) => new Date(b.punch_in_time).getTime() - new Date(a.punch_in_time).getTime()
      );

      setTimeCards(sortedData);
      setLoading(false);

      // Backfill slower punch-record details after the main list is visible.
      void (async () => {
        try {
          const enrichedData: TimeCard[] = await Promise.all(transformedData.map(async (tc) => {
            const needsInPhoto = !tc.punch_in_photo_url;
            const needsOutPhoto = !tc.punch_out_photo_url && tc.punch_out_time;
            const needsInLoc = (!tc.punch_in_location_lat || !tc.punch_in_location_lng);
            const needsOutLoc = tc.punch_out_time && (!tc.punch_out_location_lat || !tc.punch_out_location_lng);
            const needsCostCode = !tc.cost_code_id;
            
            if (!needsInPhoto && !needsOutPhoto && !needsInLoc && !needsOutLoc && !needsCostCode) return tc;

            const from = new Date(new Date(tc.punch_in_time).getTime() - 60_000).toISOString();
            const to = new Date(new Date(tc.punch_out_time || tc.punch_in_time).getTime() + 60_000).toISOString();
            const { data: punches } = await supabase
              .from('punch_records')
              .select('punch_type, photo_url, latitude, longitude, punch_time, cost_code_id')
              .eq('user_id', tc.user_id)
              .gte('punch_time', from)
              .lte('punch_time', to)
              .order('punch_time', { ascending: true });

            const punchIn = (punches || []).find(p => p.punch_type === 'punched_in');
            const punchOut = (punches || []).find(p => p.punch_type === 'punched_out');

            const resolvedCostCodeId: string | null = tc.cost_code_id || punchOut?.cost_code_id || punchIn?.cost_code_id || null;
            const resolvedCost = resolvedCostCodeId && costCodesMap.get(resolvedCostCodeId)
              ? { code: costCodesMap.get(resolvedCostCodeId)!.code, description: costCodesMap.get(resolvedCostCodeId)!.description }
              : tc.cost_codes || null;

            const updated: TimeCard = {
              ...tc,
              punch_in_photo_url: tc.punch_in_photo_url || punchIn?.photo_url || null,
              punch_out_photo_url: tc.punch_out_photo_url || punchOut?.photo_url || null,
              punch_in_location_lat: tc.punch_in_location_lat ?? (punchIn?.latitude ?? null),
              punch_in_location_lng: tc.punch_in_location_lng ?? (punchIn?.longitude ?? null),
              punch_out_location_lat: tc.punch_out_location_lat ?? (punchOut?.latitude ?? null),
              punch_out_location_lng: tc.punch_out_location_lng ?? (punchOut?.longitude ?? null),
              cost_code_id: resolvedCostCodeId as any,
              cost_codes: resolvedCost as any,
            } as any;

            if (
              (needsInPhoto && updated.punch_in_photo_url) ||
              (needsOutPhoto && updated.punch_out_photo_url) ||
              (needsInLoc && (updated.punch_in_location_lat || updated.punch_in_location_lng)) ||
              (needsOutLoc && (updated.punch_out_location_lat || updated.punch_out_location_lng)) ||
              (needsCostCode && updated.cost_code_id)
            ) {
              await supabase
                .from('time_cards')
                .update({
                  punch_in_photo_url: updated.punch_in_photo_url,
                  punch_out_photo_url: updated.punch_out_photo_url,
                  punch_in_location_lat: updated.punch_in_location_lat,
                  punch_in_location_lng: updated.punch_in_location_lng,
                  punch_out_location_lat: updated.punch_out_location_lat,
                  punch_out_location_lng: updated.punch_out_location_lng,
                  cost_code_id: updated.cost_code_id,
                })
                .eq('id', tc.id);
            }

            return updated;
          }));

          const sortedEnrichedData = [...enrichedData].sort(
            (a, b) => new Date(b.punch_in_time).getTime() - new Date(a.punch_in_time).getTime()
          );

          setTimeCards((prev) => prev.map((timeCard) =>
            sortedEnrichedData.find((enriched) => enriched.id === timeCard.id) || timeCard
          ));
        } catch (error) {
          console.warn('Time card enrichment skipped:', error);
        }
      })();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): 'outline' | 'secondary' | 'default' | 'destructive' => {
    switch (status) {
      case 'draft': return 'outline';
      case 'submitted': return 'secondary';
      case 'approved': return 'default';
      case 'approved-edited': return 'default';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const handleApproval = async (timeCardId: string, approved: boolean) => {
    if (!isManager) return;

    try {
      const { error } = await supabase
        .from('time_cards')
        .update({ 
          status: approved ? 'approved' : 'rejected',
          approved_at: approved ? new Date().toISOString() : null,
          approved_by: approved ? user?.id : null
        })
        .eq('id', timeCardId);

      if (error) throw error;

      setTimeCards(prev => 
        prev.map(tc => 
          tc.id === timeCardId 
            ? { ...tc, status: approved ? 'approved' : 'rejected' }
            : tc
        )
      );

      toast({
        title: 'Success',
        description: `Time card ${approved ? 'approved' : 'rejected'}`,
      });
    } catch (error) {
      console.error('Error updating time card:', error);
      toast({
        title: 'Error',
        description: 'Failed to update time card',
        variant: 'destructive',
      });
    }
  };

  const handleViewDetails = (timeCardId: string) => {
    setSelectedTimeCardId(timeCardId);
    setShowDetailView(true);
  };

  const handleEditTimeCard = (timeCardId: string) => {
    setSelectedTimeCardId(timeCardId);
    setShowEditDialog(true);
  };

  const handleDeleteTimeCard = async () => {
    if (!deleteTimeCardId || !isManager) return;

    try {
      // Soft delete: keep audit trail, mark as deleted
      const { error } = await supabase
        .from('time_cards')
        .update({ status: 'deleted', deleted_at: new Date().toISOString() })
        .eq('id', deleteTimeCardId);

      if (error) throw error;

      setTimeCards(prev => prev.filter(tc => tc.id !== deleteTimeCardId));
      setDeleteTimeCardId('');

      toast({
        title: 'Removed',
        description: 'Time card moved to trash',
      });
    } catch (error: any) {
      console.error('Error deleting time card:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete time card',
        variant: 'destructive',
      });
    }
  };

  const formatWeekRange = (date: string) => {
    const d = new Date(date);
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const getEmployeeName = (timeCard: TimeCard) => {
    if (timeCard.profiles?.display_name) return timeCard.profiles.display_name;
    if (timeCard.profiles?.first_name && timeCard.profiles?.last_name) {
      return `${timeCard.profiles.first_name} ${timeCard.profiles.last_name}`;
    }
    return 'Unknown Employee';
  };

  const isLowLocationConfidence = (timeCard: TimeCard) => timeCard.low_location_confidence === true;

  const timeCardNeedsApproval = (timeCard: TimeCard) => {
    const hasPendingChangeRequest = pendingChangeRequestTimeCardIds.includes(timeCard.id);
    const approvalPendingStatus = timeCard.status === 'submitted' || timeCard.status === 'pending';
    const explicitlyRequiresApproval = timeCard.requires_approval !== false;

    if (hasPendingChangeRequest) return true;
    if (!approvalPendingStatus) return false;
    if (timeCard.status === 'pending') return true;
    return explicitlyRequiresApproval;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getFilteredAndSortedTimeCards = () => {
    let filtered = timeCards;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        filtered = filtered.filter(tc => tc.status === 'submitted' || tc.status === 'draft');
      } else if (statusFilter === 'pending_approval') {
        filtered = filtered.filter(tc => timeCardNeedsApproval(tc));
      } else {
        filtered = filtered.filter(tc => tc.status === statusFilter);
      }
    }
    
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'employee':
          aValue = getEmployeeName(a).toLowerCase();
          bValue = getEmployeeName(b).toLowerCase();
          break;
        case 'job':
          aValue = a.jobs?.name?.toLowerCase() || '';
          bValue = b.jobs?.name?.toLowerCase() || '';
          break;
        case 'date':
          aValue = new Date(a.punch_in_time).getTime();
          bValue = new Date(b.punch_in_time).getTime();
          break;
        case 'hours':
          aValue = a.total_hours;
          bValue = b.total_hours;
          break;
        case 'overtime':
          aValue = a.overtime_hours;
          bValue = b.overtime_hours;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = a.punch_in_time;
          bValue = b.punch_in_time;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-primary/10 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
  );

  const openPunchPhoto = async (url?: string | null) => {
    if (!url) return;
    const resolved = await resolveStorageUrl('punch-photos', url);
    if (resolved) {
      window.open(resolved, '_blank', 'noopener,noreferrer');
    }
  };

  const PhotoButton = ({ url, type, className }: { url?: string; type: 'in' | 'out'; className?: string }) => {
    if (!url) return null;

    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className || "h-8 px-2 gap-1"}
        onClick={(e) => {
          e.stopPropagation();
          void openPunchPhoto(url);
        }}
      >
        <Camera className="h-3.5 w-3.5" />
        {type === 'in' ? 'In' : 'Out'}
      </Button>
    );
  };

  // State for pending change requests count
  const [pendingChangeRequestsCount, setPendingChangeRequestsCount] = useState(0);
  const [pendingChangeRequestTimeCardIds, setPendingChangeRequestTimeCardIds] = useState<string[]>([]);

  // Load pending change requests count
  useEffect(() => {
    const loadPendingChangeRequestsCount = async () => {
      if (!currentCompany?.id) return;
      
      const { data, error } = await supabase
        .from('time_card_change_requests')
        .select('time_card_id')
        .eq('company_id', currentCompany.id)
        .eq('status', 'pending');
      
      if (!error && data) {
        console.log('Pending change requests:', data);
        setPendingChangeRequestsCount(data.length);
        setPendingChangeRequestTimeCardIds(data.map(r => r.time_card_id));
      }
    };

    loadPendingChangeRequestsCount();

    // Subscribe to changes in time_card_change_requests
    const channel = supabase
      .channel('change-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_card_change_requests'
        },
        () => {
          loadPendingChangeRequestsCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id]);

  // Calculate summary statistics based on the currently filtered dataset
  const filteredTimeCards = getFilteredAndSortedTimeCards();

  const totalHoursFiltered = filteredTimeCards.reduce((sum, tc) => sum + (tc.total_hours || 0), 0);

  const approvedHoursFiltered = filteredTimeCards
    .filter(tc => tc.status === 'approved' || tc.status === 'approved-edited')
    .reduce((sum, tc) => sum + (tc.total_hours || 0), 0);

  const uniqueDaysInFiltered = new Set(
    filteredTimeCards.map(tc => {
      const d = new Date(tc.punch_in_time);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const averageDailyFiltered = uniqueDaysInFiltered.size > 0
    ? totalHoursFiltered / uniqueDaysInFiltered.size
    : 0;

  const pendingCards = filteredTimeCards.filter(tc => timeCardNeedsApproval(tc)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span><span className="loading-dots">Loading time sheets</span></span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileText className="h-8 w-8" />
            Time Sheets
          </h1>
        </div>
        <div className="flex gap-3">
          {isManager && (
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="w-64 h-11">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {emp.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFromInput}
              onChange={(event) => setDateFromInput(event.target.value)}
              onBlur={() => commitDateFilter('from')}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitDateFilter('from');
                }
              }}
              className="h-11 w-40"
              aria-label="Filter time sheets from date"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateToInput}
              onChange={(event) => setDateToInput(event.target.value)}
              onBlur={() => commitDateFilter('to')}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitDateFilter('to');
                }
              }}
              className="h-11 w-40"
              aria-label="Filter time sheets to date"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 h-11">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending_approval">
                Pending Approval ({pendingCards})
              </SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
          <TimeSheetsViewSelector
            currentView={currentView}
            onViewChange={viewPreference.setCurrentView}
            onSetDefault={viewPreference.setDefaultView}
            defaultView={viewPreference.defaultView}
          />
          <Button variant="outline" className="h-11">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {isManager && (
            <>
              <Button 
                className="h-11 gap-2"
                onClick={() => navigate('/manual-time-entry')}
              >
                <Plus className="h-4 w-4" />
                New Time Sheet
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {isManager && (
          <Card 
            className="shadow-elevation-md cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setStatusFilter('pending_approval')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {pendingCards}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Click to view all</p>
            </CardContent>
          </Card>
        )}
        
        <Card className="shadow-elevation-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {totalHoursFiltered.toFixed(1)} hrs
            </div>
            <p className="text-xs text-muted-foreground mt-1">Filtered results</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-elevation-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {approvedHoursFiltered.toFixed(1)} hrs
            </div>
            <p className="text-xs text-muted-foreground mt-1">Filtered results</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-elevation-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Daily</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {averageDailyFiltered.toFixed(1)} hrs
            </div>
            <p className="text-xs text-muted-foreground mt-1">Avg per day (filtered)</p>
          </CardContent>
        </Card>
      </div>

      {/* Time Cards List */}
      <Card className="shadow-elevation-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calendar className="h-6 w-6" />
            Recent Time Cards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeCards.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">No time cards found</h3>
                <p className="text-muted-foreground">Start tracking time to see your records here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Render different views based on viewMode */}
                {currentView === 'table' && (
                  <Table className="border-separate border-spacing-0">
                    <TableHeader>
                      <TableRow>
                        {isManager && (
                          <SortableHeader field="employee">Employee</SortableHeader>
                        )}
                        <SortableHeader field="job">Job</SortableHeader>
                        <SortableHeader field="date">Date</SortableHeader>
                        <TableHead>Time In/Out</TableHead>
                        <SortableHeader field="hours">Hours</SortableHeader>
                        <SortableHeader field="overtime">Overtime</SortableHeader>
                        <SortableHeader field="status">Status</SortableHeader>
                        <TableHead>Photos</TableHead>
                        <TableHead>Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredAndSortedTimeCards().map((timeCard) => (
                        <TableRow key={timeCard.id} onClick={() => handleViewDetails(timeCard.id)} className={`cursor-pointer group hover:bg-primary/5 transition-colors ${(timeCard.over_12h || timeCard.over_24h) ? 'animate-pulse-red' : ''}`}>
                          {isManager && (
                            <TableCell className="font-medium border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg">
                              {getEmployeeName(timeCard)}
                            </TableCell>
                          )}
                           <TableCell className={isManager ? "border-y border-transparent group-hover:border-primary" : "border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg"}>
                            <div>
                              <div className="font-medium group-hover:text-primary transition-colors">{timeCard.jobs?.name || 'Unknown Job'}</div>
                              <div className="text-sm text-muted-foreground">
                                {timeCard.cost_codes ? `${timeCard.cost_codes.code} - ${timeCard.cost_codes.description}` : 'N/A'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="border-y border-transparent group-hover:border-primary">
                            {new Date(timeCard.punch_in_time).toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </TableCell>
                          <TableCell className="border-y border-transparent group-hover:border-primary">
                            <div className="text-sm">
                              <div>
                                In: {new Date(timeCard.punch_in_time).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit' 
                                })}
                              </div>
                              <div>
                                Out: {new Date(timeCard.punch_out_time).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>
                          </TableCell>
<TableCell className="font-medium border-y border-transparent group-hover:border-primary">
  <div className="flex items-center gap-2">
    {timeCard.total_hours.toFixed(1)}h
    {timeCard.over_24h && (
      <Badge variant="destructive">24h+</Badge>
    )}
    {!timeCard.over_24h && timeCard.over_12h && (
      <Badge variant="secondary">12h+</Badge>
    )}
  </div>
</TableCell>
                          <TableCell className="border-y border-transparent group-hover:border-primary">
                            {timeCard.overtime_hours > 0 ? (
                              <span className="text-warning font-medium">
                                {timeCard.overtime_hours.toFixed(1)}h
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="border-y border-transparent group-hover:border-primary">
                            <div className="flex items-center gap-2">
                              <Badge variant={(pendingChangeRequestTimeCardIds.includes(timeCard.id) && timeCard.status !== 'approved' && timeCard.status !== 'approved-edited') ? 'secondary' : getStatusColor(timeCard.status)}>
                                {(pendingChangeRequestTimeCardIds.includes(timeCard.id) && timeCard.status !== 'approved' && timeCard.status !== 'approved-edited') ? 'CHANGE REQUESTED' : timeCard.status.toUpperCase()}
                              </Badge>
                              {timeCard.distance_warning && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                </Badge>
                              )}
                              {isLowLocationConfidence(timeCard) && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  Low GPS
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="border-y border-transparent group-hover:border-primary">
                            <div className="flex items-center gap-2">
                              <PhotoButton url={timeCard.punch_in_photo_url || undefined} type="in" />
                              <PhotoButton url={timeCard.punch_out_photo_url || undefined} type="out" />
                              {!timeCard.punch_in_photo_url && !timeCard.punch_out_photo_url && (
                                <span className="text-muted-foreground text-sm">No photos</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="border-y border-transparent group-hover:border-primary last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                            <div className="flex items-center gap-3">
                              {timeCard.punch_in_location_lat && timeCard.punch_in_location_lng ? (
                                <a
                                  href={`https://www.openstreetmap.org/?mlat=${timeCard.punch_in_location_lat}&mlon=${timeCard.punch_in_location_lng}&zoom=15`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline text-primary"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  In
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                              {timeCard.punch_out_location_lat && timeCard.punch_out_location_lng ? (
                                <a
                                  href={`https://www.openstreetmap.org/?mlat=${timeCard.punch_out_location_lat}&mlon=${timeCard.punch_out_location_lng}&zoom=15`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline text-primary"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Out
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                
                {currentView === 'list' && getFilteredAndSortedTimeCards().map((timeCard) => (
                  <div
                    key={timeCard.id}
                    className={`border rounded-xl px-4 py-3 hover-card cursor-pointer ${(timeCard.over_12h || timeCard.over_24h) ? 'animate-pulse-red' : ''}`}
                    onClick={() => handleViewDetails(timeCard.id)}
                  >
                    <div className="space-y-1.5">
                      <div className="grid gap-2 text-sm md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.1fr)_auto] md:items-center">
                        <div className="min-w-0">
                          {isManager ? (
                            <div className="font-semibold leading-tight truncate">{getEmployeeName(timeCard)}</div>
                          ) : null}
                          <div className="font-medium leading-tight truncate">
                            {timeCard.jobs?.name || 'Unknown Job'}
                          </div>
                        </div>

                        <div className="min-w-0 text-muted-foreground">
                          <div className="truncate">
                            {new Date(timeCard.punch_in_time).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="truncate text-xs">{formatWeekRange(timeCard.punch_in_time)}</div>
                        </div>

                        <div className="min-w-0 text-muted-foreground">
                          {timeCard.cost_codes ? (
                            <div className="truncate">{`${timeCard.cost_codes.code} - ${timeCard.cost_codes.description}`}</div>
                          ) : (
                            <div className="truncate">No cost code</div>
                          )}
                          <div className="truncate text-xs">{formatWeekRange(timeCard.punch_in_time)}</div>
                        </div>

                        <div className="flex flex-wrap items-center justify-start gap-1.5 md:justify-end">
                          <Badge variant={(pendingChangeRequestTimeCardIds.includes(timeCard.id) && timeCard.status !== 'approved' && timeCard.status !== 'approved-edited') ? 'secondary' : getStatusColor(timeCard.status)} className="text-[11px]">
                            {(pendingChangeRequestTimeCardIds.includes(timeCard.id) && timeCard.status !== 'approved' && timeCard.status !== 'approved-edited') ? 'CHANGE REQUESTED' : timeCard.status.toUpperCase()}
                          </Badge>
                          {timeCard.distance_warning && (
                            <Badge variant="destructive" className="flex items-center gap-1 text-[11px]">
                              <AlertTriangle className="h-3 w-3" />
                              Distance
                            </Badge>
                          )}
                          {isLowLocationConfidence(timeCard) && (
                            <Badge variant="secondary" className="flex items-center gap-1 text-[11px]">
                              <MapPin className="h-3 w-3" />
                              Low GPS
                            </Badge>
                          )}
                          {!timeCard.requires_approval && timeCard.created_via_punch_clock && (
                            <Badge variant="outline" className="text-[11px]">
                              Auto-Approved
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_auto] md:items-center">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In</div>
                          <div className="font-medium leading-tight">
                            {new Date(timeCard.punch_in_time).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            {new Date(timeCard.punch_in_time).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground min-w-0 md:justify-center">
                          {timeCard.break_minutes > 0 ? (
                            <span>Break: {timeCard.break_minutes} min</span>
                          ) : (
                            <span>Break: 0 min</span>
                          )}
                          {timeCard.overtime_hours > 0 ? (
                            <span className="text-warning font-medium">OT: {timeCard.overtime_hours.toFixed(1)}h</span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 min-w-0 md:justify-center">
                          <span className="font-semibold whitespace-nowrap">{timeCard.total_hours.toFixed(1)} hrs</span>
                          {timeCard.over_24h && <Badge variant="destructive" className="text-[11px]">24h+</Badge>}
                          {!timeCard.over_24h && timeCard.over_12h && <Badge variant="secondary" className="text-[11px]">12h+</Badge>}
                        </div>

                        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                          {timeCard.punch_in_location_lat && timeCard.punch_in_location_lng ? (
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${timeCard.punch_in_location_lat}&mlon=${timeCard.punch_in_location_lng}&zoom=15`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-primary text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              In Map
                            </a>
                          ) : null}
                          <PhotoButton url={timeCard.punch_in_photo_url || undefined} type="in" />
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_auto] md:items-center">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Out</div>
                          <div className="font-medium leading-tight">
                            {timeCard.punch_out_time ? (
                              <>
                                {new Date(timeCard.punch_out_time).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}{' '}
                                {new Date(timeCard.punch_out_time).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not punched out</span>
                            )}
                          </div>
                        </div>

                        <div className="text-muted-foreground min-w-0 md:justify-self-center">
                          <span>{formatWeekRange(timeCard.punch_in_time)}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 min-w-0 md:justify-center">
                          {timeCard.punch_out_location_lat && timeCard.punch_out_location_lng ? (
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${timeCard.punch_out_location_lat}&mlon=${timeCard.punch_out_location_lng}&zoom=15`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-primary text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Out Map
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">No out map</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                          <PhotoButton url={timeCard.punch_out_photo_url || undefined} type="out" />
                          {isManager && timeCard.status === 'submitted' && (timeCard.requires_approval !== false) && (
                            <>
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleApproval(timeCard.id, true); }}
                                className="rounded-lg h-8"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => { e.stopPropagation(); handleApproval(timeCard.id, false); }}
                                className="rounded-lg h-8"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Compact View */}
                {currentView === 'compact' && getFilteredAndSortedTimeCards().map((timeCard) => (
                  <div 
                    key={timeCard.id} 
                    className={`border rounded-lg p-4 hover-card cursor-pointer ${(timeCard.over_12h || timeCard.over_24h) ? 'animate-pulse-red' : ''}`}
                    onClick={() => handleViewDetails(timeCard.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {isManager && (
                          <div className="min-w-0">
                            <div className="font-medium truncate">{getEmployeeName(timeCard)}</div>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{timeCard.jobs?.name || 'Unknown Job'}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(timeCard.punch_in_time).toLocaleDateString()}
                          </div>
                        </div>
                         <div className="flex items-center gap-2">
                           <Badge variant={(pendingChangeRequestTimeCardIds.includes(timeCard.id) && timeCard.status !== 'approved' && timeCard.status !== 'approved-edited') ? 'secondary' : getStatusColor(timeCard.status)} className="text-xs">
                             {(pendingChangeRequestTimeCardIds.includes(timeCard.id) && timeCard.status !== 'approved' && timeCard.status !== 'approved-edited') ? 'CHANGE REQUESTED' : timeCard.status.toUpperCase()}
                           </Badge>
                           {timeCard.distance_warning && (
                             <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                               <AlertTriangle className="h-3 w-3" />
                             </Badge>
                           )}
                           {isLowLocationConfidence(timeCard) && (
                             <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                               <MapPin className="h-3 w-3" />
                               Low GPS
                             </Badge>
                           )}
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold flex items-center gap-2">
                            {timeCard.total_hours.toFixed(1)} hrs
                            {timeCard.over_24h && (<Badge variant="destructive" className="text-xs">24h+</Badge>)}
                            {!timeCard.over_24h && timeCard.over_12h && (<Badge variant="secondary" className="text-xs">12h+</Badge>)}
                          </div>
                          {timeCard.overtime_hours > 0 && (
                            <div className="text-xs text-warning">+{timeCard.overtime_hours.toFixed(1)} OT</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Super Compact View */}
                {currentView === 'super-compact' && (
                  <div className="space-y-1">
                    {getFilteredAndSortedTimeCards().map((timeCard) => (
                      <div 
                        key={timeCard.id} 
                        className={`flex items-center justify-between p-2 hover:bg-primary/5 hover:border-primary hover:shadow-md rounded cursor-pointer transition-all duration-200 group ${(timeCard.over_12h || timeCard.over_24h) ? 'animate-pulse-red' : ''}`}
                        onClick={() => handleViewDetails(timeCard.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {isManager && (
                            <div className="min-w-0 w-32">
                              <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{getEmployeeName(timeCard)}</div>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm truncate">{timeCard.jobs?.name || 'Unknown Job'}</div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(timeCard.punch_in_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                           <div className="font-medium whitespace-nowrap flex items-center gap-1">
                             {timeCard.total_hours.toFixed(1)}h
                             {timeCard.over_24h && (<Badge variant="destructive" className="text-xs">24h+</Badge>)}
                             {!timeCard.over_24h && timeCard.over_12h && (<Badge variant="secondary" className="text-xs">12h+</Badge>)}
                           </div>
                           <Badge variant={(pendingChangeRequestTimeCardIds.includes(timeCard.id) && timeCard.status !== 'approved' && timeCard.status !== 'approved-edited') ? 'secondary' : getStatusColor(timeCard.status)} className="text-xs whitespace-nowrap">
                             {(pendingChangeRequestTimeCardIds.includes(timeCard.id) && timeCard.status !== 'approved' && timeCard.status !== 'approved-edited') ? 'CHANGE REQUESTED' : timeCard.status.toUpperCase()}
                           </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedTimeCardId && (
        <TimeCardDetailView
          open={showDetailView}
          onOpenChange={setShowDetailView}
          timeCardId={selectedTimeCardId}
          onTimeCardUpdated={() => {
            void loadTimeCards();
          }}
        />
      )}

      {selectedTimeCardId && (
        <EditTimeCardDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          timeCardId={selectedTimeCardId}
          onSave={async (updatedTimeCard) => {
            if (updatedTimeCard?.id) {
              setTimeCards((prev) =>
                prev.map((timeCard) =>
                  timeCard.id === updatedTimeCard.id
                    ? {
                        ...timeCard,
                        ...updatedTimeCard,
                        jobs: updatedTimeCard.jobs ?? timeCard.jobs,
                        cost_codes: updatedTimeCard.cost_codes ?? null,
                      } as TimeCard
                    : timeCard,
                ),
              );
            }
            void loadTimeCards();
            setSelectedTimeCardId('');
          }}
        />
      )}

      <AlertDialog open={!!deleteTimeCardId} onOpenChange={() => setDeleteTimeCardId('')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time card? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTimeCard}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
