import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';

interface VisitorLog {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  company_name?: string;
  check_in_time: string;
  check_out_time?: string;
  purpose_of_visit?: string;
  subcontractor?: {
    company_name: string;
  };
}

interface VisitorReportsPageProps {
  jobId: string;
  jobName: string;
}

export function VisitorReportsPage({ jobId, jobName }: VisitorReportsPageProps) {
  const { toast } = useToast();
  const [visitors, setVisitors] = useState<VisitorLog[]>([]);
  const [filteredVisitors, setFilteredVisitors] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [reportType, setReportType] = useState<'range' | 'daily'>('range');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dailyDate, setDailyDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [companies, setCompanies] = useState<string[]>([]);

  useEffect(() => {
    loadVisitorLogs();
  }, [jobId]);

  useEffect(() => {
    applyFilters();
  }, [visitors, companyFilter, startDate, endDate, reportType, dailyDate]);

  const loadVisitorLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('visitor_logs')
        .select('*')
        .eq('job_id', jobId)
        .order('check_in_time', { ascending: false });

      if (error) throw error;

      const visitorData = data || [];
      const subcontractorIds = visitorData.map(v => v.subcontractor_id).filter(Boolean);

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

      const visitorsWithSubs = visitorData.map(v => ({
        ...v,
        subcontractor: v.subcontractor_id ? subcontractorMap[v.subcontractor_id] : undefined
      }));

      setVisitors(visitorsWithSubs);

      // Extract unique companies
      const uniqueCompanies = Array.from(
        new Set(
          visitorsWithSubs
            .map(v => v.company_name || v.subcontractor?.company_name)
            .filter(Boolean)
        )
      ) as string[];
      setCompanies(uniqueCompanies);
    } catch (error) {
      console.error('Error loading visitor logs:', error);
      toast({
        title: "Error",
        description: "Failed to load visitor logs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...visitors];

    // Company filter
    if (companyFilter !== 'all') {
      filtered = filtered.filter(visitor => {
        const company = visitor.company_name || visitor.subcontractor?.company_name;
        return company === companyFilter;
      });
    }

    // Report type filter
    if (reportType === 'daily') {
      const targetDate = new Date(dailyDate);
      const targetStart = new Date(targetDate);
      targetStart.setHours(0, 0, 0, 0);
      const targetEnd = new Date(targetDate);
      targetEnd.setHours(23, 59, 59, 999);

      filtered = filtered.filter(visitor => {
        const checkInDate = parseISO(visitor.check_in_time);
        return checkInDate >= targetStart && checkInDate <= targetEnd;
      });
    } else {
      // Date range filter
      if (startDate) {
        const start = new Date(startDate);
        filtered = filtered.filter(visitor => {
          const checkInDate = parseISO(visitor.check_in_time);
          return checkInDate >= start;
        });
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(visitor => {
          const checkInDate = parseISO(visitor.check_in_time);
          return checkInDate <= end;
        });
      }
    }

    setFilteredVisitors(filtered);
  };

  const exportToCSV = () => {
    const headers = [
      'Name',
      'Phone',
      'Company',
      'Check In Time',
      'Check Out Time',
      'Duration (minutes)',
      'Purpose',
    ];

    const csvData = filteredVisitors.map(visitor => {
      const checkIn = parseISO(visitor.check_in_time);
      const checkOut = visitor.check_out_time ? parseISO(visitor.check_out_time) : null;
      const duration = checkOut ? 
        Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60)) : 
        '';

      return [
        visitor.visitor_name,
        visitor.visitor_phone,
        visitor.company_name || visitor.subcontractor?.company_name || '',
        format(checkIn, 'yyyy-MM-dd HH:mm:ss'),
        checkOut ? format(checkOut, 'yyyy-MM-dd HH:mm:ss') : 'Still on site',
        duration,
        visitor.purpose_of_visit || '',
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitor-report-${jobName}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const calculateDuration = (checkIn: string, checkOut?: string) => {
    const start = parseISO(checkIn);
    const end = checkOut ? parseISO(checkOut) : new Date();
    const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    
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
          <div className="text-center">Loading visitor reports...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Visitor Reports - {jobName}</span>
          </h3>
          <p className="text-muted-foreground">
            Filter and export visitor data
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={filteredVisitors.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Report Type Selector */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={reportType === 'range' ? 'default' : 'outline'}
                onClick={() => setReportType('range')}
                className="w-full"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Date Range
              </Button>
              <Button
                variant={reportType === 'daily' ? 'default' : 'outline'}
                onClick={() => setReportType('daily')}
                className="w-full"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Daily Report
              </Button>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company} value={company}>
                        {company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {reportType === 'daily' ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>Report Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dailyDate}
                      onChange={(e) => setDailyDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {reportType === 'daily' 
                  ? `Showing ${filteredVisitors.length} visitor(s) for ${format(new Date(dailyDate), 'MMMM d, yyyy')}`
                  : `Showing ${filteredVisitors.length} of ${visitors.length} visitors`
                }
              </p>
              {(companyFilter !== 'all' || (reportType === 'range' && (startDate || endDate))) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCompanyFilter('all');
                    if (reportType === 'range') {
                      setStartDate('');
                      setEndDate('');
                    }
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visitor</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No visitors found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredVisitors.map((visitor) => (
                  <TableRow key={visitor.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{visitor.visitor_name}</p>
                        <p className="text-sm text-muted-foreground">{visitor.visitor_phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {visitor.company_name || visitor.subcontractor?.company_name || 'Not specified'}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(visitor.check_in_time), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell>
                      {visitor.check_out_time 
                        ? format(parseISO(visitor.check_out_time), 'MMM d, h:mm a')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {calculateDuration(visitor.check_in_time, visitor.check_out_time)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={visitor.check_out_time ? 'secondary' : 'default'}>
                        {visitor.check_out_time ? 'Checked Out' : 'On Site'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
