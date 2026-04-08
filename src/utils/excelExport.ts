import { format } from "date-fns";
import { exportAoAToXlsx, type ExcelCell } from "@/utils/exceljsExport";
import { formatCompanyDateTime } from "@/utils/companyTimeZone";

export interface ExcelReportData {
  title: string;
  dateRange: string;
  employee?: string;
  data: any[];
  showLaborCost?: boolean;
  summary: {
    totalRecords: number;
    regularHours: number;
    overtimeHours: number;
    totalHours: number;
    laborCost?: number;
  };
}

const formatMoney = (value: unknown) => Number(value || 0).toFixed(2);
const formatHours = (value: unknown) => Number(value || 0).toFixed(2);

export const exportTimecardToExcel = async (
  reportData: ExcelReportData,
  companyName: string,
  timeZone?: string,
) => {
  const includeLaborCost = reportData.showLaborCost !== false;

  // Prepare header rows
  const headerRows: ExcelCell[][] = [
    [companyName],
    [reportData.title],
    [`Period: ${reportData.dateRange}`],
    [`Generated: ${formatCompanyDateTime(new Date(), timeZone)}`],
    [],
  ];

  if (reportData.employee) {
    headerRows.push([`Employee: ${reportData.employee}`], []);
  } else {
    headerRows.push([]);
  }

  // Prepare data rows. Timecard exports can be detailed rows or grouped summary rows.
  const dataRows = reportData.data.flatMap((record) => {
    if (record.cost_codes) {
      return Object.values(record.cost_codes || {}).map((costCode: any) => ({
        Job: record.job_name || "-",
        "Cost Code": costCode.cost_code || "-",
        Records: costCode.total_records || 0,
        "Total Hours": formatHours(costCode.total_hours),
        "Overtime Hours": formatHours(costCode.overtime_hours),
        ...(includeLaborCost ? { "Labor Cost": formatMoney(costCode.total_labor_cost) } : {}),
      }));
    }

    if (typeof record.total_labor_cost !== "undefined" && typeof record.punch_in_time === "undefined") {
      return [{
        Employee: record.employee_name || undefined,
        Job: record.job_name || undefined,
        Date: record.date || undefined,
        Records: record.total_records || 0,
        "Total Hours": formatHours(record.total_hours),
        "Overtime Hours": formatHours(record.overtime_hours),
        ...(includeLaborCost ? { "Labor Cost": formatMoney(record.total_labor_cost) } : {}),
      }];
    }

    return [{
      Employee: record.employee_name || "-",
      Job: record.job_name || "-",
      "Cost Code": record.cost_code || "-",
      "Punch In": record.punch_in_time ? formatCompanyDateTime(record.punch_in_time, timeZone) : "-",
      "Punch Out": record.punch_out_time ? formatCompanyDateTime(record.punch_out_time, timeZone) : "-",
      Hours: formatHours(record.total_hours),
      ...(includeLaborCost ? { "Labor Cost": formatMoney(record.labor_cost) } : {}),
    }];
  }).map((row) => (
    Object.fromEntries(Object.entries(row).filter(([, value]) => typeof value !== "undefined"))
  ));

  // Prepare summary rows
  const summaryRows: ExcelCell[][] = [
    [],
    ["Summary Totals"],
    ["Total Records", reportData.summary.totalRecords],
    ["Regular Hours", reportData.summary.regularHours.toFixed(2)],
    ["Overtime Hours", reportData.summary.overtimeHours.toFixed(2)],
    ["Total Hours", reportData.summary.totalHours.toFixed(2)],
    ...(includeLaborCost ? [["Labor Cost", formatMoney(reportData.summary.laborCost)] as ExcelCell[]] : []),
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

export const exportPunchTrackingToExcel = async (
  records: any[],
  companyName: string,
  timeZone?: string,
) => {
  const headerRows: ExcelCell[][] = [
    [companyName],
    ["Punch Tracking Report"],
    [`Generated: ${formatCompanyDateTime(new Date(), timeZone)}`],
    [`Total Punches: ${records.length}`],
    [],
  ];

  const dataRows = records.map((record) => ({
    Employee: record.employee_name,
    Time: formatCompanyDateTime(record.punch_time, timeZone),
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
