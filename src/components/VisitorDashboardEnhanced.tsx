import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, Building2, Users, MapPin, Clock, Phone, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface VisitorOnSite {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  company_name?: string;
  check_in_time: string;
  purpose_of_visit?: string;
  notes?: string;
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

export function VisitorDashboardEnhanced({ jobId, companyName }: VisitorDashboardProps) {
  const { toast } = useToast();
  const [visitors, setVisitors] = useState<VisitorOnSite[]>([]);
  const [employees, setEmployees] = useState<EmployeeOnSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorOnSite | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOnSite | null>(null);
  const [focusedSection, setFocusedSection] = useState<string | null>(null);

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
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name, avatar_url')
          .in('user_id', userIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.user_id] = profile;
            return acc;
          }, {} as Record<string, { first_name: string; last_name: string; display_name?: string; avatar_url?: string }>);
        }
      }

      const employeesList = (employeeData || []).map(emp => {
        const profile = profilesMap[emp.user_id];
        return {
          id: emp.id,
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || '',
          display_name: profile?.display_name,
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
  const companiesOnSite = Object.keys(visitorsByCompany).length;

  return (
    <div className="space-y-6">
      {/* Summary Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total On Site */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary"
          onClick={() => setFocusedSection(focusedSection === 'all' ? null : 'all')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total On Site</p>
                <p className="text-4xl font-bold text-primary">{totalOnSite}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visitors */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-blue-500"
          onClick={() => setFocusedSection(focusedSection === 'visitors' ? null : 'visitors')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Visitors</p>
                <p className="text-4xl font-bold text-blue-600">{visitors.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employees */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-green-500"
          onClick={() => setFocusedSection(focusedSection === 'employees' ? null : 'employees')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Employees</p>
                <p className="text-4xl font-bold text-green-600">{employees.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Companies On Site */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-purple-500"
          onClick={() => setFocusedSection(focusedSection === 'companies' ? null : 'companies')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Companies</p>
                <p className="text-4xl font-bold text-purple-600">{companiesOnSite + 1}</p>
                <p className="text-xs text-muted-foreground">Including GC</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GC Employees */}
      {(!focusedSection || focusedSection === 'all' || focusedSection === 'employees') && (
        <Card>
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ChevronRight className="h-4 w-4 transition-transform ui-state-open:rotate-90" />
                    <Building2 className="h-5 w-5 text-green-600" />
                    <span>{companyName} (GC)</span>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">{employees.length}</Badge>
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
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={employee.avatar_url} />
                          <AvatarFallback className="bg-green-100 text-green-700">
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
      )}

      {/* Visitors by Company */}
      {(!focusedSection || focusedSection === 'all' || focusedSection === 'visitors' || focusedSection === 'companies') && (
        <>
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
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <ChevronRight className="h-4 w-4 transition-transform ui-state-open:rotate-90" />
                          <Building2 className="h-5 w-5 text-blue-600" />
                          <span>{company}</span>
                        </div>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">{companyVisitors.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-2">
                      {companyVisitors.map((visitor) => (
                        <div 
                          key={visitor.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedVisitor(visitor)}
                        >
                          <div>
                            <p className="font-medium">{visitor.visitor_name}</p>
                            <p className="text-xs text-muted-foreground">{visitor.visitor_phone}</p>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{calculateDuration(visitor.check_in_time)}</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </>
      )}

      {/* Visitor Details Dialog */}
      <Dialog open={!!selectedVisitor} onOpenChange={() => setSelectedVisitor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Visitor Details</DialogTitle>
          </DialogHeader>
          {selectedVisitor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedVisitor.visitor_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="flex items-center space-x-1">
                    <Phone className="h-3 w-3" />
                    <span>{selectedVisitor.visitor_phone}</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Company</p>
                  <p>{selectedVisitor.company_name || selectedVisitor.subcontractor?.company_name || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Check In Time</p>
                  <p>{format(parseISO(selectedVisitor.check_in_time), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Duration</p>
                  <p>{calculateDuration(selectedVisitor.check_in_time)}</p>
                </div>
                {selectedVisitor.purpose_of_visit && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Purpose of Visit</p>
                    <p className="flex items-start space-x-1">
                      <FileText className="h-3 w-3 mt-1" />
                      <span>{selectedVisitor.purpose_of_visit}</span>
                    </p>
                  </div>
                )}
                {selectedVisitor.notes && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Notes</p>
                    <p className="text-sm">{selectedVisitor.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Employee Details Dialog */}
      <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedEmployee.avatar_url} />
                  <AvatarFallback className="text-lg bg-green-100 text-green-700">
                    {selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xl font-semibold">
                    {selectedEmployee.display_name || `${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
                  </p>
                  <p className="text-sm text-muted-foreground">{companyName} Employee</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Check In Time</p>
                  <p>{format(parseISO(selectedEmployee.check_in_time), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Duration</p>
                  <p>{calculateDuration(selectedEmployee.check_in_time)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
