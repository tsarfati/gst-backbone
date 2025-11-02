import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { supabase } from "@/integrations/supabase/client";

export interface CompanyBranding {
  logo_url?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  primaryColor?: string;
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
  filters?: {
    employeeNames?: string[];
    groupNames?: string[];
    jobNames?: string[];
    locations?: string[];
    statuses?: string[];
    hasNotes?: boolean;
    hasOvertime?: boolean;
    showDeleted?: boolean;
    showNotes?: boolean;
  };
}

interface PdfTemplate {
  header_html?: string;
  footer_html?: string;
  font_family: string;
  primary_color?: string;
  secondary_color?: string;
  table_header_bg?: string;
  table_border_color?: string;
  table_stripe_color?: string;
  auto_size_columns?: boolean;
  header_images?: Array<{
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export class PDFExporter {
  private company: CompanyBranding;
  private template?: PdfTemplate;

  constructor(company: CompanyBranding, template?: PdfTemplate) {
    this.company = company;
    this.template = template;
  }

  async exportTimecardReport(reportData: ReportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 32;

    // Set font from template or use default
    const fontFamily = this.template?.font_family || 'helvetica';
    doc.setFont(fontFamily, 'normal');

    // Add custom header images if defined in template
    if (this.template?.header_images && this.template.header_images.length > 0) {
      for (const img of this.template.header_images) {
        try {
          const { dataUrl } = await this.loadImageWithDimensions(img.url);
          doc.addImage(dataUrl, 'PNG', img.x, img.y, img.width, img.height);
        } catch (e) {
          console.error('Failed to load header image:', e);
        }
      }
    }

    // Render custom HTML header if defined, otherwise use default
    if (this.template?.header_html) {
      yPos = await this.renderHtmlHeader(doc, this.template.header_html, reportData, yPos, pageWidth);
    } else {
      // Default header rendering
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(20, 20, pageWidth - 40, 80, 8, 8, 'F');

      const logoX = 36;
      const logoY = 32;
      let logoLoaded = false;
      let actualLogoWidth = 0;
    
    if (this.company.logo_url) {
      try {
        let logoUrlRaw = this.company.logo_url;
        let logoUrl = logoUrlRaw;

        if (/^https?:\/\//i.test(logoUrlRaw)) {
          // Use as-is
        } else if (logoUrlRaw.startsWith('/')) {
          // Relative path in app
          logoUrl = window.location.origin + logoUrlRaw;
        } else {
          // Treat as Supabase Storage path in format "bucket/path/to/file"
          const [bucket, ...rest] = logoUrlRaw.split('/');
          const objectPath = rest.join('/');
          if (bucket && objectPath) {
            const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
            if (data?.publicUrl) logoUrl = data.publicUrl;
          }
        }

        // Add timestamp to bust cache
        const separator = logoUrl.includes('?') ? '&' : '?';
        logoUrl = `${logoUrl}${separator}t=${Date.now()}`;

        console.log('Loading logo from:', logoUrl);
        const { dataUrl, width, height } = await this.loadImageWithDimensions(logoUrl);
        
        // Calculate dimensions maintaining aspect ratio
        const maxLogoHeight = 56;
        const maxLogoWidth = 120;
        let logoWidth = width;
        let logoHeight = height;
        
        // Scale to fit within max dimensions while maintaining aspect ratio
        if (logoHeight > maxLogoHeight || logoWidth > maxLogoWidth) {
          const aspectRatio = width / height;
          if (aspectRatio > 1) {
            // Wider than tall
            logoWidth = Math.min(maxLogoWidth, width);
            logoHeight = logoWidth / aspectRatio;
            if (logoHeight > maxLogoHeight) {
              logoHeight = maxLogoHeight;
              logoWidth = logoHeight * aspectRatio;
            }
          } else {
            // Taller than wide
            logoHeight = Math.min(maxLogoHeight, height);
            logoWidth = logoHeight * aspectRatio;
          }
        }
        
        doc.addImage(dataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
        logoLoaded = true;
        actualLogoWidth = logoWidth;
        console.log('Logo loaded successfully with dimensions:', logoWidth, 'x', logoHeight);
      } catch (e) {
        console.error('Logo failed to load:', e);
        console.log('Logo URL attempted:', this.company.logo_url);
      }
    }

    // Position company name centered
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const companyNameWidth = doc.getTextWidth(this.company.name);
    doc.text(this.company.name, (pageWidth - companyNameWidth) / 2, logoY + 12);

    // Position company details below centered name
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    
    const addressLine = [
      this.company.address,
      [this.company.city, this.company.state, this.company.zip_code].filter(Boolean).join(', ')
    ].filter(Boolean).join(', ');
    if (addressLine) {
      const addressWidth = doc.getTextWidth(addressLine);
      doc.text(addressLine, (pageWidth - addressWidth) / 2, logoY + 30);
    }
    
    const contactLine = [this.company.phone, this.company.email].filter(Boolean).join(' • ');
    if (contactLine) {
      const contactWidth = doc.getTextWidth(contactLine);
      doc.text(contactLine, (pageWidth - contactWidth) / 2, logoY + 44);
    }

    // Report title and info on right
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
    }

    // Active Filters Section
    if (reportData.filters) {
      const filters = reportData.filters;
      const filterLines: string[] = [];
      
      if (filters.employeeNames && filters.employeeNames.length > 0) {
        filterLines.push(`Employees: ${filters.employeeNames.join(', ')}`);
      }
      if (filters.groupNames && filters.groupNames.length > 0) {
        filterLines.push(`Groups: ${filters.groupNames.join(', ')}`);
      }
      if (filters.jobNames && filters.jobNames.length > 0) {
        filterLines.push(`Jobs: ${filters.jobNames.join(', ')}`);
      }
      if (filters.locations && filters.locations.length > 0) {
        filterLines.push(`Locations: ${filters.locations.join(', ')}`);
      }
      if (filters.statuses && filters.statuses.length > 0) {
        filterLines.push(`Status: ${filters.statuses.join(', ')}`);
      }
      if (filters.hasNotes) filterLines.push('Only records with notes');
      if (filters.hasOvertime) filterLines.push('Only records with overtime');
      if (filters.showDeleted) filterLines.push('Including deleted records');

      if (filterLines.length > 0) {
        // Calculate required height based on number of filter lines
        const lineHeight = 14;
        const boxHeight = 28 + (filterLines.length - 1) * lineHeight;
        
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(20, yPos, pageWidth - 40, boxHeight, 6, 6, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Active Filters:', 32, yPos + 18);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        filterLines.forEach((line, index) => {
          doc.text(line, 32, yPos + 32 + (index * lineHeight));
        });
        
        yPos += boxHeight + 12;
      }
    }

    // Employee info if provided - modern rounded container (legacy single employee display)
    if (reportData.employee && !reportData.filters?.employeeNames) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(20, yPos, pageWidth - 40, 28, 6, 6, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Employee: ${reportData.employee}`, 32, yPos + 18);
      yPos += 40;
    }

    // Prepare table data - exclude ID columns and format properly
    const includeNotes = !!reportData.filters?.showNotes;
    const tableData = reportData.data.map(record => {
      const base = [
        record.employee_name || '-',
        record.job_name || '-',
        record.cost_code || '-',
        record.punch_in_time ? format(new Date(record.punch_in_time), 'MM/dd/yyyy hh:mm a') : '-',
        record.punch_out_time ? format(new Date(record.punch_out_time), 'MM/dd/yyyy hh:mm a') : '-',
        (record.break_minutes ?? 0).toString(),
        record.total_hours?.toFixed(2) || '0.00'
      ];
      if (includeNotes) {
        base.push(record.notes || '-');
      }
      return base;
    });

    // Get colors from template or use defaults
    const headerBgColor = this.hexToRgb(this.template?.table_header_bg || '#f1f5f9');
    const borderColor = this.hexToRgb(this.template?.table_border_color || '#e2e8f0');
    const stripeColor = this.hexToRgb(this.template?.table_stripe_color || '#f8fafc');

    // Table configuration with template styling
    const headRow = reportData.filters?.showNotes
      ? ['Employee', 'Job', 'Cost Code', 'Punch In', 'Punch Out', 'Break (min)', 'Hours', 'Notes']
      : ['Employee', 'Job', 'Cost Code', 'Punch In', 'Punch Out', 'Break (min)', 'Hours'];
    const tableConfig: any = {
      startY: yPos,
      head: [headRow],
      body: tableData,
      theme: 'plain',
      headStyles: {
        fillColor: headerBgColor,
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
        lineColor: borderColor,
        lineWidth: 0.5
      },
      alternateRowStyles: {
        fillColor: stripeColor
      },
      styles: {
        overflow: 'ellipsize',
        font: fontFamily
      },
      didDrawPage: (data) => {
        // Render custom footer if defined
        if (this.template?.footer_html) {
          this.renderHtmlFooter(doc, this.template.footer_html, reportData, pageHeight - 30, pageWidth);
        } else {
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${doc.getCurrentPageInfo().pageNumber}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
          );
        }
      }
    };

    // Auto-size all columns to fit content and prevent clipping
    tableConfig.columnStyles = {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 'auto', halign: 'right' },
      6: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
      ...(reportData.filters?.showNotes ? { 7: { cellWidth: 'auto', halign: 'left' } } : {})
    };

    autoTable(doc, tableConfig);

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

    doc.save(`timecard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }

  async exportTimecardReportGrouped(reportData: ReportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const fontFamily = this.template?.font_family || 'helvetica';
    doc.setFont(fontFamily, 'normal');

    // Group records by employee name
    const byEmployee: Record<string, any[]> = {};
    (reportData.data || []).forEach((r: any) => {
      const key = r.employee_name || r.employee || 'Unknown Employee';
      if (!byEmployee[key]) byEmployee[key] = [];
      byEmployee[key].push(r);
    });

    const employeeNames = Object.keys(byEmployee);
    let isFirstEmployee = true;
    
    for (let idx = 0; idx < employeeNames.length; idx++) {
      const employeeName = employeeNames[idx];
      const rows = byEmployee[employeeName];
      
      // Add a page before each employee (except the first)
      if (!isFirstEmployee) {
        doc.addPage();
      }

      let yPos = 32;

      // Header images
      if (this.template?.header_images && this.template.header_images.length > 0) {
        for (const img of this.template.header_images) {
          try {
            const { dataUrl } = await this.loadImageWithDimensions(img.url);
            doc.addImage(dataUrl, 'PNG', img.x, img.y, img.width, img.height);
          } catch (e) {
            console.error('Failed to load header image:', e);
          }
        }
      }

      // Header (HTML or default)
      if (this.template?.header_html) {
        const scopedData = { ...reportData, employee: employeeName };
        yPos = await this.renderHtmlHeader(doc, this.template.header_html, scopedData, yPos, pageWidth);
      } else {
        // Default header
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(20, 20, pageWidth - 40, 80, 8, 8, 'F');

        const logoX = 36;
        const logoY = 32;
        let logoLoaded = false;

        if (this.company.logo_url) {
          try {
            let logoUrlRaw = this.company.logo_url;
            let logoUrl = logoUrlRaw;
            if (/^https?:\/\//i.test(logoUrlRaw)) {
              // as-is
            } else if (logoUrlRaw.startsWith('/')) {
              logoUrl = window.location.origin + logoUrlRaw;
            } else {
              const [bucket, ...rest] = logoUrlRaw.split('/');
              const objectPath = rest.join('/');
              if (bucket && objectPath) {
                const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
                if (data?.publicUrl) logoUrl = data.publicUrl;
              }
            }
            const sep = logoUrl.includes('?') ? '&' : '?';
            logoUrl = `${logoUrl}${sep}t=${Date.now()}`;
            const { dataUrl, width, height } = await this.loadImageWithDimensions(logoUrl);
            const maxLogoHeight = 56;
            const maxLogoWidth = 120;
            const aspectRatio = width / height;
            let logoWidth = Math.min(maxLogoWidth, width);
            let logoHeight = logoWidth / aspectRatio;
            if (logoHeight > maxLogoHeight) {
              logoHeight = maxLogoHeight;
              logoWidth = logoHeight * aspectRatio;
            }
            doc.addImage(dataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight);
            logoLoaded = true;
          } catch (e) {
            console.error('Logo failed to load:', e);
          }
        }

        const textStartX = logoLoaded ? logoX + 68 : logoX;
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        const companyNameWidth = doc.getTextWidth(this.company.name);
        doc.text(this.company.name, (pageWidth - companyNameWidth) / 2, logoY + 12);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const addressLine = [
          this.company.address,
          [this.company.city, this.company.state, this.company.zip_code].filter(Boolean).join(', ')
        ].filter(Boolean).join(', ');
        if (addressLine) {
          const addressWidth = doc.getTextWidth(addressLine);
          doc.text(addressLine, (pageWidth - addressWidth) / 2, logoY + 30);
        }
        const contactLine = [this.company.phone, this.company.email].filter(Boolean).join(' • ');
        if (contactLine) {
          const contactWidth = doc.getTextWidth(contactLine);
          doc.text(contactLine, (pageWidth - contactWidth) / 2, logoY + 44);
        }

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
      }

      // Active Filters Section (show on first employee only)
      if (isFirstEmployee && reportData.filters) {
        const filters = reportData.filters;
        const filterLines: string[] = [];
        
        if (filters.groupNames && filters.groupNames.length > 0) {
          filterLines.push(`Groups: ${filters.groupNames.join(', ')}`);
        }
        if (filters.jobNames && filters.jobNames.length > 0) {
          filterLines.push(`Jobs: ${filters.jobNames.join(', ')}`);
        }
        if (filters.locations && filters.locations.length > 0) {
          filterLines.push(`Locations: ${filters.locations.join(', ')}`);
        }
        if (filters.statuses && filters.statuses.length > 0) {
          filterLines.push(`Status: ${filters.statuses.join(', ')}`);
        }
        if (filters.hasNotes) filterLines.push('Only records with notes');
        if (filters.hasOvertime) filterLines.push('Only records with overtime');
        if (filters.showDeleted) filterLines.push('Including deleted records');

        if (filterLines.length > 0) {
          const lineHeight = 14;
          const boxHeight = 28 + (filterLines.length - 1) * lineHeight;
          
          doc.setFillColor(241, 245, 249);
          doc.roundedRect(20, yPos, pageWidth - 40, boxHeight, 6, 6, 'F');
          doc.setTextColor(15, 23, 42);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Active Filters:', 32, yPos + 18);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          filterLines.forEach((line, index) => {
            doc.text(line, 32, yPos + 32 + (index * lineHeight));
          });
          
          yPos += boxHeight + 12;
        }
      }

      // Employee badge/container
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(20, yPos, pageWidth - 40, 28, 6, 6, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Employee: ${employeeName}`, 32, yPos + 18);
      yPos += 40;

      const includeNotes = !!reportData.filters?.showNotes;
      const tableData = rows.map((record: any) => {
        const base = [
          record.employee_name || '-',
          record.job_name || '-',
          record.cost_code || '-',
          record.punch_in_time ? format(new Date(record.punch_in_time), 'MM/dd/yyyy hh:mm a') : '-',
          record.punch_out_time ? format(new Date(record.punch_out_time), 'MM/dd/yyyy hh:mm a') : '-',
          (record.break_minutes ?? 0).toString(),
          record.total_hours?.toFixed(2) || '0.00'
        ];
        if (includeNotes) {
          base.push(record.notes || '-');
        }
        return base;
      });

      const headerBgColor = this.hexToRgb(this.template?.table_header_bg || '#f1f5f9');
      const borderColor = this.hexToRgb(this.template?.table_border_color || '#e2e8f0');
      const stripeColor = this.hexToRgb(this.template?.table_stripe_color || '#f8fafc');

      const headRowGrouped = reportData.filters?.showNotes
        ? ['Employee', 'Job', 'Cost Code', 'Punch In', 'Punch Out', 'Break (min)', 'Hours', 'Notes']
        : ['Employee', 'Job', 'Cost Code', 'Punch In', 'Punch Out', 'Break (min)', 'Hours'];

      const tableConfig: any = {
        startY: yPos,
        head: [headRowGrouped],
        body: tableData,
        theme: 'plain',
        headStyles: {
          fillColor: headerBgColor,
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
          lineColor: borderColor,
          lineWidth: 0.5
        },
        alternateRowStyles: { fillColor: stripeColor },
        styles: { overflow: 'linebreak', font: fontFamily },
        margin: { top: 60, bottom: 30 },
        showHead: 'everyPage',
        pageBreak: 'auto',
        rowPageBreak: 'auto',
        didDrawPage: (data: any) => {
          // Re-render header on each new page
          const currentPage = doc.getCurrentPageInfo().pageNumber;
          
          // Only render header if we're on a continuation page for this employee
          if (data.pageNumber > 1 && data.pageCount > 1) {
            // Render minimal header on continuation pages
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(20, 20, pageWidth - 40, 35, 8, 8, 'F');
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`${employeeName} (continued)`, 32, 40);
          }
          
          // Render footer
          if (this.template?.footer_html) {
            this.renderHtmlFooter(doc, this.template.footer_html, { ...reportData, employee: employeeName }, pageHeight - 30, pageWidth);
          } else {
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(
              `Page ${currentPage}`,
              pageWidth / 2,
              pageHeight - 10,
              { align: 'center' }
            );
          }
        }
      };

      // Auto-size all columns to fit content
      tableConfig.columnStyles = {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 'auto', halign: 'right' },
        6: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
        ...(reportData.filters?.showNotes ? { 7: { cellWidth: 'auto', halign: 'left' } } : {})
      };

      autoTable(doc, tableConfig);

      const finalY = (doc as any).lastAutoTable.finalY + 16;
      const totals = rows.reduce((acc: any, r: any) => {
        acc.totalRecords += 1;
        acc.totalHours += r.total_hours || 0;
        acc.overtimeHours += r.overtime_hours || 0;
        acc.regularHours += (r.total_hours || 0) - (r.overtime_hours || 0);
        return acc;
      }, { totalRecords: 0, totalHours: 0, overtimeHours: 0, regularHours: 0 });

      // Check if summary will fit on current page, if not add a new page
      if (finalY + 70 > pageHeight) {
        doc.addPage();
        const summaryY = 60;
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(20, summaryY, pageWidth - 40, 56, 8, 8, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`Summary Totals - ${employeeName}`, 36, summaryY + 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`Total Records: ${totals.totalRecords}`, 36, summaryY + 38);
        doc.text(`Regular Hours: ${totals.regularHours.toFixed(2)}`, 240, summaryY + 38);
        doc.text(`Overtime Hours: ${totals.overtimeHours.toFixed(2)}`, 440, summaryY + 38);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        const totalText = `Total Hours: ${totals.totalHours.toFixed(2)}`;
        doc.text(totalText, pageWidth - 36 - doc.getTextWidth(totalText), summaryY + 38);
      } else {
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(20, finalY, pageWidth - 40, 56, 8, 8, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`Summary Totals - ${employeeName}`, 36, finalY + 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`Total Records: ${totals.totalRecords}`, 36, finalY + 38);
        doc.text(`Regular Hours: ${totals.regularHours.toFixed(2)}`, 240, finalY + 38);
        doc.text(`Overtime Hours: ${totals.overtimeHours.toFixed(2)}`, 440, finalY + 38);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        const totalText = `Total Hours: ${totals.totalHours.toFixed(2)}`;
        doc.text(totalText, pageWidth - 36 - doc.getTextWidth(totalText), finalY + 38);
      }
      
      isFirstEmployee = false;
    }

    doc.save(`timecard-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }
 
   private async renderHtmlHeader(doc: jsPDF, html: string, reportData: ReportData, startY: number, pageWidth: number): Promise<number> {
    // Simple HTML to PDF rendering for headers
    // Replace placeholders
    const rendered = this.replacePlaceholders(html, reportData);
    
    // Very basic HTML parsing - in production, consider using html2canvas or similar
    const div = document.createElement('div');
    div.innerHTML = rendered;
    div.style.width = `${pageWidth - 80}px`;
    div.style.position = 'absolute';
    div.style.left = '-9999px';
    document.body.appendChild(div);
    
    const lines = div.innerText.split('\n');
    let yPos = startY + 20;
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    lines.forEach(line => {
      if (line.trim()) {
        doc.text(line, 40, yPos);
        yPos += 16;
      }
    });
    
    document.body.removeChild(div);
    return yPos + 20;
  }

  private renderHtmlFooter(doc: jsPDF, html: string, reportData: ReportData, yPos: number, pageWidth: number): void {
    const rendered = this.replacePlaceholders(html, reportData);
    
    const div = document.createElement('div');
    div.innerHTML = rendered;
    div.style.width = `${pageWidth - 80}px`;
    div.style.position = 'absolute';
    div.style.left = '-9999px';
    document.body.appendChild(div);
    
    const lines = div.innerText.split('\n');
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    
    lines.forEach((line, idx) => {
      if (line.trim()) {
        doc.text(line, pageWidth / 2, yPos + (idx * 12), { align: 'center' });
      }
    });
    
    document.body.removeChild(div);
  }

  private replacePlaceholders(html: string, reportData: ReportData): string {
    return html
      .replace(/{company_name}/g, this.company.name)
      .replace(/{period}/g, reportData.dateRange)
      .replace(/{date}/g, format(new Date(), 'MM/dd/yyyy'))
      .replace(/{employee_name}/g, reportData.employee || '')
      .replace(/{job_name}/g, '')
      .replace(/{page}/g, '1')
      .replace(/{pages}/g, '1')
      .replace(/{generated_date}/g, format(new Date(), 'MM/dd/yyyy hh:mm a'));
  }

  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [241, 245, 249];
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

  private loadImageWithDimensions(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
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
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: img.width,
          height: img.height
        });
      };
      img.onerror = reject;
      img.src = url;
    });
  }
}

export const exportTimecardToPDF = async (reportData: ReportData, company: CompanyBranding, companyId?: string) => {
  // Load template from database if company ID is provided
  let template: PdfTemplate | undefined;
  
  if (companyId) {
    try {
      const { data } = await supabase
        .from('pdf_templates')
        .select('*')
        .eq('company_id', companyId)
        .eq('template_type', 'timecard')
        .maybeSingle();
      
      if (data) {
        template = {
          ...data,
          header_images: (data.header_images as any) || []
        } as PdfTemplate;
      }
    } catch (error) {
      console.error('Error loading PDF template:', error);
    }
  }
  
  const exporter = new PDFExporter(company, template);

  // If multiple employees are present in detailed rows, group by employee
  const hasDetailedRows = (reportData.data || []).some((r: any) => r.punch_in_time || r.punch_out_time);
  const uniqueEmployees = new Set((reportData.data || []).map((r: any) => r.employee_name || r.employee).filter(Boolean));
  if (hasDetailedRows && uniqueEmployees.size > 1) {
    await exporter.exportTimecardReportGrouped({ ...reportData, employee: undefined });
  } else {
    await exporter.exportTimecardReport(reportData);
  }
};

interface CreditCardTransactionReportData {
  transactions: Array<{
    id: string;
    transaction_date: string;
    amount: number;
    merchant_name: string;
    description: string;
    vendor_name: string | null;
    job_name: string | null;
    cost_code: string | null;
    chart_account_name: string | null;
  }>;
  creditCard: {
    card_name: string;
    cardholder_name: string;
    card_number_last_four: string;
  };
  dateFrom: Date;
  dateTo: Date;
  companyName: string;
  companyId: string;
}

export const exportCreditCardTransactionReport = async (data: CreditCardTransactionReportData) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Load template
  let template: PdfTemplate | undefined;
  try {
    const { data: templateData } = await supabase
      .from('pdf_templates')
      .select('*')
      .eq('company_id', data.companyId)
      .eq('template_type', 'credit_card_transaction')
      .maybeSingle();
    
    if (templateData) {
      template = {
        ...templateData,
        header_images: (templateData.header_images as any) || []
      } as PdfTemplate;
    }
  } catch (error) {
    console.error('Error loading PDF template:', error);
  }

  const fontFamily = template?.font_family || 'helvetica';
  doc.setFont(fontFamily, 'normal');

  let yPos = 32;

  // Header images
  if (template?.header_images && template.header_images.length > 0) {
    for (const img of template.header_images) {
      try {
        const imgLoader = new Image();
        imgLoader.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          imgLoader.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = imgLoader.width;
              canvas.height = imgLoader.height;
              ctx.drawImage(imgLoader, 0, 0);
              doc.addImage(canvas.toDataURL('image/png'), 'PNG', img.x, img.y, img.width, img.height);
            }
            resolve(null);
          };
          imgLoader.onerror = reject;
          imgLoader.src = img.url;
        });
      } catch (e) {
        console.error('Failed to load header image:', e);
      }
    }
  }

  // Header
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, 20, pageWidth - 40, 80, 8, 8, 'F');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(20);
  doc.setFont(fontFamily, 'bold');
  const companyNameWidth = doc.getTextWidth(data.companyName);
  doc.text(data.companyName, (pageWidth - companyNameWidth) / 2, 48);

  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(16);
  const titleText = 'Credit Card Transaction Report';
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, pageWidth - 36 - titleWidth, 48);

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const dateRange = `${format(data.dateFrom, 'MM/dd/yyyy')} - ${format(data.dateTo, 'MM/dd/yyyy')}`;
  doc.text(dateRange, pageWidth - 36 - doc.getTextWidth(dateRange), 68);

  const genText = `Generated: ${format(new Date(), 'MM/dd/yyyy hh:mm a')}`;
  doc.text(genText, pageWidth - 36 - doc.getTextWidth(genText), 84);

  yPos = 120;

  // Card info
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(20, yPos, pageWidth - 40, 28, 6, 6, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont(fontFamily, 'bold');
  const cardInfo = `Card: ${data.creditCard.card_name} (*${data.creditCard.card_number_last_four}) - ${data.creditCard.cardholder_name}`;
  doc.text(cardInfo, 32, yPos + 18);
  yPos += 40;

  // Table
  const tableData = data.transactions.map((txn) => [
    format(new Date(txn.transaction_date), 'MM/dd/yyyy'),
    `$${Number(txn.amount).toFixed(2)}`,
    txn.vendor_name || txn.merchant_name || '-',
    txn.description || '-',
    txn.chart_account_name || txn.job_name || '-',
    txn.cost_code || '-'
  ]);

  const headerBgColor = template?.table_header_bg 
    ? template.table_header_bg.replace('#', '').match(/.{2}/g)?.map(h => parseInt(h, 16)) || [241, 245, 249]
    : [241, 245, 249];

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Amount', 'Vendor', 'Description', 'Account/Job', 'Cost Code']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: headerBgColor as [number, number, number],
      textColor: [15, 23, 42],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: { top: 8, bottom: 8, left: 6, right: 6 }
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42],
      cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'auto', halign: 'right' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 'auto' }
    },
    margin: { left: 20, right: 20 },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap'
    },
    pageBreak: 'auto',
    rowPageBreak: 'auto'
  });

  // Total
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 100;
  const totalAmount = data.transactions.reduce((sum, txn) => sum + Number(txn.amount), 0);
  
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(pageWidth - 220, finalY + 20, 200, 30, 6, 6, 'F');
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Total:', pageWidth - 200, finalY + 40);
  doc.text(`$${totalAmount.toFixed(2)}`, pageWidth - 40 - doc.getTextWidth(`$${totalAmount.toFixed(2)}`), finalY + 40);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont(fontFamily, 'normal');
    const footerText = `Page ${i} of ${pageCount}`;
    doc.text(footerText, pageWidth / 2 - doc.getTextWidth(footerText) / 2, doc.internal.pageSize.getHeight() - 20);
  }

  doc.save(`Credit_Card_Transaction_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
