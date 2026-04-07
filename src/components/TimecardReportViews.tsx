import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, BarChart3, Clock, MapPin, Eye } from "lucide-react";
import TimeCardDetailView from "@/components/TimeCardDetailView";
import { useSettings } from "@/contexts/SettingsContext";
import {
  formatCompanyDate,
  formatCompanyDateTime,
  formatCompanyShortDate,
  getCompanyDateKey,
} from "@/utils/companyTimeZone";

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
  regular_hours: number;
  overtime_hours: number;
  hourly_rate?: number | null;
  labor_cost: number;
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
  totalLaborCost: number;
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
  const { settings } = useSettings();
  const companyTimeZone = settings.timeZone;
  const [selectedView, setSelectedView] = useState('detailed');
  const [selectedTimeCardId, setSelectedTimeCardId] = useState<string | null>(null);
  const [showTimeCardDetail, setShowTimeCardDetail] = useState(false);

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

  const formatCurrency = (amount: number) =>
    amount.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleViewPunchDetails = (record: TimeCardRecord) => {
    setSelectedTimeCardId(record.id);
    setShowTimeCardDetail(true);
  };

  const employeeSummary = records.reduce((acc, record) => {
    const key = record.employee_name;
    if (!acc[key]) {
      acc[key] = {
        employee_name: record.employee_name,
        total_hours: 0,
        overtime_hours: 0,
        total_labor_cost: 0,
        total_records: 0,
      };
    }
    acc[key].total_hours += record.total_hours;
    acc[key].overtime_hours += record.overtime_hours;
    acc[key].total_labor_cost += record.labor_cost || 0;
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
        total_labor_cost: 0,
        total_records: 0,
      };
    }
    acc[key].total_hours += record.total_hours;
    acc[key].overtime_hours += record.overtime_hours;
    acc[key].total_labor_cost += record.labor_cost || 0;
    acc[key].total_records += 1;
    return acc;
  }, {} as Record<string, any>);

  const dateRangeSummary = records.reduce((acc, record) => {
    const date = getCompanyDateKey(record.punch_in_time, companyTimeZone);
    if (!acc[date]) {
      acc[date] = {
        date: date,
        total_hours: 0,
        overtime_hours: 0,
        total_labor_cost: 0,
        total_records: 0,
      };
    }
    acc[date].total_hours += record.total_hours;
    acc[date].overtime_hours += record.overtime_hours;
    acc[date].total_labor_cost += record.labor_cost || 0;
    acc[date].total_records += 1;
    return acc;
  }, {} as Record<string, any>);

  // Group by Job -> Cost Code
  const costCodeByJobSummary = records.reduce((acc, record) => {
    const jobKey = record.job_name || 'Unassigned';
    if (!acc[jobKey]) {
      acc[jobKey] = {
        job_name: jobKey,
        cost_codes: {} as Record<string, any>,
        total_hours: 0,
        total_labor_cost: 0,
        total_records: 0,
      };
    }
    const ccKey = record.cost_code || 'No Cost Code';
    if (!acc[jobKey].cost_codes[ccKey]) {
      acc[jobKey].cost_codes[ccKey] = {
        cost_code: ccKey,
        total_hours: 0,
        overtime_hours: 0,
        total_labor_cost: 0,
        total_records: 0,
      };
    }
    acc[jobKey].cost_codes[ccKey].total_hours += record.total_hours;
    acc[jobKey].cost_codes[ccKey].overtime_hours += record.overtime_hours;
    acc[jobKey].cost_codes[ccKey].total_labor_cost += record.labor_cost || 0;
    acc[jobKey].cost_codes[ccKey].total_records += 1;
    acc[jobKey].total_hours += record.total_hours;
    acc[jobKey].total_labor_cost += record.labor_cost || 0;
    acc[jobKey].total_records += 1;
    return acc;
  }, {} as Record<string, any>);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground"><span className="loading-dots">Loading timecard records</span></div>
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Labor Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalLaborCost || 0)}</div>
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
                onClick={() => onExportPDF(selectedView, selectedView === 'detailed' ? records : 
                  selectedView === 'employee' ? Object.values(employeeSummary) :
                  selectedView === 'job' ? Object.values(jobSummary) :
                  selectedView === 'costcode' ? Object.values(costCodeByJobSummary) :
                  Object.values(dateRangeSummary))}
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
                    selectedView === 'costcode' ? Object.values(costCodeByJobSummary) :
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
              <TabsTrigger value="costcode" className="flex-1">By Cost Code</TabsTrigger>
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
                      <TableHead>Rate</TableHead>
                      <TableHead>Labor Cost</TableHead>
                      <TableHead>Status</TableHead>
                      {showNotes && <TableHead>Notes</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow 
                        key={record.id}
                        className={`cursor-pointer transition-colors ${
                          record.over_12h || record.over_24h 
                            ? 'bg-red-50 dark:bg-red-950/30 animate-pulse hover:bg-red-100 dark:hover:bg-red-950/50' 
                            : 'hover:bg-primary/10'
                        }`}
                        onClick={() => handleViewPunchDetails(record)}
                      >
                        <TableCell className="font-medium">{record.employee_name}</TableCell>
                        <TableCell>{record.job_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{record.cost_code}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {formatCompanyShortDate(record.punch_in_time, companyTimeZone)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.punch_out_time ? (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {formatCompanyShortDate(record.punch_out_time, companyTimeZone)}
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
                        <TableCell>{record.hourly_rate ? formatCurrency(record.hourly_rate) : "-"}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(record.labor_cost || 0)}</TableCell>
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
                      <TableHead>Labor Cost</TableHead>
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
                        <TableCell className="font-medium">{formatCurrency(emp.total_labor_cost || 0)}</TableCell>
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
                      <TableHead>Labor Cost</TableHead>
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
                        <TableCell className="font-medium">{formatCurrency(job.total_labor_cost || 0)}</TableCell>
                        <TableCell>{formatDuration(job.total_hours / job.total_records)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Cost Code by Job Summary View */}
            <TabsContent value="costcode">
              <div className="space-y-4">
                {Object.values(costCodeByJobSummary)
                  .sort((a: any, b: any) => b.total_hours - a.total_hours)
                  .map((job: any) => (
                    <div key={job.job_name} className="rounded-md border">
                      <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b">
                        <span className="font-semibold">{job.job_name}</span>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{job.total_records} records</span>
                          <span className="font-medium text-foreground">{formatDuration(job.total_hours)}</span>
                          <span className="font-medium text-foreground">{formatCurrency(job.total_labor_cost || 0)}</span>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cost Code</TableHead>
                            <TableHead>Records</TableHead>
                            <TableHead>Total Hours</TableHead>
                            <TableHead>Overtime Hours</TableHead>
                            <TableHead>Labor Cost</TableHead>
                            <TableHead>Average Hours</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.values(job.cost_codes)
                            .sort((a: any, b: any) => b.total_hours - a.total_hours)
                            .map((cc: any) => (
                              <TableRow key={cc.cost_code}>
                                <TableCell className="font-medium">{cc.cost_code}</TableCell>
                                <TableCell>{cc.total_records}</TableCell>
                                <TableCell className="font-medium">{formatDuration(cc.total_hours)}</TableCell>
                                <TableCell className="text-orange-600">
                                  {cc.overtime_hours > 0 ? formatDuration(cc.overtime_hours) : "-"}
                                </TableCell>
                                <TableCell className="font-medium">{formatCurrency(cc.total_labor_cost || 0)}</TableCell>
                                <TableCell>{formatDuration(cc.total_hours / cc.total_records)}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
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
                      <TableHead>Labor Cost</TableHead>
                      <TableHead>Average Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(dateRangeSummary)
                      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((day: any) => (
                        <TableRow key={day.date}>
                          <TableCell className="font-medium">
                            {formatCompanyDate(day.date, companyTimeZone)}
                          </TableCell>
                          <TableCell>{day.total_records}</TableCell>
                          <TableCell className="font-medium">{formatDuration(day.total_hours)}</TableCell>
                          <TableCell className="text-orange-600">
                            {day.overtime_hours > 0 ? formatDuration(day.overtime_hours) : "-"}
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(day.total_labor_cost || 0)}</TableCell>
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

      {/* Full Time Card Detail Modal */}
      {selectedTimeCardId && (
        <TimeCardDetailView
          open={showTimeCardDetail}
          onOpenChange={setShowTimeCardDetail}
          timeCardId={selectedTimeCardId}
        />
      )}
    </div>
  );
}
