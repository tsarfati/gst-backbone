import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Info, Eye, Upload, X, Save, Layout, Code, Image as ImageIcon, Move } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SubcontractTemplateSettings from '@/components/PdfTemplateSettingsSubcontract';
import { Canvas as FabricCanvas, FabricImage } from 'fabric';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TemplateSettings {
  id?: string;
  company_id: string;
  template_type: string;
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
  notes?: string;
}

const TEMPLATE_PRESETS = {
  professional: {
    name: 'Professional Blue',
    header_html: '<div style="border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 25px;">\n  <div style="font-size: 30px; font-weight: 700; color: #1e3a8a; margin-bottom: 10px; letter-spacing: -0.5px;">{company_name}</div>\n  <div style="font-size: 15px; color: #64748b; font-weight: 600;">Timecard Report</div>\n  <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">Report Period: {period}</div>\n</div>',
    footer_html: '<div style="text-align: center; font-size: 10px; color: #64748b; padding-top: 20px; border-top: 1px solid #e2e8f0;">\n  <div style="font-weight: 600;">Confidential - For Internal Use Only</div>\n  <div style="margin-top: 5px;">Generated on {generated_date} | Page {page} of {pages}</div>\n</div>',
    primary_color: '#1e40af',
    table_header_bg: '#dbeafe',
  },
  corporate: {
    name: 'Corporate Gray',
    header_html: '<div style="background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); padding: 25px 0; margin-bottom: 25px; border-bottom: 3px solid #334155;">\n  <div style="font-size: 32px; font-weight: 700; color: #0f172a; margin-bottom: 8px; letter-spacing: -0.5px;">{company_name}</div>\n  <div style="font-size: 14px; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Timecard Report</div>\n  <div style="font-size: 12px; color: #64748b; margin-top: 8px;">{period}</div>\n</div>',
    footer_html: '<div style="background: #f1f5f9; padding: 15px 20px; margin: 25px -20px -20px -20px; border-top: 2px solid #cbd5e1; font-size: 10px; color: #475569; display: flex; justify-content: space-between; align-items: center;">\n  <div style="font-weight: 600;">© {company_name} - Confidential</div>\n  <div style="font-weight: 500;">Page {page} of {pages} | {generated_date}</div>\n</div>',
    primary_color: '#334155',
    table_header_bg: '#f1f5f9',
  },
  executive: {
    name: 'Executive Black',
    header_html: '<div style="background: #0f172a; color: white; padding: 30px; margin: -20px -20px 25px -20px; border-bottom: 4px solid #334155;">\n  <div style="font-size: 34px; font-weight: 700; margin-bottom: 10px; letter-spacing: -0.5px;">{company_name}</div>\n  <div style="font-size: 14px; font-weight: 600; opacity: 0.9; text-transform: uppercase; letter-spacing: 1.5px;">Timecard Report</div>\n  <div style="font-size: 13px; opacity: 0.8; margin-top: 8px;">{period}</div>\n</div>',
    footer_html: '<div style="background: #0f172a; color: white; padding: 15px 20px; margin: 25px -20px -20px -20px; border-top: 3px solid #334155; font-size: 10px; text-align: center;">\n  <div style="font-weight: 700; letter-spacing: 1px; margin-bottom: 4px;">CONFIDENTIAL DOCUMENT</div>\n  <div style="opacity: 0.85; font-weight: 500;">Page {page} of {pages} • Generated {generated_date}</div>\n</div>',
    primary_color: '#0f172a',
    table_header_bg: '#f8fafc',
  },
  modern: {
    name: 'Modern Indigo',
    header_html: '<div style="padding-bottom: 20px; margin-bottom: 25px; border-bottom: 3px solid #4f46e5;">\n  <div style="font-size: 32px; font-weight: 700; color: #312e81; margin-bottom: 10px;">{company_name}</div>\n  <div style="display: flex; justify-content: space-between; align-items: center;">\n    <div style="font-size: 15px; color: #6366f1; font-weight: 600;">Timecard Report</div>\n    <div style="font-size: 12px; color: #6b7280; font-weight: 500;">{period}</div>\n  </div>\n</div>',
    footer_html: '<div style="padding-top: 15px; border-top: 2px solid #e0e7ff; font-size: 10px; color: #6b7280;">\n  <table width="100%" style="border-collapse: collapse;"><tr>\n    <td style="font-weight: 600; text-align: left;">Confidential</td>\n    <td style="font-weight: 500; text-align: right;">Page {page} of {pages} • {generated_date}</td>\n  </tr></table>\n</div>',
    primary_color: '#4f46e5',
    table_header_bg: '#eef2ff',
  },
  financial: {
    name: 'Financial Green',
    header_html: '<div style="border-left: 5px solid #059669; padding-left: 20px; margin-bottom: 25px;">\n  <div style="font-size: 32px; font-weight: 700; color: #064e3b; margin-bottom: 10px;">{company_name}</div>\n  <div style="font-size: 14px; color: #047857; font-weight: 600; margin-bottom: 6px;">TIMECARD REPORT</div>\n  <div style="font-size: 12px; color: #6b7280;">Period: {period}</div>\n</div>',
    footer_html: '<div style="border-top: 2px solid #d1fae5; padding-top: 15px; font-size: 10px; color: #6b7280;">\n  <table width="100%"><tr>\n    <td style="font-weight: 600;">This document is confidential</td>\n    <td style="text-align: right; font-weight: 500;">{generated_date} | Page {page}/{pages}</td>\n  </tr></table>\n</div>',
    primary_color: '#059669',
    table_header_bg: '#d1fae5',
  },
  legal: {
    name: 'Legal Navy',
    header_html: '<div style="text-align: center; padding: 25px 0; margin-bottom: 25px; border-bottom: 3px double #1e3a8a;">\n  <div style="font-size: 30px; font-weight: 700; color: #1e3a8a; margin-bottom: 12px; letter-spacing: 0.5px;">{company_name}</div>\n  <div style="width: 100px; height: 2px; background: #3b82f6; margin: 0 auto 15px;"></div>\n  <div style="font-size: 14px; color: #1e40af; font-weight: 600; letter-spacing: 1px;">TIMECARD REPORT</div>\n  <div style="font-size: 12px; color: #64748b; margin-top: 8px;">For Period: {period}</div>\n</div>',
    footer_html: '<div style="text-align: center; padding-top: 20px; margin-top: 25px; border-top: 3px double #1e3a8a; font-size: 10px; color: #64748b;">\n  <div style="font-weight: 700; color: #1e40af; margin-bottom: 5px;">CONFIDENTIAL & PRIVILEGED</div>\n  <div style="font-weight: 500;">Page {page} of {pages} | Generated: {generated_date}</div>\n</div>',
    primary_color: '#1e40af',
    table_header_bg: '#dbeafe',
  },
  tech: {
    name: 'Tech Slate',
    header_html: '<div style="font-family: system-ui, -apple-system, sans-serif; background: linear-gradient(135deg, #334155 0%, #475569 100%); color: white; padding: 25px; margin: -20px -20px 25px -20px; border-radius: 8px;">\n  <div style="font-size: 30px; font-weight: 600; margin-bottom: 10px; letter-spacing: -0.5px;">{company_name}</div>\n  <div style="font-size: 13px; opacity: 0.9; font-weight: 500; letter-spacing: 0.5px;">TIMECARD REPORT • {period}</div>\n</div>',
    footer_html: '<div style="font-family: system-ui, -apple-system, sans-serif; padding-top: 15px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #64748b;">\n  <table width="100%"><tr>\n    <td style="font-weight: 600;">Confidential</td>\n    <td style="text-align: right; font-weight: 500;">Page {page}/{pages} • {generated_date}</td>\n  </tr></table>\n</div>',
    primary_color: '#334155',
    table_header_bg: '#f1f5f9',
  },
  minimal: {
    name: 'Minimal Clean',
    header_html: '<div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">\n  <div style="font-size: 32px; font-weight: 300; color: #111827; margin-bottom: 10px; letter-spacing: -0.5px;">{company_name}</div>\n  <div style="display: flex; justify-content: space-between; align-items: baseline;">\n    <div style="font-size: 14px; color: #6b7280; font-weight: 500;">Timecard Report</div>\n    <div style="font-size: 12px; color: #9ca3af;">{period}</div>\n  </div>\n</div>',
    footer_html: '<div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">\n  <table width="100%"><tr>\n    <td style="font-weight: 500;">{generated_date}</td>\n    <td style="text-align: right; font-weight: 500;">Page {page} of {pages}</td>\n  </tr></table>\n</div>',
    primary_color: '#111827',
    table_header_bg: '#f9fafb',
  },
  construction: {
    name: 'Construction Orange',
    header_html: '<div style="border-top: 6px solid #ea580c; border-bottom: 2px solid #ea580c; padding: 20px 0; margin-bottom: 25px;">\n  <div style="font-size: 32px; font-weight: 800; color: #9a3412; margin-bottom: 8px; text-transform: uppercase;">{company_name}</div>\n  <div style="font-size: 14px; color: #c2410c; font-weight: 700; letter-spacing: 1px;">TIMECARD REPORT</div>\n  <div style="font-size: 12px; color: #78716c; margin-top: 6px; font-weight: 600;">{period}</div>\n</div>',
    footer_html: '<div style="border-top: 2px solid #ea580c; padding-top: 15px; font-size: 10px; color: #78716c;">\n  <table width="100%"><tr>\n    <td style="font-weight: 700; color: #9a3412;">CONFIDENTIAL REPORT</td>\n    <td style="text-align: right; font-weight: 600;">Page {page} of {pages} | {generated_date}</td>\n  </tr></table>\n</div>',
    primary_color: '#ea580c',
    table_header_bg: '#fed7aa',
  },
  healthcare: {
    name: 'Healthcare Teal',
    header_html: '<div style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 28px; margin: -20px -20px 25px -20px; border-radius: 10px;">\n  <div style="font-size: 32px; font-weight: 700; margin-bottom: 10px;">{company_name}</div>\n  <div style="font-size: 14px; opacity: 0.95; font-weight: 600; letter-spacing: 0.5px;">Timecard Report • {period}</div>\n</div>',
    footer_html: '<div style="padding-top: 15px; border-top: 2px solid #5eead4; font-size: 10px; color: #0f766e; text-align: center;">\n  <div style="font-weight: 600; margin-bottom: 3px;">Confidential Medical Records</div>\n  <div style="font-weight: 500;">Page {page} of {pages} • {generated_date}</div>\n</div>',
    primary_color: '#0d9488',
    table_header_bg: '#ccfbf1',
  },
  luxury: {
    name: 'Luxury Gold',
    header_html: '<div style="background: linear-gradient(135deg, #78350f 0%, #92400e 100%); color: #fef3c7; padding: 28px; margin: -20px -20px 25px -20px; border-top: 3px solid #fbbf24; border-bottom: 3px solid #fbbf24;">\n  <div style="font-size: 32px; font-weight: 700; margin-bottom: 10px; letter-spacing: 1px;">{company_name}</div>\n  <div style="font-size: 13px; opacity: 0.95; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">Timecard Report</div>\n  <div style="font-size: 12px; opacity: 0.9; margin-top: 8px;">{period}</div>\n</div>',
    footer_html: '<div style="background: linear-gradient(135deg, #78350f 0%, #92400e 100%); color: #fef3c7; padding: 15px; margin: 25px -20px -20px -20px; border-top: 3px solid #fbbf24; text-align: center; font-size: 10px;">\n  <div style="font-weight: 700; letter-spacing: 1px; margin-bottom: 3px;">PRIVATE & CONFIDENTIAL</div>\n  <div style="opacity: 0.9; font-weight: 500;">Page {page} of {pages} • {generated_date}</div>\n</div>',
    primary_color: '#92400e',
    table_header_bg: '#fef3c7',
  },
  creative: {
    name: 'Creative Purple',
    header_html: '<div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%); color: white; padding: 30px; margin: -20px -20px 25px -20px; border-radius: 12px; box-shadow: 0 10px 30px rgba(124,58,237,0.3);">\n  <div style="font-size: 34px; font-weight: 800; margin-bottom: 10px; text-shadow: 0 2px 15px rgba(0,0,0,0.2);">{company_name}</div>\n  <div style="font-size: 15px; opacity: 0.95; font-weight: 600;">Timecard Report • {period}</div>\n</div>',
    footer_html: '<div style="text-align: center; font-size: 10px; padding-top: 15px; border-top: 2px solid #e9d5ff; color: #6b21a8;">\n  <div style="font-weight: 600;">Page {page} of {pages} • {generated_date}</div>\n</div>',
    primary_color: '#7c3aed',
    table_header_bg: '#f3e8ff',
  },
  split_header: {
    name: 'Split Header (Logo Left)',
    header_html: '<div style="display:flex; align-items:center; gap:20px; padding-bottom:16px; margin-bottom:20px; border-bottom:2px solid #e5e7eb;">\n  <div style="flex:1">\n    <div style="font-size:28px; font-weight:700; color:#111827; letter-spacing:-0.4px">{company_name}</div>\n    <div style="font-size:12px; color:#6b7280; margin-top:6px">{period}</div>\n  </div>\n  <div style="width:2px; height:48px; background:#e5e7eb"></div>\n  <div style="text-align:right; min-width:220px">\n    <div style="font-size:12px; color:#374151; font-weight:600">Timecard Report</div>\n    <div style="font-size:11px; color:#6b7280; margin-top:4px">Page {page} of {pages}</div>\n  </div>\n</div>',
    footer_html: '<div style="text-align:right; font-size:10px; color:#6b7280; padding-top:12px; border-top:1px solid #e5e7eb">Generated: {generated_date}</div>',
    primary_color: '#111827',
    table_header_bg: '#f3f4f6',
  },
  centered_logo: {
    name: 'Centered Title (Logo Center)',
    header_html: '<div style="text-align:center; padding-bottom:16px; margin-bottom:20px; border-bottom:2px solid #e5e7eb">\n  <div style="font-size:30px; font-weight:800; color:#111827">{company_name}</div>\n  <div style="margin-top:4px; font-size:12px; color:#6b7280">Timecard Report • {period}</div>\n</div>',
    footer_html: '<div style="text-align:center; font-size:10px; color:#6b7280; padding-top:12px; border-top:1px solid #e5e7eb">{generated_date} • Page {page}/{pages}</div>',
    primary_color: '#111827',
    table_header_bg: '#eef2f7',
  },
  right_aligned: {
    name: 'Right-Aligned (Logo Right)',
    header_html: '<div style="padding-bottom:16px; margin-bottom:20px; border-bottom:2px solid #e5e7eb">\n  <div style="display:flex; justify-content:space-between; align-items:flex-end">\n    <div>\n      <div style="font-size:28px; font-weight:700; color:#111827">{company_name}</div>\n      <div style="font-size:12px; color:#6b7280; margin-top:4px">{period}</div>\n    </div>\n    <div style="font-size:13px; color:#374151; font-weight:600">Timecard Report</div>\n  </div>\n</div>',
    footer_html: '<div style="font-size:10px; color:#6b7280; padding-top:12px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between">\n  <span>Confidential</span><span>Page {page} of {pages}</span>\n</div>',
    primary_color: '#111827',
    table_header_bg: '#f3f4f6',
  },
  banner_top: {
    name: 'Banner Top',
    header_html: '<div style="background:#111827; color:white; padding:18px 24px; margin:-20px -20px 20px -20px">\n  <div style="display:flex; justify-content:space-between; align-items:center">\n    <div style="font-size:18px; opacity:.9; font-weight:600; letter-spacing:1px">TIMECARD REPORT</div>\n    <div style="font-size:11px; opacity:.85">{period}</div>\n  </div>\n</div>',
    footer_html: '<div style="background:#111827; color:white; padding:10px 16px; margin:20px -20px -20px -20px; font-size:10px; text-align:center">Page {page}/{pages} • {generated_date}</div>',
    primary_color: '#111827',
    table_header_bg: '#e5e7eb',
  },
  sidebar_accent: {
    name: 'Sidebar Accent',
    header_html: '<div style="display:grid; grid-template-columns: 8px 1fr; gap:16px; align-items:center; padding-bottom:16px; margin-bottom:20px; border-bottom:2px solid #e5e7eb">\n  <div style="background:#3b82f6; height:48px; border-radius:4px"></div>\n  <div>\n    <div style="font-size:28px; font-weight:800; color:#111827">{company_name}</div>\n    <div style="font-size:12px; color:#6b7280; margin-top:4px">{period}</div>\n  </div>\n</div>',
    footer_html: '<div style="font-size:10px; color:#6b7280; padding-top:12px; border-top:1px solid #e5e7eb; text-align:right">Page {page}/{pages}</div>',
    primary_color: '#3b82f6',
    table_header_bg: '#eff6ff',
  },
};

export default function PdfTemplateSettings() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [editMode, setEditMode] = useState<'visual' | 'code'>('visual');
  const [timecardTemplate, setTimecardTemplate] = useState<TemplateSettings>({
    company_id: currentCompany?.id || '',
    template_type: 'timecard',
    font_family: 'helvetica',
    header_html: TEMPLATE_PRESETS.professional.header_html,
    footer_html: TEMPLATE_PRESETS.professional.footer_html,
    primary_color: '#1e40af',
    secondary_color: '#3b82f6',
    table_header_bg: '#f1f5f9',
    table_border_color: '#e2e8f0',
    table_stripe_color: '#f8fafc',
    auto_size_columns: true,
    header_images: []
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const fabricImagesRef = useRef<FabricImage[]>([]);
  const [canvasReady, setCanvasReady] = useState(false);
  const [saveAsPresetDialogOpen, setSaveAsPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Resolve storage or relative URLs to loadable image URLs (uses signed URLs if needed)
  const resolveStorageUrl = async (rawUrl: string): Promise<string> => {
    try {
      if (/^https?:\/\//i.test(rawUrl)) {
        const sep = rawUrl.includes('?') ? '&' : '?';
        return `${rawUrl}${sep}t=${Date.now()}`;
      }
      if (rawUrl.startsWith('/')) {
        return window.location.origin + rawUrl;
      }
      const [bucket, ...rest] = rawUrl.split('/');
      const objectPath = rest.join('/');
      if (bucket && objectPath) {
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        let url = pub?.publicUrl;
        if (!url) {
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60 * 24);
          url = signed?.signedUrl;
        }
        if (url) {
          const sep = url.includes('?') ? '&' : '?';
          return `${url}${sep}t=${Date.now()}`;
        }
      }
    } catch (e) {
      console.error('resolveStorageUrl error:', e);
    }
    return rawUrl;
  };

  const getCompanyLogoPublicUrl = async (): Promise<string | undefined> => {
    const raw = (currentCompany as any)?.logo_url as string | undefined;
    if (!raw) return undefined;
    try {
      if (/^https?:\/\//i.test(raw)) return raw;
      if (raw.startsWith('/')) return window.location.origin + raw;
      const [bucket, ...rest] = raw.split('/');
      const objectPath = rest.join('/');
      if (bucket && objectPath) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        return data?.publicUrl || undefined;
      }
    } catch (e) {
      console.error('getCompanyLogoPublicUrl error:', e);
    }
    return undefined;
  };
  useEffect(() => {
    if (currentCompany?.id) {
      loadTemplate('timecard');
    }
  }, [currentCompany?.id]);

  // Auto-add company logo to header images if none present - only on initial load
  useEffect(() => {
    const maybeAddLogo = async () => {
      if (!currentCompany?.logo_url || !canvasReady) return;
      const hasImages = (timecardTemplate.header_images || []).length > 0;
      if (hasImages) return;
      
      // Only add logo if we have a canvas but no images yet
      const url = await getCompanyLogoPublicUrl();
      if (!url) return;
      
      setTimecardTemplate(prev => {
        // Double-check we still don't have images
        if (prev.header_images && prev.header_images.length > 0) return prev;
        return {
          ...prev,
          header_images: [{ url, x: 36, y: 28, width: 140, height: 56 }]
        };
      });
    };
    maybeAddLogo();
  }, [currentCompany?.logo_url, canvasReady]);

  // Initialize fabric canvas with proper sizing
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    // Get the container size to match the preview
    const container = canvasRef.current.parentElement;
    if (!container) return;

    const width = 842; // A4 landscape in points
    const height = 595;

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: 'transparent',
      selection: true,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;
    setCanvasReady(true);

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Update canvas with logos without clearing to prevent flicker/disappear
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const imgs = timecardTemplate.header_images || [];
    if (!canvas || !canvasReady) return;

    // Ensure canvas stays transparent
    canvas.backgroundColor = 'transparent';
    canvas.requestRenderAll();

    // Sync fabric objects with state (by index)
    imgs.forEach((img, idx) => {
      const existing = fabricImagesRef.current[idx];
      if (existing && (existing as any)._originalUrl === img.url) {
        existing.set({
          left: img.x,
          top: img.y,
          scaleX: img.width / ((existing.width as number) || 1),
          scaleY: img.height / ((existing.height as number) || 1),
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          hoverCursor: 'move',
        });
        existing.setCoords?.();
        canvas.setActiveObject(existing as any);
        canvas.requestRenderAll();
        } else {
          // Remove mismatched existing
          if (existing) {
            canvas.remove(existing as any);
          }
          (async () => {
            try {
              const resolvedUrl = await resolveStorageUrl(img.url);
              const fabricImg = await FabricImage.fromURL(resolvedUrl, { crossOrigin: 'anonymous' });
              (fabricImg as any)._originalUrl = img.url;
              fabricImg.set({
                left: img.x,
                top: img.y,
                scaleX: img.width / ((fabricImg.width as number) || 1),
                scaleY: img.height / ((fabricImg.height as number) || 1),
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                hoverCursor: 'move',
                lockRotation: false,
              });

              // Styling of controls (fallback to a solid color for canvas rendering)
              fabricImg.set({
                borderColor: '#3b82f6',
                cornerColor: '#3b82f6',
                cornerSize: 8,
                transparentCorners: false,
              });

              // Persist changes when moved/resized
              fabricImg.on('modified', () => {
                const updated = [...imgs];
                const w = (fabricImg.width as number) || 0;
                const h = (fabricImg.height as number) || 0;
                updated[idx] = {
                  url: img.url,
                  x: Math.round(fabricImg.left || 0),
                  y: Math.round(fabricImg.top || 0),
                  width: Math.round(w * ((fabricImg.scaleX as number) || 1)),
                  height: Math.round(h * ((fabricImg.scaleY as number) || 1)),
                };
                setTimecardTemplate((prev) => ({ ...prev, header_images: updated }));
                canvas.setActiveObject(fabricImg);
                canvas.requestRenderAll();
              });

              fabricImagesRef.current[idx] = fabricImg;
              canvas.add(fabricImg);
              canvas.setActiveObject(fabricImg);
              canvas.requestRenderAll();
            } catch (err) {
              console.error('Failed to load header image onto canvas:', err, img.url);
            }
          })();
        }
    });

    // Remove extra fabric objects if images were removed
    for (let i = imgs.length; i < fabricImagesRef.current.length; i++) {
      const obj = fabricImagesRef.current[i];
      if (obj) {
        canvas.remove(obj as any);
      }
    }
    fabricImagesRef.current.length = imgs.length;

    canvas.requestRenderAll();
  }, [timecardTemplate.header_images, canvasReady]);

  const loadTemplate = async (templateType: string) => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdf_templates')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('template_type', templateType)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Parse header_images properly
        let headerImages = [];
        try {
          headerImages = typeof data.header_images === 'string' 
            ? JSON.parse(data.header_images) 
            : (data.header_images || []);
        } catch (e) {
          console.error('Error parsing header_images:', e);
          headerImages = [];
        }

        setTimecardTemplate({
          ...data,
          header_images: headerImages
        });
      } else {
        // If no saved template, try to add company logo as default
        const logoUrl = await getCompanyLogoPublicUrl();
        if (logoUrl) {
          setTimecardTemplate(prev => ({
            ...prev,
            header_images: [{ url: logoUrl, x: 36, y: 28, width: 140, height: 56 }]
          }));
        }
      }
    } catch (error: any) {
      console.error('Error loading template:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async (template: TemplateSettings) => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const templateData = {
        ...template,
        company_id: currentCompany.id,
        created_by: user.id
      };

      if (template.id) {
        const { error } = await supabase
          .from('pdf_templates')
          .update(templateData)
          .eq('id', template.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pdf_templates')
          .insert([templateData]);
        
        if (error) throw error;
      }

      toast({
        title: "Template saved",
        description: "PDF template settings have been updated successfully.",
      });
      
      await loadTemplate(template.template_type);
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save template settings.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentCompany?.id) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}/header-images/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('company-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-files')
        .getPublicUrl(fileName);

      const newImages = [...(timecardTemplate.header_images || []), {
        url: publicUrl,
        x: 50,
        y: 50,
        width: 100,
        height: 100
      }];

      setTimecardTemplate({ ...timecardTemplate, header_images: newImages });

      toast({
        title: "Image uploaded",
        description: "You can now position this image in your header.",
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const removeHeaderImage = (index: number) => {
    const newImages = timecardTemplate.header_images?.filter((_, i) => i !== index);
    setTimecardTemplate({ ...timecardTemplate, header_images: newImages });
  };

  const updateImagePosition = (index: number, field: 'x' | 'y' | 'width' | 'height', value: number) => {
    const newImages = [...(timecardTemplate.header_images || [])];
    newImages[index] = { ...newImages[index], [field]: value };
    setTimecardTemplate({ ...timecardTemplate, header_images: newImages });
  };

  const applyPreset = (presetKey: string) => {
    const preset = TEMPLATE_PRESETS[presetKey as keyof typeof TEMPLATE_PRESETS];
    if (preset) {
      setTimecardTemplate(prev => ({
        ...prev,
        header_html: preset.header_html,
        footer_html: preset.footer_html,
        primary_color: preset.primary_color,
        table_header_bg: preset.table_header_bg,
      }));
      setSelectedPreset(presetKey);
      // If no logos positioned yet, auto-place company logo depending on layout
      getCompanyLogoPublicUrl().then((logoUrl) => {
        if (!logoUrl) return;
        setTimecardTemplate(prev => {
          if ((prev.header_images || []).length > 0) return prev;
          // Default positions for a few layouts (A4 landscape 842x595)
          const placements: Record<string, { x: number; y: number; width: number; height: number }> = {
            split_header: { x: 36, y: 28, width: 140, height: 56 },
            centered_logo: { x: (842 - 140) / 2, y: 24, width: 140, height: 56 },
            right_aligned: { x: 842 - 36 - 140, y: 28, width: 140, height: 56 },
            banner_top: { x: 36, y: 26, width: 120, height: 48 },
            sidebar_accent: { x: 24, y: 28, width: 120, height: 48 },
          };
          const fallback = { x: 36, y: 28, width: 140, height: 56 };
          const pos = placements[presetKey] || fallback;
          return { ...prev, header_images: [{ url: logoUrl, ...pos }] };
        });
      });
      toast({
        title: "Template applied",
        description: `${preset.name} template has been applied. You can customize it further.`,
      });
    }
  };

  const saveTemplateAsPreset = async () => {
    setSaveAsPresetDialogOpen(true);
  };

  const confirmSaveAsPreset = async () => {
    if (!presetName.trim() || !currentCompany?.id) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save as a new template with template_name
      const templateData = {
        ...timecardTemplate,
        template_name: presetName,
        company_id: currentCompany.id,
        created_by: user.id,
        id: undefined // Remove id to create new record
      };

      const { error } = await supabase
        .from('pdf_templates')
        .insert([templateData]);

      if (error) throw error;

      toast({
        title: "Preset saved",
        description: `Template preset "${presetName}" has been saved successfully.`,
      });

      setSaveAsPresetDialogOpen(false);
      setPresetName('');
    } catch (error: any) {
      console.error('Error saving preset:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save preset.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = (html: string) => {
    return html
      .replace(/{company_name}/g, currentCompany?.name || 'Company Name')
      .replace(/{period}/g, 'Jan 1 - Jan 7, 2025')
      .replace(/{date}/g, new Date().toLocaleDateString())
      .replace(/{employee_name}/g, 'John Doe')
      .replace(/{job_name}/g, 'Sample Project')
      .replace(/{page}/g, '1')
      .replace(/{pages}/g, '1')
      .replace(/{generated_date}/g, new Date().toLocaleDateString());
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF Document Templates
          </CardTitle>
          <CardDescription>
            Design your PDF reports with HTML templates and live preview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Use HTML to design your headers and footers. Available variables: <code className="text-xs">{'{company_name}'}</code>, <code className="text-xs">{'{period}'}</code>, <code className="text-xs">{'{date}'}</code>, <code className="text-xs">{'{employee_name}'}</code>, <code className="text-xs">{'{job_name}'}</code>, <code className="text-xs">{'{page}'}</code>, <code className="text-xs">{'{pages}'}</code>
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="timecard" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="timecard">Timecard Reports</TabsTrigger>
              <TabsTrigger value="purchase-order" disabled>Purchase Orders (Coming Soon)</TabsTrigger>
              <TabsTrigger value="subcontract">Subcontracts</TabsTrigger>
            </TabsList>

            <TabsContent value="subcontract" className="space-y-6">
              <SubcontractTemplateSettings onSave={() => loadTemplate('subcontract')} />
            </TabsContent>

            <TabsContent value="timecard" className="space-y-6">
              {/* Template Presets */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layout className="h-4 w-4" />
                    Choose a Template Preset
                  </CardTitle>
                  <CardDescription>Start with a professionally designed template</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={selectedPreset} onValueChange={applyPreset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a preset template" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TEMPLATE_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Edit Mode Toggle */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Edit Mode</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={editMode} onValueChange={(value) => setEditMode(value as 'visual' | 'code')}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="visual" id="visual" />
                      <Label htmlFor="visual" className="flex items-center gap-2 cursor-pointer">
                        <Layout className="h-4 w-4" />
                        Visual Editor
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="code" id="code" />
                      <Label htmlFor="code" className="flex items-center gap-2 cursor-pointer">
                        <Code className="h-4 w-4" />
                        HTML Code
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {editMode === 'code' ? (
                <>
                  {/* Header HTML Editor */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Header HTML</CardTitle>
                      <CardDescription>Design the header section with HTML</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={timecardTemplate.header_html || ''}
                        onChange={(e) => setTimecardTemplate({ ...timecardTemplate, header_html: e.target.value })}
                        rows={10}
                        className="font-mono text-xs"
                        placeholder="Enter HTML for header..."
                      />
                      <div className="p-4 border rounded-lg bg-muted/30">
                        <Label className="text-xs text-muted-foreground mb-2 block">Preview:</Label>
                        <div 
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: renderPreview(timecardTemplate.header_html || '') }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Footer HTML Editor */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Footer HTML</CardTitle>
                      <CardDescription>Design the footer section with HTML</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={timecardTemplate.footer_html || ''}
                        onChange={(e) => setTimecardTemplate({ ...timecardTemplate, footer_html: e.target.value })}
                        rows={8}
                        className="font-mono text-xs"
                        placeholder="Enter HTML for footer..."
                      />
                      <div className="p-4 border rounded-lg bg-muted/30">
                        <Label className="text-xs text-muted-foreground mb-2 block">Preview:</Label>
                        <div 
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: renderPreview(timecardTemplate.footer_html || '') }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  {/* Visual Style Editor */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Colors & Styling</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Primary Color</Label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={timecardTemplate.primary_color}
                              onChange={(e) => setTimecardTemplate({ ...timecardTemplate, primary_color: e.target.value })}
                              className="h-10 w-16 rounded border cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={timecardTemplate.primary_color}
                              onChange={(e) => setTimecardTemplate({ ...timecardTemplate, primary_color: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Table Header Background</Label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={timecardTemplate.table_header_bg}
                              onChange={(e) => setTimecardTemplate({ ...timecardTemplate, table_header_bg: e.target.value })}
                              className="h-10 w-16 rounded border cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={timecardTemplate.table_header_bg}
                              onChange={(e) => setTimecardTemplate({ ...timecardTemplate, table_header_bg: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Font Family</Label>
                        <Select 
                          value={timecardTemplate.font_family} 
                          onValueChange={(value) => setTimecardTemplate({ ...timecardTemplate, font_family: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="helvetica">Helvetica</SelectItem>
                            <SelectItem value="times">Times New Roman</SelectItem>
                            <SelectItem value="courier">Courier</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Header Images */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Header Images
                      </CardTitle>
                      <CardDescription>Upload and position images in your header</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="image-upload" className="cursor-pointer">
                          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              {uploadingImage ? 'Uploading...' : 'Click to upload image'}
                            </p>
                          </div>
                          <Input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                          />
                        </Label>
                      </div>

                      {timecardTemplate.header_images && timecardTemplate.header_images.length > 0 && (
                        <div className="space-y-3">
                          {timecardTemplate.header_images.map((img, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/20 transition-colors">
                              <img src={img.url} alt={`Logo ${index + 1}`} className="w-16 h-16 object-contain border rounded bg-white" />
                              <div className="flex-1">
                                <p className="text-sm font-medium">Logo {index + 1}</p>
                                <p className="text-xs text-muted-foreground">Drag on preview to position and resize</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeHeaderImage(index)}
                                className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Save Buttons */}
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => saveTemplateAsPreset()} 
                  disabled={loading}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Save as Preset
                </Button>
                <Button onClick={() => saveTemplate(timecardTemplate)} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Template'}
                </Button>
              </div>

              {/* Full Template Preview with Interactive Logo Placement */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <Move className="h-4 w-4" />
                    Interactive Template Preview
                  </CardTitle>
                  <CardDescription>
                    Preview your template and drag logos to position them
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {timecardTemplate.header_images && timecardTemplate.header_images.length > 0 
                          ? <span><strong>Click and drag</strong> logos to reposition. <strong>Drag corners</strong> to resize. Changes save automatically.</span>
                          : 'Preview shows how your template will look. Upload logo images above to position them here.'}
                      </AlertDescription>
                    </Alert>

                    {/* Template Preview with Canvas Overlay */}
                    <div className="relative w-full bg-gradient-to-br from-muted/10 to-muted/5 rounded-lg p-4 shadow-xl">
                      {/* Static HTML Preview */}
                      <div className="relative w-full bg-white rounded shadow-lg overflow-hidden" style={{ aspectRatio: '842/595' }}>
                        {/* Grid background */}
                        <div className="absolute inset-0 pointer-events-none z-0" style={{
                          backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px)',
                          backgroundSize: '50px 50px'
                        }} />
                        
                        {/* Reference dimensions */}
                        <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/90 px-2 py-1 rounded shadow-sm z-[100]">
                          842pt × 595pt
                        </div>

                        {/* Template Content - lower z-index so canvas is on top */}
                        <div className="relative w-full h-full flex flex-col p-6 pointer-events-none z-10">
                          {/* Header Section */}
                          <div 
                            className="prose prose-sm max-w-none mb-4"
                            dangerouslySetInnerHTML={{ __html: renderPreview(timecardTemplate.header_html || '') }}
                          />

                          {/* Sample Body Content */}
                          <div className="flex-1 overflow-hidden">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr style={{ backgroundColor: timecardTemplate.table_header_bg }}>
                                  <th className="border p-2 text-left">Employee</th>
                                  <th className="border p-2 text-left">Date</th>
                                  <th className="border p-2 text-left">Job</th>
                                  <th className="border p-2 text-center">Hours</th>
                                  <th className="border p-2 text-right">Rate</th>
                                  <th className="border p-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="bg-muted/20">
                                  <td className="border p-2">John Doe</td>
                                  <td className="border p-2">01/15/2025</td>
                                  <td className="border p-2">Main Street Project</td>
                                  <td className="border p-2 text-center">8.0</td>
                                  <td className="border p-2 text-right">$45.00</td>
                                  <td className="border p-2 text-right">$360.00</td>
                                </tr>
                                <tr>
                                  <td className="border p-2">Jane Smith</td>
                                  <td className="border p-2">01/15/2025</td>
                                  <td className="border p-2">Downtown Building</td>
                                  <td className="border p-2 text-center">7.5</td>
                                  <td className="border p-2 text-right">$50.00</td>
                                  <td className="border p-2 text-right">$375.00</td>
                                </tr>
                                <tr className="bg-muted/20">
                                  <td className="border p-2">Mike Johnson</td>
                                  <td className="border p-2">01/15/2025</td>
                                  <td className="border p-2">Bridge Repair</td>
                                  <td className="border p-2 text-center">9.0</td>
                                  <td className="border p-2 text-right">$55.00</td>
                                  <td className="border p-2 text-right">$495.00</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Footer Section */}
                          <div 
                            className="prose prose-sm max-w-none mt-4"
                            dangerouslySetInnerHTML={{ __html: renderPreview(timecardTemplate.footer_html || '') }}
                          />

                        </div>
                        {/* Canvas on top for logo manipulation */}
                        <canvas
                          ref={canvasRef}
                          width={842}
                          height={595}
                          className="absolute inset-0 w-full h-full"
                          style={{ 
                            zIndex: 90, 
                            background: 'transparent', 
                            cursor: 'move',
                            pointerEvents: 'auto'
                          }}
                        />
                      </div>
                    </div>

                    {/* Logo List */}
                    {timecardTemplate.header_images && timecardTemplate.header_images.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Positioned Logos</Label>
                        <div className="grid gap-2">
                          {timecardTemplate.header_images.map((img, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-3">
                                <img src={img.url} alt={`Logo ${index + 1}`} className="w-12 h-12 object-contain border rounded bg-white p-1" />
                                <div className="text-xs space-y-0.5">
                                  <div className="font-semibold">Logo {index + 1}</div>
                                  <div className="text-muted-foreground font-mono">
                                    ({Math.round(img.x)}, {Math.round(img.y)}) • {Math.round(img.width)}×{Math.round(img.height)}pt
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeHeaderImage(index)}
                                className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Save as Preset Dialog */}
      <Dialog open={saveAsPresetDialogOpen} onOpenChange={setSaveAsPresetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template Preset</DialogTitle>
            <DialogDescription>
              Save your current template settings as a reusable preset
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                placeholder="e.g., My Custom Template"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveAsPresetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSaveAsPreset} disabled={!presetName.trim() || loading}>
              {loading ? 'Saving...' : 'Save Preset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}