import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, subDays } from 'date-fns';
import TimecardReportFilters from '@/components/TimecardReportFilters';
import TimecardReportViews from '@/components/TimecardReportViews';
import { PunchTrackingReport } from '@/components/PunchTrackingReport';
import { exportTimecardToPDF, ReportData, CompanyBranding } from '@/utils/pdfExport';
import { exportTimecardToExcel, ExcelReportData } from '@/utils/excelExport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Settings } from "lucide-react";

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
  showDeleted: boolean;
  showNotes: boolean;
}

export default function TimecardReports() {
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [records, setRecords] = useState<TimeCardRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [company, setCompany] = useState<CompanyBranding | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'timecards' | 'punches'>('timecards');
  const [punches, setPunches] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    employees: [],
    jobs: [],
    startDate: startOfWeek(new Date()),
    endDate: endOfWeek(new Date()),
    locations: [],
    hasNotes: false,
    hasOvertime: false,
    status: [],
    showDeleted: false,
    showNotes: false
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
    await Promise.all([
      loadTimecardRecords(),
      loadPunchRecords()
    ]);
  };

  const loadEmployees = async () => {
    if (!currentCompany?.id) return;
    
    try {
      // Get regular users for this company
      const { data: companyUsers } = await supabase
        .from('user_company_access')
        .select('user_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);
      
      const companyUserIds: string[] = (companyUsers || []).map(u => u.user_id);

      // Date range (use current filters)
      const startISO = filters.startDate ? new Date(Date.UTC(
        filters.startDate.getFullYear(),
        filters.startDate.getMonth(),
        filters.startDate.getDate(),
        0, 0, 0, 0
      )).toISOString() : undefined;
      const endISO = filters.endDate ? new Date(Date.UTC(
        filters.endDate.getFullYear(),
        filters.endDate.getMonth(),
        filters.endDate.getDate(),
        23, 59, 59, 999
      )).toISOString() : undefined;

      // Build candidate PIN employee IDs based on settings and activity within date range for THIS company
      const pinSettingsRes = await supabase
        .from('pin_employee_timecard_settings')
        .select('pin_employee_id')
        .eq('company_id', currentCompany.id);

      let tcQuery = supabase
        .from('time_cards')
        .select('user_id')
        .eq('company_id', currentCompany.id);
      if (startISO) tcQuery = tcQuery.gte('punch_in_time', startISO);
      if (endISO) tcQuery = tcQuery.lte('punch_in_time', endISO);
      const tcUsersRes = await tcQuery;

      let punchQuery = supabase
        .from('punch_records')
        .select('pin_employee_id')
        .eq('company_id', currentCompany.id);
      if (startISO) punchQuery = punchQuery.gte('punch_time', startISO);
      if (endISO) punchQuery = punchQuery.lte('punch_time', endISO);
      const punchPinsRes = await punchQuery;

      const pinFromSettings: string[] = (pinSettingsRes.data || []).map((r: any) => r.pin_employee_id);
      const pinFromTimeCards: string[] = (tcUsersRes.data || []).map((r: any) => r.user_id);
      const pinFromPunches: string[] = (punchPinsRes.data || []).map((r: any) => r.pin_employee_id).filter(Boolean);
      const candidatePinIds = Array.from(new Set([...pinFromSettings, ...pinFromTimeCards, ...pinFromPunches]));

      if (companyUserIds.length === 0 && candidatePinIds.length === 0) {
        setEmployees([]);
        return;
      }

      // Load regular users
      const profilesRes: any = await (supabase as any)
        .from('profiles')
        .select('user_id, display_name, first_name, last_name')
        .in('user_id', companyUserIds.length > 0 ? companyUserIds : ['00000000-0000-0000-0000-000000000000']);

      // Load PIN employees that actually appear for this company within the date range
      const pinRes: any = await (supabase as any)
        .from('pin_employees')
        .select('id, display_name, first_name, last_name')
        .eq('is_active', true)
        .in('id', candidatePinIds.length > 0 ? candidatePinIds : ['00000000-0000-0000-0000-000000000000']);

      const list: Employee[] = [];

      // Sort profiles and PIN employees before adding to list
      const sortedProfiles = (profilesRes.data || []).sort((a: any, b: any) => 
        (a.display_name || '').localeCompare(b.display_name || '')
      );
      const sortedPins = (pinRes.data || []).sort((a: any, b: any) => 
        (a.display_name || '').localeCompare(b.display_name || '')
      );

      sortedProfiles.forEach((p: any) => {
        list.push({
          id: p.user_id,
          user_id: p.user_id,
          display_name: p.display_name,
          first_name: p.first_name,
          last_name: p.last_name,
        });
      });

      sortedPins.forEach((p: any) => {
        // Avoid duplicates if a user exists as a regular profile too
        if (!list.find((e) => e.user_id === p.id)) {
          list.push({
            id: p.id,
            user_id: p.id,
            display_name: p.display_name,
            first_name: p.first_name,
            last_name: p.last_name,
          });
        }
      });

      setEmployees(list);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadJobs = async () => {
    if (!currentCompany?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, address')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
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
    if (!currentCompany?.id) return;
    
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
        .eq('company_id', currentCompany.id)
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

      // Load punch clock settings to get calculate_overtime setting
      const { data: settingsData } = await supabase
        .from('job_punch_clock_settings')
        .select('calculate_overtime, overtime_threshold, auto_break_duration, auto_break_wait_hours')
        .eq('company_id', currentCompany.id)
        .is('job_id', null)
        .maybeSingle();

      // Only calculate overtime if explicitly enabled in settings
      const calculateOvertime = settingsData?.calculate_overtime === true;
      const overtimeThreshold = settingsData?.overtime_threshold || 8;
      const autoBreakDuration = settingsData?.auto_break_duration || 30;
      const autoBreakWaitHours = settingsData?.auto_break_wait_hours || 6;

      // Normalize date range to full days in UTC to avoid timezone gaps
      const startISO = filters.startDate ? new Date(Date.UTC(
        filters.startDate.getFullYear(),
        filters.startDate.getMonth(),
        filters.startDate.getDate(),
        0, 0, 0, 0
      )) : undefined;
      const endISO = filters.endDate ? new Date(Date.UTC(
        filters.endDate.getFullYear(),
        filters.endDate.getMonth(),
        filters.endDate.getDate(),
        23, 59, 59, 999
      )) : undefined;

      if (startISO) {
        query = query.gte('punch_in_time', startISO.toISOString());
      }

      if (endISO) {
        query = query.lte('punch_out_time', endISO.toISOString());
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

      // By default, exclude deleted records unless showDeleted is true
      if (!filters.showDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Strictly scope to this company's jobs
      const { data: allowedJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', currentCompany.id);
      const allowedJobSet = new Set((allowedJobs || []).map((j: any) => j.id));
      const filteredData = (data || []).filter((r: any) => !r.job_id || allowedJobSet.has(r.job_id));

      // Get additional data for display
      const jobIds = [...new Set(filteredData.map((r: any) => r.job_id).filter(Boolean))];
      const costCodeIds = [...new Set(filteredData.map((r: any) => r.cost_code_id).filter(Boolean))];
      const userIds = [...new Set(filteredData.map((r: any) => r.user_id))];

      const [jobsData, costCodesData, profilesData, pinEmployeesData] = await Promise.all([
        jobIds.length > 0 ? supabase.from('jobs').select('id, name').in('id', jobIds).eq('company_id', currentCompany.id) : { data: [], error: null },
        costCodeIds.length > 0 ? supabase.from('cost_codes').select('id, code, description').in('id', costCodeIds).eq('company_id', currentCompany.id) : { data: [], error: null },
        userIds.length > 0 ? supabase.from('profiles').select('user_id, display_name, first_name, last_name').in('user_id', userIds) : { data: [], error: null },
        userIds.length > 0 ? supabase.from('pin_employees').select('id, display_name, first_name, last_name').in('id', userIds) : { data: [], error: null }
      ]);

      console.log('Cost Code IDs:', costCodeIds);
      console.log('Cost Codes Data:', costCodesData.data);
      if (costCodesData.error) console.error('Cost Codes Error:', costCodesData.error);

      const jobsMap = new Map((jobsData.data || []).map(job => [job.id, job]));
      const costCodesMap = new Map((costCodesData.data || []).map(code => [code.id, code]));
      const profilesMap = new Map((profilesData.data || []).map(profile => [profile.user_id, profile]));
      const pinMap = new Map((pinEmployeesData.data || []).map(emp => [emp.id, emp]));

      // Transform the data with recalculated hours
      const transformedRecords: TimeCardRecord[] = filteredData.map((record: any) => {
        const job = jobsMap.get(record.job_id);
        const costCode = costCodesMap.get(record.cost_code_id);
        const profile = profilesMap.get(record.user_id);
        const pinEmp = pinMap.get(record.user_id);
        const displayName = profile?.display_name || pinEmp?.display_name ||
          ((profile?.first_name && profile?.last_name) ? `${profile.first_name} ${profile.last_name}` :
           (pinEmp?.first_name && pinEmp?.last_name) ? `${pinEmp.first_name} ${pinEmp.last_name}` : 'Unknown Employee');
        
        // Recalculate hours based on current settings
        let totalHours = record.total_hours || 0;
        let overtimeHours = 0;

        if (record.punch_in_time && record.punch_out_time) {
          const punchIn = new Date(record.punch_in_time);
          const punchOut = new Date(record.punch_out_time);
          const rawHours = (punchOut.getTime() - punchIn.getTime()) / (1000 * 60 * 60);
          
          // Apply auto break if applicable
          let adjustedHours = rawHours;
          if (rawHours > autoBreakWaitHours) {
            adjustedHours = rawHours - (autoBreakDuration / 60);
          }

          totalHours = adjustedHours;

          // Calculate overtime only if enabled
          if (calculateOvertime) {
            overtimeHours = Math.max(0, adjustedHours - overtimeThreshold);
          }
        }

        return {
          id: record.id,
          user_id: record.user_id,
          employee_id: record.user_id,
          employee_name: displayName,
          job_id: record.job_id,
          job_name: job?.name || 'Unknown Job',
          cost_code: costCode ? `${costCode.code} - ${costCode.description}` : 'Unknown Code',
          punch_in_time: record.punch_in_time,
          punch_out_time: record.punch_out_time,
          total_hours: totalHours,
          overtime_hours: overtimeHours,
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
    Promise.all([loadEmployees(), loadTimecardRecords(), loadPunchRecords()]);
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
      status: [],
      showDeleted: false,
      showNotes: false
    });
    // Reload after clearing
    Promise.all([loadEmployees(), loadTimecardRecords(), loadPunchRecords()]);
  };

  const checkForUnapprovedPunches = async (): Promise<boolean> => {
    try {
      let query = supabase
        .from('time_cards')
        .select('id, status')
        .neq('status', 'approved');

      // Apply date filters if they exist
      // Normalize date range to full days in UTC
      const startISO = filters.startDate ? new Date(Date.UTC(
        filters.startDate.getFullYear(),
        filters.startDate.getMonth(),
        filters.startDate.getDate(),
        0, 0, 0, 0
      )) : undefined;
      const endISO = filters.endDate ? new Date(Date.UTC(
        filters.endDate.getFullYear(),
        filters.endDate.getMonth(),
        filters.endDate.getDate(),
        23, 59, 59, 999
      )) : undefined;
      if (startISO) {
        query = query.gte('punch_in_time', startISO.toISOString());
      }
      if (endISO) {
        query = query.lte('punch_out_time', endISO.toISOString());
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

  const loadPunchRecords = async () => {
    if (!currentCompany?.id) return;
    try {
      let query = supabase
        .from('punch_records')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('punch_time', { ascending: false });

      // Apply filters - need to handle both user_id and pin_employee_id
      if (filters.employees.length > 0) {
        const quotedIds = filters.employees.map((id) => `"${id}"`).join(',');
        query = query.or(`user_id.in.(${quotedIds}),pin_employee_id.in.(${quotedIds})`);
      } else if (!isManager) {
        query = query.eq('user_id', user?.id);
      }
      if (filters.jobs.length > 0) {
        query = query.in('job_id', filters.jobs);
      }
      // Normalize date range to full days in UTC
      const startISO = filters.startDate ? new Date(Date.UTC(
        filters.startDate.getFullYear(),
        filters.startDate.getMonth(),
        filters.startDate.getDate(),
        0, 0, 0, 0
      )) : undefined;
      const endISO = filters.endDate ? new Date(Date.UTC(
        filters.endDate.getFullYear(),
        filters.endDate.getMonth(),
        filters.endDate.getDate(),
        23, 59, 59, 999
      )) : undefined;
      if (startISO) {
        query = query.gte('punch_time', startISO.toISOString());
      }
      if (endISO) {
        query = query.lte('punch_time', endISO.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      let punchData: any[] = data || [];

      // Fallback: if none returned, try last 3 days window to guard against date boundary issues
      if (punchData.length === 0) {
        const fallbackStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 3, 0, 0, 0, 0));
        let q2 = supabase
          .from('punch_records')
          .select('*')
          .eq('company_id', currentCompany.id)
          .gte('punch_time', fallbackStart.toISOString())
          .order('punch_time', { ascending: false });
        if (filters.employees.length > 0) {
          const quotedIds = filters.employees.map((id) => `"${id}"`).join(',');
          q2 = q2.or(`user_id.in.(${quotedIds}),pin_employee_id.in.(${quotedIds})`);
        }
        if (filters.jobs.length > 0) q2 = q2.in('job_id', filters.jobs);
        const { data: d2 } = await q2;
        punchData = d2 || [];
      }

      console.log('Punch records loaded:', punchData.length, 'records');

      // Strictly scope to this company's jobs
      const { data: allowedJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', currentCompany.id);
      const allowedJobSet = new Set((allowedJobs || []).map((j: any) => j.id));
      const filteredPunches = (punchData || []).filter((r: any) => !r.job_id || allowedJobSet.has(r.job_id));

      const userIds = [...new Set(filteredPunches.map((r: any) => r.user_id).filter(Boolean))];
      const pinEmployeeIds = [...new Set(filteredPunches.map((r: any) => r.pin_employee_id).filter(Boolean))];
      const allPossiblePinIds = [...new Set([...pinEmployeeIds, ...userIds])];
      const jobIds = [...new Set(filteredPunches.map((r: any) => r.job_id).filter(Boolean))];
      const costCodeIds = [...new Set(filteredPunches.map((r: any) => r.cost_code_id).filter(Boolean))];

      const [profilesData, pinEmployeesData, jobsData, costCodesData] = await Promise.all([
        userIds.length > 0 ? supabase.from('profiles').select('user_id, display_name, first_name, last_name').in('user_id', userIds) : { data: [], error: null },
        allPossiblePinIds.length > 0 ? supabase.from('pin_employees').select('id, display_name, first_name, last_name').in('id', allPossiblePinIds) : { data: [], error: null },
        jobIds.length > 0 ? supabase.from('jobs').select('id, name').in('id', jobIds).eq('company_id', currentCompany.id) : { data: [], error: null },
        costCodeIds.length > 0 ? supabase.from('cost_codes').select('id, code, description').eq('company_id', currentCompany.id).in('id', costCodeIds) : { data: [], error: null },
      ]);

      console.log('Punch Cost Code IDs:', costCodeIds);
      console.log('Punch Cost Codes Data:', costCodesData.data);
      if (costCodesData.error) console.error('Punch Cost Codes Error:', costCodesData.error);

      const profilesMap = new Map((profilesData.data || []).map((p: any) => [p.user_id, p]));
      const pinMap = new Map((pinEmployeesData.data || []).map((p: any) => [p.id, p]));
      const jobsMap = new Map((jobsData.data || []).map((j: any) => [j.id, j]));
      const costCodesMap = new Map((costCodesData.data || []).map((c: any) => [c.id, c]));

      // Group punches by employee/job to apply punch-out cost code to punch-in
      const groupedPunches = filteredPunches.reduce((acc: any, r: any) => {
        const key = `${r.user_id || r.pin_employee_id}_${r.job_id}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      }, {});

      // Sort each group by time and propagate cost codes from punch-out to punch-in
      Object.values(groupedPunches).forEach((group: any) => {
        group.sort((a: any, b: any) => new Date(a.punch_time).getTime() - new Date(b.punch_time).getTime());
        for (let i = 0; i < group.length - 1; i++) {
          if (group[i].punch_type === 'punched_in' && group[i + 1].punch_type === 'punched_out') {
            if (!group[i].cost_code_id && group[i + 1].cost_code_id) {
              group[i].cost_code_id = group[i + 1].cost_code_id;
            }
          }
        }
      });

      const transformed = filteredPunches.map((r: any) => {
        const profile = profilesMap.get(r.user_id);
        const pinEmp = pinMap.get(r.pin_employee_id) || pinMap.get(r.user_id);
        const employee_name = profile?.display_name || pinEmp?.display_name ||
          ((profile?.first_name && profile?.last_name) ? `${profile.first_name} ${profile.last_name}` :
           (pinEmp?.first_name && pinEmp?.last_name) ? `${pinEmp.first_name} ${pinEmp.last_name}` : 'Unknown Employee');
        const job = jobsMap.get(r.job_id);
        const code = costCodesMap.get(r.cost_code_id);
        return {
          id: r.id,
          user_id: r.user_id,
          pin_employee_id: r.pin_employee_id,
          employee_name,
          job_id: r.job_id,
          job_name: job?.name || 'Unknown Job',
          cost_code_id: r.cost_code_id,
          cost_code: code ? `${code.code} - ${code.description}` : null,
          punch_time: r.punch_time,
          punch_type: r.punch_type,
          latitude: r.latitude,
          longitude: r.longitude,
          photo_url: r.photo_url,
          ip_address: r.ip_address,
          user_agent: r.user_agent,
          notes: r.notes,
        };
      });

      setPunches(transformed);
      console.log('Transformed punch records:', transformed.length);
      if (records.length === 0 && transformed.length > 0 && activeTab !== 'punches') {
        setActiveTab('punches');
        toast({ title: 'Showing punches', description: 'No time cards found for filters; showing punch records.'});
      }
    } catch (error) {
      console.error('Error loading punch records:', error);
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
        summary: {
          totalRecords: data.length,
          totalHours: summary.totalHours,
          overtimeHours: summary.totalOvertimeHours,
          regularHours: summary.totalRegularHours
        }
      };

      await exportTimecardToPDF(reportData, company, currentCompany?.id);
      
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

  const handleExportExcel = async (reportType: string, data: any) => {
    if (!company) {
      toast({
        title: "Error",
        description: "Company information not available for Excel export",
        variant: "destructive",
      });
      return;
    }

    try {
      const reportData: ExcelReportData = {
        title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Timecard Report`,
        dateRange: filters.startDate && filters.endDate 
          ? `${filters.startDate.toLocaleDateString()} - ${filters.endDate.toLocaleDateString()}`
          : 'All Time',
        employee: filters.employees.length === 1 
          ? employees.find(e => e.user_id === filters.employees[0])?.display_name 
          : undefined,
        data,
        summary: {
          totalRecords: data.length,
          totalHours: summary.totalHours,
          overtimeHours: summary.totalOvertimeHours,
          regularHours: summary.totalRegularHours
        }
      };

      exportTimecardToExcel(reportData, company.name);
      
      toast({
        title: "Export Complete",
        description: "Excel report has been downloaded successfully",
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate Excel report",
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
        <Button variant="outline" onClick={() => { setLoading(true); Promise.all([loadTimecardRecords(), loadPunchRecords()]).finally(() => setLoading(false)); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <div className="space-y-6">
        {/* PDF Template Placeholders Info */}
        <Alert className="border-info/50 bg-info/5">
          <Info className="h-4 w-4 text-info" />
          <AlertDescription className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="font-medium text-sm">PDF Template Placeholders</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>You can customize PDF report headers and footers using these placeholders:</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 mt-2 font-mono">
                  <div><span className="text-primary">{'{company_name}'}</span> - Company name</div>
                  <div><span className="text-primary">{'{period}'}</span> - Report date range</div>
                  <div><span className="text-primary">{'{date}'}</span> - Current date</div>
                  <div><span className="text-primary">{'{employee_name}'}</span> - Employee name (if filtered)</div>
                  <div><span className="text-primary">{'{job_name}'}</span> - Job name (if filtered)</div>
                  <div><span className="text-primary">{'{generated_date}'}</span> - Generation timestamp</div>
                  <div><span className="text-primary">{'{page}'}</span> - Current page number</div>
                  <div><span className="text-primary">{'{pages}'}</span> - Total pages</div>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/settings/company?tab=templates'}
              className="flex-shrink-0"
            >
              <Settings className="h-4 w-4 mr-2" />
              Edit Templates
            </Button>
          </AlertDescription>
        </Alert>

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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'timecards' | 'punches')} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger 
              value="timecards"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
            >
              Time Cards
            </TabsTrigger>
            <TabsTrigger 
              value="punches"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
            >
              Punch Tracking
            </TabsTrigger>
          </TabsList>
          <TabsContent value="timecards">
            <TimecardReportViews
              records={records}
              summary={summary}
              loading={loading}
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
              showNotes={filters.showNotes}
            />
          </TabsContent>
          <TabsContent value="punches">
            <PunchTrackingReport
              records={punches}
              loading={loading}
              companyName={company?.name}
              onTimecardCreated={() => {
                loadTimecardRecords();
                loadPunchRecords();
                setActiveTab('timecards');
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}