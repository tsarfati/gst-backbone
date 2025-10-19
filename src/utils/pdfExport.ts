import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface CompanyBranding {
  logo_url?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  primaryColor?: string; // HSL color like "220, 90%, 56%"
}

export interface ReportData {
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

export class PDFExporter {
  private company: CompanyBranding;

  constructor(company: CompanyBranding) {
    this.company = company;
  }

  async exportTimecardReport(reportData: ReportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 24;

    // Use Arial-like font (Helvetica)
    doc.setFont('helvetica', 'normal');

    // Header: Logo + Company info (no heavy background)
    if (this.company.logo_url) {
      try {
        const logoData = await this.loadImage(this.company.logo_url);
        doc.addImage(logoData, 'PNG', 20, 12, 48, 48);
      } catch (e) {
        console.warn('Logo failed to load, continuing without image');
      }
    }

    doc.setTextColor(33, 37, 41);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(this.company.name, this.company.logo_url ? 80 : 20, 28);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const addressLine = [
      this.company.address,
      [this.company.city, this.company.state, this.company.zip_code].filter(Boolean).join(', ')
    ].filter(Boolean).join(', ');
    if (addressLine) doc.text(addressLine, this.company.logo_url ? 80 : 20, 44);
    const contactLine = [this.company.phone, this.company.email].filter(Boolean).join(' • ');
    if (contactLine) doc.text(contactLine, this.company.logo_url ? 80 : 20, 58);

    // Report meta on right
    doc.setFont('helvetica', 'bold');
    const titleText = reportData.title;
    const titleWidth = doc.getTextWidth(titleText);
    doc.text(titleText, pageWidth - 20 - titleWidth, 28);
    doc.setFont('helvetica', 'normal');
    const rangeText = `Period: ${reportData.dateRange}`;
    doc.text(rangeText, pageWidth - 20 - doc.getTextWidth(rangeText), 44);
    const genText = `Generated: ${format(new Date(), 'MM/dd/yyyy')}`;
    doc.text(genText, pageWidth - 20 - doc.getTextWidth(genText), 58);

    yPos = 80;

    // Employee info if provided
    if (reportData.employee) {
      doc.setFillColor(245, 245, 245);
      doc.rect(20, yPos, pageWidth - 40, 18, 'F');
      doc.setTextColor(33, 37, 41);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Employee: ${reportData.employee}`, 28, yPos + 12);
      yPos += 26;
    }

    // Prepare table data - exclude ID columns and format properly
    const tableData = reportData.data.map(record => [
      record.employee_name || '-',
      record.job_name || '-',
      record.cost_code || '-',
      record.punch_in_time ? format(new Date(record.punch_in_time), 'MM/dd/yyyy hh:mm a') : '-',
      record.punch_out_time ? format(new Date(record.punch_out_time), 'MM/dd/yyyy hh:mm a') : '-',
      record.total_hours?.toFixed(2) || '0.00'
    ]);

    // Add data table with modern styling
    autoTable(doc, {
      startY: yPos,
      head: [['Employee', 'Job', 'Cost Code', 'Punch In', 'Punch Out', 'Hours']],
      body: tableData,
      theme: 'plain',
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [33, 37, 41],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 4
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [50, 50, 50]
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252]
      },
      columnStyles: {
        0: { cellWidth: 160 },
        1: { cellWidth: 160 },
        2: { cellWidth: 180 },
        3: { cellWidth: 120 },
        4: { cellWidth: 120 },
        5: { cellWidth: 60, halign: 'right' }
      },
      styles: {
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
        overflow: 'ellipsize'
      },
      didDrawPage: (data) => {
        // Add page numbers
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${doc.getCurrentPageInfo().pageNumber}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
    });

    // Summary section
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Summary box (subtle)
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(20, finalY, pageWidth - 40, 44, 4, 4, 'F');
    
    doc.setTextColor(33, 37, 41);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Totals', 28, finalY + 16);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Records: ${reportData.summary.totalRecords}`, 28, finalY + 30);
    doc.text(`Regular Hours: ${reportData.summary.regularHours.toFixed(2)}`, 220, finalY + 30);
    doc.text(`Overtime Hours: ${reportData.summary.overtimeHours.toFixed(2)}`, 420, finalY + 30);
    
    doc.setFont('helvetica', 'bold');
    const totalText = `Total Hours: ${reportData.summary.totalHours.toFixed(2)}`;
    doc.text(totalText, pageWidth - 20 - doc.getTextWidth(totalText), finalY + 30);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'italic');
    const footerY = pageHeight - 15;
    doc.text('Confidential - For Internal Use Only', pageWidth / 2, footerY, { align: 'center' });

    doc.save(`timecard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }

  private parseHSLColor(hsl: string): [number, number, number] {
    // Parse "220, 90%, 56%" to RGB
    const parts = hsl.split(',').map(s => s.trim());
    const h = parseFloat(parts[0]) / 360;
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = hue2rgb(p, q, h + 1/3);
    const g = hue2rgb(p, q, h);
    const b = hue2rgb(p, q, h - 1/3);
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  private lightenColor(rgb: [number, number, number], factor: number): [number, number, number] {
    return [
      Math.round(rgb[0] + (255 - rgb[0]) * factor),
      Math.round(rgb[1] + (255 - rgb[1]) * factor),
      Math.round(rgb[2] + (255 - rgb[2]) * factor)
    ];
  }

  private loadImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = url;
    });
  }
}

export const exportTimecardToPDF = async (reportData: ReportData, company: CompanyBranding) => {
  const exporter = new PDFExporter(company);
  await exporter.exportTimecardReport(reportData);
};
