import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface CompanyBranding {
  logo_url?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
}

export interface ReportData {
  title: string;
  dateRange: string;
  employee?: string;
  data: any[];
  totals?: {
    totalHours: number;
    overtimeHours: number;
    regularHours: number;
  };
}

export class PDFExporter {
  private company: CompanyBranding;

  constructor(company: CompanyBranding) {
    this.company = company;
  }

  async exportTimecardReport(reportData: ReportData): Promise<void> {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 20;
    let yPosition = margin;

    // Company Header
    yPosition = await this.addCompanyHeader(pdf, yPosition, pageWidth, margin);

    // Report Title
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text(reportData.title, margin, yPosition);
    yPosition += 15;

    // Report Details
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Date Range: ${reportData.dateRange}`, margin, yPosition);
    yPosition += 8;
    
    if (reportData.employee) {
      pdf.text(`Employee: ${reportData.employee}`, margin, yPosition);
      yPosition += 8;
    }

    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 15;

    // Data Table
    if (reportData.data.length > 0) {
      yPosition = this.addDataTable(pdf, reportData.data, yPosition, margin, pageWidth);
    }

    // Summary Totals
    if (reportData.totals) {
      yPosition = this.addSummaryTotals(pdf, reportData.totals, yPosition, margin);
    }

    // Footer
    this.addFooter(pdf);

    // Download
    const fileName = `${reportData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  }

  private async addCompanyHeader(pdf: jsPDF, yPosition: number, pageWidth: number, margin: number): Promise<number> {
    // Company Logo (if available)
    if (this.company.logo_url) {
      try {
        const logoImg = await this.loadImage(this.company.logo_url);
        const logoHeight = 20;
        const logoWidth = 40;
        pdf.addImage(logoImg, 'PNG', margin, yPosition, logoWidth, logoHeight);
        yPosition += logoHeight + 5;
      } catch (error) {
        console.warn('Could not load company logo:', error);
      }
    }

    // Company Name
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text(this.company.name, margin, yPosition);
    yPosition += 10;

    // Company Address
    if (this.company.address) {
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(this.company.address, margin, yPosition);
      yPosition += 6;
      
      const cityStateZip = [this.company.city, this.company.state, this.company.zip_code]
        .filter(Boolean)
        .join(', ');
      if (cityStateZip) {
        pdf.text(cityStateZip, margin, yPosition);
        yPosition += 6;
      }
    }

    // Contact Info
    const contactInfo = [];
    if (this.company.phone) contactInfo.push(`Phone: ${this.company.phone}`);
    if (this.company.email) contactInfo.push(`Email: ${this.company.email}`);
    
    if (contactInfo.length > 0) {
      pdf.text(contactInfo.join(' | '), margin, yPosition);
      yPosition += 6;
    }

    // Separator Line
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition + 5, pageWidth - margin, yPosition + 5);
    yPosition += 15;

    return yPosition;
  }

  private addDataTable(pdf: jsPDF, data: any[], yPosition: number, margin: number, pageWidth: number): number {
    if (data.length === 0) return yPosition;

    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    const columnWidth = (pageWidth - 2 * margin) / columns.length;

    // Table Headers
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'bold');
    pdf.setFillColor(240, 240, 240);
    
    columns.forEach((column, index) => {
      const x = margin + (index * columnWidth);
      pdf.rect(x, yPosition, columnWidth, 8, 'F');
      pdf.text(this.formatColumnHeader(column), x + 2, yPosition + 5);
    });
    yPosition += 8;

    // Table Rows
    pdf.setFont(undefined, 'normal');
    data.forEach((row, rowIndex) => {
      if (yPosition > pdf.internal.pageSize.height - 40) {
        pdf.addPage();
        yPosition = margin;
      }

      // Alternate row colors
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
      }

      columns.forEach((column, index) => {
        const x = margin + (index * columnWidth);
        const value = this.formatCellValue(row[column], column);
        pdf.text(value, x + 2, yPosition + 5);
      });
      yPosition += 8;
    });

    return yPosition + 10;
  }

  private addSummaryTotals(pdf: jsPDF, totals: any, yPosition: number, margin: number): number {
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('Summary Totals:', margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    
    const summaryLines = [
      `Regular Hours: ${totals.regularHours?.toFixed(2) || '0.00'}`,
      `Overtime Hours: ${totals.overtimeHours?.toFixed(2) || '0.00'}`,
      `Total Hours: ${totals.totalHours?.toFixed(2) || '0.00'}`
    ];

    summaryLines.forEach(line => {
      pdf.text(line, margin, yPosition);
      yPosition += 8;
    });

    return yPosition + 10;
  }

  private addFooter(pdf: jsPDF): void {
    const pageHeight = pdf.internal.pageSize.height;
    const pageWidth = pdf.internal.pageSize.width;
    
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    pdf.text(
      `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      20,
      pageHeight - 15
    );
    
    pdf.text(
      'Confidential - For Internal Use Only',
      pageWidth - 80,
      pageHeight - 15
    );
  }

  private loadImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  private formatColumnHeader(column: string): string {
    return column
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatCellValue(value: any, column: string): string {
    if (value === null || value === undefined) return '';
    
    if (typeof value === 'number') {
      if (column.includes('hours') || column.includes('time')) {
        return value.toFixed(2);
      }
      return value.toString();
    }
    
    if (typeof value === 'string' && value.includes('T')) {
      // Likely a timestamp
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return value;
      }
    }
    
    return value.toString();
  }
}

export const exportTimecardToPDF = async (reportData: ReportData, company: CompanyBranding) => {
  const exporter = new PDFExporter(company);
  await exporter.exportTimecardReport(reportData);
};