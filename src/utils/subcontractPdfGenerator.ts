import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

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

const SMALL_NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];

const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALE_WORDS = ['', 'thousand', 'million', 'billion', 'trillion'];

function convertHundredsToWords(value: number): string {
  if (value === 0) return '';

  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds > 0) {
    parts.push(`${SMALL_NUMBER_WORDS[hundreds]} hundred`);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(SMALL_NUMBER_WORDS[remainder]);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      parts.push(ones > 0 ? `${TENS_WORDS[tens]}-${SMALL_NUMBER_WORDS[ones]}` : TENS_WORDS[tens]);
    }
  }

  return parts.join(' ');
}

function numberToWords(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return SMALL_NUMBER_WORDS[0];

  let remaining = Math.floor(Math.abs(value));
  let scaleIndex = 0;
  const parts: string[] = [];

  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const chunkWords = convertHundredsToWords(chunk);
      const scale = SCALE_WORDS[scaleIndex];
      parts.unshift(scale ? `${chunkWords} ${scale}` : chunkWords);
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }

  const result = parts.join(' ').trim();
  return value < 0 ? `negative ${result}` : result;
}

function formatCurrencyAsWords(value: number): string {
  const absoluteValue = Math.abs(value);
  const dollars = Math.floor(absoluteValue);
  const cents = Math.round((absoluteValue - dollars) * 100);
  const dollarWords = numberToWords(dollars);
  const centWords = cents > 0 ? numberToWords(cents) : '';

  const dollarLabel = dollars === 1 ? 'dollar' : 'dollars';
  const centLabel = cents === 1 ? 'cent' : 'cents';

  if (cents > 0) {
    return `${value < 0 ? 'negative ' : ''}${dollarWords} ${dollarLabel} and ${centWords} ${centLabel}`;
  }

  return `${value < 0 ? 'negative ' : ''}${dollarWords} ${dollarLabel}`;
}

export const SUBCONTRACT_PLACEHOLDERS = {
  '{contractor_name}': 'Contractor Name',
  '{contractor_address}': 'Contractor Address',
  '{contractor_phone}': 'Contractor Phone',
  '{contractor_email}': 'Contractor Email',
  '{contractor_signer_name}': 'Contractor Signer Name',
  '{contractor_signer_title}': 'Contractor Signer Title',
  '{subcontractor_name}': 'Subcontractor Name',
  '{subcontractor_signer_name}': 'Subcontractor Signer Name',
  '{subcontractor_signer_position}': 'Subcontractor Signer Position',
  '{subcontractor_signer_title}': 'Subcontractor Signer Title',
  '{subcontractor_contact_phone}': 'Subcontractor Contact Phone',
  '{subcontractor_address}': 'Subcontractor Street Address',
  '{subcontractor_city}': 'Subcontractor City',
  '{subcontractor_state}': 'Subcontractor State',
  '{subcontractor_zip_code}': 'Subcontractor ZIP Code',
  '{subcontractor_phone}': 'Subcontractor Phone',
  '{subcontractor_email}': 'Subcontractor Email',
  '{contract_name}': 'Contract/Subcontract Name',
  '{contract_number}': 'Contract Number',
  '{subcontract_number}': 'Subcontract Number',
  '{subcontract_description}': 'Subcontract Description',
  '{contract_amount}': 'Contract Amount',
  '{contract_amount_numeric}': 'Contract Amount Numeric',
  '{contract_amount_written}': 'Contract Amount Written Out',
  '{job_name}': 'Job/Project Name',
  '{job_number}': 'Job/Project Number',
  '{job_address}': 'Job Address',
  '{architect}': 'Architect',
  '{start_date}': 'Start Date',
  '{end_date}': 'End Date',
  '{scope_of_work}': 'Scope of Work',
  '{payment_terms}': 'Payment Terms',
  '{retainage_percentage}': 'Retainage Percentage',
  '{date}': 'Current Date',
  '{contract_month}': 'Contract Date Month',
  '{contract_day_number}': 'Contract Date Day Number',
  '{contract_year}': 'Contract Date Year',
  '{page}': 'Page Number',
  '{pages}': 'Total Pages'
};

export const generateSubcontractPDF = async (
  subcontractId: string,
  templateIdentifier?: string
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
    const templateQuery = supabase
      .from('pdf_templates')
      .select('*')
      .eq('company_id', company.id)
      .eq('template_type', 'subcontract');

    const isUuid = !!templateIdentifier && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(templateIdentifier);
    const { data: template, error: templateError } = await (templateIdentifier
      ? isUuid
        ? templateQuery.eq('id', templateIdentifier).maybeSingle()
        : templateQuery.eq('template_name', templateIdentifier).maybeSingle()
      : templateQuery.order('created_at', { ascending: true }).limit(1).maybeSingle());

    if (templateError) throw templateError;

    if (!template) {
      throw new Error(`Subcontract template not found. Please create it in PDF Template Settings (Company Settings > PDF Templates).`);
    }

    const contractAmountValue = typeof subcontract.contract_amount === 'number'
      ? subcontract.contract_amount
      : parseFloat(subcontract.contract_amount || '0');

    const placeholderValues = {
      '{contractor_name}': company.name || '',
      '{contractor_address}': company.address || '',
      '{contractor_phone}': company.phone || '',
      '{contractor_email}': company.email || '',
      '{contractor_signer_name}': subcontract.company_signer_name || '',
      '{contractor_signer_title}': subcontract.company_signer_title || '',
      '{subcontractor_name}': subcontract.vendor.name || '',
      '{subcontractor_signer_name}': subcontract.subcontractor_signer_name || subcontract.vendor.contact_person || '',
      '{subcontractor_signer_position}': subcontract.subcontractor_signer_title || subcontract.vendor.contact_title || '',
      '{subcontractor_signer_title}': subcontract.subcontractor_signer_title || subcontract.vendor.contact_title || '',
      '{subcontractor_contact_phone}': subcontract.vendor.phone || '',
      '{subcontractor_address}': subcontract.vendor.address || '',
      '{subcontractor_city}': subcontract.vendor.city || '',
      '{subcontractor_state}': subcontract.vendor.state || '',
      '{subcontractor_zip_code}': subcontract.vendor.zip_code || '',
      '{subcontractor_phone}': subcontract.vendor.phone || '',
      '{subcontractor_email}': subcontract.vendor.email || '',
      '{contract_name}': subcontract.name || '',
      '{contract_number}': subcontract.subcontract_number || subcontract.name || '',
      '{subcontract_number}': subcontract.subcontract_number || '',
      '{subcontract_description}': subcontract.description || '',
      '{contract_amount}': `$${contractAmountValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      '{contract_amount_numeric}': `$${contractAmountValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      '{contract_amount_written}': formatCurrencyAsWords(contractAmountValue),
      '{job_name}': subcontract.job.name || '',
      '{job_number}': subcontract.job.project_number || '',
      '{job_address}': subcontract.job.address || '',
      '{architect}': subcontract.job.architect || '',
      '{start_date}': subcontract.start_date ? format(new Date(subcontract.start_date), 'MM/dd/yyyy') : '',
      '{end_date}': subcontract.end_date ? format(new Date(subcontract.end_date), 'MM/dd/yyyy') : '',
      '{scope_of_work}': subcontract.scope_of_work || '',
      '{payment_terms}': subcontract.apply_retainage ? `Net 30, ${subcontract.retainage_percentage}% retainage` : 'Net 30',
      '{retainage_percentage}': subcontract.retainage_percentage ? `${subcontract.retainage_percentage}%` : 'N/A',
      '{date}': format(new Date(), 'MM/dd/yyyy'),
      '{contract_month}': format(new Date(), 'MMMM'),
      '{contract_day_number}': format(new Date(), 'd'),
      '{contract_year}': format(new Date(), 'yyyy'),
      '{page}': '1',
      '{pages}': '1',
      // Backward-compatible aliases for older subcontract templates.
      '{company_name}': company.name || '',
      '{company_address}': company.address || '',
      '{company_phone}': company.phone || '',
      '{company_email}': company.email || '',
      '{company_signer_name}': subcontract.company_signer_name || '',
      '{company_signer_title}': subcontract.company_signer_title || '',
      '{contractor_contact_phone}': subcontract.vendor.phone || '',
      '{contractor_city}': subcontract.vendor.city || '',
      '{contractor_state}': subcontract.vendor.state || '',
      '{contractor_zip_code}': subcontract.vendor.zip_code || '',
      '{contractor_contact_name}': subcontract.vendor.contact_person || '',
      '{contractor_contact_position}': subcontract.vendor.contact_title || '',
    };

    const templateFileType = String(template?.template_file_type || '').toLowerCase();
    const templateFileName = String(template?.template_file_name || '').toLowerCase();
    const templateFileUrl = String(template?.template_file_url || '').toLowerCase();
    const isDocxTemplate =
      !!template?.template_file_url &&
      (
        templateFileType === 'docx' ||
        templateFileName.endsWith('.docx') ||
        templateFileUrl.endsWith('.docx')
      );

    if (isDocxTemplate) {
      const fileName = `Subcontract_${subcontract.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.docx`;
      return await generateSubcontractDocx(template.template_file_url, placeholderValues, fileName);
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
        `${placeholderValues['{contractor_name}']}`,
        `${placeholderValues['{contractor_address}']}`,
        ``,
        `And:`,
        `${placeholderValues['{subcontractor_name}']}`,
        `${placeholderValues['{subcontractor_address}']}`,
        `${[placeholderValues['{subcontractor_city}'], placeholderValues['{subcontractor_state}'], placeholderValues['{subcontractor_zip_code}']].filter(Boolean).join(', ').replace(/, ([^,]+)$/, ' $1')}`,
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

    const fileName = `Subcontract_${subcontract.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    const outputBlob = pdf.output('blob');

    return {
      blob: outputBlob,
      fileName,
      mimeType: 'application/pdf',
      kind: 'pdf' as const,
    };
  } catch (error) {
    console.error('Error generating subcontract PDF:', error);
    throw error;
  }
};

const generateSubcontractDocx = async (
  templateFileUrl: string,
  placeholderValues: Record<string, string>,
  fileName: string,
) => {
  let fileUrl = templateFileUrl;

  if (!fileUrl.startsWith('http')) {
    const { data: signedData, error } = await supabase.storage
      .from('report-templates')
      .createSignedUrl(fileUrl, 3600);

    if (error) throw error;
    if (!signedData?.signedUrl) throw new Error('No signed URL returned');
    fileUrl = signedData.signedUrl;
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const knownPlaceholderKeys = new Set(
    Object.keys(placeholderValues).map((key) => key.replace(/^\{|\}$/g, ''))
  );

  const normalizeXml = (xml: string) => {
    if (!xml) return xml;

    return xml
      .replace(/\{(?:[^{}]|<[^>]+>)+\}/g, (match) => {
        const tag = match.replace(/<[^>]+>/g, '').slice(1, -1).replace(/\s+/g, '').trim();
        return knownPlaceholderKeys.has(tag) ? `[[${tag}]]` : match;
      })
      .replace(/\{\s*(<[^>]+>)*\s*/g, '{')
      .replace(/\s*(<[^>]+>)*\s*\}/g, '}')
      .replace(/\{([^{}<>]+)\}/g, (_, tag) => {
        const normalizedTag = String(tag).trim();
        return knownPlaceholderKeys.has(normalizedTag) ? `[[${normalizedTag}]]` : `{${normalizedTag}}`;
      })
      .replace(/\[\[\[+/g, '[[')
      .replace(/\]\]\]+/g, ']]');
  };

  const xmlFiles = Object.keys(zip.files).filter((key) => key.startsWith('word/') && key.endsWith('.xml'));
  for (const xmlFile of xmlFiles) {
    const content = zip.file(xmlFile)?.asText();
    if (!content) continue;
    zip.file(xmlFile, normalizeXml(content));
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
    delimiters: { start: '[[', end: ']]' },
  });

  const templateData = Object.fromEntries(
    Object.entries(placeholderValues).map(([key, value]) => [key.replace(/^\{|\}$/g, ''), value ?? ''])
  );

  doc.setData(templateData);
  doc.render();

  const renderedZip = doc.getZip();
  const replaceXmlPlaceholders = (xml: string) => {
    let result = xml;
    for (const [key, value] of Object.entries(templateData)) {
      const token = `[[${key}]]`;
      result = result.split(token).join(value ?? '');
    }
    return result;
  };

  const renderedXmlFiles = Object.keys(renderedZip.files).filter((key) => key.startsWith('word/') && key.endsWith('.xml'));
  for (const xmlFile of renderedXmlFiles) {
    const content = renderedZip.file(xmlFile)?.asText();
    if (!content) continue;
    renderedZip.file(xmlFile, replaceXmlPlaceholders(content));
  }

  const outputBlob = renderedZip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return {
    blob: outputBlob,
    fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    kind: 'docx' as const,
  };
};

export const downloadGeneratedSubcontractDocument = (
  generatedDocument: { blob: Blob; fileName: string }
) => {
  const url = URL.createObjectURL(generatedDocument.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = generatedDocument.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
