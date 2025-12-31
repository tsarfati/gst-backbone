import { supabase } from '@/integrations/supabase/client';

export interface PdfTemplateSettings {
  id?: string;
  company_id: string;
  header_html?: string;
  footer_html?: string;
  font_family: string;
  primary_color?: string;
  table_header_bg?: string;
  table_border_color?: string;
  use_company_logo?: boolean;
  logo_url?: string;
}

const DEFAULT_TEMPLATE: PdfTemplateSettings = {
  company_id: '',
  font_family: 'helvetica',
  primary_color: '#1e40af',
  table_header_bg: '#dbeafe',
  table_border_color: '#e2e8f0',
  header_html: '',
  footer_html: '',
  use_company_logo: false,
  logo_url: ''
};

/**
 * Loads the global PDF template settings for a company
 */
export async function loadPdfTemplate(companyId: string): Promise<PdfTemplateSettings> {
  if (!companyId) return DEFAULT_TEMPLATE;

  try {
    const { data, error } = await supabase
      .from('pdf_templates')
      .select('*')
      .eq('company_id', companyId)
      .eq('template_type', 'global')
      .eq('template_name', 'default')
      .maybeSingle();

    if (error) {
      console.warn('Error loading PDF template:', error);
      return DEFAULT_TEMPLATE;
    }

    if (data) {
      return {
        id: data.id,
        company_id: data.company_id,
        header_html: data.header_html || '',
        footer_html: data.footer_html || '',
        font_family: data.font_family || 'helvetica',
        primary_color: data.primary_color || '#1e40af',
        table_header_bg: data.table_header_bg || '#dbeafe',
        table_border_color: data.table_border_color || '#e2e8f0',
        use_company_logo: data.use_company_logo || false,
        logo_url: (data as any).logo_url || ''
      };
    }

    return DEFAULT_TEMPLATE;
  } catch (e) {
    console.warn('Failed to load PDF template:', e);
    return DEFAULT_TEMPLATE;
  }
}

/**
 * Converts hex color to RGB array for jsPDF
 */
export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [30, 64, 175]; // Default blue
}

/**
 * Loads an image URL and converts to data URL for jsPDF
 */
export async function loadImageAsDataUrl(url: string): Promise<string> {
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
}

/**
 * Replaces template placeholders with actual values
 */
export function replacePlaceholders(
  html: string,
  placeholders: Record<string, string>
): string {
  let result = html;
  Object.entries(placeholders).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  });
  return result;
}
