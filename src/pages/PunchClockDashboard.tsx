import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MapPin, Clock, Users, FileText, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from "@/contexts/CompanyContext";
import PunchDetailView from '@/components/PunchDetailView';
import TimeCardDetailModal from '@/components/TimeCardDetailModal';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

interface CurrentStatus {
  id: string;
  user_id: string;
  job_id: string;
  cost_code_id: string | null;
  punch_in_time: string;
  punch_in_location_lat?: number | null;
  punch_in_location_lng?: number | null;
  punch_in_photo_url?: string | null;
}

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  first_name?: string;
  last_name?: string;
}

interface Job { id: string; name: string; latitude?: number | null; longitude?: number | null; address?: string | null }

interface PunchRecord {
  id: string;
  user_id: string | null;
  pin_employee_id?: string | null;
  job_id: string | null;
  cost_code_id: string | null;
  punch_time: string;
  punch_type: 'punched_in' | 'punched_out';
  latitude?: number | null;
  longitude?: number | null;
  photo_url?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

interface TimeCard {
  id: string;
  user_id: string;
  job_id: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  status: string;
}

export default function PunchClockDashboard() {
  const { currentCompany } = useCompany();
  const [active, setActive] = useState<CurrentStatus[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [recentOuts, setRecentOuts] = useState<PunchRecord[]>([]);
  const [costCodes, setCostCodes] = useState<Record<string, { code: string; description: string }>>({});

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
const [confirmPunchOutOpen, setConfirmPunchOutOpen] = useState(false);
  const [employeeToPunchOut, setEmployeeToPunchOut] = useState<CurrentStatus | null>(null);
  const [timeCardModalOpen, setTimeCardModalOpen] = useState(false);
  const [selectedTimeCardId, setSelectedTimeCardId] = useState<string | null>(null);
  const [pendingChangeRequests, setPendingChangeRequests] = useState<any[]>([]);
  const [pendingTimeCards, setPendingTimeCards] = useState<any[]>([]);
  // Punch-out cost code requirements
  const [costCodeTiming, setCostCodeTiming] = useState<'punch_in' | 'punch_out'>('punch_in');
  const [adminSelectedCostCode, setAdminSelectedCostCode] = useState<string | null>(null);
  const [adminCostCodeOptions, setAdminCostCodeOptions] = useState<Array<{ id: string; code: string; description: string }>>([]);
  const [loadingAdminCostCodes, setLoadingAdminCostCodes] = useState(false);
  
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const isAdmin = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    const load = async () => {
      if (!currentCompany?.id) return;
      
      console.log('PunchClockDashboard: loading data for company', currentCompany.id);
      
      // Get user IDs for this company first
      const { data: companyUsers } = await supabase
        .from('user_company_access')
        .select('user_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      const companyUserIds = (companyUsers || []).map(u => u.user_id);
      if (companyUserIds.length === 0) {
        companyUserIds.push('00000000-0000-0000-0000-000000000000');
      }
      
      // First get jobs for this company
      const { data: companyJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', currentCompany.id);
      
      const companyJobIds = (companyJobs || []).map(j => j.id);
      
      // Load active punches for users in this company AND jobs in this company
      const { data: activeData } = await supabase
        .from('current_punch_status')
        .select('*')
        .eq('is_active', true)
        .in('user_id', companyUserIds)
        .in('job_id', companyJobIds.length > 0 ? companyJobIds : ['00000000-0000-0000-0000-000000000000'])
        .order('punch_in_time', { ascending: false });

      setActive(activeData || []);
      console.log('PunchClockDashboard: active count', (activeData || []).length);

      const userIds = Array.from(new Set((activeData || []).map(a => a.user_id)));
      const jobIds = Array.from(new Set((activeData || []).map(a => a.job_id).filter(Boolean))) as string[];

      if (userIds.length) {
        // Robustly fetch names using edge function (handles regular + PIN)
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('get-employee-profiles', {
          body: { user_ids: userIds }
        });
        if (!fnErr && fnData?.profiles) {
          const profMap: Record<string, any> = {};
          (fnData.profiles as any[]).forEach((p) => {
            profMap[p.user_id] = p;
          });
          setProfiles(prev => ({ ...prev, ...profMap }));
        }
      }

      if (jobIds.length) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, name, latitude, longitude, address')
          .eq('company_id', currentCompany.id)
          .in('id', jobIds);
        const jobMap: Record<string, Job> = {};
        (jobsData || []).forEach(j => { jobMap[j.id] = j; });
        setJobs(prev => ({ ...prev, ...jobMap }));
      }

      // Load recent punch outs - get all employees who are NOT currently punched in
      // First get the most recent punch record for each user in this company
      const { data: allPunchData } = await supabase
        .from('punch_records')
        .select('id, user_id, pin_employee_id, job_id, cost_code_id, punch_time, punch_type, latitude, longitude, photo_url, ip_address, user_agent')
        .eq('company_id', currentCompany.id)
        .in('user_id', companyUserIds)
        .in('job_id', companyJobIds.length > 0 ? companyJobIds : ['00000000-0000-0000-0000-000000000000'])
        .order('punch_time', { ascending: false });

      // Get the most recent punch for each user
      const activeUserIds = new Set((activeData || []).map(a => a.user_id));
      const lastPunchPerUser: Record<string, PunchRecord> = {};
      
      (allPunchData || []).forEach((punch) => {
        if (!activeUserIds.has(punch.user_id) && !lastPunchPerUser[punch.user_id]) {
          lastPunchPerUser[punch.user_id] = punch;
        }
      });

      // Only include users whose last punch was a punch_out
      const recentOuts = Object.values(lastPunchPerUser).filter(punch => 
        punch.punch_type === 'punched_out'
      );

      setRecentOuts(recentOuts);

      // Preload profiles for recently punched out users and load jobs for punch outs
      const outUserIds = recentOuts.map(r => r.user_id).filter(Boolean) as string[];
      const outPinIds = recentOuts.map(r => r.pin_employee_id).filter(Boolean) as string[];
      const outJobIds = Array.from(new Set(recentOuts.map(r => r.job_id).filter(Boolean))) as string[];
      
      if (outUserIds.length || outPinIds.length) {
        const ids = Array.from(new Set([...(outUserIds || []), ...(outPinIds || [])]));
        if (ids.length) {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('get-employee-profiles', {
            body: { user_ids: ids }
          });
          if (!fnErr && fnData?.profiles) {
            const profMap: Record<string, any> = {};
            (fnData.profiles as any[]).forEach((p) => {
              profMap[p.user_id] = p;
            });
            setProfiles(prev => ({ ...prev, ...profMap }));
          }
        }
      }

      if (outJobIds.length) {
        const { data: outJobsData } = await supabase
          .from('jobs')
          .select('id, name, latitude, longitude, address')
          .eq('company_id', currentCompany.id)
          .in('id', outJobIds);
        const jobMap: Record<string, Job> = {};
        (outJobsData || []).forEach(j => { jobMap[j.id] = j; });
        setJobs(prev => ({ ...prev, ...jobMap }));
      }

      // Load cost codes for both active and recently punched out records
      const allCostCodeIds = Array.from(new Set([
        ...(((activeData || []).map(a => a.cost_code_id).filter(Boolean)) as string[]),
        ...((recentOuts.map(r => r.cost_code_id).filter(Boolean)) as string[])
      ]));

      if (allCostCodeIds.length) {
        const { data: costCodesData } = await supabase
          .from('cost_codes')
          .select('id, code, description')
          .eq('company_id', currentCompany.id)
          .in('id', allCostCodeIds);
        const ccMap: Record<string, { code: string; description: string }> = {};
        (costCodesData || []).forEach(cc => { ccMap[cc.id] = { code: cc.code, description: cc.description }; });
        setCostCodes(prev => ({ ...prev, ...ccMap }));
      }
    };

    
    load();
    
    // Set up real-time subscription for punch status changes
    const channel = supabase
      .channel('punch-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'current_punch_status'
        },
        (payload) => {
          console.log('Punch status change:', payload);
          // Reload data when punch status changes
          load();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'punch_records'
        },
        (payload) => {
          console.log('Punch record change:', payload);
          // Reload data when punch records change
          load();
        }
      )
      .subscribe();
    
    // Keep polling as backup, but with longer interval
    const interval = setInterval(load, 30_000);
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
}, [currentCompany?.id]);

  // Load company-level cost code timing (punch_in or punch_out)
  useEffect(() => {
    if (!currentCompany?.id) return;
    (async () => {
      const { data } = await supabase
        .from('job_punch_clock_settings')
        .select('cost_code_selection_timing')
        .eq('company_id', currentCompany.id)
        .is('job_id', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setCostCodeTiming((data?.cost_code_selection_timing as 'punch_in' | 'punch_out') ?? 'punch_in');
    })();
  }, [currentCompany?.id]);

  const openDetailForActive = (row: CurrentStatus) => {
    const prof = profiles[row.user_id];
    const job = jobs[row.job_id];
    setSelectedDetail({
      id: row.id,
      punch_time: row.punch_in_time,
      punch_type: 'punched_in',
      employee_name: prof?.display_name || ((prof?.first_name && prof?.last_name) ? `${prof.first_name} ${prof.last_name}` : 'Unknown Employee'),
      job_name: job?.name || 'Job',
      cost_code: row.cost_code_id && costCodes[row.cost_code_id]
        ? `${costCodes[row.cost_code_id].code} - ${costCodes[row.cost_code_id].description}`
        : '',
      latitude: row.punch_in_location_lat !== null && row.punch_in_location_lat !== undefined ? Number(row.punch_in_location_lat) : undefined,
      longitude: row.punch_in_location_lng !== null && row.punch_in_location_lng !== undefined ? Number(row.punch_in_location_lng) : undefined,
      photo_url: row.punch_in_photo_url || undefined,
      ip_address: undefined,
      user_agent: undefined,
      notes: undefined,
      job_latitude: job?.latitude,
      job_longitude: job?.longitude,
      job_address: job?.address,
      user_id: row.user_id,
      job_id: row.job_id,
      cost_code_id: row.cost_code_id,
      current_status_id: row.id,
    });
    setDetailOpen(true);
  };

  const openDetailForOut = (row: PunchRecord) => {
    const prof = profiles[row.user_id || row.pin_employee_id || ''];
    const job = row.job_id ? jobs[row.job_id] : undefined;
    setSelectedDetail({
      id: row.id,
      punch_time: row.punch_time,
      punch_type: row.punch_type,
      employee_name: prof?.display_name || ((prof?.first_name && prof?.last_name) ? `${prof.first_name} ${prof.last_name}` : 'Unknown Employee'),
      job_name: job?.name || 'Job',
      cost_code: row.cost_code_id && costCodes[row.cost_code_id]
        ? `${costCodes[row.cost_code_id].code} - ${costCodes[row.cost_code_id].description}`
        : '',
      latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : undefined,
      longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : undefined,
      photo_url: row.photo_url || undefined,
      ip_address: row.ip_address || undefined,
      user_agent: row.user_agent || undefined,
      notes: undefined,
      job_latitude: job?.latitude,
      job_longitude: job?.longitude,
      job_address: job?.address,
      // Ensure PunchDetailView can resolve cost code
      user_id: row.user_id,
      job_id: row.job_id || undefined,
      cost_code_id: row.cost_code_id || undefined,
    });
    setDetailOpen(true);
  };

  const loadAdminCostCodeOptions = async (row: CurrentStatus) => {
    if (!currentCompany?.id || !row.job_id) {
      setAdminCostCodeOptions([]);
      return;
    }

    try {
      setLoadingAdminCostCodes(true);
      setAdminCostCodeOptions([]);

      const { data: accessData, error: accessErr } = await supabase.functions.invoke('get-employee-timecard-access', {
        body: { company_id: currentCompany.id, employee_user_id: row.user_id },
      });

      if (accessErr) throw accessErr;

      // Edge function returns { access: { ... } }
      const access = accessData?.access || {};
      const assignedCostCodes: string[] = access.assigned_cost_codes || [];
      const hasGlobal: boolean = !!access.has_global_job_access;

      // Match PunchClockApp behavior: cost codes must belong to selected job, and be limited to assigned_cost_codes unless global
      if (!hasGlobal && (!assignedCostCodes || assignedCostCodes.length === 0)) {
        setAdminCostCodeOptions([]);
        return;
      }

      let query = supabase
        .from('cost_codes')
        .select('id, code, description')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .eq('job_id', row.job_id)
        .order('code');

      if (!hasGlobal) {
        query = query.in('id', assignedCostCodes);
      }

      const { data, error } = await query;
      if (error) throw error;

      setAdminCostCodeOptions((data || []) as any);
    } catch (e) {
      console.error('Error loading admin cost code options:', e);
      toast({
        title: 'Error',
        description: 'Failed to load cost codes for this job.',
        variant: 'destructive',
      });
      setAdminCostCodeOptions([]);
    } finally {
      setLoadingAdminCostCodes(false);
    }
  };

  const handleAdminPunchOut = async (row: CurrentStatus) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can punch out employees.",
        variant: "destructive",
      });
      return;
    }

    setEmployeeToPunchOut(row);
    setAdminSelectedCostCode(null);
    setConfirmPunchOutOpen(true);

    if (costCodeTiming === 'punch_out') {
      await loadAdminCostCodeOptions(row);
    }
  };

  const confirmAdminPunchOut = async () => {
    if (!employeeToPunchOut) return;

    // If cost code selection is done at punch-out, prefer the admin selection.
    // Otherwise, keep the employee's current punch cost code.
    const allowedIds = new Set(adminCostCodeOptions.map(o => o.id));
    const costCodeIdForPunchOut =
      costCodeTiming === 'punch_out'
        ? (adminSelectedCostCode || (employeeToPunchOut.cost_code_id && allowedIds.has(employeeToPunchOut.cost_code_id) ? employeeToPunchOut.cost_code_id : null))
        : employeeToPunchOut.cost_code_id;

    try {
      // Create punch out record
      const { error: punchError } = await supabase.from('punch_records').insert({
        user_id: employeeToPunchOut.user_id,
        company_id: currentCompany?.id,
        job_id: employeeToPunchOut.job_id,
        cost_code_id: costCodeIdForPunchOut ?? null,
        punch_type: 'punched_out',
        punch_time: new Date().toISOString(),
        latitude: null,
        longitude: null,
        photo_url: null,
        notes: 'Admin punch-out',
        user_agent: navigator.userAgent,
        ip_address: null // Browser can't directly access IP
      });

      if (punchError) throw punchError;

      // Clear current punch status by deleting the specific record
      const { error: clearError } = await supabase
        .from('current_punch_status')
        .delete()
        .eq('id', employeeToPunchOut.id);

      if (clearError) throw clearError;

      // Create time card entry
      const punchInTime = new Date(employeeToPunchOut.punch_in_time);
      const punchOutTime = new Date();
      const totalHours = Math.max(0, (punchOutTime.getTime() - punchInTime.getTime()) / (1000 * 60 * 60));

      const { data: timeCardData, error: timeCardError } = await supabase.from('time_cards').insert({
        user_id: employeeToPunchOut.user_id,
        company_id: currentCompany?.id,
        job_id: employeeToPunchOut.job_id,
        cost_code_id: costCodeIdForPunchOut ?? null,
        punch_in_time: employeeToPunchOut.punch_in_time,
        punch_out_time: punchOutTime.toISOString(),
        total_hours: totalHours,
        overtime_hours: Math.max(0, totalHours - 8),
        status: 'approved', // Admin punch-outs are auto-approved
        break_minutes: totalHours > 6 ? 30 : 0, // Auto break deduction
        notes: 'Admin punch-out',
        punch_in_location_lat: employeeToPunchOut.punch_in_location_lat,
        punch_in_location_lng: employeeToPunchOut.punch_in_location_lng,
        punch_out_location_lat: null,
        punch_out_location_lng: null,
        punch_in_photo_url: employeeToPunchOut.punch_in_photo_url,
        punch_out_photo_url: null,
        created_via_punch_clock: false,
        requires_approval: false,
        distance_warning: false
      }).select().single();

      if (timeCardError) throw timeCardError;

      toast({
        title: "Success",
        description: `Successfully punched out ${profiles[employeeToPunchOut.user_id]?.display_name || 'employee'}.`,
        action: timeCardData ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setSelectedTimeCardId(timeCardData.id);
              setTimeCardModalOpen(true);
            }}
          >
            View Time Card
          </Button>
        ) : undefined
      });

      // Immediately remove from local state to prevent re-appearance
      setActive(prev => prev.filter(a => a.user_id !== employeeToPunchOut.user_id));

      // Refresh the data after a short delay to get updated state
      setTimeout(() => {
        setActive(prev => prev.filter(a => a.user_id !== employeeToPunchOut.user_id));
      }, 1000);

    } catch (error: any) {
      console.error('Error punching out employee:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to punch out employee.",
        variant: "destructive",
      });
    } finally {
      setConfirmPunchOutOpen(false);
      setEmployeeToPunchOut(null);
      setAdminSelectedCostCode(null);
      setAdminCostCodeOptions([]);
    }
  };

  const loadPendingChangeRequests = async () => {
    if (!currentCompany?.id) return;
    
    // Load change requests
    const { data } = await supabase
        .from('time_card_change_requests')
        .select(`
          id,
          time_card_id,
          user_id,
          status,
          created_at,
          reason,
          proposed_punch_in_time,
          proposed_punch_out_time,
          proposed_job_id,
          proposed_cost_code_id,
          time_cards (
            id,
            user_id,
            job_id,
            cost_code_id,
            company_id,
            punch_in_time,
            punch_out_time,
            total_hours,
            status
          )
        `)
        .eq('status', 'pending')
        .eq('time_cards.company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      const deduped = (data || [])
        .reduce((acc: Map<string, any>, cr: any) => {
          const key = cr.time_card_id || cr.id;
          const existing = acc.get(key);
          if (!existing || new Date(cr.created_at) > new Date(existing.created_at)) {
            acc.set(key, cr);
          }
          return acc;
        }, new Map<string, any>());
      setPendingChangeRequests(Array.from(deduped.values()));
      
      // Load regular time cards that need approval (no change request)
      const { data: timeCardsData } = await supabase
        .from('time_cards')
        .select('id, user_id, job_id, cost_code_id, punch_in_time, punch_out_time, total_hours, status, created_at')
        .eq('company_id', currentCompany.id)
        .in('status', ['submitted', 'pending'])
        .is('deleted_at', null)
        .is('approved_at', null)
        .order('created_at', { ascending: false })
        .limit(20);
      
      // Filter out time cards that have pending change requests
      const changeRequestTimeCardIds = new Set(Array.from(deduped.values()).map(cr => cr.time_card_id));
      const pendingCards = (timeCardsData || []).filter(tc => !changeRequestTimeCardIds.has(tc.id));
      setPendingTimeCards(pendingCards);
      
      // Load profiles, jobs, and cost codes for both change requests and time cards
      if ((data && data.length > 0) || (pendingCards && pendingCards.length > 0)) {
        const userIds = Array.from(new Set([
          ...(data || []).map(cr => cr.user_id),
          ...(pendingCards || []).map(tc => tc.user_id)
        ]));
        const jobIds = Array.from(new Set([
          ...(data || []).map(cr => cr.time_cards?.job_id).filter(Boolean),
          ...(data || []).map(cr => cr.proposed_job_id).filter(Boolean),
          ...(pendingCards || []).map(tc => tc.job_id).filter(Boolean)
        ])) as string[];
        const costCodeIds = Array.from(new Set([
          ...(data || []).map(cr => cr.time_cards?.cost_code_id).filter(Boolean),
          ...(data || []).map(cr => cr.proposed_cost_code_id).filter(Boolean),
          ...(pendingCards || []).map(tc => tc.cost_code_id).filter(Boolean)
        ])) as string[];
        
        if (userIds.length) {
          const [profilesResponse, pinEmployeesResponse] = await Promise.all([
            supabase
              .from('profiles')
              .select('user_id, display_name, avatar_url')
              .in('user_id', userIds),
            supabase
              .from('pin_employees')
              .select('id, first_name, last_name, display_name, avatar_url')
              .eq('company_id', currentCompany.id)
              .in('id', userIds)
          ]);
          
          const profMap: Record<string, Profile> = {};
          (profilesResponse.data || []).forEach(p => { profMap[p.user_id] = p; });
          (pinEmployeesResponse.data || []).forEach(p => { 
            profMap[p.id] = {
              user_id: p.id,
              display_name: p.display_name || `${p.first_name} ${p.last_name}`,
              avatar_url: p.avatar_url
            };
          });
          setProfiles(prev => ({ ...prev, ...profMap }));
        }
        
        if (jobIds.length) {
          const { data: jobsData } = await supabase
            .from('jobs')
            .select('id, name')
            .eq('company_id', currentCompany.id)
            .in('id', jobIds);
          const jobMap: Record<string, Job> = {};
          (jobsData || []).forEach(j => { jobMap[j.id] = j; });
          setJobs(prev => ({ ...prev, ...jobMap }));
        }
        
        if (costCodeIds.length) {
          const { data: costCodesData } = await supabase
            .from('cost_codes')
            .select('id, code, description')
            .eq('company_id', currentCompany.id)
            .in('id', costCodeIds);
          const ccMap: Record<string, { code: string; description: string }> = {};
          (costCodesData || []).forEach(cc => { ccMap[cc.id] = { code: cc.code, description: cc.description }; });
          setCostCodes(prev => ({ ...prev, ...ccMap }));
        }
      }
  };

  useEffect(() => {
    if (!currentCompany?.id) return;
    
    loadPendingChangeRequests();
    
    // Set up real-time subscriptions for both change requests and time cards
    const channel = supabase
      .channel('pending-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_card_change_requests'
        },
        () => {
          loadPendingChangeRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_cards',
          filter: `company_id=eq.${currentCompany.id}`
        },
        () => {
          loadPendingChangeRequests();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
    }, [currentCompany?.id]);

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full space-y-0">
        <div className="p-6 border-b bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Punch Clock Dashboard</h1>
              <p className="text-sm md:text-base text-muted-foreground">Live overview of employee punch activity</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/time-sheets">
                  <FileText className="h-4 w-4 mr-2" />
                  Time Sheets
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/punch-clock/reports">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Time Card Reports
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-0">
          {/* Left Side - Pending Approval (40%) */}
          <Card className="w-full rounded-none border-l-0 border-t-0 border-b lg:border-b-0 lg:border-r">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-6 w-6" />
                Pending Approval ({pendingChangeRequests.length + pendingTimeCards.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
              {pendingChangeRequests.length === 0 && pendingTimeCards.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground text-lg">None pending approval</p>
                </div>
              ) : (
                <>
                  {/* Change Requests */}
                  {pendingChangeRequests.map((cr) => {
                  const prof = profiles[cr.user_id];
                  const tc = cr.time_cards;
                  const job = tc?.job_id ? jobs[tc.job_id] : undefined;
                  
                  return (
                    <div 
                      key={cr.id} 
                      className="p-4 rounded-lg border bg-card/50 hover:bg-primary/5 hover:border-primary cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedTimeCardId(tc?.id || null);
                        setTimeCardModalOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={prof?.avatar_url} />
                          <AvatarFallback className="text-lg">{(prof?.display_name || 'E').substring(0,1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-lg truncate">{prof?.display_name || (prof?.first_name && prof?.last_name ? `${prof.first_name} ${prof.last_name}` : 'Unknown Employee')}</div>
                          <div className="text-sm text-muted-foreground truncate">{job?.name || 'Job'}</div>
                          {tc?.punch_in_time && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                              <Clock className="h-4 w-4" /> {format(new Date(tc.punch_in_time), 'MMM d, h:mm a')}
                            </div>
                          )}
                          {tc?.total_hours && (
                            <div className="text-sm font-medium text-primary mt-1">
                              {tc.total_hours.toFixed(2)} hours
                            </div>
                          )}
                          {cr.reason && (
                            <div className="text-xs text-muted-foreground mt-2 italic line-clamp-2">
                              <span className="font-semibold">Reason:</span> {cr.reason}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary">
                          Pending Review
                        </Badge>
                      </div>
                    </div>
                  );
                  })}
                  
                  {/* Regular Time Cards Needing Approval */}
                  {pendingTimeCards.map((tc) => {
                    const prof = profiles[tc.user_id];
                    const job = tc.job_id ? jobs[tc.job_id] : undefined;
                    
                    return (
                      <div 
                        key={tc.id} 
                        className="p-4 rounded-lg border bg-card/50 hover:bg-primary/5 hover:border-primary cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedTimeCardId(tc.id);
                          setTimeCardModalOpen(true);
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={prof?.avatar_url} />
                            <AvatarFallback className="text-lg">{(prof?.display_name || 'E').substring(0,1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-lg truncate">{prof?.display_name || (prof?.first_name && prof?.last_name ? `${prof.first_name} ${prof.last_name}` : 'Unknown Employee')}</div>
                            <div className="text-sm text-muted-foreground truncate">{job?.name || 'Job'}</div>
                            {tc.punch_in_time && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                                <Clock className="h-4 w-4" /> {format(new Date(tc.punch_in_time), 'MMM d, h:mm a')}
                              </div>
                            )}
                            {tc.total_hours && (
                              <div className="text-sm font-medium text-primary mt-1">
                                {tc.total_hours.toFixed(2)} hours
                              </div>
                            )}
                          </div>
                          <Badge variant="default">
                            Needs Approval
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>

          {/* Right Side - Punched In/Out */}
          <div className="flex flex-col">
            {/* Currently Punched In */}
            <Card className="w-full rounded-none border-r-0 border-t-0 border-x-0 lg:border-t-0 flex-1">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Users className="h-6 w-6" />
                  Currently Punched In ({active.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 overflow-y-auto" style={{ maxHeight: '400px' }}>
                {active.length === 0 && (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground">No employees are currently punched in.</p>
                  </div>
                )}
                {active.slice(0, 8).map((row) => {
                  const prof = profiles[row.user_id];
                  const job = jobs[row.job_id];
                  return (
                     <div 
                       key={row.id} 
                       className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card/50 hover:bg-primary/10 hover:border-primary cursor-pointer transition-colors"
                       onClick={() => openDetailForActive(row)}
                     >
                       <div className="flex items-center gap-3 min-w-0 flex-1">
                         <Avatar className="h-10 w-10">
                            <AvatarImage src={(
                              () => {
                                const url = (prof?.avatar_url || row.punch_in_photo_url || undefined) as string | undefined;
                                if (!url) return undefined;
                                if (url.startsWith('http')) return url;
                                const { data } = supabase.storage.from('punch-photos').getPublicUrl(url);
                                return data.publicUrl || undefined;
                              }
                            )()} />
                           <AvatarFallback>{(prof?.display_name || 'E').substring(0,1).toUpperCase()}</AvatarFallback>
                         </Avatar>
                           <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate">{prof?.display_name || (prof?.first_name && prof?.last_name ? `${prof.first_name} ${prof.last_name}` : 'Unknown Employee')}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{job?.name || 'Job'}</span>
                              <span className="inline-flex items-center gap-1 shrink-0">
                                <Clock className="h-3 w-3" /> {format(new Date(row.punch_in_time), 'h:mm a')}
                              </span>
                              {row.punch_in_location_lat && row.punch_in_location_lng && (
                                <span className="inline-flex items-center gap-1 shrink-0">
                                  <MapPin className="h-3 w-3" />
                                </span>
                              )}
                              {costCodeTiming === 'punch_in' && row.cost_code_id && costCodes[row.cost_code_id] && (
                                <span className="font-medium text-primary truncate">
                                  {costCodes[row.cost_code_id].code}
                                </span>
                              )}
                            </div>
                          </div>
                       </div>
                     </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Currently Punched Out */}
            <Card className="w-full rounded-none border-r-0 border-b-0 border-x-0 flex-1">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock className="h-6 w-6" />
                  Currently Punched Out ({recentOuts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 overflow-y-auto" style={{ maxHeight: '400px' }}>
                {recentOuts.length === 0 && (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground">No recent punch outs.</p>
                  </div>
                )}
                {recentOuts.slice(0, 8).map((row) => {
                  const prof = profiles[row.user_id || row.pin_employee_id || ''];
                  const job = row.job_id ? jobs[row.job_id] : undefined;
                  return (
                     <div key={row.id} onClick={() => openDetailForOut(row)} role="button" tabIndex={0} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card/50 hover:bg-primary/10 hover:border-primary cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50">
                       <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={(
                              () => {
                                const url = (prof?.avatar_url || row.photo_url || undefined) as string | undefined;
                                if (!url) return undefined;
                                if (url.startsWith('http')) return url;
                                const { data } = supabase.storage.from('punch-photos').getPublicUrl(url);
                                return data.publicUrl || undefined;
                              }
                            )()} />
                            <AvatarFallback>{(prof?.display_name || 'E').substring(0,1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                         <div className="min-w-0 flex-1">
                           <div className="font-semibold truncate">{prof?.display_name || (prof?.first_name && prof?.last_name ? `${prof.first_name} ${prof.last_name}` : 'Unknown Employee')}</div>
                           <div className="flex items-center gap-2 text-xs text-muted-foreground">
                             <span className="truncate">{job?.name || 'Unknown Job'}</span>
                             <span className="inline-flex items-center gap-1 shrink-0">
                               <Clock className="h-3 w-3" /> {format(new Date(row.punch_time), 'h:mm a')}
                             </span>
                           </div>
                         </div>
                       </div>
                     </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <PunchDetailView 
        open={detailOpen} 
        onOpenChange={setDetailOpen} 
        punch={selectedDetail}
        showPunchOutButton={isAdmin && selectedDetail?.punch_type === 'punched_in'}
        onPunchOut={(userId) => {
          const currentStatus = active.find(a => a.user_id === userId);
          if (currentStatus) {
            handleAdminPunchOut(currentStatus);
            setDetailOpen(false);
          }
        }}
      />
      
      <TimeCardDetailModal 
        open={timeCardModalOpen} 
        onOpenChange={(open) => {
          setTimeCardModalOpen(open);
          if (!open) {
            loadPendingChangeRequests();
          }
        }} 
        timeCardId={selectedTimeCardId || undefined} 
      />

      <AlertDialog open={confirmPunchOutOpen} onOpenChange={setConfirmPunchOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Punch Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to punch out {employeeToPunchOut ? profiles[employeeToPunchOut.user_id]?.display_name || 'this employee' : 'this employee'}?
              This action will create a time card entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {costCodeTiming === 'punch_out' && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Daily Task (optional)</label>
                <Select value={adminSelectedCostCode || ''} onValueChange={(v) => setAdminSelectedCostCode(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingAdminCostCodes ? 'Loading cost codes...' : 'Select a cost code (optional)'} />
                  </SelectTrigger>
                  <SelectContent>
                    {adminCostCodeOptions.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (employeeToPunchOut) {
                // temporarily set selectedDetail to pass optional cost code to PunchDetailView if needed
                if (adminSelectedCostCode) {
                  employeeToPunchOut.cost_code_id = adminSelectedCostCode as any;
                }
                confirmAdminPunchOut();
              }
            }}>
              Punch Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
