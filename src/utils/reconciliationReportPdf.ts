import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { renderAsync } from 'docx-preview';
import html2canvas from 'html2canvas';

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

    const { data: rows } = await query
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);
    templateData = rows && rows.length > 0 ? rows[0] : null;
  } catch (e) {
    console.warn('Unable to load reconciliation template, using defaults');
  }

  // Check if there's a template file uploaded
  if (templateData?.template_file_url) {
    // Always use the uploaded template when available (no fallback)
    await generateFromTemplate(data, templateData);
    return;
  }

  // Default PDF generation (only when no template exists)
  return await generateDefaultReconciliationPdf(data, templateData);
};

// Generate report from uploaded Word template
const generateFromTemplate = async (data: ReconciliationReportData, templateData: any) => {
  let fileUrl = templateData.template_file_url;
  
  // Check if this is a Supabase storage URL (signed or public)
  if (fileUrl.includes('supabase.co/storage/v1/object')) {
    try {
      // Extract bucket and path from the URL
      const urlObj = new URL(fileUrl);
      const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/(.+?)(\?|$)/);
      
      if (pathMatch) {
        const [, , fullPath] = pathMatch;
        const [bucket, ...pathParts] = fullPath.split('/');
        const filePath = pathParts.join('/');
        
        // Generate a fresh signed URL
        const { data: signedData, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 3600); // 1 hour
        
        if (error) {
          console.error('Error creating signed URL:', error);
          throw error;
        }
        
        if (!signedData?.signedUrl) {
          throw new Error('No signed URL returned');
        }
        
        fileUrl = signedData.signedUrl;
      }
    } catch (urlError) {
      console.error('Error parsing storage URL:', urlError);
      throw new Error(`Failed to generate signed URL: ${urlError}`);
    }
  } else if (!fileUrl.startsWith('http')) {
    // This is a storage path, generate signed URL
    const { data: signedData, error } = await supabase.storage
      .from('report-templates')
      .createSignedUrl(fileUrl, 3600); // 1 hour
    
    if (error) throw error;
    if (!signedData?.signedUrl) throw new Error('No signed URL returned');
    fileUrl = signedData.signedUrl;
  }
  
  // Fetch the template file
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  
  const zip = new PizZip(arrayBuffer);

  // Normalize split template tags (Word often splits {{tag}} across runs)
  const normalizeXml = (xml: string) => {
    if (!xml) return xml;
    // Join run boundaries inside mustache tags
    xml = xml.replace(/\{\s*<\/w:t>\s*<w:r[^>]*>\s*<w:t[^>]*>\s*\{/g, '{{');
    xml = xml.replace(/\}\s*<\/w:t>\s*<w:r[^>]*>\s*<w:t[^>]*>\s*\}/g, '}}');
    // Remove run boundaries occurring between braces and variable names
    xml = xml.replace(/\{\{\s*<\/w:t>\s*<w:r[^>]*>\s*<w:t[^>]*>/g, '{{');
    xml = xml.replace(/<\/w:t>\s*<w:r[^>]*>\s*<w:t[^>]*>\s*\}\}/g, '}}');
    // Collapse duplicated braces
    xml = xml.replace(/\{\{\s*\{\{/g, '{{').replace(/\}\}\s*\}\}/g, '}}');
    // Remove any remaining run boundaries strictly inside tags
    xml = xml.replace(/\}\}\s*<\/w:t>\s*<w:r[^>]*>\s*<w:t[^>]*>/g, '}}');
    xml = xml.replace(/<\/w:t>\s*<w:r[^>]*>\s*<w:t[^>]*>\{\{/g, '{{');
    return xml;
  };

  const xmlFiles = Object.keys(zip.files).filter((k) => k.startsWith('word/') && k.endsWith('.xml'));
  for (const f of xmlFiles) {
    try {
      const content = zip.file(f)?.asText();
      if (content) {
        zip.file(f, normalizeXml(content));
      }
    } catch (e) {
      console.warn('Skipped XML normalization for', f, e);
    }
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  // Helper function for formatting currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Calculate totals
  const clearedDepositsTotal = data.clearedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const clearedPaymentsTotal = data.clearedPayments.reduce((sum, p) => sum + p.amount, 0);
  const unclearedDepositsTotal = data.unclearedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const unclearedPaymentsTotal = data.unclearedPayments.reduce((sum, p) => sum + p.amount, 0);

  // Format transactions for table
  const formatTransactions = (transactions: any[]) => {
    return transactions.map(t => ({
      description: t.description,
      date: format(new Date(t.date), 'MM/dd/yyyy'),
      amount: formatCurrency(t.amount)
    }));
  };

  // Build report_data HTML table
  const reportDataHtml = `
    <h3>Summary</h3>
    <table>
      <tr><td>Bank Statement Starting Balance</td><td>${formatCurrency(data.beginningBalance)}</td></tr>
      <tr><td>Cleared Deposits and other Increases</td><td>${formatCurrency(clearedDepositsTotal)}</td></tr>
      <tr><td>Cleared Checks and other Decreases</td><td>${formatCurrency(clearedPaymentsTotal)}</td></tr>
      <tr><td>Cleared Balance</td><td>${formatCurrency(data.clearedBalance)}</td></tr>
    </table>
    
    <h3>Cleared Transactions</h3>
    <h4>Cleared Deposits (${data.clearedDeposits.length} Items)</h4>
    <table>
      <tr><th>Description</th><th>Date</th><th>Amount</th></tr>
      ${data.clearedDeposits.map(d => `<tr><td>${d.description}</td><td>${format(new Date(d.date), 'MM/dd/yyyy')}</td><td>${formatCurrency(d.amount)}</td></tr>`).join('')}
      <tr><td><strong>Total</strong></td><td></td><td><strong>${formatCurrency(clearedDepositsTotal)}</strong></td></tr>
    </table>
    
    <h4>Cleared Checks (${data.clearedPayments.length} Items)</h4>
    <table>
      <tr><th>Description</th><th>Date</th><th>Amount</th></tr>
      ${data.clearedPayments.map(p => `<tr><td>${p.description}</td><td>${format(new Date(p.date), 'MM/dd/yyyy')}</td><td>${formatCurrency(p.amount)}</td></tr>`).join('')}
      <tr><td><strong>Total</strong></td><td></td><td><strong>${formatCurrency(clearedPaymentsTotal)}</strong></td></tr>
    </table>
    
    <h3>Unreconciled Transactions</h3>
    <h4>Unreconciled Deposits (${data.unclearedDeposits.length} Items)</h4>
    <table>
      <tr><th>Description</th><th>Date</th><th>Amount</th></tr>
      ${data.unclearedDeposits.map(d => `<tr><td>${d.description}</td><td>${format(new Date(d.date), 'MM/dd/yyyy')}</td><td>${formatCurrency(d.amount)}</td></tr>`).join('')}
      <tr><td><strong>Total</strong></td><td></td><td><strong>${formatCurrency(unclearedDepositsTotal)}</strong></td></tr>
    </table>
    
    <h4>Unreconciled Checks (${data.unclearedPayments.length} Items)</h4>
    <table>
      <tr><th>Description</th><th>Date</th><th>Amount</th></tr>
      ${data.unclearedPayments.map(p => `<tr><td>${p.description}</td><td>${format(new Date(p.date), 'MM/dd/yyyy')}</td><td>${formatCurrency(p.amount)}</td></tr>`).join('')}
      <tr><td><strong>Total</strong></td><td></td><td><strong>${formatCurrency(unclearedPaymentsTotal)}</strong></td></tr>
    </table>
  `;

  // Set template data (support both old and new template formats)
  doc.setData({
    company_name: data.companyName,
    bank_name: data.bankName,
    bank_account: `${data.bankName} - ${data.accountName}${data.accountNumber ? ` (***${data.accountNumber.slice(-4)})` : ''}`,
    account_name: data.accountName,
    account_number: data.accountNumber ? `***${data.accountNumber.slice(-4)}` : '',
    beginning_date: format(new Date(data.beginningDate), 'MM/dd/yyyy'),
    ending_date: format(new Date(data.endingDate), 'MM/dd/yyyy'),
    beginning_balance: formatCurrency(data.beginningBalance),
    ending_balance: formatCurrency(data.endingBalance),
    cleared_balance: formatCurrency(data.clearedBalance),
    report_date: format(new Date(), 'MM/dd/yyyy'),
    generated_date: format(new Date(), 'MM/dd/yyyy'),
    date: format(new Date(), 'MM/dd/yyyy'),
    reconcile_date: format(new Date(), 'MM/dd/yyyy'),
    period: `${format(new Date(data.beginningDate), 'MM/dd/yyyy')} - ${format(new Date(data.endingDate), 'MM/dd/yyyy')}`,
    report_data: reportDataHtml,
    
    // Transactions as arrays for loops
    cleared_deposits: formatTransactions(data.clearedDeposits),
    cleared_payments: formatTransactions(data.clearedPayments),
    uncleared_deposits: formatTransactions(data.unclearedDeposits),
    uncleared_payments: formatTransactions(data.unclearedPayments),
    
    // Totals
    cleared_deposits_total: formatCurrency(clearedDepositsTotal),
    cleared_payments_total: formatCurrency(clearedPaymentsTotal),
    uncleared_deposits_total: formatCurrency(unclearedDepositsTotal),
    uncleared_payments_total: formatCurrency(unclearedPaymentsTotal),
  });

  try {
    doc.render();
  } catch (error: any) {
    console.error('Error rendering template:', error);
    // Continue without throwing to preserve template formatting
  }

  // Generate filled DOCX
  const outputBlob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  // Force download immediately - most reliable method
  const url = URL.createObjectURL(outputBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Reconciliation_Report_${format(new Date(data.endingDate), 'yyyy-MM-dd')}.docx`;
  link.style.display = 'none';
  document.body.appendChild(link);
  
  // Use setTimeout to ensure the link is in the DOM
  setTimeout(() => {
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }, 100);
};

// Default PDF generation (existing logic)
const generateDefaultReconciliationPdf = async (data: ReconciliationReportData, templateData: any | null) => {

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
