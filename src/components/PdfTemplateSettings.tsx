import { useState, useEffect } from 'react';
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
    name: 'Professional',
    header_html: '<div style="border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px;">\n  <div style="font-size: 28px; font-weight: bold; color: #1e3a8a; margin-bottom: 8px;">{company_name}</div>\n  <div style="font-size: 16px; color: #475569;">Timecard Report</div>\n  <div style="font-size: 12px; color: #64748b; margin-top: 5px;">Report Period: {period}</div>\n</div>',
    footer_html: '<div style="text-align: center; font-size: 10px; color: #64748b; padding-top: 15px; border-top: 1px solid #e2e8f0;">\n  <div>Confidential - For Internal Use Only</div>\n  <div style="margin-top: 5px;">Generated on {generated_date} | Page {page} of {pages}</div>\n</div>',
    primary_color: '#1e40af',
    table_header_bg: '#dbeafe',
  },
  modern: {
    name: 'Modern',
    header_html: '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; margin: -20px -20px 20px -20px; border-radius: 8px;">\n  <div style="font-size: 32px; font-weight: bold; margin-bottom: 10px;">{company_name}</div>\n  <div style="font-size: 14px; opacity: 0.95;">Timecard Report • {period}</div>\n</div>',
    footer_html: '<div style="text-align: center; font-size: 9px; color: #9ca3af; padding-top: 12px;">\n  <div style="font-weight: 600; margin-bottom: 3px;">CONFIDENTIAL DOCUMENT</div>\n  <div>Page {page} • Generated {generated_date}</div>\n</div>',
    primary_color: '#667eea',
    table_header_bg: '#ede9fe',
  },
  minimal: {
    name: 'Minimal',
    header_html: '<div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">\n  <div style="font-size: 24px; font-weight: 300; color: #111827; letter-spacing: 2px;">{company_name}</div>\n  <div style="font-size: 11px; color: #6b7280; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px;">Timecard Report — {period}</div>\n</div>',
    footer_html: '<div style="text-align: center; font-size: 8px; color: #9ca3af; padding-top: 15px;">{page} / {pages}</div>',
    primary_color: '#111827',
    table_header_bg: '#f9fafb',
  },
  classic: {
    name: 'Classic',
    header_html: '<table width="100%" style="border-collapse: collapse; margin-bottom: 20px;">\n  <tr>\n    <td style="width: 70%; vertical-align: top;">\n      <div style="font-size: 26px; font-weight: bold; color: #0f172a; margin-bottom: 5px;">{company_name}</div>\n      <div style="font-size: 13px; color: #334155;">Weekly Timecard Summary</div>\n    </td>\n    <td style="width: 30%; text-align: right; vertical-align: top;">\n      <div style="font-size: 11px; color: #64748b;">Period: {period}</div>\n      <div style="font-size: 11px; color: #64748b;">Date: {date}</div>\n    </td>\n  </tr>\n</table>\n<div style="border-top: 2px solid #1e293b; margin-bottom: 15px;"></div>',
    footer_html: '<div style="border-top: 2px solid #1e293b; padding-top: 10px; margin-top: 20px;">\n  <table width="100%" style="font-size: 9px; color: #475569;">\n    <tr>\n      <td>Confidential Document</td>\n      <td style="text-align: right;">Page {page} of {pages}</td>\n    </tr>\n  </table>\n</div>',
    primary_color: '#0f172a',
    table_header_bg: '#f1f5f9',
  },
  corporate: {
    name: 'Corporate',
    header_html: '<div style="background: #f8fafc; border-left: 5px solid #0ea5e9; padding: 20px; margin-bottom: 20px;">\n  <div style="font-size: 22px; font-weight: 600; color: #0c4a6e; margin-bottom: 5px;">{company_name}</div>\n  <div style="font-size: 14px; color: #64748b;">Employee Time Report</div>\n  <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">Period: {period} | Generated: {date}</div>\n</div>',
    footer_html: '<div style="background: #f8fafc; padding: 10px; text-align: center; font-size: 9px; color: #64748b;">\n  <div>© {company_name} - Internal Use Only</div>\n  <div style="margin-top: 3px;">Page {page} of {pages}</div>\n</div>',
    primary_color: '#0ea5e9',
    table_header_bg: '#e0f2fe',
  },
  executive: {
    name: 'Executive',
    header_html: '<div style="border: 2px solid #78716c; padding: 15px; margin-bottom: 20px;">\n  <div style="text-align: center; font-size: 20px; font-weight: 700; color: #292524; letter-spacing: 3px; margin-bottom: 10px;">{company_name}</div>\n  <div style="text-align: center; font-size: 12px; color: #57534e; font-weight: 500;">TIMECARD REPORT</div>\n  <div style="text-align: center; font-size: 10px; color: #78716c; margin-top: 8px;">{period}</div>\n</div>',
    footer_html: '<div style="border-top: 2px solid #78716c; padding-top: 10px; font-size: 8px; color: #78716c;">\n  <table width="100%"><tr>\n    <td>CONFIDENTIAL</td>\n    <td style="text-align: center;">Page {page}/{pages}</td>\n    <td style="text-align: right;">{date}</td>\n  </tr></table>\n</div>',
    primary_color: '#78716c',
    table_header_bg: '#f5f5f4',
  },
  bold: {
    name: 'Bold',
    header_html: '<div style="background: #dc2626; color: white; padding: 20px; margin: -20px -20px 25px -20px;">\n  <div style="font-size: 30px; font-weight: 900; margin-bottom: 5px;">{company_name}</div>\n  <div style="font-size: 13px; font-weight: 600; opacity: 0.9;">TIMECARD REPORT | {period}</div>\n</div>',
    footer_html: '<div style="background: #dc2626; color: white; padding: 8px; margin: 20px -20px -20px -20px; text-align: center; font-size: 9px;">\n  <div style="font-weight: 600;">CONFIDENTIAL & PROPRIETARY</div>\n  <div style="margin-top: 3px; opacity: 0.8;">Page {page} of {pages} | {generated_date}</div>\n</div>',
    primary_color: '#dc2626',
    table_header_bg: '#fecaca',
  },
  elegant: {
    name: 'Elegant',
    header_html: '<div style="text-align: center; padding-bottom: 25px; margin-bottom: 20px; background: linear-gradient(to bottom, #fafaf9 0%, #ffffff 100%);">\n  <div style="font-size: 32px; font-family: serif; font-weight: 300; color: #57534e; margin-bottom: 8px; letter-spacing: 1px;">{company_name}</div>\n  <div style="width: 60px; height: 2px; background: #a8a29e; margin: 0 auto 12px;"></div>\n  <div style="font-size: 13px; color: #78716c; font-style: italic;">Timecard Report</div>\n  <div style="font-size: 11px; color: #a8a29e; margin-top: 5px;">{period}</div>\n</div>',
    footer_html: '<div style="text-align: center; padding-top: 20px; margin-top: 20px; border-top: 1px solid #e7e5e4; font-size: 9px; color: #a8a29e;">\n  <div style="font-style: italic;">Page {page} of {pages}</div>\n  <div style="margin-top: 5px;">{generated_date}</div>\n</div>',
    primary_color: '#78716c',
    table_header_bg: '#fafaf9',
  },
  tech: {
    name: 'Tech',
    header_html: '<div style="font-family: monospace; border: 1px solid #10b981; padding: 15px; margin-bottom: 20px; background: #f0fdf4;">\n  <div style="font-size: 20px; font-weight: bold; color: #047857;">// {company_name}</div>\n  <div style="font-size: 12px; color: #059669; margin-top: 5px;">/* Timecard Report */</div>\n  <div style="font-size: 11px; color: #10b981; margin-top: 8px;">Period: {period}</div>\n</div>',
    footer_html: '<div style="font-family: monospace; border-top: 1px solid #10b981; padding-top: 10px; font-size: 9px; color: #059669;">\n  <table width="100%"><tr>\n    <td>// End of report</td>\n    <td style="text-align: right;">Page {page}/{pages}</td>\n  </tr></table>\n</div>',
    primary_color: '#10b981',
    table_header_bg: '#d1fae5',
  },
  simple: {
    name: 'Simple',
    header_html: '<div style="margin-bottom: 20px;">\n  <div style="font-size: 26px; font-weight: 600; color: #18181b; margin-bottom: 5px;">{company_name}</div>\n  <div style="font-size: 14px; color: #71717a;">Timecard Report</div>\n  <div style="font-size: 12px; color: #a1a1aa; margin-top: 5px;">{period}</div>\n  <div style="height: 2px; background: #e4e4e7; margin-top: 15px;"></div>\n</div>',
    footer_html: '<div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #e4e4e7; font-size: 10px; color: #a1a1aa;">\n  <table width="100%"><tr>\n    <td>{generated_date}</td>\n    <td style="text-align: right;">Page {page} of {pages}</td>\n  </tr></table>\n</div>',
    primary_color: '#18181b',
    table_header_bg: '#f4f4f5',
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

  useEffect(() => {
    if (currentCompany?.id) {
      loadTemplate('timecard');
    }
  }, [currentCompany?.id]);

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
        setTimecardTemplate({
          ...data,
          header_images: (data.header_images as any) || []
        });
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
      setTimecardTemplate({
        ...timecardTemplate,
        header_html: preset.header_html,
        footer_html: preset.footer_html,
        primary_color: preset.primary_color,
        table_header_bg: preset.table_header_bg,
      });
      setSelectedPreset(presetKey);
      toast({
        title: "Template applied",
        description: `${preset.name} template has been applied. You can customize it further.`,
      });
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
                            <Card key={index}>
                              <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                  <img src={img.url} alt="Header" className="w-20 h-20 object-contain border rounded" />
                                  <div className="flex-1 grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">X Position</Label>
                                      <Input
                                        type="number"
                                        value={img.x}
                                        onChange={(e) => updateImagePosition(index, 'x', Number(e.target.value))}
                                        className="h-8"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Y Position</Label>
                                      <Input
                                        type="number"
                                        value={img.y}
                                        onChange={(e) => updateImagePosition(index, 'y', Number(e.target.value))}
                                        className="h-8"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Width</Label>
                                      <Input
                                        type="number"
                                        value={img.width}
                                        onChange={(e) => updateImagePosition(index, 'width', Number(e.target.value))}
                                        className="h-8"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Height</Label>
                                      <Input
                                        type="number"
                                        value={img.height}
                                        onChange={(e) => updateImagePosition(index, 'height', Number(e.target.value))}
                                        className="h-8"
                                      />
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeHeaderImage(index)}
                                    className="shrink-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={() => saveTemplate(timecardTemplate)} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Template'}
                </Button>
              </div>

              {/* Full Template Preview with Logo Placement */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Template Preview
                  </CardTitle>
                  <CardDescription>
                    Preview your complete timecard template with logo placement (A4 Landscape: 842×595pt)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative w-full bg-white rounded-lg overflow-hidden shadow-lg" style={{ aspectRatio: '842/595' }}>
                    {/* Grid background */}
                    <div className="absolute inset-0" style={{
                      backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)',
                      backgroundSize: '50px 50px'
                    }} />
                    
                    {/* Reference dimensions */}
                    <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/90 px-2 py-1 rounded shadow-sm z-10">
                      842pt × 595pt
                    </div>

                    {/* Template Content */}
                    <div className="relative w-full h-full flex flex-col p-6">
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

                    {/* Render logo images with positioning overlay */}
                    {timecardTemplate.header_images && timecardTemplate.header_images.map((img, idx) => (
                      <div
                        key={idx}
                        className="absolute border-2 border-primary bg-primary/5 rounded group hover:shadow-xl transition-all z-20"
                        style={{
                          left: `${(img.x / 842) * 100}%`,
                          top: `${(img.y / 595) * 100}%`,
                          width: `${(img.width / 842) * 100}%`,
                          height: `${(img.height / 595) * 100}%`,
                        }}
                      >
                        <img 
                          src={img.url} 
                          alt={`Logo ${idx + 1}`} 
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Logo {idx + 1} ({Math.round(img.x)}, {Math.round(img.y)})
                        </div>
                        
                        {/* Position adjustment controls */}
                        <div className="absolute -bottom-24 left-0 right-0 bg-background border border-primary rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-30 min-w-max">
                          <div className="grid grid-cols-4 gap-1 text-xs">
                            <div>
                              <Label className="text-[10px]">X (pt)</Label>
                              <Input
                                type="number"
                                value={Math.round(img.x)}
                                onChange={(e) => updateImagePosition(idx, 'x', parseFloat(e.target.value) || 0)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Y (pt)</Label>
                              <Input
                                type="number"
                                value={Math.round(img.y)}
                                onChange={(e) => updateImagePosition(idx, 'y', parseFloat(e.target.value) || 0)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Width</Label>
                              <Input
                                type="number"
                                value={Math.round(img.width)}
                                onChange={(e) => updateImagePosition(idx, 'width', parseFloat(e.target.value) || 10)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px]">Height</Label>
                              <Input
                                type="number"
                                value={Math.round(img.height)}
                                onChange={(e) => updateImagePosition(idx, 'height', parseFloat(e.target.value) || 10)}
                                className="h-7 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    {timecardTemplate.header_images && timecardTemplate.header_images.length > 0 
                      ? 'Hover over logo images to adjust their position and size. Values are in PDF points (pt).'
                      : 'Upload logo images in the Header Images section above to see them positioned on the template.'}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}