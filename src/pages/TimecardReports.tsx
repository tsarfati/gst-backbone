import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, subDays } from 'date-fns';
import TimecardReportFilters from '@/components/TimecardReportFilters';
import TimecardReportViews from '@/components/TimecardReportViews';
import { exportTimecardToPDF, ReportData, CompanyBranding } from '@/utils/pdfExport';

interface Employee {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
}

interface Job {
  id: string;
  name: string;
  address?: string;
}

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

interface FilterState {
  employees: string[];
  jobs: string[];
  startDate?: Date;
  endDate?: Date;
  locations: string[];
  hasNotes: boolean;
  hasOvertime: boolean;
  status: string[];
}

export default function TimecardReports() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<TimeCardRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [company, setCompany] = useState<CompanyBranding | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    employees: [],
    jobs: [],
    startDate: startOfWeek(new Date()),
    endDate: endOfWeek(new Date()),
    locations: [],
    hasNotes: false,
    hasOvertime: false,
    status: []
  });

  const isManager = ['admin', 'controller', 'project_manager', 'manager'].includes(profile?.role as string);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    await Promise.all([
      loadEmployees(),
      loadJobs(),
      loadCompany()
    ]);
    loadTimecardRecords();
  };

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, first_name, last_name')
        .order('display_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, address')
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadCompany = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile?.current_company_id || user?.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setCompany({
          name: data.name,
          logo_url: data.logo_url,
          address: data.address,
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
          phone: data.phone,
          email: data.email
        });
      }
    } catch (error) {
      console.error('Error loading company:', error);
    }
  };

  const loadTimecardRecords = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('time_cards')
        .select(`
          id,
          user_id,
          job_id,
          cost_code_id,
          punch_in_time,
          punch_out_time,
          total_hours,
          overtime_hours,
          break_minutes,
          status,
          notes,
          punch_in_location_lat,
          punch_in_location_lng,
          punch_out_location_lat,
          punch_out_location_lng
        `)
        .order('punch_in_time', { ascending: false });

      // Apply filters
      if (filters.employees.length > 0) {
        query = query.in('user_id', filters.employees);
      } else if (!isManager) {
        // Non-managers can only see their own records
        query = query.eq('user_id', user?.id);
      }

      if (filters.jobs.length > 0) {
        query = query.in('job_id', filters.jobs);
      }

      if (filters.startDate) {
        query = query.gte('punch_in_time', filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte('punch_out_time', filters.endDate.toISOString());
      }

      if (filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters.hasNotes) {
        query = query.not('notes', 'is', null);
      }

      if (filters.hasOvertime) {
        query = query.gt('overtime_hours', 0);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get additional data for display
      const jobIds = [...new Set((data || []).map(r => r.job_id).filter(Boolean))];
      const costCodeIds = [...new Set((data || []).map(r => r.cost_code_id).filter(Boolean))];
      const userIds = [...new Set((data || []).map(r => r.user_id))];

      const [jobsData, costCodesData, profilesData] = await Promise.all([
        jobIds.length > 0 ? supabase.from('jobs').select('id, name').in('id', jobIds) : { data: [] },
        costCodeIds.length > 0 ? supabase.from('cost_codes').select('id, code, description').in('id', costCodeIds) : { data: [] },
        userIds.length > 0 ? supabase.from('profiles').select('user_id, display_name, first_name, last_name').in('user_id', userIds) : { data: [] }
      ]);

      const jobsMap = new Map((jobsData.data || []).map(job => [job.id, job]));
      const costCodesMap = new Map((costCodesData.data || []).map(code => [code.id, code]));
      const profilesMap = new Map((profilesData.data || []).map(profile => [profile.user_id, profile]));

      // Transform the data
      const transformedRecords: TimeCardRecord[] = (data || []).map(record => {
        const job = jobsMap.get(record.job_id);
        const costCode = costCodesMap.get(record.cost_code_id);
        const profile = profilesMap.get(record.user_id);
        
        return {
          id: record.id,
          user_id: record.user_id,
          employee_name: profile?.display_name || `${profile?.first_name} ${profile?.last_name}` || 'Unknown Employee',
          job_name: job?.name || 'Unknown Job',
          cost_code: costCode ? `${costCode.code} - ${costCode.description}` : 'Unknown Code',
          punch_in_time: record.punch_in_time,
          punch_out_time: record.punch_out_time,
          total_hours: parseFloat(record.total_hours.toString()) || 0,
          overtime_hours: parseFloat(record.overtime_hours.toString()) || 0,
          break_minutes: record.break_minutes || 0,
          status: record.status,
          notes: record.notes,
          punch_in_location: record.punch_in_location_lat && record.punch_in_location_lng 
            ? `${record.punch_in_location_lat}, ${record.punch_in_location_lng}` 
            : undefined,
          punch_out_location: record.punch_out_location_lat && record.punch_out_location_lng 
            ? `${record.punch_out_location_lat}, ${record.punch_out_location_lng}` 
            : undefined,
        };
      });

      setRecords(transformedRecords);
      console.log('TimecardReports: loaded', transformedRecords.length, 'records');
    } catch (error) {
      console.error('Error loading timecard records:', error);
      toast({
        title: "Error",
        description: "Failed to load timecard records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    loadTimecardRecords();
  };

  const handleClearFilters = () => {
    setFilters({
      employees: [],
      jobs: [],
      startDate: startOfWeek(new Date()),
      endDate: endOfWeek(new Date()),
      locations: [],
      hasNotes: false,
      hasOvertime: false,
      status: []
    });
  };

  const checkForUnapprovedPunches = async (): Promise<boolean> => {
    try {
      let query = supabase
        .from('time_cards')
        .select('id, status')
        .neq('status', 'approved');

      // Apply date filters if they exist
      if (filters.startDate) {
        query = query.gte('punch_in_time', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('punch_out_time', filters.endDate.toISOString());
      }

      // Apply employee filters if they exist
      if (filters.employees.length > 0) {
        query = query.in('user_id', filters.employees);
      } else if (!isManager) {
        query = query.eq('user_id', user?.id);
      }

      // Apply job filters if they exist
      if (filters.jobs.length > 0) {
        query = query.in('job_id', filters.jobs);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).length > 0;
    } catch (error) {
      console.error('Error checking for unapproved punches:', error);
      return false;
    }
  };

  const handleExportPDF = async (reportType: string, data: any) => {
    if (!company) {
      toast({
        title: "Error",
        description: "Company information not available for PDF export",
        variant: "destructive",
      });
      return;
    }

    // Check for unapproved punches
    const hasUnapprovedPunches = await checkForUnapprovedPunches();
    if (hasUnapprovedPunches) {
      toast({
        title: "Cannot Generate Report",
        description: "There are unapproved time cards in the selected date range. Please approve all time cards before generating reports.",
        variant: "destructive",
      });
      return;
    }

    try {
      const reportData: ReportData = {
        title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Timecard Report`,
        dateRange: filters.startDate && filters.endDate 
          ? `${filters.startDate.toLocaleDateString()} - ${filters.endDate.toLocaleDateString()}`
          : 'All Time',
        employee: filters.employees.length === 1 
          ? employees.find(e => e.user_id === filters.employees[0])?.display_name 
          : undefined,
        data,
        totals: {
          totalHours: summary.totalHours,
          overtimeHours: summary.totalOvertimeHours,
          regularHours: summary.totalRegularHours
        }
      };

      await exportTimecardToPDF(reportData, company);
      
      toast({
        title: "Export Complete",
        description: "PDF report has been downloaded successfully",
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Export Error",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    }
  };

  // Calculate summary data
  const summary = {
    totalRecords: records.length,
    totalHours: records.reduce((sum, record) => sum + record.total_hours, 0),
    totalOvertimeHours: records.reduce((sum, record) => sum + record.overtime_hours, 0),
    totalRegularHours: records.reduce((sum, record) => sum + (record.total_hours - record.overtime_hours), 0),
    uniqueEmployees: new Set(records.map(r => r.user_id)).size,
    uniqueJobs: new Set(records.map(r => r.job_name)).size,
    averageHoursPerDay: records.length > 0 ? records.reduce((sum, record) => sum + record.total_hours, 0) / records.length : 0
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-7 w-7" />
            Timecard Reports
          </h1>
          <p className="text-muted-foreground">
            Comprehensive timecard reporting and analytics
          </p>
        </div>
        <Button variant="outline" onClick={loadTimecardRecords} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <div className="space-y-6">
        {/* Filters */}
        <TimecardReportFilters
          filters={filters}
          onFiltersChange={setFilters}
          employees={employees}
          jobs={jobs}
          onApplyFilters={handleApplyFilters}
          onClearFilters={handleClearFilters}
          loading={loading}
        />

        {/* Report Views */}
        <TimecardReportViews
          records={records}
          summary={summary}
          loading={loading}
          onExportPDF={handleExportPDF}
        />
      </div>
    </div>
  );
}