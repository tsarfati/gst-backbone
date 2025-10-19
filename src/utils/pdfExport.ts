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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // Parse company color or use default blue
    const primaryRGB = this.parseHSLColor((this.company as any).primaryColor || '220, 90%, 56%');
    const lightRGB = this.lightenColor(primaryRGB, 0.95);
    const accentRGB = this.lightenColor(primaryRGB, 0.85);

    // Add modern header with gradient effect
    doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Add company logo
    if (this.company.logo_url) {
      try {
        const logoData = await this.loadImage(this.company.logo_url);
        doc.addImage(logoData, 'PNG', 15, 10, 30, 30);
        yPos = 15;
      } catch (error) {
        console.error('Error loading logo:', error);
        yPos = 15;
      }
    } else {
      yPos = 15;
    }

    // Company name and details (white text on colored background)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(this.company.name, this.company.logo_url ? 50 : 15, yPos + 5);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (this.company.address) {
      const fullAddress = [
        this.company.address,
        [this.company.city, this.company.state, this.company.zip_code].filter(Boolean).join(', ')
      ].filter(Boolean).join(', ');
      doc.text(fullAddress, this.company.logo_url ? 50 : 15, yPos + 12);
    }
    if (this.company.phone || this.company.email) {
      const contact = [this.company.phone, this.company.email].filter(Boolean).join(' • ');
      doc.text(contact, this.company.logo_url ? 50 : 15, yPos + 18);
    }

    // Report title and metadata on right side
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const titleWidth = doc.getTextWidth(reportData.title);
    doc.text(reportData.title, pageWidth - 15 - titleWidth, yPos + 5);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const dateRangeText = `Period: ${reportData.dateRange}`;
    const dateWidth = doc.getTextWidth(dateRangeText);
    doc.text(dateRangeText, pageWidth - 15 - dateWidth, yPos + 12);
    
    const generatedText = `Generated: ${format(new Date(), 'MM/dd/yyyy')}`;
    const genWidth = doc.getTextWidth(generatedText);
    doc.text(generatedText, pageWidth - 15 - genWidth, yPos + 18);

    yPos = 55;

    // Employee info if provided
    if (reportData.employee) {
      doc.setFillColor(lightRGB[0], lightRGB[1], lightRGB[2]);
      doc.rect(10, yPos, pageWidth - 20, 10, 'F');
      doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Employee: ${reportData.employee}`, 15, yPos + 7);
      yPos += 15;
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
        fillColor: primaryRGB,
        textColor: [255, 255, 255],
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
        fillColor: lightRGB
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 35 },
        2: { cellWidth: 40 },
        3: { cellWidth: 32 },
        4: { cellWidth: 32 },
        5: { cellWidth: 16, halign: 'right' }
      },
      styles: {
        lineColor: [220, 220, 220],
        lineWidth: 0.1
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
    
    // Summary box with accent color
    doc.setFillColor(accentRGB[0], accentRGB[1], accentRGB[2]);
    doc.roundedRect(10, finalY, pageWidth - 20, 35, 3, 3, 'F');
    
    doc.setTextColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Totals', 15, finalY + 7);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Records: ${reportData.summary.totalRecords}`, 15, finalY + 15);
    doc.text(`Regular Hours: ${reportData.summary.regularHours.toFixed(2)}`, 15, finalY + 22);
    doc.text(`Overtime Hours: ${reportData.summary.overtimeHours.toFixed(2)}`, 15, finalY + 29);
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Hours: ${reportData.summary.totalHours.toFixed(2)}`, pageWidth - 15 - doc.getTextWidth(`Total Hours: ${reportData.summary.totalHours.toFixed(2)}`), finalY + 22);

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
