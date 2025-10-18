import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, Building2, Users, MapPin, Clock, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';

interface VisitorOnSite {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  company_name?: string;
  check_in_time: string;
  purpose_of_visit?: string;
  visitor_photo_url?: string;
  subcontractor?: {
    company_name: string;
  };
}

interface EmployeeOnSite {
  id: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  avatar_url?: string;
  check_in_time: string;
}

interface VisitorDashboardProps {
  jobId: string;
  companyName: string;
  jobName: string;
}

export function VisitorDashboard({ jobId, companyName }: VisitorDashboardProps) {
  const { toast } = useToast();
  const [visitors, setVisitors] = useState<VisitorOnSite[]>([]);
  const [employees, setEmployees] = useState<EmployeeOnSite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOnSiteData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadOnSiteData, 30000);
    return () => clearInterval(interval);
  }, [jobId]);

  const loadOnSiteData = async () => {
    try {
      // Load visitors currently on site
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitor_logs')
        .select(`
          *
        `)
        .eq('job_id', jobId)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false });

      if (visitorError) throw visitorError;

      // Fetch subcontractor data
      const visitorDataWithSubs = visitorData || [];
      const subcontractorIds = visitorDataWithSubs
        .map(v => v.subcontractor_id)
        .filter(Boolean);

      let subcontractorMap: Record<string, { company_name: string }> = {};

      if (subcontractorIds.length > 0) {
        const { data: subData } = await supabase
          .from('job_subcontractors')
          .select('id, company_name')
          .in('id', subcontractorIds);

        if (subData) {
          subcontractorMap = subData.reduce((acc, sub) => {
            acc[sub.id] = { company_name: sub.company_name };
            return acc;
          }, {} as Record<string, { company_name: string }>);
        }
      }

      const visitorsWithSubs = visitorDataWithSubs.map(v => ({
        ...v,
        subcontractor: v.subcontractor_id ? subcontractorMap[v.subcontractor_id] : undefined
      }));

      setVisitors(visitorsWithSubs);

      // Load employees currently on site (from current_punch_status)
      const { data: employeeData, error: employeeError } = await supabase
        .from('current_punch_status')
        .select('id, user_id, punch_in_time')
        .eq('job_id', jobId)
        .eq('is_active', true);

      if (employeeError) throw employeeError;

      // Fetch profile data separately
      const userIds = (employeeData || []).map(e => e.user_id);
      let profilesMap: Record<string, { first_name: string; last_name: string; display_name?: string; avatar_url?: string }> = {};

      if (userIds.length > 0) {
        try {
          const { data: profRes } = await supabase.functions.invoke('get-employee-profiles', {
            body: { user_ids: userIds },
          });
          if (profRes?.profiles) {
            profilesMap = (profRes.profiles as any[]).reduce((acc, profile: any) => {
              acc[profile.user_id] = profile;
              return acc;
            }, {} as Record<string, { first_name: string; last_name: string; display_name?: string; avatar_url?: string }>);
          }
        } catch (e) {
          console.error('Profiles fetch failed', e);
        }
      }

      const employeesList = (employeeData || []).map(emp => {
        const profile = profilesMap[emp.user_id];
        const first = profile?.first_name || 'Unknown';
        const last = profile?.last_name || 'Employee';
        return {
          id: emp.id,
          first_name: first,
          last_name: last,
          display_name: profile?.display_name || `${first} ${last}`,
          avatar_url: profile?.avatar_url,
          check_in_time: emp.punch_in_time
        };
      });

      setEmployees(employeesList);
    } catch (error) {
      console.error('Error loading on-site data:', error);
      toast({
        title: "Error",
        description: "Failed to load on-site data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVisitorCheckOut = async (visitorId: string) => {
    try {
      const { error } = await supabase
        .from('visitor_logs')
        .update({ check_out_time: new Date().toISOString() })
        .eq('id', visitorId);

      if (error) throw error;
      toast({ title: 'Checked out', description: 'Visitor has been checked out.' });
      loadOnSiteData();
    } catch (err) {
      console.error('Manual checkout failed:', err);
      toast({ title: 'Checkout failed', description: 'Could not check out visitor.', variant: 'destructive' });
    }
  };
  // Group visitors by company
  const visitorsByCompany = visitors.reduce((acc, visitor) => {
    const company = visitor.company_name || visitor.subcontractor?.company_name || 'Unknown Company';
    if (!acc[company]) {
      acc[company] = [];
    }
    acc[company].push(visitor);
    return acc;
  }, {} as Record<string, VisitorOnSite[]>);

  const calculateDuration = (checkInTime: string) => {
    const start = parseISO(checkInTime);
    const now = new Date();
    const minutes = Math.round((now.getTime() - start.getTime()) / (1000 * 60));
    
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading on-site data...</div>
        </CardContent>
      </Card>
    );
  }

  const totalOnSite = visitors.length + employees.length;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-green-600" />
              <span>Currently On Site</span>
            </div>
            <Badge variant="default" className="text-lg">
              {totalOnSite}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Visitors</p>
                <p className="text-xl font-bold">{visitors.length}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Employees</p>
                <p className="text-xl font-bold">{employees.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GC Employees */}
      <Card>
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ChevronRight className="h-4 w-4 transition-transform ui-state-open:rotate-90" />
                  <Building2 className="h-5 w-5" />
                  <span>{companyName} (GC)</span>
                </div>
                <Badge variant="secondary">{employees.length}</Badge>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-2">
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No employees currently on site
                </p>
              ) : (
                employees.map((employee) => (
                  <div 
                    key={employee.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-primary/10 hover:border-primary transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={employee.avatar_url} alt={employee.display_name || `${employee.first_name} ${employee.last_name}`} />
                        <AvatarFallback>
                          {employee.first_name[0]}{employee.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {employee.display_name || `${employee.first_name} ${employee.last_name}`}
                        </p>
                        <p className="text-xs text-muted-foreground">Employee</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{calculateDuration(employee.check_in_time)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Visitors by Company */}
      {Object.keys(visitorsByCompany).length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              No visitors currently on site
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(visitorsByCompany).map(([company, companyVisitors]) => (
          <Card key={company}>
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ChevronRight className="h-4 w-4 transition-transform ui-state-open:rotate-90" />
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <span>{company}</span>
                    </div>
                    <Badge variant="secondary">{companyVisitors.length}</Badge>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2">
                  {companyVisitors.map((visitor) => (
                    <div 
                      key={visitor.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-primary/10 hover:border-primary transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={visitor.visitor_photo_url} alt={visitor.visitor_name} />
                          <AvatarFallback>
                            {visitor.visitor_name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{visitor.visitor_name}</p>
                          <p className="text-xs text-muted-foreground">{visitor.visitor_phone}</p>
                          {visitor.purpose_of_visit && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Purpose: {visitor.purpose_of_visit}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{calculateDuration(visitor.check_in_time)}</span>
                        <Button size="sm" variant="outline" onClick={() => handleVisitorCheckOut(visitor.id)}>
                          <LogOut className="h-4 w-4 mr-1" />
                          Check Out
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))
      )}
    </div>
  );
}
