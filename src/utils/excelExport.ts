import { format } from "date-fns";
import { exportAoAToXlsx, type ExcelCell } from "@/utils/exceljsExport";

export interface ExcelReportData {
  title: string;
  dateRange: string;
  employee?: string;
  data: any[];
  summary: {
    totalRecords: number;
    regularHours: number;
    overtimeHours: number;
    totalHours: number;
  };
}

export const exportTimecardToExcel = async (reportData: ExcelReportData, companyName: string) => {
  // Prepare header rows
  const headerRows: ExcelCell[][] = [
    [companyName],
    [reportData.title],
    [`Period: ${reportData.dateRange}`],
    [`Generated: ${format(new Date(), "MM/dd/yyyy hh:mm a")}`],
    [],
  ];

  if (reportData.employee) {
    headerRows.push([`Employee: ${reportData.employee}`], []);
  } else {
    headerRows.push([]);
  }

  // Prepare data rows
  const dataRows = reportData.data.map((record) => ({
    Employee: record.employee_name || "-",
    Job: record.job_name || "-",
    "Cost Code": record.cost_code || "-",
    "Punch In": record.punch_in_time ? format(new Date(record.punch_in_time), "MM/dd/yyyy hh:mm a") : "-",
    "Punch Out": record.punch_out_time ? format(new Date(record.punch_out_time), "MM/dd/yyyy hh:mm a") : "-",
    Hours: record.total_hours?.toFixed(2) || "0.00",
  }));

  // Prepare summary rows
  const summaryRows: ExcelCell[][] = [
    [],
    ["Summary Totals"],
    ["Total Records", reportData.summary.totalRecords],
    ["Regular Hours", reportData.summary.regularHours.toFixed(2)],
    ["Overtime Hours", reportData.summary.overtimeHours.toFixed(2)],
    ["Total Hours", reportData.summary.totalHours.toFixed(2)],
  ];

  // Combine all data
  const headers = Object.keys(dataRows[0] || {});
  const wsData: ExcelCell[][] = [
    ...headerRows,
    headers,
    ...dataRows.map((row) => headers.map((h) => (row as any)[h])),
    ...summaryRows,
  ];

  await exportAoAToXlsx({
    data: wsData,
    sheetName: "Timecard Report",
    fileName: `timecard-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
  });
};

export const exportPunchTrackingToExcel = async (records: any[], companyName: string) => {
  const headerRows: ExcelCell[][] = [
    [companyName],
    ["Punch Tracking Report"],
    [`Generated: ${format(new Date(), "PPpp")}`],
    [`Total Punches: ${records.length}`],
    [],
  ];

  const dataRows = records.map((record) => ({
    Employee: record.employee_name,
    Time: format(new Date(record.punch_time), "MM/dd/yyyy hh:mm a"),
    Type: record.punch_type === "punched_in" ? "In" : "Out",
    Job: record.job_name || "-",
    "Cost Code": record.cost_code || "-",
    Location: record.latitude && record.longitude ? "Yes" : "No",
    Photo: record.photo_url ? "Yes" : "No",
    Notes: record.notes || "-",
  }));

  const headers = Object.keys(dataRows[0] || {});
  const wsData: ExcelCell[][] = [
    ...headerRows,
    headers,
    ...dataRows.map((row) => headers.map((h) => (row as any)[h])),
  ];

  await exportAoAToXlsx({
    data: wsData,
    sheetName: "Punch Tracking",
    fileName: `punch-tracking-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
  });
};

