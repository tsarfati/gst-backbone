import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber } from './formatNumber';
import { format } from 'date-fns';
import { loadPdfTemplate, loadImageAsDataUrl, hexToRgb, replacePlaceholders } from './pdfTemplateLoader';

interface SubcontractData {
  name: string;
  vendor_name: string;
  contract_amount: number;
  status: string;
  start_date?: string;
  end_date?: string;
  apply_retainage: boolean;
  retainage_percentage?: number;
}

interface InvoiceData {
  invoice_number: string;
  issue_date: string;
  amount: number;
  status: string;
  due_date?: string;
}

interface PaymentData {
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  check_number?: string;
  memo?: string;
}

interface CompanyData {
  name: string;
  logo_url?: string;
  id?: string;
}

interface JobData {
  name: string;
  client?: string;
}

export const generateCommitmentStatusReport = async (
  subcontract: SubcontractData,
  invoices: InvoiceData[],
  payments: PaymentData[],
  company: CompanyData,
  job: JobData
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const margin = 20;
  let yPosition = margin;

  // Load template settings
  const template = company.id ? await loadPdfTemplate(company.id) : null;
  const primaryColor = template?.primary_color ? hexToRgb(template.primary_color) : [30, 64, 175];
  const tableHeaderBg = template?.table_header_bg ? hexToRgb(template.table_header_bg) : [219, 234, 254];

  // Add logo if configured
  if (template?.use_company_logo && template.logo_url) {
    try {
      const logoDataUrl = await loadImageAsDataUrl(template.logo_url);
      pdf.addImage(logoDataUrl, 'PNG', margin, yPosition, 40, 20);
      yPosition += 25;
    } catch (e) {
      console.warn('Failed to load logo:', e);
    }
  }

  // Header
  pdf.setFontSize(18);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text('Commitment Status Report', margin, yPosition);
  pdf.setTextColor(0, 0, 0);
  yPosition += 10;

  // Company and Job Info
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  pdf.text(`Company: ${company.name}`, margin, yPosition);
  yPosition += 6;
  pdf.text(`Job: ${job.name}`, margin, yPosition);
  yPosition += 6;
  if (job.client) {
    pdf.text(`Client: ${job.client}`, margin, yPosition);
    yPosition += 6;
  }
  pdf.text(`Report Date: ${format(new Date(), 'MM/dd/yyyy')}`, margin, yPosition);
  yPosition += 15;

  // Subcontract Details
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text('Subcontract Information', margin, yPosition);
  pdf.setTextColor(0, 0, 0);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  pdf.text(`Subcontract: ${subcontract.name}`, margin, yPosition);
  yPosition += 6;
  pdf.text(`Vendor: ${subcontract.vendor_name}`, margin, yPosition);
  yPosition += 6;
  pdf.text(`Status: ${subcontract.status}`, margin, yPosition);
  yPosition += 6;
  if (subcontract.start_date) {
    pdf.text(`Start Date: ${format(new Date(subcontract.start_date), 'MM/dd/yyyy')}`, margin, yPosition);
    yPosition += 6;
  }
  yPosition += 10;

  // Financial Summary
  const totalCommit = subcontract.contract_amount;
  const grossInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const retainageAmount = subcontract.apply_retainage 
    ? grossInvoiced * (subcontract.retainage_percentage || 0) / 100 
    : 0;
  const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
  const osCommitment = totalCommit - grossInvoiced;

  pdf.setFontSize(12);
  pdf.setFont(undefined, 'bold');
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text('Financial Summary', margin, yPosition);
  pdf.setTextColor(0, 0, 0);
  yPosition += 10;

  // Summary Box
  pdf.setFillColor(tableHeaderBg[0], tableHeaderBg[1], tableHeaderBg[2]);
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F');
  
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  yPosition += 8;
  
  const summaryData = [
    { label: 'Total Commit:', value: `$${formatNumber(totalCommit)}` },
    { label: 'Prev Gross:', value: `$${formatNumber(grossInvoiced)}` },
    { label: 'Prev Ret\'d:', value: `$${formatNumber(retainageAmount)}` },
    { label: 'Prev Pmts:', value: `$${formatNumber(totalPaid)}` },
  ];

  summaryData.forEach(item => {
    pdf.text(item.label, margin + 5, yPosition);
    pdf.text(item.value, pageWidth - margin - 60, yPosition);
    yPosition += 8;
  });

  // Contract Balance highlighted
  pdf.setFont(undefined, 'bold');
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 10, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Contract Balance:', margin + 5, yPosition + 7);
  pdf.text(`$${formatNumber(osCommitment)}`, pageWidth - margin - 60, yPosition + 7);
  pdf.setTextColor(0, 0, 0);
  yPosition += 20;

  // Invoices Table
  if (invoices.length > 0) {
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    pdf.text('Invoices', margin, yPosition);
    pdf.setTextColor(0, 0, 0);
    yPosition += 10;

    const tableData = invoices.map(inv => [
      inv.invoice_number || 'N/A',
      format(new Date(inv.issue_date), 'MM/dd/yyyy'),
      `$${formatNumber(inv.amount)}`,
      inv.status,
      inv.due_date ? format(new Date(inv.due_date), 'MM/dd/yyyy') : 'N/A',
    ]);

    autoTable(pdf, {
      startY: yPosition,
      head: [['Invoice #', 'Date', 'Amount', 'Status', 'Due Date']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: primaryColor as [number, number, number],
        textColor: [255, 255, 255]
      },
      styles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });

    yPosition = (pdf as any).lastAutoTable.finalY + 15;
  }

  // Payments Table
  if (payments.length > 0) {
    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    pdf.text('Payments', margin, yPosition);
    pdf.setTextColor(0, 0, 0);
    yPosition += 10;

    const paymentTableData = payments.map(pmt => [
      pmt.payment_number || 'N/A',
      format(new Date(pmt.payment_date), 'MM/dd/yyyy'),
      `$${formatNumber(pmt.amount)}`,
      pmt.payment_method || 'N/A',
      pmt.check_number || '-',
      pmt.memo || '-',
    ]);

    autoTable(pdf, {
      startY: yPosition,
      head: [['Payment #', 'Date', 'Amount', 'Method', 'Check #', 'Memo']],
      body: paymentTableData,
      theme: 'grid',
      headStyles: { 
        fillColor: primaryColor as [number, number, number],
        textColor: [255, 255, 255]
      },
      styles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });

    yPosition = (pdf as any).lastAutoTable.finalY + 15;
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Generated on ${format(new Date(), 'MM/dd/yyyy \'at\' h:mm a')}`,
    margin,
    pageHeight - 15
  );

  // Add custom footer if configured
  if (template?.footer_html) {
    const footerText = replacePlaceholders(template.footer_html, {
      company_name: company.name,
      generated_date: format(new Date(), 'MM/dd/yyyy'),
      page: '1',
      pages: '1'
    });
    // Strip HTML tags for plain text footer
    const plainFooter = footerText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (plainFooter) {
      pdf.text(plainFooter.substring(0, 100), pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
  }

  // Download
  try {
    const fileName = `Commitment_Status_${subcontract.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(fileName);
    return true;
  } catch (error) {
    console.error('Error saving PDF:', error);
    throw error;
  }
};
