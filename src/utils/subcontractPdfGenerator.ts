import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

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

export const SUBCONTRACT_PLACEHOLDERS = {
  '{company_name}': 'Company Name',
  '{company_address}': 'Company Address',
  '{company_phone}': 'Company Phone',
  '{company_email}': 'Company Email',
  '{contractor_name}': 'Contractor/Vendor Name',
  '{contractor_address}': 'Contractor Address',
  '{contractor_phone}': 'Contractor Phone',
  '{contractor_email}': 'Contractor Email',
  '{contract_name}': 'Contract/Subcontract Name',
  '{contract_number}': 'Contract Number',
  '{contract_amount}': 'Contract Amount',
  '{job_name}': 'Job/Project Name',
  '{job_address}': 'Job Address',
  '{start_date}': 'Start Date',
  '{end_date}': 'End Date',
  '{scope_of_work}': 'Scope of Work',
  '{payment_terms}': 'Payment Terms',
  '{retainage_percentage}': 'Retainage Percentage',
  '{date}': 'Current Date',
  '{page}': 'Page Number',
  '{pages}': 'Total Pages'
};

export const generateSubcontractPDF = async (
  subcontractId: string,
  templateName: string = 'default'
) => {
  try {
    // Fetch subcontract data
    const { data: subcontract, error: subError } = await supabase
      .from('subcontracts')
      .select(`
        *,
        job:jobs(*),
        vendor:vendors(*)
      `)
      .eq('id', subcontractId)
      .single();

    if (subError) throw subError;

    // Fetch company data
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', subcontract.job.company_id)
      .single();

    if (companyError) throw companyError;

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('pdf_templates')
      .select('*')
      .eq('company_id', company.id)
      .eq('template_type', 'subcontract')
      .eq('template_name', templateName)
      .maybeSingle();

    if (templateError) throw templateError;

    if (!template) {
      throw new Error(`Template "${templateName}" not found. Please create it in PDF Template Settings (Company Settings > PDF Templates).`);
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;

    // Add header images/logos if defined in template
    if (template.header_images && Array.isArray(template.header_images) && template.header_images.length > 0) {
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

    // Prepare data for placeholder replacement
    const placeholderValues = {
      '{company_name}': company.name || '',
      '{company_address}': company.address || '',
      '{company_phone}': company.phone || '',
      '{company_email}': company.email || '',
      '{contractor_name}': subcontract.vendor.name || '',
      '{contractor_address}': subcontract.vendor.address || '',
      '{contractor_phone}': subcontract.vendor.phone || '',
      '{contractor_email}': subcontract.vendor.email || '',
      '{contract_name}': subcontract.name || '',
      '{contract_number}': subcontract.name || '',
      '{contract_amount}': `$${(typeof subcontract.contract_amount === 'number' ? subcontract.contract_amount : parseFloat(subcontract.contract_amount || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      '{job_name}': subcontract.job.name || '',
      '{job_address}': subcontract.job.address || '',
      '{start_date}': subcontract.start_date ? format(new Date(subcontract.start_date), 'MM/dd/yyyy') : '',
      '{end_date}': subcontract.end_date ? format(new Date(subcontract.end_date), 'MM/dd/yyyy') : '',
      '{scope_of_work}': subcontract.scope_of_work || '',
      '{payment_terms}': subcontract.apply_retainage ? `Net 30, ${subcontract.retainage_percentage}% retainage` : 'Net 30',
      '{retainage_percentage}': subcontract.retainage_percentage ? `${subcontract.retainage_percentage}%` : 'N/A',
      '{date}': format(new Date(), 'MM/dd/yyyy'),
      '{page}': '1',
      '{pages}': '1'
    };

    const replacePlaceholders = (text: string): string => {
      let result = text;
      Object.entries(placeholderValues).forEach(([placeholder, value]) => {
        result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      });
      return result;
    };

    // Render header if exists
    if (template.header_html) {
      const headerHtml = replacePlaceholders(template.header_html);
      // Simple HTML rendering - in production you'd use html2canvas or similar
      pdf.setFontSize(10);
      pdf.text(headerHtml.replace(/<[^>]*>/g, ''), margin, margin + 10);
    }

    // Main content area
    let yPos = margin + 30;

    // Use body_html if it exists, otherwise fallback to default layout
    if (template.body_html) {
      const bodyHtml = replacePlaceholders(template.body_html);
      // Simple HTML to text conversion - in production use proper HTML parser
      const bodyText = bodyHtml.replace(/<[^>]*>/g, '\n').split('\n').filter(line => line.trim());
      
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'normal');
      
      bodyText.forEach(line => {
        if (yPos > pageHeight - margin - 20) {
          pdf.addPage();
          yPos = margin;
        }
        const textLines = pdf.splitTextToSize(line, pageWidth - 2 * margin);
        textLines.forEach((textLine: string) => {
          pdf.text(textLine, margin, yPos);
          yPos += 6;
        });
      });
    } else {
      // Default layout if no body template
      pdf.setFontSize(18);
      pdf.setFont(undefined, 'bold');
      pdf.text('SUBCONTRACT AGREEMENT', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      // Contract details
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'normal');
      
      const details = [
        `Contract Name: ${placeholderValues['{contract_name}']}`,
        `Contract Amount: ${placeholderValues['{contract_amount}']}`,
        ``,
        `Between:`,
        `${placeholderValues['{company_name}']}`,
        `${placeholderValues['{company_address}']}`,
        ``,
        `And:`,
        `${placeholderValues['{contractor_name}']}`,
        `${placeholderValues['{contractor_address}']}`,
        ``,
        `For Project:`,
        `${placeholderValues['{job_name}']}`,
        ``,
        `Start Date: ${placeholderValues['{start_date}']}`,
        `End Date: ${placeholderValues['{end_date}']}`,
        ``,
        `SCOPE OF WORK:`,
        placeholderValues['{scope_of_work}'] || 'Not specified',
        ``,
        `Payment Terms: ${placeholderValues['{payment_terms}']}`,
      ];

      details.forEach(line => {
        if (yPos > pageHeight - margin - 20) {
          pdf.addPage();
          yPos = margin;
        }
        const textLines = pdf.splitTextToSize(line, pageWidth - 2 * margin);
        textLines.forEach((textLine: string) => {
          pdf.text(textLine, margin, yPos);
          yPos += 6;
        });
      });
    }

    // Render footer if exists
    if (template.footer_html) {
      const footerHtml = replacePlaceholders(template.footer_html);
      pdf.setFontSize(8);
      pdf.text(footerHtml.replace(/<[^>]*>/g, ''), margin, pageHeight - 15);
    }

    // Download
    const fileName = `Subcontract_${subcontract.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(fileName);

    return true;
  } catch (error) {
    console.error('Error generating subcontract PDF:', error);
    throw error;
  }
};
