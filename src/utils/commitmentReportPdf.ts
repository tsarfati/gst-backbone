import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatNumber } from './formatNumber';
import { format } from 'date-fns';

// Helper to load image and convert to data URL for jsPDF
const loadImageAsDataUrl = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
};

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
  company: CompanyData,
  job: JobData
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  const margin = 20;
  let yPosition = margin;

  // Load and add header images/logos from template if available
  if (company.id) {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: template } = await supabase
        .from('pdf_templates')
        .select('header_images')
        .eq('company_id', company.id)
        .eq('template_type', 'commitment')
        .maybeSingle();

      if (template?.header_images && Array.isArray(template.header_images) && template.header_images.length > 0) {
        for (const img of template.header_images) {
          try {
            const imgData = img as any;
            const dataUrl = await loadImageAsDataUrl(imgData.url);
            pdf.addImage(dataUrl, 'PNG', imgData.x, imgData.y, imgData.width, imgData.height);
          } catch (e) {
            console.error('Failed to load header image:', e);
          }
        }
      }
    } catch (e) {
      console.warn('Could not load template header images:', e);
    }
  }

  // Header
  pdf.setFontSize(18);
  pdf.setFont(undefined, 'bold');
  pdf.text('Commitment Status Report', margin, yPosition);
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
  pdf.text('Subcontract Information', margin, yPosition);
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
  pdf.text('Financial Summary', margin, yPosition);
  yPosition += 10;

  // Summary Box
  pdf.setFillColor(240, 240, 240);
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
  pdf.setFillColor(40, 40, 40);
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
    pdf.text('Invoices', margin, yPosition);
    yPosition += 10;

    const tableData = invoices.map(inv => [
      inv.invoice_number || 'N/A',
      format(new Date(inv.issue_date), 'MM/dd/yyyy'),
      `$${formatNumber(inv.amount)}`,
      inv.status,
      inv.due_date ? format(new Date(inv.due_date), 'MM/dd/yyyy') : 'N/A',
    ]);

    (pdf as any).autoTable({
      startY: yPosition,
      head: [['Invoice #', 'Date', 'Amount', 'Status', 'Due Date']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100] },
      styles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });

    yPosition = (pdf as any).lastAutoTable.finalY + 15;
  }

  // Footer
  const pageHeight = pdf.internal.pageSize.height;
  pdf.setFontSize(8);
  pdf.setFont(undefined, 'normal');
  pdf.text(
    `Generated on ${format(new Date(), 'MM/dd/yyyy \'at\' h:mm a')}`,
    margin,
    pageHeight - 15
  );

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
