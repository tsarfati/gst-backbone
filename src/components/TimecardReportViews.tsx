import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Clock, User, MapPin, FileText, Download, TrendingUp, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PunchDetailView from '@/components/PunchDetailView';

interface TimeCardRecord {
  id: string;
  user_id: string;
  employee_name: string;
  job_name: string;
  cost_code: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  overtime_hours: number;
  break_minutes: number;
  status: string;
  notes?: string;
  punch_in_location?: string;
  punch_out_location?: string;
}

interface ReportSummary {
  totalRecords: number;
  totalHours: number;
  totalOvertimeHours: number;
  totalRegularHours: number;
  uniqueEmployees: number;
  uniqueJobs: number;
  averageHoursPerDay: number;
}

interface TimecardReportViewsProps {
  records: TimeCardRecord[];
  summary: ReportSummary;
  loading: boolean;
  onExportPDF: (reportType: string, data: any) => void;
}

export default function TimecardReportViews({
  records,
  summary,
  loading,
  onExportPDF
}: TimecardReportViewsProps) {
  const [selectedView, setSelectedView] = useState('detailed');
  const [selectedPunch, setSelectedPunch] = useState<any>(null);
  const [showPunchDetail, setShowPunchDetail] = useState(false);
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      case 'corrected': return 'outline';
      default: return 'outline';
    }
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const handleViewPunchDetails = async (record: TimeCardRecord) => {
    try {
      // Fetch detailed punch records for this timecard
      const { data: punchRecords, error } = await supabase
        .from('punch_records')
        .select(`
          id,
          punch_time,
          punch_type,
          latitude,
          longitude,
          photo_url,
          ip_address,
          user_agent,
          notes,
          profiles!punch_records_user_id_fkey(display_name),
          jobs!punch_records_job_id_fkey(name),
          cost_codes!punch_records_cost_code_id_fkey(code)
        `)
        .eq('user_id', record.user_id)
        .gte('punch_time', record.punch_in_time)
        .lte('punch_time', record.punch_out_time)
        .order('punch_time', { ascending: true });

      if (error) throw error;

      if (punchRecords && punchRecords.length > 0) {
        // Show the first punch record (punch in) - you could modify this to show both in/out
        const punchData = {
          id: punchRecords[0].id,
          punch_time: punchRecords[0].punch_time,
          punch_type: punchRecords[0].punch_type,
          employee_name: record.employee_name,
          job_name: record.job_name,
          cost_code: record.cost_code,
          latitude: punchRecords[0].latitude,
          longitude: punchRecords[0].longitude,
          photo_url: punchRecords[0].photo_url,
          ip_address: punchRecords[0].ip_address,
          user_agent: punchRecords[0].user_agent,
          notes: punchRecords[0].notes
        };

        setSelectedPunch(punchData);
        setShowPunchDetail(true);
      } else {
        toast({
          title: 'No Details Found',
          description: 'No punch records found for this timecard entry.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching punch details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load punch details.',
        variant: 'destructive'
      });
    }
  };

  // Employee Summary Data
  const employeeSummary = records.reduce((acc, record) => {
    const employeeId = record.user_id;
    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee_name: record.employee_name,
        total_hours: 0,
        overtime_hours: 0,
        regular_hours: 0,
        total_records: 0,
        jobs: new Set()
      };
    }
    acc[employeeId].total_hours += record.total_hours;
    acc[employeeId].overtime_hours += record.overtime_hours;
    acc[employeeId].regular_hours += (record.total_hours - record.overtime_hours);
    acc[employeeId].total_records += 1;
    acc[employeeId].jobs.add(record.job_name);
    return acc;
  }, {} as Record<string, any>);

  // Job Summary Data
  const jobSummary = records.reduce((acc, record) => {
    const jobName = record.job_name;
    if (!acc[jobName]) {
      acc[jobName] = {
        job_name: jobName,
        total_hours: 0,
        overtime_hours: 0,
        total_records: 0,
        unique_employees: new Set()
      };
    }
    acc[jobName].total_hours += record.total_hours;
    acc[jobName].overtime_hours += record.overtime_hours;
    acc[jobName].total_records += 1;
    acc[jobName].unique_employees.add(record.user_id);
    return acc;
  }, {} as Record<string, any>);

  // Date Range Summary
  const dateRangeSummary = records.reduce((acc, record) => {
    const date = format(new Date(record.punch_in_time), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = {
        date,
        total_hours: 0,
        overtime_hours: 0,
        total_records: 0,
        unique_employees: new Set()
      };
    }
    acc[date].total_hours += record.total_hours;
    acc[date].overtime_hours += record.overtime_hours;
    acc[date].total_records += 1;
    acc[date].unique_employees.add(record.user_id);
    return acc;
  }, {} as Record<string, any>);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">Loading report data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Total Records</div>
            </div>
            <div className="text-2xl font-bold">{summary.totalRecords}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Total Hours</div>
            </div>
            <div className="text-2xl font-bold">{summary.totalHours.toFixed(1)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <div className="text-sm font-medium">Overtime Hours</div>
            </div>
            <div className="text-2xl font-bold text-orange-600">{summary.totalOvertimeHours.toFixed(1)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium">Employees</div>
            </div>
            <div className="text-2xl font-bold">{summary.uniqueEmployees}</div>
          </CardContent>
        </Card>
      </div>

      {/* Report Views */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Timecard Reports
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onExportPDF(selectedView, selectedView === 'detailed' ? records : 
                selectedView === 'employee' ? Object.values(employeeSummary) :
                selectedView === 'job' ? Object.values(jobSummary) :
                Object.values(dateRangeSummary))}
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedView} onValueChange={setSelectedView}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="detailed">Detailed Report</TabsTrigger>
              <TabsTrigger value="employee">By Employee</TabsTrigger>
              <TabsTrigger value="job">By Job</TabsTrigger>
              <TabsTrigger value="date">By Date Range</TabsTrigger>
            </TabsList>

            <TabsContent value="detailed" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Cost Code</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>In Time</TableHead>
                      <TableHead>Out Time</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Break Time</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.employee_name}</TableCell>
                        <TableCell>{record.job_name}</TableCell>
                        <TableCell>{record.cost_code}</TableCell>
                        <TableCell>{format(new Date(record.punch_in_time), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{format(new Date(record.punch_in_time), 'h:mm a')}</TableCell>
                        <TableCell>{format(new Date(record.punch_out_time), 'h:mm a')}</TableCell>
                        <TableCell>{formatDuration(record.total_hours)}</TableCell>
                        <TableCell className="text-blue-600">
                          {record.break_minutes > 0 ? `${record.break_minutes}m` : '-'}
                        </TableCell>
                        <TableCell className={record.overtime_hours > 0 ? 'text-orange-600 font-medium' : ''}>
                          {record.overtime_hours > 0 ? formatDuration(record.overtime_hours) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(record.status)}>
                            {record.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {record.notes || '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewPunchDetails(record)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="employee" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Total Records</TableHead>
                      <TableHead>Regular Hours</TableHead>
                      <TableHead>Overtime Hours</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Jobs Worked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(employeeSummary).map((employee: any) => (
                      <TableRow key={employee.employee_name}>
                        <TableCell className="font-medium">{employee.employee_name}</TableCell>
                        <TableCell>{employee.total_records}</TableCell>
                        <TableCell>{formatDuration(employee.regular_hours)}</TableCell>
                        <TableCell className={employee.overtime_hours > 0 ? 'text-orange-600 font-medium' : ''}>
                          {employee.overtime_hours > 0 ? formatDuration(employee.overtime_hours) : '-'}
                        </TableCell>
                        <TableCell className="font-medium">{formatDuration(employee.total_hours)}</TableCell>
                        <TableCell>{employee.jobs.size}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="job" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Total Records</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Overtime Hours</TableHead>
                      <TableHead>Avg Hours/Day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(jobSummary).map((job: any) => (
                      <TableRow key={job.job_name}>
                        <TableCell className="font-medium">{job.job_name}</TableCell>
                        <TableCell>{job.total_records}</TableCell>
                        <TableCell>{job.unique_employees.size}</TableCell>
                        <TableCell className="font-medium">{formatDuration(job.total_hours)}</TableCell>
                        <TableCell className={job.overtime_hours > 0 ? 'text-orange-600 font-medium' : ''}>
                          {job.overtime_hours > 0 ? formatDuration(job.overtime_hours) : '-'}
                        </TableCell>
                        <TableCell>{(job.total_hours / job.total_records).toFixed(1)}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="date" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Overtime Hours</TableHead>
                      <TableHead>Avg Hours/Employee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(dateRangeSummary)
                      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((day: any) => (
                        <TableRow key={day.date}>
                          <TableCell className="font-medium">
                            {format(new Date(day.date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>{day.total_records}</TableCell>
                          <TableCell>{day.unique_employees.size}</TableCell>
                          <TableCell className="font-medium">{formatDuration(day.total_hours)}</TableCell>
                          <TableCell className={day.overtime_hours > 0 ? 'text-orange-600 font-medium' : ''}>
                            {day.overtime_hours > 0 ? formatDuration(day.overtime_hours) : '-'}
                          </TableCell>
                          <TableCell>{(day.total_hours / day.unique_employees.size).toFixed(1)}h</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Punch Detail Modal */}
      <PunchDetailView
        punch={selectedPunch}
        open={showPunchDetail}
        onOpenChange={setShowPunchDetail}
      />
    </div>
  );
}