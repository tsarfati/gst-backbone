import * as XLSX from 'xlsx';
import { format } from 'date-fns';

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

export const exportTimecardToExcel = (reportData: ExcelReportData, companyName: string) => {
  // Create workbook
  const wb = XLSX.utils.book_new();

  // Prepare header rows
  const headerRows = [
    [companyName],
    [reportData.title],
    [`Period: ${reportData.dateRange}`],
    [`Generated: ${format(new Date(), 'MM/dd/yyyy hh:mm a')}`],
    []
  ];

  if (reportData.employee) {
    headerRows.push([`Employee: ${reportData.employee}`], []);
  } else {
    headerRows.push([]);
  }

  // Prepare data rows
  const dataRows = reportData.data.map(record => ({
    'Employee': record.employee_name || '-',
    'Job': record.job_name || '-',
    'Cost Code': record.cost_code || '-',
    'Punch In': record.punch_in_time ? format(new Date(record.punch_in_time), 'MM/dd/yyyy hh:mm a') : '-',
    'Punch Out': record.punch_out_time ? format(new Date(record.punch_out_time), 'MM/dd/yyyy hh:mm a') : '-',
    'Hours': record.total_hours?.toFixed(2) || '0.00'
  }));

  // Prepare summary rows
  const summaryRows = [
    [],
    ['Summary Totals'],
    ['Total Records', reportData.summary.totalRecords],
    ['Regular Hours', reportData.summary.regularHours.toFixed(2)],
    ['Overtime Hours', reportData.summary.overtimeHours.toFixed(2)],
    ['Total Hours', reportData.summary.totalHours.toFixed(2)]
  ];

  // Combine all data
  const wsData = [
    ...headerRows,
    Object.keys(dataRows[0] || {}),
    ...dataRows.map(row => Object.values(row)),
    ...summaryRows
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // Employee
    { wch: 25 }, // Job
    { wch: 30 }, // Cost Code
    { wch: 20 }, // Punch In
    { wch: 20 }, // Punch Out
    { wch: 10 }  // Hours
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Timecard Report');

  // Save file
  XLSX.writeFile(wb, `timecard-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

export const exportPunchTrackingToExcel = (records: any[], companyName: string) => {
  const wb = XLSX.utils.book_new();

  const headerRows = [
    [companyName],
    ['Punch Tracking Report'],
    [`Generated: ${format(new Date(), 'PPpp')}`],
    [`Total Punches: ${records.length}`],
    []
  ];

  const dataRows = records.map(record => ({
    'Employee': record.employee_name,
    'Time': format(new Date(record.punch_time), 'MM/dd/yyyy hh:mm a'),
    'Type': record.punch_type === 'punched_in' ? 'In' : 'Out',
    'Job': record.job_name || '-',
    'Cost Code': record.cost_code || '-',
    'Location': record.latitude && record.longitude ? 'Yes' : 'No',
    'Photo': record.photo_url ? 'Yes' : 'No',
    'Notes': record.notes || '-'
  }));

  const wsData = [
    ...headerRows,
    Object.keys(dataRows[0] || {}),
    ...dataRows.map(row => Object.values(row))
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 25 }, // Employee
    { wch: 20 }, // Time
    { wch: 8 },  // Type
    { wch: 25 }, // Job
    { wch: 30 }, // Cost Code
    { wch: 10 }, // Location
    { wch: 10 }, // Photo
    { wch: 40 }  // Notes
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Punch Tracking');
  XLSX.writeFile(wb, `punch-tracking-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};
