import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Clock, MapPin, Camera } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
}

export function PunchTrackingReport({ records, loading }: PunchTrackingReportProps) {
  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Punch Tracking Report", 14, 20);
    doc.setFontSize(11);
    doc.text(`Generated: ${format(new Date(), "PPpp")}`, 14, 28);
    doc.text(`Total Punches: ${records.length}`, 14, 34);

    const tableData = records.map(record => [
      record.employee_name,
      format(new Date(record.punch_time), "MM/dd/yyyy hh:mm a"),
      record.punch_type === "punched_in" ? "In" : "Out",
      record.job_name || "-",
      record.cost_code || "-",
      record.latitude && record.longitude ? "Yes" : "No",
      record.photo_url ? "Yes" : "No",
      record.notes || "-"
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["Employee", "Time", "Type", "Job", "Cost Code", "Location", "Photo", "Notes"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 32 },
        2: { cellWidth: 12 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 15 },
        6: { cellWidth: 15 },
        7: { cellWidth: 30 }
      }
    });

    doc.save(`punch-tracking-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const getPunchTypeColor = (punchType: string) => {
    return punchType === "punched_in" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800";
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
            <p className="text-sm text-muted-foreground">Total Punches: {records.length}</p>
          </div>
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow key={record.id}>
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
                  <TableCell>{record.cost_code || "-"}</TableCell>
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
    </div>
  );
}
