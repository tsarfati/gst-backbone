import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Info, Eye, Upload, X, Save, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SubcontractTemplateSettings from '@/components/PdfTemplateSettingsSubcontract';
import DragDropUpload from '@/components/DragDropUpload';

interface TemplateSettings {
  id?: string;
  company_id: string;
  template_type: string;
  template_name?: string;
  header_html?: string;
  footer_html?: string;
  font_family: string;
  primary_color?: string;
  table_header_bg?: string;
  table_border_color?: string;
  use_company_logo?: boolean;
  logo_url?: string;
}

const TEMPLATE_PRESETS = {
  professional: {
    name: 'Professional Blue',
    header_html: '<div style="border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 25px;">\n  <div style="font-size: 30px; font-weight: 700; color: #1e3a8a; margin-bottom: 10px; letter-spacing: -0.5px;">{company_name}</div>\n  <div style="font-size: 15px; color: #64748b; font-weight: 600;">{report_title}</div>\n  <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">Report Period: {period}</div>\n</div>',
    footer_html: '<div style="text-align: center; font-size: 10px; color: #64748b; padding-top: 20px; border-top: 1px solid #e2e8f0;">\n  <div style="font-weight: 600;">Confidential - For Internal Use Only</div>\n  <div style="margin-top: 5px;">Generated on {generated_date} | Page {page} of {pages}</div>\n</div>',
    primary_color: '#1e40af',
    table_header_bg: '#dbeafe',
  },
  corporate: {
    name: 'Corporate Gray',
    header_html: '<div style="background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); padding: 25px 0; margin-bottom: 25px; border-bottom: 3px solid #334155;">\n  <div style="font-size: 32px; font-weight: 700; color: #0f172a; margin-bottom: 8px; letter-spacing: -0.5px;">{company_name}</div>\n  <div style="font-size: 14px; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">{report_title}</div>\n  <div style="font-size: 12px; color: #64748b; margin-top: 8px;">{period}</div>\n</div>',
    footer_html: '<div style="background: #f1f5f9; padding: 15px 20px; margin: 25px -20px -20px -20px; border-top: 2px solid #cbd5e1; font-size: 10px; color: #475569; display: flex; justify-content: space-between; align-items: center;">\n  <div style="font-weight: 600;">© {company_name} - Confidential</div>\n  <div style="font-weight: 500;">Page {page} of {pages} | {generated_date}</div>\n</div>',
    primary_color: '#334155',
    table_header_bg: '#f1f5f9',
  },
  executive: {
    name: 'Executive Black',
    header_html: '<div style="background: #0f172a; color: white; padding: 30px; margin: -20px -20px 25px -20px; border-bottom: 4px solid #334155;">\n  <div style="font-size: 34px; font-weight: 700; margin-bottom: 10px; letter-spacing: -0.5px;">{company_name}</div>\n  <div style="font-size: 14px; font-weight: 600; opacity: 0.9; text-transform: uppercase; letter-spacing: 1.5px;">{report_title}</div>\n  <div style="font-size: 13px; opacity: 0.8; margin-top: 8px;">{period}</div>\n</div>',
    footer_html: '<div style="background: #0f172a; color: white; padding: 15px 20px; margin: 25px -20px -20px -20px; border-top: 3px solid #334155; font-size: 10px; text-align: center;">\n  <div style="font-weight: 700; letter-spacing: 1px; margin-bottom: 4px;">CONFIDENTIAL DOCUMENT</div>\n  <div style="opacity: 0.85; font-weight: 500;">Page {page} of {pages} • Generated {generated_date}</div>\n</div>',
    primary_color: '#0f172a',
    table_header_bg: '#f8fafc',
  },
  modern: {
    name: 'Modern Indigo',
    header_html: '<div style="padding-bottom: 20px; margin-bottom: 25px; border-bottom: 3px solid #4f46e5;">\n  <div style="font-size: 32px; font-weight: 700; color: #312e81; margin-bottom: 10px;">{company_name}</div>\n  <div style="display: flex; justify-content: space-between; align-items: center;">\n    <div style="font-size: 15px; color: #6366f1; font-weight: 600;">{report_title}</div>\n    <div style="font-size: 12px; color: #6b7280; font-weight: 500;">{period}</div>\n  </div>\n</div>',
    footer_html: '<div style="padding-top: 15px; border-top: 2px solid #e0e7ff; font-size: 10px; color: #6b7280;">\n  <table width="100%" style="border-collapse: collapse;"><tr>\n    <td style="font-weight: 600; text-align: left;">Confidential</td>\n    <td style="font-weight: 500; text-align: right;">Page {page} of {pages} • {generated_date}</td>\n  </tr></table>\n</div>',
    primary_color: '#4f46e5',
    table_header_bg: '#eef2ff',
  },
  minimal: {
    name: 'Minimal Clean',
    header_html: '<div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">\n  <div style="font-size: 32px; font-weight: 300; color: #111827; margin-bottom: 10px; letter-spacing: -0.5px;">{company_name}</div>\n  <div style="display: flex; justify-content: space-between; align-items: baseline;">\n    <div style="font-size: 14px; color: #6b7280; font-weight: 500;">{report_title}</div>\n    <div style="font-size: 12px; color: #9ca3af;">{period}</div>\n  </div>\n</div>',
    footer_html: '<div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">\n  <table width="100%"><tr>\n    <td style="font-weight: 500;">{generated_date}</td>\n    <td style="text-align: right; font-weight: 500;">Page {page} of {pages}</td>\n  </tr></table>\n</div>',
    primary_color: '#111827',
    table_header_bg: '#f9fafb',
  },
  construction: {
    name: 'Construction Orange',
    header_html: '<div style="border-top: 6px solid #ea580c; border-bottom: 2px solid #ea580c; padding: 20px 0; margin-bottom: 25px;">\n  <div style="font-size: 32px; font-weight: 800; color: #9a3412; margin-bottom: 8px; text-transform: uppercase;">{company_name}</div>\n  <div style="font-size: 14px; color: #c2410c; font-weight: 700; letter-spacing: 1px;">{report_title}</div>\n  <div style="font-size: 12px; color: #78716c; margin-top: 6px; font-weight: 600;">{period}</div>\n</div>',
    footer_html: '<div style="border-top: 2px solid #ea580c; padding-top: 15px; font-size: 10px; color: #78716c;">\n  <table width="100%"><tr>\n    <td style="font-weight: 700; color: #9a3412;">CONFIDENTIAL REPORT</td>\n    <td style="text-align: right; font-weight: 600;">Page {page} of {pages} | {generated_date}</td>\n  </tr></table>\n</div>',
    primary_color: '#ea580c',
    table_header_bg: '#fed7aa',
  },
};

export default function PdfTemplateSettings() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [template, setTemplate] = useState<TemplateSettings>({
    company_id: currentCompany?.id || '',
    template_type: 'global',
    template_name: 'default',
    font_family: 'helvetica',
    header_html: TEMPLATE_PRESETS.professional.header_html,
    footer_html: TEMPLATE_PRESETS.professional.footer_html,
    primary_color: '#1e40af',
    table_header_bg: '#dbeafe',
    table_border_color: '#e2e8f0',
    use_company_logo: false,
    logo_url: ''
  });

  useEffect(() => {
    if (currentCompany?.id) {
      loadTemplate();
    }
  }, [currentCompany?.id]);

  const loadTemplate = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdf_templates')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('template_type', 'global')
        .eq('template_name', 'default')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setTemplate({
          ...data,
          logo_url: (data as any).logo_url || currentCompany.logo_url || ''
        });
      } else {
        // Use company logo if available
        setTemplate(prev => ({
          ...prev,
          company_id: currentCompany.id,
          logo_url: currentCompany.logo_url || ''
        }));
      }
    } catch (error: any) {
      console.error('Error loading template:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const templateData = {
        ...template,
        company_id: currentCompany.id,
        created_by: user.id,
        template_type: 'global',
        template_name: 'default',
        updated_at: new Date().toISOString()
      };

      // Check if template exists
      const { data: existingTemplate } = await supabase
        .from('pdf_templates')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('template_type', 'global')
        .eq('template_name', 'default')
        .maybeSingle();

      if (existingTemplate?.id) {
        const { created_by: _created_by, id: _id, ...updateData } = templateData;
        const { error } = await supabase
          .from('pdf_templates')
          .update(updateData)
          .eq('id', existingTemplate.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pdf_templates')
          .insert([templateData]);
        
        if (error) throw error;
      }

      toast({
        title: "Template saved",
        description: "PDF template settings have been saved and will apply to all reports.",
      });
      
      await loadTemplate();
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

  const uploadLogoFile = async (file?: File | null) => {
    if (!file || !currentCompany?.id) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}/pdf-logo/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-files')
        .getPublicUrl(fileName);

      setTemplate(prev => ({
        ...prev,
        logo_url: publicUrl,
        use_company_logo: true
      }));

      toast({
        title: "Logo uploaded",
        description: "Your PDF header logo has been uploaded successfully.",
      });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo.",
        variant: "destructive"
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await uploadLogoFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const removeLogo = () => {
    setTemplate(prev => ({
      ...prev,
      logo_url: '',
      use_company_logo: false
    }));
  };

  const applyPreset = (presetKey: string) => {
    const preset = TEMPLATE_PRESETS[presetKey as keyof typeof TEMPLATE_PRESETS];
    if (preset) {
      setTemplate(prev => ({
        ...prev,
        header_html: preset.header_html,
        footer_html: preset.footer_html,
        primary_color: preset.primary_color,
        table_header_bg: preset.table_header_bg,
      }));
      setSelectedPreset(presetKey);
      toast({
        title: "Preset applied",
        description: `${preset.name} template has been applied.`,
      });
    }
  };

  const renderPreview = (html: string) => {
    let result = html
      .replace(/{company_name}/g, currentCompany?.name || 'Company Name')
      .replace(/{report_title}/g, 'Sample Report')
      .replace(/{period}/g, 'Jan 1 - Jan 31, 2025')
      .replace(/{date}/g, new Date().toLocaleDateString())
      .replace(/{page}/g, '1')
      .replace(/{pages}/g, '1')
      .replace(/{generated_date}/g, new Date().toLocaleDateString());
    
    // If use_company_logo is enabled and we have a logo, replace company name with logo
    if (template.use_company_logo && template.logo_url) {
      const logoHtml = `<img src="${template.logo_url}" alt="${currentCompany?.name}" style="max-height: 60px; max-width: 200px; object-fit: contain;" />`;
      result = result.replace(new RegExp(currentCompany?.name || 'Company Name', 'g'), logoHtml);
    }
    
    return result;
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
            Customize the header and footer for all PDF reports generated by the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              These settings apply to all PDF reports including timecards, invoices, reconciliation reports, and more. 
              Available variables: <code className="text-xs bg-muted px-1 rounded">{'{company_name}'}</code>, <code className="text-xs bg-muted px-1 rounded">{'{report_title}'}</code>, <code className="text-xs bg-muted px-1 rounded">{'{period}'}</code>, <code className="text-xs bg-muted px-1 rounded">{'{page}'}</code>, <code className="text-xs bg-muted px-1 rounded">{'{pages}'}</code>, <code className="text-xs bg-muted px-1 rounded">{'{generated_date}'}</code>
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column - Settings */}
            <div className="space-y-6">
              {/* Logo Upload Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Header Logo
                  </CardTitle>
                  <CardDescription>
                    Upload a logo to display in the PDF header instead of text
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="use-logo"
                      checked={template.use_company_logo}
                      onCheckedChange={(checked) => setTemplate(prev => ({ ...prev, use_company_logo: checked }))}
                      disabled={!template.logo_url}
                    />
                    <Label htmlFor="use-logo">Use logo in header</Label>
                  </div>

                  {template.logo_url ? (
                    <div className="flex items-center gap-4">
                      <div className="relative border rounded-lg p-2 bg-white">
                        <img 
                          src={template.logo_url} 
                          alt="PDF Logo" 
                          className="max-h-16 max-w-[200px] object-contain"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={removeLogo}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Current logo
                      </div>
                    </div>
                  ) : (
                    uploadingLogo ? (
                      <div className="border rounded-lg p-6 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        </div>
                      </div>
                    ) : (
                      <DragDropUpload
                        onFileSelect={(file) => { void uploadLogoFile(file); }}
                        accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                        maxSize={2}
                        title="Drag logo here"
                        dropTitle="Drop logo here"
                        helperText="PNG/JPG/SVG/WEBP up to 2MB"
                      />
                    )
                  )}

                  {!template.logo_url && currentCompany?.logo_url && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setTemplate(prev => ({ 
                        ...prev, 
                        logo_url: currentCompany.logo_url || '',
                        use_company_logo: true 
                      }))}
                    >
                      Use Company Logo
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Style Presets */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Style Presets</CardTitle>
                  <CardDescription>
                    Choose a pre-designed template style
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={selectedPreset} onValueChange={applyPreset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a preset style..." />
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

              {/* Header HTML */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Header HTML</CardTitle>
                  <CardDescription>
                    Customize the header that appears on every page
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={template.header_html || ''}
                    onChange={(e) => setTemplate(prev => ({ ...prev, header_html: e.target.value }))}
                    className="font-mono text-sm min-h-[150px]"
                    placeholder="Enter header HTML..."
                  />
                </CardContent>
              </Card>

              {/* Footer HTML */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Footer HTML</CardTitle>
                  <CardDescription>
                    Customize the footer that appears on every page
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={template.footer_html || ''}
                    onChange={(e) => setTemplate(prev => ({ ...prev, footer_html: e.target.value }))}
                    className="font-mono text-sm min-h-[120px]"
                    placeholder="Enter footer HTML..."
                  />
                </CardContent>
              </Card>

              <Button onClick={saveTemplate} disabled={loading} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Save Template Settings'}
              </Button>
            </div>

            {/* Right Column - Preview */}
            <div className="space-y-4">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Live Preview
                  </CardTitle>
                  <CardDescription>
                    See how your PDF reports will look
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-6 bg-white shadow-sm min-h-[400px] flex flex-col">
                    {/* Header Preview */}
                    {template.header_html && (
                      <div 
                        className="mb-4" 
                        dangerouslySetInnerHTML={{ __html: renderPreview(template.header_html) }}
                      />
                    )}
                    
                    {/* Sample Content */}
                    <div className="flex-1 flex items-center justify-center py-8">
                      <div className="text-center text-muted-foreground">
                        <p className="text-sm font-medium">Sample Report Content</p>
                        <p className="text-xs mt-1">Your report data will appear here...</p>
                      </div>
                    </div>
                    
                    {/* Footer Preview */}
                    {template.footer_html && (
                      <div 
                        className="mt-4" 
                        dangerouslySetInnerHTML={{ __html: renderPreview(template.footer_html) }}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Subcontract Template Settings - Keep separate as it has different requirements */}
      <SubcontractTemplateSettings />
    </div>
  );
}
