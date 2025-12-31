import * as XLSX from 'xlsx-js-style';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface AIATemplateData {
  // Company Information
  company_name: string;
  company_address: string;
  company_city: string;
  company_state: string;
  company_zip: string;
  company_phone: string;
  company_email: string;
  license_number: string;

  // Customer/Owner Information
  owner_name: string;
  owner_address: string;
  owner_city: string;
  owner_state: string;
  owner_zip: string;
  owner_phone: string;
  owner_email: string;

  // Project/Job Information
  project_name: string;
  project_number: string;
  project_address: string;
  project_city: string;
  project_state: string;
  project_zip: string;
  architect_name: string;
  architect_project_no: string;

  // Contract Information
  contract_date: string;
  contract_amount: string;
  change_orders_amount: string;
  current_contract_sum: string;
  retainage_percent: string;

  // Application/Invoice Details
  application_number: string;
  application_date: string;
  period_from: string;
  period_to: string;
  total_completed: string;
  total_retainage: string;
  total_earned_less_retainage: string;
  less_previous_certificates: string;
  current_payment_due: string;
  balance_to_finish: string;

  // Line Items (for G703)
  lineItems: Array<{
    item_number: string;
    description: string;
    scheduled_value: number;
    previous_applications: number;
    this_period: number;
    materials_stored: number;
    total_completed: number;
    percent_complete: number;
    balance_to_finish: number;
    retainage: number;
  }>;
}

interface AIATemplate {
  id: string;
  company_id: string;
  template_name: string;
  file_url: string;
  file_name: string;
  file_size: number;
  is_default: boolean;
}

/**
 * Load the default AIA template for a company
 */
export async function loadDefaultAIATemplate(companyId: string): Promise<AIATemplate | null> {
  try {
    console.log('Loading default AIA template for company:', companyId);
    
    const { data, error } = await (supabase
      .from('aia_invoice_templates' as any)
      .select('*')
      .eq('company_id', companyId)
      .eq('is_default', true)
      .single() as any);

    if (error) {
      console.error('Error loading default AIA template:', error);
      return null;
    }

    console.log('Found default AIA template:', data);
    return data as AIATemplate;
  } catch (error) {
    console.error('Error loading default AIA template:', error);
    return null;
  }
}

/**
 * Replace placeholders in a cell value
 */
function replacePlaceholders(value: any, data: Record<string, string>): any {
  if (typeof value !== 'string') return value;
  
  let result = value;
  for (const [key, replacement] of Object.entries(data)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement || '');
  }
  return result;
}

/**
 * Format a number as currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Process an Excel template with AIA invoice data
 */
export async function processAIATemplate(
  template: AIATemplate,
  data: AIATemplateData
): Promise<Blob | null> {
  try {
    console.log('Processing AIA template:', template.file_url);
    
    // Fetch the template file
    const response = await fetch(template.file_url);
    console.log('Template fetch response status:', response.status);
    
    if (!response.ok) {
      console.error('Failed to fetch template file, status:', response.status);
      throw new Error('Failed to fetch template file');
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('Template file size:', arrayBuffer.byteLength, 'bytes');
    
    // Read with cellStyles to preserve formatting
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellStyles: true,
      cellNF: true,
      cellDates: true,
    });
    console.log('Workbook sheets:', workbook.SheetNames);

    // Create placeholder mappings
    const placeholders: Record<string, string> = {
      // Company Information
      company_name: data.company_name,
      company_address: data.company_address,
      company_city: data.company_city,
      company_state: data.company_state,
      company_zip: data.company_zip,
      company_phone: data.company_phone,
      company_email: data.company_email,
      license_number: data.license_number,

      // Customer/Owner Information
      owner_name: data.owner_name,
      owner_address: data.owner_address,
      owner_city: data.owner_city,
      owner_state: data.owner_state,
      owner_zip: data.owner_zip,
      owner_phone: data.owner_phone,
      owner_email: data.owner_email,

      // Project/Job Information
      project_name: data.project_name,
      project_number: data.project_number,
      project_address: data.project_address,
      project_city: data.project_city,
      project_state: data.project_state,
      project_zip: data.project_zip,
      architect_name: data.architect_name,
      architect_project_no: data.architect_project_no,

      // Contract Information
      contract_date: data.contract_date,
      contract_amount: data.contract_amount,
      change_orders_amount: data.change_orders_amount,
      current_contract_sum: data.current_contract_sum,
      retainage_percent: data.retainage_percent,

      // Application/Invoice Details
      application_number: data.application_number,
      application_date: data.application_date,
      period_from: data.period_from,
      period_to: data.period_to,
      total_completed: data.total_completed,
      total_retainage: data.total_retainage,
      total_earned_less_retainage: data.total_earned_less_retainage,
      less_previous_certificates: data.less_previous_certificates,
      current_payment_due: data.current_payment_due,
      balance_to_finish: data.balance_to_finish,
    };

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

      // First pass: Replace simple placeholders while preserving cell formatting
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = sheet[cellAddress];
          
          if (cell && cell.v !== undefined) {
            const originalValue = cell.v;
            const newValue = replacePlaceholders(originalValue, placeholders);
            
            if (newValue !== originalValue) {
              // Preserve the cell's style + number format
              const cellStyle = (cell as any).s;
              const cellFormat = (cell as any).z;
              const cellType = cell.t;

              cell.v = newValue;
              cell.w = String(newValue);
              if (cellStyle) (cell as any).s = cellStyle;
              if (cellFormat) (cell as any).z = cellFormat;
              if (cellType) cell.t = cellType;

              // If the result looks like a number, convert it BUT keep number format
              if (typeof newValue === 'string' && /^\$?[\d,]+\.?\d*$/.test(newValue.replace(/[$,]/g, ''))) {
                const numValue = parseFloat(newValue.replace(/[$,]/g, ''));
                if (!isNaN(numValue)) {
                  cell.t = 'n';
                  cell.v = numValue;
                  if (cellStyle) (cell as any).s = cellStyle;
                  if (cellFormat) (cell as any).z = cellFormat;
                }
              }
            }
          }
        }
      }

      // Second pass: Find and populate SOV table rows
      // Look for rows containing SOV placeholders and expand them with line items
      let sovStartRow = -1;
      let sovRowTemplate: Record<string, any> = {};

      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = sheet[cellAddress];
          
          if (cell && typeof cell.v === 'string' && cell.v.includes('{sov_')) {
            sovStartRow = row;
            // Capture the template row
            for (let c = range.s.c; c <= range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ r: row, c });
              if (sheet[addr]) {
                sovRowTemplate[c] = { ...sheet[addr] };
              }
            }
            break;
          }
        }
        if (sovStartRow >= 0) break;
      }

      // If we found an SOV template row, expand it with line items
      if (sovStartRow >= 0 && data.lineItems.length > 0) {
        // Remove the template row placeholder values
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: sovStartRow, c: col });
          if (sheet[cellAddress]) {
            delete sheet[cellAddress];
          }
        }

        // Insert line items starting at the template row
        data.lineItems.forEach((item, index) => {
          const rowIndex = sovStartRow + index;
          const itemPlaceholders: Record<string, string> = {
            sov_item_no: item.item_number,
            sov_description: item.description,
            sov_scheduled_value: formatCurrency(item.scheduled_value),
            sov_previous_applications: formatCurrency(item.previous_applications),
            sov_this_period: formatCurrency(item.this_period),
            sov_materials_stored: formatCurrency(item.materials_stored),
            sov_total_completed: formatCurrency(item.total_completed),
            sov_percent_complete: `${item.percent_complete}%`,
            sov_balance_to_finish: formatCurrency(item.balance_to_finish),
            sov_retainage: formatCurrency(item.retainage),
          };

          for (let col = range.s.c; col <= range.e.c; col++) {
            const templateCell = sovRowTemplate[col];
            if (templateCell) {
              const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: col });
              const newValue = replacePlaceholders(templateCell.v, itemPlaceholders);
              // Copy cell including style
              sheet[cellAddress] = {
                ...templateCell,
                v: newValue,
                w: String(newValue),
                s: templateCell.s, // Preserve cell style
              };
            }
          }
        });

        // Update the sheet range
        const newRange = { ...range };
        newRange.e.r = Math.max(range.e.r, sovStartRow + data.lineItems.length - 1);
        sheet['!ref'] = XLSX.utils.encode_range(newRange);
      }
    }

    // Generate the processed workbook as a blob, preserving styles
    const outputBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array',
      cellStyles: true,
      bookSST: true,
    });
    return new Blob([outputBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  } catch (error) {
    console.error('Error processing AIA template:', error);
    return null;
  }
}

/**
 * Generate AIA invoice using template or fallback to standard PDF
 */
export async function generateAIAInvoice(
  companyId: string,
  data: AIATemplateData,
  options: { forReview?: boolean; outputFormat?: 'excel' | 'pdf' } = {}
): Promise<{ blob: Blob; fileName: string; format: 'excel' | 'pdf' } | null> {
  const { forReview = false, outputFormat = 'excel' } = options;

  console.log('generateAIAInvoice called for company:', companyId);

  // Try to load the default template
  const template = await loadDefaultAIATemplate(companyId);
  console.log('Template loaded:', template ? 'yes' : 'no');

  if (template) {
    // Process the template with the data
    console.log('Processing template...');
    const processedBlob = await processAIATemplate(template, data);
    console.log('Template processed:', processedBlob ? 'success' : 'failed');
    
    if (processedBlob) {
      const fileName = `AIA_Invoice_${data.application_number}${forReview ? '_REVIEW' : ''}.xlsx`;
      console.log('Returning processed blob with filename:', fileName);
      return {
        blob: processedBlob,
        fileName,
        format: 'excel',
      };
    }
  }

  // Fallback: generate standard PDF if no template or processing failed
  console.log('No template found or processing failed, generating standard PDF');
  return null; // Return null to signal fallback to standard PDF generation
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
