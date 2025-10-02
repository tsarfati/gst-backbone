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
}

interface Job { id: string; name: string; latitude?: number | null; longitude?: number | null; address?: string | null }

interface PunchRecord {
  id: string;
  user_id: string;
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
      
      // Load active punches for users in this company
      const { data: activeData } = await supabase
        .from('current_punch_status')
        .select('*')
        .eq('is_active', true)
        .in('user_id', companyUserIds)
        .order('punch_in_time', { ascending: false });

      setActive(activeData || []);
      console.log('PunchClockDashboard: active count', (activeData || []).length);

      const userIds = Array.from(new Set((activeData || []).map(a => a.user_id)));
      const jobIds = Array.from(new Set((activeData || []).map(a => a.job_id).filter(Boolean))) as string[];

      if (userIds.length) {
        // Load both regular profiles and PIN employees
        const [profilesResponse, pinEmployeesResponse] = await Promise.all([
          supabase
            .from('profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', userIds),
          supabase
            .from('pin_employees')
            .select('id, first_name, last_name, display_name, avatar_url')
            .in('id', userIds)
        ]);
        
        const profMap: Record<string, Profile> = {};
        // Regular profiles
        (profilesResponse.data || []).forEach(p => { profMap[p.user_id] = p; });
        // PIN employees
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
        .select('id, user_id, job_id, cost_code_id, punch_time, punch_type, latitude, longitude, photo_url, ip_address, user_agent')
        .eq('company_id', currentCompany.id)
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
      const outUserIds = recentOuts.map(r => r.user_id);
      const outJobIds = Array.from(new Set(recentOuts.map(r => r.job_id).filter(Boolean))) as string[];
      
      if (outUserIds.length) {
        const [profilesResponse, pinEmployeesResponse] = await Promise.all([
          supabase
            .from('profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', outUserIds),
          supabase
            .from('pin_employees')
            .select('id, first_name, last_name, display_name, avatar_url')
            .in('id', outUserIds)
        ]);
        
        const profMap: Record<string, Profile> = {};
        // Regular profiles
        (profilesResponse.data || []).forEach(p => { profMap[p.user_id] = p; });
        // PIN employees
        (pinEmployeesResponse.data || []).forEach(p => { 
          profMap[p.id] = {
            user_id: p.id,
            display_name: p.display_name || `${p.first_name} ${p.last_name}`,
            avatar_url: p.avatar_url
          };
        });
        setProfiles(prev => ({ ...prev, ...profMap }));
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

  const openDetailForActive = (row: CurrentStatus) => {
    const prof = profiles[row.user_id];
    const job = jobs[row.job_id];
    setSelectedDetail({
      id: row.id,
      punch_time: row.punch_in_time,
      punch_type: 'punched_in',
      employee_name: prof?.display_name || 'Employee',
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
    });
    setDetailOpen(true);
  };

  const openDetailForOut = (row: PunchRecord) => {
    const prof = profiles[row.user_id];
    const job = row.job_id ? jobs[row.job_id] : undefined;
    setSelectedDetail({
      id: row.id,
      punch_time: row.punch_time,
      punch_type: row.punch_type,
      employee_name: prof?.display_name || 'Employee',
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
    });
    setDetailOpen(true);
  };

  const handleAdminPunchOut = (row: CurrentStatus) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can punch out employees.",
        variant: "destructive",
      });
      return;
    }

    setEmployeeToPunchOut(row);
    setConfirmPunchOutOpen(true);
  };

  const confirmAdminPunchOut = async () => {
    if (!employeeToPunchOut) return;

    try {
      // Create punch out record
      const { error: punchError } = await supabase.from('punch_records').insert({
        user_id: employeeToPunchOut.user_id,
        company_id: currentCompany?.id,
        job_id: employeeToPunchOut.job_id,
        cost_code_id: employeeToPunchOut.cost_code_id,
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
        cost_code_id: employeeToPunchOut.cost_code_id,
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
    }
  };

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

        <div className={`grid ${active.length === 0 && recentOuts.length === 0 ? 'grid-rows-1' : active.length === 0 || recentOuts.length === 0 ? 'grid-rows-1' : 'grid-rows-2'} h-full`}>
          {/* Currently Punched In */}
          <Card className="w-full rounded-none border-x-0 border-t-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-6 w-6" />
                Currently Punched In ({active.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 min-h-0 overflow-y-auto">
              {active.length === 0 && (
                <div className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground text-lg">No employees are currently punched in.</p>
                </div>
              )}
              {active.map((row) => {
                const prof = profiles[row.user_id];
                const job = jobs[row.job_id];
                return (
                   <div key={row.id} className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50">
                     <div className="flex items-center gap-4 min-w-0 flex-1">
                       <Avatar className="h-12 w-12">
                          <AvatarImage src={(
                            () => {
                              const url = (prof?.avatar_url || row.punch_in_photo_url || undefined) as string | undefined;
                              if (!url) return undefined;
                              if (url.startsWith('http')) return url;
                              const { data } = supabase.storage.from('punch-photos').getPublicUrl(url);
                              return data.publicUrl || undefined;
                            }
                          )()} />
                         <AvatarFallback className="text-lg">{(prof?.display_name || 'E').substring(0,1).toUpperCase()}</AvatarFallback>
                       </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-lg truncate">{prof?.display_name || 'Employee'}</div>
                          <div className="text-sm text-muted-foreground truncate">{job?.name || 'Job'}</div>
                          {row.cost_code_id && costCodes[row.cost_code_id] && (
                            <div className="text-sm font-medium text-primary mt-1">
                              {costCodes[row.cost_code_id].code} - {costCodes[row.cost_code_id].description}
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-2">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-4 w-4" /> {format(new Date(row.punch_in_time), 'MMM d, h:mm a')}
                            </span>
                            {row.punch_in_location_lat && row.punch_in_location_lng && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                Location Available
                              </span>
                            )}
                          </div>
                        </div>
                     </div>
                      {isAdmin ? (
                        <div className="flex gap-2">
                          <Button size="lg" variant="outline" onClick={() => openDetailForActive(row)}>
                            View Details
                          </Button>
                          <Button 
                            size="lg" 
                            variant="destructive" 
                            onClick={() => handleAdminPunchOut(row)}
                          >
                            Punch Out
                          </Button>
                        </div>
                      ) : (
                        <Button size="lg" variant="outline" onClick={() => openDetailForActive(row)}>
                          View Details
                        </Button>
                      )}
                   </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Recently Punched Out */}
          {(recentOuts.length > 0 || active.length === 0) && (
            <Card className="w-full rounded-none border-x-0 border-b-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock className="h-6 w-6" />
                  Recently Punched Out ({recentOuts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 min-h-0 overflow-y-auto">
                {recentOuts.length === 0 && (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground text-lg">No recent punch outs.</p>
                  </div>
                )}
                {recentOuts.map((row) => {
                  const prof = profiles[row.user_id];
                  const job = row.job_id ? jobs[row.job_id] : undefined;
                  return (
                     <div key={row.id} onClick={() => openDetailForOut(row)} role="button" tabIndex={0} className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card/50 hover:bg-accent cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50">
                       <div className="flex items-center gap-4 min-w-0 flex-1">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={(
                              () => {
                                const url = (prof?.avatar_url || row.photo_url || undefined) as string | undefined;
                                if (!url) return undefined;
                                if (url.startsWith('http')) return url;
                                const { data } = supabase.storage.from('punch-photos').getPublicUrl(url);
                                return data.publicUrl || undefined;
                              }
                            )()} />
                            <AvatarFallback className="text-lg">{(prof?.display_name || 'E').substring(0,1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                         <div className="min-w-0 flex-1">
                           <div className="font-semibold text-lg truncate">{prof?.display_name || 'Employee'}</div>
                           <div className="text-sm text-muted-foreground truncate">{job?.name || 'Unknown Job'}</div>
                           <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                             <Clock className="h-4 w-4" /> {format(new Date(row.punch_time), 'MMM d, h:mm a')}
                           </div>
                         </div>
                       </div>
                     </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <PunchDetailView open={detailOpen} onOpenChange={setDetailOpen} punch={selectedDetail} />
      
      <TimeCardDetailModal 
        open={timeCardModalOpen} 
        onOpenChange={setTimeCardModalOpen} 
        timeCardId={selectedTimeCardId || undefined} 
      />

      <AlertDialog open={confirmPunchOutOpen} onOpenChange={setConfirmPunchOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Punch Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to punch out {employeeToPunchOut ? profiles[employeeToPunchOut.user_id]?.display_name || 'this employee' : 'this employee'}? 
              This action will create a time card entry and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAdminPunchOut}>
              Punch Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
