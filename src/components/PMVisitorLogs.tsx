import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface VisitorLog {
  id: string;
  visitor_name: string;
  check_in_time: string;
  check_out_time?: string;
  job_name: string;
  job_address?: string;
}

interface JobVisitorCount {
  job_name: string;
  job_address?: string;
  count: number;
  visitors: VisitorLog[];
}

interface PMVisitorLogsProps {
  companyId: string;
}

export default function PMVisitorLogs({ companyId }: PMVisitorLogsProps) {
  const [visitorsByLocation, setVisitorsByLocation] = useState<JobVisitorCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodayVisitors();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('visitor-logs-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'visitor_logs',
      }, () => {
        loadTodayVisitors();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const loadTodayVisitors = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: logs, error } = await supabase
        .from('visitor_logs')
        .select(`
          id,
          visitor_name,
          check_in_time,
          check_out_time,
          job_id,
          jobs:job_id (
            name,
            address,
            company_id
          )
        `)
        .gte('check_in_time', today.toISOString())
        .order('check_in_time', { ascending: false });

      if (error) throw error;

      // Filter by company after fetching
      const companyLogs = logs?.filter((log: any) => log.jobs?.company_id === companyId) || [];

      // Group visitors by job
      const grouped = companyLogs.reduce((acc, log: any) => {
        const jobName = log.jobs?.name || 'Unknown Location';
        const jobAddress = log.jobs?.address;
        
        const existing = acc.find((g: JobVisitorCount) => g.job_name === jobName);
        
        const visitorLog: VisitorLog = {
          id: log.id,
          visitor_name: log.visitor_name,
          check_in_time: log.check_in_time,
          check_out_time: log.check_out_time,
          job_name: jobName,
          job_address: jobAddress,
        };

        if (existing) {
          existing.count++;
          existing.visitors.push(visitorLog);
        } else {
          acc.push({
            job_name: jobName,
            job_address: jobAddress,
            count: 1,
            visitors: [visitorLog],
          });
        }

        return acc;
      }, [] as JobVisitorCount[]) || [];

      setVisitorsByLocation(grouped);
    } catch (error) {
      console.error('Error loading visitor logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Visitors by Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (visitorsByLocation.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Visitors by Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No visitors today
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Visitors by Location</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visitorsByLocation.map((location, idx) => (
            <div key={idx} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">{location.job_name}</h3>
                  </div>
                  {location.job_address && (
                    <p className="text-sm text-muted-foreground ml-6">{location.job_address}</p>
                  )}
                </div>
                <Badge variant="secondary">{location.count} visitor{location.count !== 1 ? 's' : ''}</Badge>
              </div>

              <div className="space-y-2 ml-6">
                {location.visitors.map((visitor) => (
                  <div key={visitor.id} className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="font-medium">{visitor.visitor_name}</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>In: {format(new Date(visitor.check_in_time), 'h:mm a')}</span>
                      </div>
                      {visitor.check_out_time ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Out: {format(new Date(visitor.check_out_time), 'h:mm a')}</span>
                        </div>
                      ) : (
                        <Badge variant="default" className="text-xs">On Site</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
