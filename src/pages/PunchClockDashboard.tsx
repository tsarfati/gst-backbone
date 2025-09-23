import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import PunchDetailView from '@/components/PunchDetailView';

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

interface Job { id: string; name: string }

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
  const [active, setActive] = useState<CurrentStatus[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [recentOuts, setRecentOuts] = useState<PunchRecord[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      // Load active punches
      const { data: activeData } = await supabase
        .from('current_punch_status')
        .select('*')
        .eq('is_active', true)
        .order('punch_in_time', { ascending: false });

      setActive(activeData || []);

      const userIds = Array.from(new Set((activeData || []).map(a => a.user_id)));
      const jobIds = Array.from(new Set((activeData || []).map(a => a.job_id).filter(Boolean))) as string[];

      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        const profMap: Record<string, Profile> = {};
        (profs || []).forEach(p => { profMap[p.user_id] = p; });
        setProfiles(prev => ({ ...prev, ...profMap }));
      }

      if (jobIds.length) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, name')
          .in('id', jobIds);
        const jobMap: Record<string, Job> = {};
        (jobsData || []).forEach(j => { jobMap[j.id] = j; });
        setJobs(prev => ({ ...prev, ...jobMap }));
      }

      // Load recent punch outs (last 24h), dedupe by user
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: outsData } = await supabase
        .from('punch_records')
        .select('id, user_id, job_id, cost_code_id, punch_time, punch_type, latitude, longitude, photo_url, ip_address, user_agent')
        .eq('punch_type', 'punched_out')
        .gte('punch_time', since)
        .order('punch_time', { ascending: false })
        .limit(200);

      const activeUserIds = new Set((activeData || []).map(a => a.user_id));
      const deduped: Record<string, PunchRecord> = {};
      (outsData || []).forEach((r) => {
        if (activeUserIds.has(r.user_id)) return; // skip if currently punched in
        if (!deduped[r.user_id]) deduped[r.user_id] = r;
      });

      setRecentOuts(Object.values(deduped));

      // Preload profiles for outs
      const outUserIds = Object.keys(deduped);
      if (outUserIds.length) {
        const { data: outProfs } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', outUserIds);
        const profMap: Record<string, Profile> = {};
        (outProfs || []).forEach(p => { profMap[p.user_id] = p; });
        setProfiles(prev => ({ ...prev, ...profMap }));
      }
    };

    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  const openDetailForActive = (row: CurrentStatus) => {
    const prof = profiles[row.user_id];
    const job = jobs[row.job_id];
    setSelectedDetail({
      id: row.id,
      punch_time: row.punch_in_time,
      punch_type: 'punched_in',
      employee_name: prof?.display_name || 'Employee',
      job_name: job?.name || 'Job',
      cost_code: row.cost_code_id || '',
      latitude: row.punch_in_location_lat || undefined,
      longitude: row.punch_in_location_lng || undefined,
      photo_url: row.punch_in_photo_url || undefined,
      ip_address: undefined,
      user_agent: undefined,
      notes: undefined,
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
      cost_code: row.cost_code_id || '',
      latitude: row.latitude || undefined,
      longitude: row.longitude || undefined,
      photo_url: row.photo_url || undefined,
      ip_address: row.ip_address || undefined,
      user_agent: row.user_agent || undefined,
      notes: undefined,
    });
    setDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="w-full max-w-[420px] sm:max-w-3xl mx-auto px-4 py-4 md:px-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Punch Clock Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">Live overview of employee punch activity</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Punched In */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Currently Punched In ({active.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {active.length === 0 && (
                <p className="text-muted-foreground">No employees are currently punched in.</p>
              )}
              {active.map((row) => {
                const prof = profiles[row.user_id];
                const job = jobs[row.job_id];
                return (
                  <div key={row.id} className="flex items-center justify-between gap-3 p-3 rounded-md border">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={prof?.avatar_url || undefined} />
                        <AvatarFallback>{(prof?.display_name || 'E').substring(0,1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{prof?.display_name || 'Employee'}</div>
                        <div className="text-xs text-muted-foreground truncate">{job?.name || 'Job'}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" /> {format(new Date(row.punch_in_time), 'PP pp')}
                          {row.punch_in_location_lat && row.punch_in_location_lng && (
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{row.punch_in_location_lat.toFixed(3)}, {row.punch_in_location_lng.toFixed(3)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openDetailForActive(row)}>View</Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Punched Out */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recently Punched Out ({recentOuts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentOuts.length === 0 && (
                <p className="text-muted-foreground">No recent punch outs.</p>
              )}
              {recentOuts.map((row) => {
                const prof = profiles[row.user_id];
                const job = row.job_id ? jobs[row.job_id] : undefined;
                return (
                  <div key={row.id} className="flex items-center justify-between gap-3 p-3 rounded-md border">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={prof?.avatar_url || undefined} />
                        <AvatarFallback>{(prof?.display_name || 'E').substring(0,1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{prof?.display_name || 'Employee'}</div>
                        <div className="text-xs text-muted-foreground truncate">{job?.name || 'Job'}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" /> {format(new Date(row.punch_time), 'PP pp')}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openDetailForOut(row)}>View</Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <PunchDetailView open={detailOpen} onOpenChange={setDetailOpen} punch={selectedDetail} />
    </div>
  );
}
