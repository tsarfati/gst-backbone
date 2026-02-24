import ExcelJS from 'exceljs';
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
 * Format a number as currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Replace placeholders in a string with actual values
 */
const EXPLICIT_NUMERIC_PLACEHOLDERS = new Set([
  'application_number',
  'contract_amount',
  'change_orders_amount',
  'current_contract_sum',
  'total_completed',
  'total_retainage',
  'total_earned_less_retainage',
  'less_previous_certificates',
  'current_payment_due',
  'balance_to_finish',
  'total_completed_stored_to_date',
  'total_completed_and_stored_to_date',
  'sov_scheduled_value',
  'sov_previous_applications',
  'sov_this_period',
  'sov_materials_stored',
  'sov_total_completed',
  'sov_total_completed_to_date',
  'sov_total_completed_stored_to_date',
  'sov_total_completed_and_stored_to_date',
  'sov_percent_complete',
  'sov_balance_to_finish',
  'sov_retainage',
]);

function looksNumericPlaceholder(rawKey: string): boolean {
  const key = rawKey.trim().toLowerCase();
  if (EXPLICIT_NUMERIC_PLACEHOLDERS.has(key)) return true;
  if (key === 'project_number' || key === 'architect_project_no' || key === 'sov_item_no') return false;
  return /(amount|sum|total|retainage|payment|balance|value|percent|applications|stored|completed)/.test(key);
}

function defaultPlaceholderValue(rawKey: string): string {
  const key = rawKey.trim().toLowerCase();
  if (!looksNumericPlaceholder(key)) return '';
  if (key.includes('percent')) return '0%';
  if (key.includes('amount') || key.includes('sum') || key.includes('total') || key.includes('payment') || key.includes('balance') || key.includes('value') || key.includes('retainage')) {
    return '$0.00';
  }
  return '0';
}

function removeUnresolvedPlaceholders(value: string): string {
  return value.replace(/\{([^{}]+)\}/g, (_full, rawKey: string) => defaultPlaceholderValue(rawKey));
}

function replacePlaceholders(template: string | number | undefined, placeholders: Record<string, string>): string {
  if (template === undefined || template === null) return '';
  
  let result = String(template);
  
  for (const [key, value] of Object.entries(placeholders)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Allow template authors to include whitespace inside braces, e.g. "{ company_city }"
    const placeholder = new RegExp(`\\{\\s*${escapedKey}\\s*\\}`, 'gi');
    result = result.replace(placeholder, value || '');
  }

  // Remove any placeholder tokens left behind by template variants we do not explicitly map.
  result = removeUnresolvedPlaceholders(result);
  
  return result;
}

function colLettersToNumber(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

function numberToColLetters(n: number): string {
  let s = '';
  let num = n;
  while (num > 0) {
    const r = (num - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

function parseA1Address(addr: string): { col: number; row: number } | null {
  const m = addr.replace(/\$/g, '').match(/^([A-Z]{1,3})(\d+)$/i);
  if (!m) return null;
  return { col: colLettersToNumber(m[1]), row: parseInt(m[2], 10) };
}

function shiftFormula(formula: string, deltaCol: number, deltaRow: number): string {
  return formula.replace(
    /(^|[^A-Z0-9_])(\$?)([A-Z]{1,3})(\$?)(\d+)/g,
    (match, pre: string, absCol: string, colLetters: string, absRow: string, rowStr: string) => {
      let col = colLettersToNumber(colLetters);
      let row = parseInt(rowStr, 10);

      if (!absCol) col += deltaCol;
      if (!absRow) row += deltaRow;

      // Clamp to valid bounds
      if (col < 1) col = 1;
      if (row < 1) row = 1;

      return `${pre}${absCol}${numberToColLetters(col)}${absRow}${row}`;
    }
  );
}

/**
 * ExcelJS throws on some workbooks that contain shared formulas where the master cell
 * is not "above and/or left" of the clone. To preserve formatting AND export reliably,
 * convert shared-formula clones into explicit formulas before writing.
 */
function normalizeSharedFormulas(workbook: ExcelJS.Workbook) {
  workbook.eachSheet((ws) => {
    ws.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const model: any = (cell as any).model;
        const valRaw: any = cell.value as any;
        const val: any = valRaw && typeof valRaw === 'object' ? valRaw : {};

        const sharedAddr = String(val.sharedFormula || model?.sharedFormula || '');
        if (!sharedAddr) return;

        const master = ws.getCell(sharedAddr);
        const masterVal: any = master?.value as any;

        // IMPORTANT: do NOT access cell.formula/master.formula getters; they can throw on broken shared formulas.
        const masterFormula = masterVal && typeof masterVal === 'object' ? (masterVal.formula as string | undefined) : undefined;
        const cellFormula = (val.formula as string | undefined) || (model?.formula as string | undefined);

        const cellAddr = parseA1Address(cell.address);
        const masterAddr = parseA1Address(sharedAddr);
        const deltaCol = cellAddr && masterAddr ? cellAddr.col - masterAddr.col : 0;
        const deltaRow = cellAddr && masterAddr ? cellAddr.row - masterAddr.row : 0;

        const baseFormula = cellFormula || masterFormula;
        if (!baseFormula) {
          // If we cannot resolve a formula, at least drop sharedFormula to avoid write crash
          cell.value = (val.result ?? null) as any;
          return;
        }

        const adjusted = masterAddr ? shiftFormula(baseFormula, deltaCol, deltaRow) : baseFormula;
        cell.value = {
          formula: adjusted,
          result:
            val.result ??
            model?.result ??
            (masterVal && typeof masterVal === 'object' ? masterVal.result : undefined) ??
            null,
        } as any;
      });
    });
  });
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
      .maybeSingle()) as { data: AIATemplate | null; error: any };

    if (error) {
      console.error('Error loading AIA template:', error);
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
 * Process an Excel template with AIA invoice data using ExcelJS
 * This preserves all formatting including fonts, borders, colors, column widths
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
    
    // Load workbook with ExcelJS - preserves all formatting
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    console.log('Workbook sheets:', workbook.worksheets.map(ws => ws.name));

    // Create placeholder mappings
    const g703Totals = data.lineItems.reduce((acc, item) => {
      const totalCompleted = Number(item.total_completed || 0);
      const materialsStored = Number(item.materials_stored || 0);
      const lineRetainage = Number(item.retainage || 0);
      const inferredRetainageRate = totalCompleted > 0 ? lineRetainage / totalCompleted : 0;
      const completedWorkBase = Math.max(totalCompleted - materialsStored, 0);
      const storedMaterialBase = Math.max(materialsStored, 0);
      const retainageCompletedWork = completedWorkBase * inferredRetainageRate;
      const retainageStoredMaterial = storedMaterialBase * inferredRetainageRate;

      return {
        scheduled_value: acc.scheduled_value + Number(item.scheduled_value || 0),
        previous_applications: acc.previous_applications + Number(item.previous_applications || 0),
        this_period: acc.this_period + Number(item.this_period || 0),
        materials_stored: acc.materials_stored + materialsStored,
        total_completed: acc.total_completed + totalCompleted,
        balance_to_finish: acc.balance_to_finish + Number(item.balance_to_finish || 0),
        retainage: acc.retainage + lineRetainage,
        retainage_completed_work: acc.retainage_completed_work + retainageCompletedWork,
        retainage_stored_material: acc.retainage_stored_material + retainageStoredMaterial,
      };
    }, {
      scheduled_value: 0,
      previous_applications: 0,
      this_period: 0,
      materials_stored: 0,
      total_completed: 0,
      balance_to_finish: 0,
      retainage: 0,
      retainage_completed_work: 0,
      retainage_stored_material: 0,
    });
    const g703OverallPercent = g703Totals.scheduled_value > 0
      ? (g703Totals.total_completed / g703Totals.scheduled_value) * 100
      : 0;

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
      // Common template aliases seen across AIA workbook variants
      total_completed_stored_to_date: data.total_completed,
      total_completed_and_stored_to_date: data.total_completed,

      // G703 totals row placeholders (template-driven totals row below the SOV section)
      g703_total_scheduled_value: formatCurrency(g703Totals.scheduled_value),
      g703_total_revised_budget: formatCurrency(g703Totals.scheduled_value),
      g703_total_revised_contract: formatCurrency(g703Totals.scheduled_value),
      g703_total_previous_applications: formatCurrency(g703Totals.previous_applications),
      g703_total_revisions: formatCurrency(g703Totals.previous_applications),
      g703_total_revision: formatCurrency(g703Totals.previous_applications),
      g703_total_this_period: formatCurrency(g703Totals.this_period),
      g703_total_materials_stored: formatCurrency(g703Totals.materials_stored),
      g703_total_completed: formatCurrency(g703Totals.total_completed),
      g703_total_completed_to_date: formatCurrency(g703Totals.total_completed),
      g703_total_completed_stored_to_date: formatCurrency(g703Totals.total_completed),
      g703_total_completed_and_stored_to_date: formatCurrency(g703Totals.total_completed),
      g703_total_balance_to_finish: formatCurrency(g703Totals.balance_to_finish),
      g703_total_retainage: formatCurrency(g703Totals.retainage),
      g703_total_retainage_completed_work: formatCurrency(g703Totals.retainage_completed_work),
      g703_total_retainage_complete_work: formatCurrency(g703Totals.retainage_completed_work),
      g703_total_retainage_completed: formatCurrency(g703Totals.retainage_completed_work),
      g703_total_retainage_stored_material: formatCurrency(g703Totals.retainage_stored_material),
      g703_total_retainage_materials_stored: formatCurrency(g703Totals.retainage_stored_material),
      g703_total_retainage_stored: formatCurrency(g703Totals.retainage_stored_material),
      g703_overall_percent_complete: `${g703OverallPercent.toFixed(1)}%`,
    };

    // Process each worksheet
    workbook.eachSheet((worksheet) => {
      let sovTemplateRow: number | null = null;

      // First pass: locate SOV template row + replace non-SOV placeholders (strings only)
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value;
          if (typeof cellValue !== 'string') return;

          // Identify the first row that contains any SOV placeholders
          if (cellValue.includes('{sov_') && sovTemplateRow === null) {
            sovTemplateRow = rowNumber;
            return;
          }

          // Replace regular placeholders
          if (cellValue.includes('{') && !cellValue.includes('{sov_')) {
            const newValue = replacePlaceholders(cellValue, placeholders);
            if (newValue !== cellValue) {
              cell.value = newValue;
            }
          }
        });
      });

      // Second pass: expand + fill SOV rows while preserving formatting and formulas
      if (sovTemplateRow !== null && data.lineItems.length > 0) {
        // Duplicate the template row so each line item gets a row with identical formatting/formulas
        if (data.lineItems.length > 1) {
          // exceljs typings vary; duplicateRow exists at runtime
          (worksheet as any).duplicateRow(sovTemplateRow, data.lineItems.length - 1, true);
        }

        data.lineItems.forEach((item, index) => {
          const targetRowNumber = sovTemplateRow! + index;
          const targetRow = worksheet.getRow(targetRowNumber);

          const itemPlaceholders: Record<string, string> = {
            // Split retainage placeholders are inferred from the line's total retainage proportionally.
            // This supports templates that break retainage into "completed work" and "stored material" columns.
            sov_retainage_completed_work: formatCurrency(
              Math.max(item.total_completed - item.materials_stored, 0) *
              (item.total_completed > 0 ? item.retainage / item.total_completed : 0)
            ),
            sov_retainage_stored_material: formatCurrency(
              Math.max(item.materials_stored, 0) *
              (item.total_completed > 0 ? item.retainage / item.total_completed : 0)
            ),
            sov_item_no: item.item_number,
            sov_description: item.description,
            sov_scheduled_value: formatCurrency(item.scheduled_value),
            sov_previous_applications: formatCurrency(item.previous_applications),
            sov_this_period: formatCurrency(item.this_period),
            sov_materials_stored: formatCurrency(item.materials_stored),
            sov_total_completed: formatCurrency(item.total_completed),
            sov_total_completed_to_date: formatCurrency(item.total_completed),
            sov_total_completed_stored_to_date: formatCurrency(item.total_completed),
            sov_total_completed_and_stored_to_date: formatCurrency(item.total_completed),
            sov_percent_complete: `${item.percent_complete.toFixed(1)}%`,
            sov_balance_to_finish: formatCurrency(item.balance_to_finish),
            sov_retainage: formatCurrency(item.retainage),
          };

          // Only replace placeholders in string cells; leave formulas/styles untouched
          targetRow.eachCell({ includeEmpty: true }, (cell) => {
            if (typeof cell.value !== 'string') return;
            if (!cell.value.includes('{sov_')) return;
            cell.value = replacePlaceholders(cell.value, itemPlaceholders);
          });

          targetRow.commit();
        });
      }
    });

    // Normalize shared-formula clones so ExcelJS can write the file reliably
    normalizeSharedFormulas(workbook);

    // Generate output buffer
    const outputBuffer = await workbook.xlsx.writeBuffer();
    console.log('Generated output buffer size:', outputBuffer.byteLength);
    
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
  return null;
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
