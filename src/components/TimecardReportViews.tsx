import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, BarChart3, Clock, MapPin, Eye } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PunchDetailView from "@/components/PunchDetailView";

interface TimeCardRecord {
  id: string;
  user_id: string;
  employee_id: string;
  employee_name: string;
  job_id: string;
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
  over_12h?: boolean;
  over_24h?: boolean;
}

interface ReportSummary {
  totalRecords: number;
  totalHours: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  uniqueEmployees: number;
  uniqueJobs: number;
  averageHoursPerDay: number;
}

interface TimecardReportViewsProps {
  records: TimeCardRecord[];
  summary: ReportSummary;
  loading: boolean;
  onExportPDF: (reportType: string, data: any) => void;
  onExportExcel?: (reportType: string, data: any) => void;
  showNotes?: boolean;
}

export default function TimecardReportViews({
  records,
  summary,
  loading,
  onExportPDF,
  onExportExcel,
  showNotes = false
}: TimecardReportViewsProps) {
  const [selectedView, setSelectedView] = useState('detailed');
  const [selectedPunch, setSelectedPunch] = useState<any>(null);
  const [showPunchDetail, setShowPunchDetail] = useState(false);
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const handleViewPunchDetails = async (record: TimeCardRecord) => {
    try {
      const { data: timecard } = await supabase
        .from('time_cards')
        .select('*')
        .eq('id', record.id)
        .single();

      if (timecard) {
        let jobData = null;
        if (timecard.job_id) {
          const { data: job } = await supabase
            .from('jobs')
            .select('job_name, job_number, address, city, state, zip_code')
            .eq('id', timecard.job_id)
            .single();
          jobData = job;
        }

        setSelectedPunch({
          id: record.id,
          punch_time: timecard.punch_in_time,
          punch_type: 'punched_in',
          employee_name: record.employee_name,
          job_name: record.job_name,
          job_data: jobData,
          cost_code: record.cost_code,
          latitude: timecard.punch_in_location_lat,
          longitude: timecard.punch_in_location_lng,
          photo_url: timecard.punch_in_photo_url,
          notes: timecard.notes,
          punch_out_time: timecard.punch_out_time,
          punch_out_latitude: timecard.punch_out_location_lat,
          punch_out_longitude: timecard.punch_out_location_lng,
          punch_out_photo_url: timecard.punch_out_photo_url,
          total_hours: timecard.total_hours,
          overtime_hours: timecard.overtime_hours,
          status: timecard.status
        });
        setShowPunchDetail(true);
      }
    } catch (error) {
      console.error('Error loading punch details:', error);
      toast({
        title: "Error",
        description: "Failed to load punch details",
        variant: "destructive"
      });
    }
  };

  const employeeSummary = records.reduce((acc, record) => {
    const key = record.employee_name;
    if (!acc[key]) {
      acc[key] = {
        employee_name: record.employee_name,
        total_hours: 0,
        overtime_hours: 0,
        total_records: 0,
      };
    }
    acc[key].total_hours += record.total_hours;
    acc[key].overtime_hours += record.overtime_hours;
    acc[key].total_records += 1;
    return acc;
  }, {} as Record<string, any>);

  const jobSummary = records.reduce((acc, record) => {
    const key = record.job_name;
    if (!acc[key]) {
      acc[key] = {
        job_name: record.job_name,
        total_hours: 0,
        overtime_hours: 0,
        total_records: 0,
      };
    }
    acc[key].total_hours += record.total_hours;
    acc[key].overtime_hours += record.overtime_hours;
    acc[key].total_records += 1;
    return acc;
  }, {} as Record<string, any>);

  const dateRangeSummary = records.reduce((acc, record) => {
    const date = format(new Date(record.punch_in_time), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = {
        date: date,
        total_hours: 0,
        overtime_hours: 0,
        total_records: 0,
      };
    }
    acc[date].total_hours += record.total_hours;
    acc[date].overtime_hours += record.overtime_hours;
    acc[date].total_records += 1;
    return acc;
  }, {} as Record<string, any>);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading timecard records...</div>
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No timecard records found for the selected criteria.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRecords}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(summary.totalHours)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Regular Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(summary.totalRegularHours)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overtime Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(summary.totalOvertimeHours)}</div>
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
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onExportPDF('detailed', records)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              {onExportExcel && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onExportExcel(selectedView, selectedView === 'detailed' ? records : 
                    selectedView === 'employee' ? Object.values(employeeSummary) :
                    selectedView === 'job' ? Object.values(jobSummary) :
                    Object.values(dateRangeSummary))}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedView} onValueChange={setSelectedView}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="detailed" className="flex-1">Detailed View</TabsTrigger>
              <TabsTrigger value="employee" className="flex-1">By Employee</TabsTrigger>
              <TabsTrigger value="job" className="flex-1">By Job</TabsTrigger>
              <TabsTrigger value="date" className="flex-1">By Date</TabsTrigger>
            </TabsList>

            {/* Detailed View */}
            <TabsContent value="detailed">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Cost Code</TableHead>
                      <TableHead>Punch In</TableHead>
                      <TableHead>Punch Out</TableHead>
                      <TableHead>Break</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Status</TableHead>
                      {showNotes && <TableHead>Notes</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow 
                        key={record.id}
                        className="cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => handleViewPunchDetails(record)}
                      >
                        <TableCell className="font-medium">{record.employee_name}</TableCell>
                        <TableCell>{record.job_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{record.cost_code}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(record.punch_in_time), "MM/dd hh:mm a")}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.punch_out_time ? (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(record.punch_out_time), "MM/dd hh:mm a")}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {record.break_minutes ? `${record.break_minutes} min` : "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {formatDuration(record.total_hours)}
                            {record.over_24h && (
                              <Badge variant="destructive" className="text-xs">24h+</Badge>
                            )}
                            {!record.over_24h && record.over_12h && (
                              <Badge variant="secondary" className="text-xs">12h+</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-orange-600">
                          {record.overtime_hours > 0 ? formatDuration(record.overtime_hours) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(record.status)}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        {showNotes && (
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {record.notes || "-"}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Employee Summary View */}
            <TabsContent value="employee">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Overtime Hours</TableHead>
                      <TableHead>Average Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(employeeSummary).map((emp: any) => (
                      <TableRow key={emp.employee_name}>
                        <TableCell className="font-medium">{emp.employee_name}</TableCell>
                        <TableCell>{emp.total_records}</TableCell>
                        <TableCell className="font-medium">{formatDuration(emp.total_hours)}</TableCell>
                        <TableCell className="text-orange-600">
                          {emp.overtime_hours > 0 ? formatDuration(emp.overtime_hours) : "-"}
                        </TableCell>
                        <TableCell>{formatDuration(emp.total_hours / emp.total_records)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Job Summary View */}
            <TabsContent value="job">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Overtime Hours</TableHead>
                      <TableHead>Average Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(jobSummary).map((job: any) => (
                      <TableRow key={job.job_name}>
                        <TableCell className="font-medium">{job.job_name}</TableCell>
                        <TableCell>{job.total_records}</TableCell>
                        <TableCell className="font-medium">{formatDuration(job.total_hours)}</TableCell>
                        <TableCell className="text-orange-600">
                          {job.overtime_hours > 0 ? formatDuration(job.overtime_hours) : "-"}
                        </TableCell>
                        <TableCell>{formatDuration(job.total_hours / job.total_records)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Date Range Summary View */}
            <TabsContent value="date">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Overtime Hours</TableHead>
                      <TableHead>Average Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(dateRangeSummary)
                      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((day: any) => (
                        <TableRow key={day.date}>
                          <TableCell className="font-medium">
                            {format(new Date(day.date), "EEEE, MMMM d, yyyy")}
                          </TableCell>
                          <TableCell>{day.total_records}</TableCell>
                          <TableCell className="font-medium">{formatDuration(day.total_hours)}</TableCell>
                          <TableCell className="text-orange-600">
                            {day.overtime_hours > 0 ? formatDuration(day.overtime_hours) : "-"}
                          </TableCell>
                          <TableCell>{formatDuration(day.total_hours / day.total_records)}</TableCell>
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
