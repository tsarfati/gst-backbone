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
    let yPos = 32;

    doc.setFont('helvetica', 'normal');

    // Modern rounded header container
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 20, pageWidth - 40, 80, 8, 8, 'F');

    // Logo + Company info
    const logoX = 36;
    const logoY = 32;
    
    if (this.company.logo_url) {
      try {
        const logoData = await this.loadImage(this.company.logo_url);
        doc.addImage(logoData, 'PNG', logoX, logoY, 56, 56);
      } catch (e) {
        console.error('Logo failed to load:', e);
        console.log('Logo URL:', this.company.logo_url);
      }
    }

    const textStartX = this.company.logo_url ? logoX + 68 : logoX;
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(this.company.name, textStartX, logoY + 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    
    const addressLine = [
      this.company.address,
      [this.company.city, this.company.state, this.company.zip_code].filter(Boolean).join(', ')
    ].filter(Boolean).join(', ');
    if (addressLine) doc.text(addressLine, textStartX, logoY + 30);
    
    const contactLine = [this.company.phone, this.company.email].filter(Boolean).join(' • ');
    if (contactLine) doc.text(contactLine, textStartX, logoY + 44);

    // Report info on right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    const titleText = reportData.title;
    const titleWidth = doc.getTextWidth(titleText);
    doc.text(titleText, pageWidth - 36 - titleWidth, logoY + 12);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const rangeText = `Period: ${reportData.dateRange}`;
    doc.text(rangeText, pageWidth - 36 - doc.getTextWidth(rangeText), logoY + 30);
    const genText = `Generated: ${format(new Date(), 'MM/dd/yyyy hh:mm a')}`;
    doc.text(genText, pageWidth - 36 - doc.getTextWidth(genText), logoY + 44);

    yPos = 120;

    // Employee info if provided - modern rounded container
    if (reportData.employee) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(20, yPos, pageWidth - 40, 28, 6, 6, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Employee: ${reportData.employee}`, 32, yPos + 18);
      yPos += 40;
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

    // Modern table styling
    autoTable(doc, {
      startY: yPos,
      head: [['Employee', 'Job', 'Cost Code', 'Punch In', 'Punch Out', 'Hours']],
      body: tableData,
      theme: 'plain',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: { top: 8, bottom: 8, left: 6, right: 6 }
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.5
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 160 },
        1: { cellWidth: 160 },
        2: { cellWidth: 180 },
        3: { cellWidth: 120 },
        4: { cellWidth: 120 },
        5: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
      },
      styles: {
        overflow: 'ellipsize'
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${doc.getCurrentPageInfo().pageNumber}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
    });

    // Modern summary section
    const finalY = (doc as any).lastAutoTable.finalY + 16;
    
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(20, finalY, pageWidth - 40, 56, 8, 8, 'F');
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Totals', 36, finalY + 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Records: ${reportData.summary.totalRecords}`, 36, finalY + 38);
    doc.text(`Regular Hours: ${reportData.summary.regularHours.toFixed(2)}`, 240, finalY + 38);
    doc.text(`Overtime Hours: ${reportData.summary.overtimeHours.toFixed(2)}`, 440, finalY + 38);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const totalText = `Total Hours: ${reportData.summary.totalHours.toFixed(2)}`;
    doc.text(totalText, pageWidth - 36 - doc.getTextWidth(totalText), finalY + 38);

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'italic');
    const footerY = pageHeight - 12;
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
