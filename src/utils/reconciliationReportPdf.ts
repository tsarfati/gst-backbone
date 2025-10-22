import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
}

interface ReconciliationReportData {
  companyId?: string;
  companyName: string;
  bankName: string;
  accountName: string;
  accountNumber?: string;
  beginningDate: string;
  endingDate: string;
  beginningBalance: number;
  endingBalance: number;
  clearedBalance: number;
  clearedDeposits: Transaction[];
  clearedPayments: Transaction[];
  unclearedDeposits: Transaction[];
  unclearedPayments: Transaction[];
  bankStatementUrl?: string;
}

export const generateReconciliationReportPdf = async (data: ReconciliationReportData) => {
  // Fetch template settings from database (scoped to company if provided)
  let templateData: any | null = null;
  try {
    let query = supabase
      .from('pdf_templates')
      .select('*')
      .eq('template_type', 'reconciliation');

    if (data.companyId) {
      query = query.eq('company_id', data.companyId);
    }

    const { data: rows } = await query.order('updated_at', { ascending: false }).limit(1);
    templateData = rows && rows.length > 0 ? rows[0] : null;
  } catch (e) {
    console.warn('Unable to load reconciliation template, using defaults');
  }

  // Helper function to convert hex to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    return result 
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [66, 139, 202]; // Default blue
  };

  // Get colors from template or use defaults
  const primaryColor: [number, number, number] = templateData?.primary_color ? hexToRgb(templateData.primary_color) : [66, 139, 202];
  const secondaryColor: [number, number, number] = templateData?.secondary_color ? hexToRgb(templateData.secondary_color) : [240, 240, 240];
  const headerBgColor: [number, number, number] = templateData?.table_header_bg ? hexToRgb(templateData.table_header_bg) : primaryColor;
  const stripeColor: [number, number, number] = templateData?.table_stripe_color ? hexToRgb(templateData.table_stripe_color) : secondaryColor;
  const borderColor: [number, number, number] = templateData?.table_border_color ? hexToRgb(templateData.table_border_color) : [200, 200, 200];
  const fontFamily = templateData?.font_family || 'helvetica';

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>/g, '').trim();
  const headerHtml = stripHtml(templateData?.header_html || '');
  const footerHtml = stripHtml(templateData?.footer_html || '');

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Header/Footer from template (plain text extracted from HTML)
  const drawHeader = () => {
    if (headerHtml) {
      doc.setFontSize(10);
      doc.setFont(fontFamily, 'normal');
      doc.text(headerHtml, 14, 12);
    }
  };

  const drawFooter = () => {
    if (footerHtml) {
      doc.setFontSize(9);
      doc.setFont(fontFamily, 'normal');
      doc.text(footerHtml, pageWidth - 14, pageHeight - 10, { align: 'right' });
    }
  };

  // Helper function for formatting currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Draw initial header
  drawHeader();
  yPos += headerHtml ? 6 : 0;

  // Header
  doc.setFontSize(16);
  doc.setFont(fontFamily, 'bold');
  doc.text(data.companyName, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(14);
  doc.text('Reconciliation Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(12);
  doc.setFont(fontFamily, 'normal');
  doc.text(data.bankName, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  const accountInfo = `Account Name: ${data.accountName}${data.accountNumber ? ` ***${data.accountNumber.slice(-4)}` : ''}`;
  doc.text(accountInfo, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  doc.text(`Ending Statement Date: ${format(new Date(data.endingDate), 'MM/dd/yyyy')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Summary section
  const clearedDepositsTotal = data.clearedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const clearedPaymentsTotal = data.clearedPayments.reduce((sum, p) => sum + p.amount, 0);
  
  doc.setFontSize(12);
  doc.setFont(fontFamily, 'bold');
  doc.text('Summary', 14, yPos);
  yPos += 8;

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [`Bank Statement Starting Balance on ${format(new Date(data.beginningDate), 'MM/dd/yyyy')}`, formatCurrency(data.beginningBalance)],
      ['Cleared Deposits and other Increases', formatCurrency(clearedDepositsTotal)],
      ['Cleared Checks and other Decreases', formatCurrency(clearedPaymentsTotal)],
      ['Cleared ACH Batches and Reversals', '$0.00'],
      ['Cleared Balance', formatCurrency(data.clearedBalance)],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { halign: 'right', cellWidth: 50 }
    },
    didParseCell: (cellData) => {
      if (cellData.row.index === 4) {
        cellData.cell.styles.fontStyle = 'bold';
        cellData.cell.styles.fillColor = secondaryColor;
      }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Cleared Transactions
  doc.setFontSize(12);
  doc.setFont(fontFamily, 'bold');
  doc.text('Cleared Transactions', 14, yPos);
  yPos += 8;

  // Cleared Deposits
  doc.setFontSize(11);
  doc.text(`Cleared Deposits and other Increases (${data.clearedDeposits.length} Items)`, 14, yPos);
  yPos += 5;

  if (data.clearedDeposits.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Date', 'Amount']],
      body: [
        ...data.clearedDeposits.map(d => [
          d.description,
          format(new Date(d.date), 'MM/dd/yyyy'),
          formatCurrency(d.amount)
        ]),
        ['Total', '', formatCurrency(clearedDepositsTotal)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, lineColor: borderColor, lineWidth: 0.1 },
      headStyles: { fillColor: headerBgColor, textColor: 255 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 }
      },
      didParseCell: (cellData) => {
        const isTotal = cellData.row.index === cellData.table.body.length - 1;
        if (isTotal) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fillColor = secondaryColor;
        } else if (cellData.section === 'body' && cellData.row.index % 2 === 1) {
          cellData.cell.styles.fillColor = stripeColor;
        }
      }
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.text('No cleared deposits', 14, yPos);
    yPos += 8;
  }

  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  // Cleared Payments
  doc.setFontSize(11);
  doc.setFont(fontFamily, 'bold');
  doc.text(`Cleared Checks and other Decreases (${data.clearedPayments.length} Items)`, 14, yPos);
  yPos += 5;

  if (data.clearedPayments.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Date', 'Amount']],
      body: [
        ...data.clearedPayments.map(p => [
          p.description,
          format(new Date(p.date), 'MM/dd/yyyy'),
          formatCurrency(p.amount)
        ]),
        ['Total', '', formatCurrency(clearedPaymentsTotal)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, lineColor: borderColor, lineWidth: 0.1 },
      headStyles: { fillColor: headerBgColor, textColor: 255 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 }
      },
      didParseCell: (cellData) => {
        const isTotal = cellData.row.index === cellData.table.body.length - 1;
        if (isTotal) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fillColor = secondaryColor;
        } else if (cellData.section === 'body' && cellData.row.index % 2 === 1) {
          cellData.cell.styles.fillColor = stripeColor;
        }
      }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.text('No cleared checks', 14, yPos);
    yPos += 10;
  }

  // Check if we need a new page
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }

  // Unreconciled Transactions
  const unclearedDepositsTotal = data.unclearedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const unclearedPaymentsTotal = data.unclearedPayments.reduce((sum, p) => sum + p.amount, 0);

  doc.setFontSize(12);
  doc.setFont(fontFamily, 'bold');
  doc.text('Unreconciled Transactions', 14, yPos);
  yPos += 8;

  // Unreconciled Deposits
  doc.setFontSize(11);
  doc.text(`Unreconciled Deposits and other Increases (${data.unclearedDeposits.length} Items)`, 14, yPos);
  yPos += 5;

  if (data.unclearedDeposits.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Date', 'Amount']],
      body: [
        ...data.unclearedDeposits.map(d => [
          d.description,
          format(new Date(d.date), 'MM/dd/yyyy'),
          formatCurrency(d.amount)
        ]),
        ['Total', '', formatCurrency(unclearedDepositsTotal)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: primaryColor, textColor: 255 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 }
      },
      didParseCell: (cellData) => {
        if (cellData.row.index === cellData.table.body.length - 1) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fillColor = secondaryColor;
        }
      }
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.text('No unreconciled deposits', 14, yPos);
    yPos += 8;
  }

  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  // Unreconciled Payments
  doc.setFontSize(11);
  doc.setFont(fontFamily, 'bold');
  doc.text(`Unreconciled Checks and other Decreases (${data.unclearedPayments.length} Items)`, 14, yPos);
  yPos += 5;

  if (data.unclearedPayments.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Date', 'Amount']],
      body: [
        ...data.unclearedPayments.map(p => [
          p.description,
          format(new Date(p.date), 'MM/dd/yyyy'),
          formatCurrency(p.amount)
        ]),
        ['Total', '', formatCurrency(unclearedPaymentsTotal)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: primaryColor, textColor: 255 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 }
      },
      didParseCell: (cellData) => {
        if (cellData.row.index === cellData.table.body.length - 1) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fillColor = secondaryColor;
        }
      }
    });
  } else {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.text('No unreconciled checks', 14, yPos);
  }

  // If there's a bank statement URL, fetch and append it
  if (data.bankStatementUrl) {
    try {
      // Get the PDF bytes from jsPDF
      const reportPdfBytes = doc.output('arraybuffer');
      const reportPdf = await PDFDocument.load(reportPdfBytes);

      // Fetch the bank statement PDF
      const response = await fetch(data.bankStatementUrl);
      const bankStatementBytes = await response.arrayBuffer();
      const bankStatementPdf = await PDFDocument.load(bankStatementBytes);

      // Copy all pages from bank statement to report
      const bankStatementPages = await reportPdf.copyPages(bankStatementPdf, bankStatementPdf.getPageIndices());
      bankStatementPages.forEach(page => reportPdf.addPage(page));

      // Save the merged PDF
      const mergedPdfBytes = await reportPdf.save();
      const blob = new Blob([new Uint8Array(mergedPdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Reconciliation_Report_${format(new Date(data.endingDate), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error merging bank statement:', error);
      // If merging fails, just download the report without the bank statement
      doc.save(`Reconciliation_Report_${format(new Date(data.endingDate), 'yyyy-MM-dd')}.pdf`);
    }
  } else {
    // No bank statement, just download the report
    doc.save(`Reconciliation_Report_${format(new Date(data.endingDate), 'yyyy-MM-dd')}.pdf`);
  }
};
