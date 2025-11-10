import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Clock, MapPin, Camera, Link as LinkIcon, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PunchDetailView from "@/components/PunchDetailView";
import { exportPunchTrackingToExcel } from "@/utils/excelExport";

interface PunchRecord {
  id: string;
  user_id: string | null;
  pin_employee_id: string | null;
  employee_name: string;
  punch_time: string;
  punch_type: string;
  job_id: string | null;
  job_name: string | null;
  cost_code_id: string | null;
  cost_code: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  notes: string | null;
}

interface PunchTrackingReportProps {
  records: PunchRecord[];
  loading: boolean;
  onTimecardCreated?: () => void;
  companyName?: string;
}

export function PunchTrackingReport({ records, loading, onTimecardCreated, companyName }: PunchTrackingReportProps) {
  const { toast } = useToast();
  const [selectedPunches, setSelectedPunches] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedPunch, setSelectedPunch] = useState<any>(null);
  const [showPunchDetail, setShowPunchDetail] = useState(false);
  
  const handleExportPDF = async () => {
    // Import the PDF export utility that uses templates
    const { exportTimecardToPDF } = await import('@/utils/pdfExport');
    
    // Get current company info
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_company_id')
      .eq('user_id', user.id)
      .single();
    
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile?.current_company_id)
      .single();
    
    if (!company) {
      toast({
        title: "Error",
        description: "Company information not available",
        variant: "destructive"
      });
      return;
    }

    // Convert punch records to report format
    const reportData = {
      title: 'Punch Tracking Report',
      dateRange: `Generated: ${format(new Date(), 'PPpp')}`,
      data: records.map(record => ({
        employee_name: record.employee_name,
        punch_in_time: record.punch_type === 'punched_in' ? record.punch_time : null,
        punch_out_time: record.punch_type === 'punched_out' ? record.punch_time : null,
        job_name: record.job_name || '-',
        cost_code: record.cost_code || '-',
        total_hours: 0,
        break_minutes: 0,
        notes: record.notes
      })),
      summary: {
        totalRecords: records.length,
        totalHours: 0,
        overtimeHours: 0,
        regularHours: 0
      }
    };

    const companyBranding = {
      name: company.name,
      logo_url: company.logo_url,
      address: company.address,
      city: company.city,
      state: company.state,
      zip_code: company.zip_code,
      phone: company.phone,
      email: company.email
    };

    try {
      await exportTimecardToPDF(reportData, companyBranding, company.id);
      toast({
        title: "Export Complete",
        description: "PDF report downloaded successfully"
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "Export Error",
        description: "Failed to generate PDF",
        variant: "destructive"
      });
    }
  };

  const getPunchTypeColor = (punchType: string) => {
    return punchType === "punched_in" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800";
  };

  const togglePunchSelection = (punchId: string) => {
    setSelectedPunches(prev => 
      prev.includes(punchId) 
        ? prev.filter(id => id !== punchId)
        : [...prev, punchId]
    );
  };

  const handleCreateTimecard = async () => {
    if (selectedPunches.length !== 2) {
      toast({
        title: "Invalid Selection",
        description: "Please select exactly one punch-in and one punch-out record",
        variant: "destructive"
      });
      return;
    }

    const selectedRecords = records.filter(r => selectedPunches.includes(r.id));
    const punchIn = selectedRecords.find(r => r.punch_type === "punched_in");
    const punchOut = selectedRecords.find(r => r.punch_type === "punched_out");

    if (!punchIn || !punchOut) {
      toast({
        title: "Invalid Selection",
        description: "You must select one punch-in and one punch-out record",
        variant: "destructive"
      });
      return;
    }

    if (new Date(punchOut.punch_time) <= new Date(punchIn.punch_time)) {
      toast({
        title: "Invalid Time Range",
        description: "Punch-out must be after punch-in",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      // Calculate hours
      const totalHours = (new Date(punchOut.punch_time).getTime() - new Date(punchIn.punch_time).getTime()) / (1000 * 60 * 60);
      let breakMinutes = 0;
      let adjustedHours = totalHours;

      if (totalHours > 6) {
        breakMinutes = 30;
        adjustedHours = totalHours - 0.5;
      }

      const overtimeHours = Math.max(0, adjustedHours - 8);

      // Get company_id from the first record with a job
      const { data: jobData } = await supabase
        .from('jobs')
        .select('company_id')
        .eq('id', punchIn.job_id || punchOut.job_id)
        .single();

      // Load punch clock settings to check if time card should be flagged
      const { data: flagSettings } = await supabase
        .from('job_punch_clock_settings')
        .select('flag_timecards_over_12hrs, flag_timecards_over_24hrs')
        .eq('company_id', jobData?.company_id)
        .is('job_id', null)
        .maybeSingle();

      const flagOver12 = flagSettings?.flag_timecards_over_12hrs ?? true;
      const flagOver24 = flagSettings?.flag_timecards_over_24hrs ?? true;

      // Determine status - flag if over threshold
      const shouldFlag = (flagOver24 && adjustedHours > 24) || (flagOver12 && adjustedHours > 12);
      const timecardStatus = shouldFlag ? 'pending' : 'approved';

      const { error } = await supabase
        .from('time_cards')
        .insert({
          user_id: punchIn.user_id || punchIn.pin_employee_id,
          job_id: punchIn.job_id,
          cost_code_id: punchIn.cost_code_id,
          company_id: jobData?.company_id,
          punch_in_time: punchIn.punch_time,
          punch_out_time: punchOut.punch_time,
          total_hours: adjustedHours,
          overtime_hours: overtimeHours,
          break_minutes: breakMinutes,
          punch_in_location_lat: punchIn.latitude,
          punch_in_location_lng: punchIn.longitude,
          punch_out_location_lat: punchOut.latitude,
          punch_out_location_lng: punchOut.longitude,
          punch_in_photo_url: punchIn.photo_url,
          punch_out_photo_url: punchOut.photo_url,
          notes: punchOut.notes,
          status: timecardStatus,
          created_via_punch_clock: true,
          requires_approval: shouldFlag
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: shouldFlag 
          ? "Time card created and flagged for approval (over 12 hours)" 
          : "Time card created successfully"
      });

      setSelectedPunches([]);
      onTimecardCreated?.();
    } catch (error) {
      console.error('Error creating timecard:', error);
      toast({
        title: "Error",
        description: "Failed to create time card",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">Loading punch records...</div>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">No punch records found for the selected criteria.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold">Individual Punch Tracking</h3>
            <p className="text-sm text-muted-foreground">
              Total Punches: {records.length}
              {selectedPunches.length > 0 && ` • ${selectedPunches.length} selected`}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedPunches.length === 2 && (
              <Button onClick={handleCreateTimecard} size="sm" disabled={creating}>
                <LinkIcon className="h-4 w-4 mr-2" />
                {creating ? "Creating..." : "Create Timecard"}
              </Button>
            )}
            <Button onClick={handleExportPDF} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button 
              onClick={() => exportPunchTrackingToExcel(records, companyName || 'Company')} 
              variant="outline" 
              size="sm"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Select</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Cost Code</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Photo</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow 
                  key={record.id}
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={(e) => {
                    // Don't trigger if clicking checkbox
                    if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                    setSelectedPunch({
                      id: record.id,
                      punch_time: record.punch_time,
                      punch_type: record.punch_type,
                      employee_name: record.employee_name,
                      job_name: record.job_name,
                      cost_code: record.cost_code,
                      latitude: record.latitude ?? undefined,
                      longitude: record.longitude ?? undefined,
                      photo_url: record.photo_url ?? undefined,
                      notes: record.notes ?? undefined,
                      user_id: record.user_id ?? undefined,
                      job_id: record.job_id ?? undefined,
                      cost_code_id: record.cost_code_id ?? undefined,
                    });
                    setShowPunchDetail(true);
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedPunches.includes(record.id)}
                      onCheckedChange={() => togglePunchSelection(record.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{record.employee_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(record.punch_time), "MM/dd/yyyy hh:mm a")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPunchTypeColor(record.punch_type)}>
                      {record.punch_type === "punched_in" ? "In" : "Out"}
                    </Badge>
                  </TableCell>
                  <TableCell>{record.job_name || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{record.cost_code || "-"}</TableCell>
                  <TableCell>
                    {record.latitude && record.longitude ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <MapPin className="h-4 w-4" />
                        Yes
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.photo_url ? (
                      <div className="flex items-center gap-1 text-blue-600">
                        <Camera className="h-4 w-4" />
                        <a href={record.photo_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          View
                        </a>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{record.notes || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
