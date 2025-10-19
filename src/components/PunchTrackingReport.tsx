import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Clock, MapPin, Camera, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PunchDetailView from "@/components/PunchDetailView";

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
}

export function PunchTrackingReport({ records, loading, onTimecardCreated }: PunchTrackingReportProps) {
  const { toast } = useToast();
  const [selectedPunches, setSelectedPunches] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedPunch, setSelectedPunch] = useState<any>(null);
  const [showPunchDetail, setShowPunchDetail] = useState(false);
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
    doc.setFont('helvetica', 'normal');

    doc.setFontSize(18);
    doc.text('Punch Tracking Report', 20, 28);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 20, 44);
    doc.text(`Total Punches: ${records.length}`, 20, 58);

    const tableData = records.map(record => [
      record.employee_name,
      format(new Date(record.punch_time), 'MM/dd/yyyy hh:mm a'),
      record.punch_type === 'punched_in' ? 'In' : 'Out',
      record.job_name || '-',
      record.cost_code || '-',
      record.latitude && record.longitude ? 'Yes' : 'No',
      record.photo_url ? 'Yes' : 'No',
      record.notes || '-'
    ]);

    autoTable(doc, {
      startY: 76,
      head: [['Employee', 'Time', 'Type', 'Job', 'Cost Code', 'Location', 'Photo', 'Notes']],
      body: tableData,
      theme: 'plain',
      headStyles: { fillColor: [245, 245, 245], textColor: [33, 37, 41], fontSize: 10, fontStyle: 'bold' },
      styles: { fontSize: 9, overflow: 'ellipsize' },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { cellWidth: 130 },
        2: { cellWidth: 50 },
        3: { cellWidth: 150 },
        4: { cellWidth: 150 },
        5: { cellWidth: 70 },
        6: { cellWidth: 60 },
        7: { cellWidth: 240 }
      }
    });

    doc.save(`punch-tracking-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
          status: 'approved',
          created_via_punch_clock: true
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Time card created successfully"
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
