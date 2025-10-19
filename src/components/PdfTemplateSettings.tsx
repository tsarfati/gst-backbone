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
  }
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
              <TabsTrigger value="subcontract" disabled>Subcontracts (Coming Soon)</TabsTrigger>
            </TabsList>

            <TabsContent value="timecard" className="space-y-6">
              {/* Template Preset Selector */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layout className="h-4 w-4" />
                    Choose a Template
                  </CardTitle>
                  <CardDescription>
                    Start with a pre-designed template
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Template Style</Label>
                    <Select value={selectedPreset} onValueChange={applyPreset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template style" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TEMPLATE_PRESETS).map(([key, preset]) => (
                          <SelectItem key={key} value={key}>
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPreset && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Selected: {TEMPLATE_PRESETS[selectedPreset as keyof typeof TEMPLATE_PRESETS]?.name}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Editor Mode Toggle */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Edit Mode</Label>
                      <p className="text-xs text-muted-foreground">
                        Visual mode for images and colors, Code mode for HTML editing
                      </p>
                    </div>
                    <RadioGroup value={editMode} onValueChange={(value) => setEditMode(value as 'visual' | 'code')} className="flex gap-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="visual" id="visual" />
                        <Label htmlFor="visual" className="cursor-pointer flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          Visual
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="code" id="code" />
                        <Label htmlFor="code" className="cursor-pointer flex items-center gap-1">
                          <Code className="h-3 w-3" />
                          Code
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editor Section */}
                <div className="space-y-6">
                  {editMode === 'visual' && (
                    <>
                      {/* Header Images Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            Header Images
                          </CardTitle>
                          <CardDescription>Upload logos or images to display in your PDF header</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Button 
                            variant="outline" 
                            className="w-full" 
                            disabled={uploadingImage} 
                            onClick={() => document.getElementById('header-image-upload')?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadingImage ? 'Uploading...' : 'Upload Image'}
                          </Button>
                          <input
                            id="header-image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                          
                          {timecardTemplate.header_images && timecardTemplate.header_images.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-xs text-muted-foreground">
                                <Move className="h-3 w-3 inline mr-1" />
                                Use the live preview below to adjust position and size
                              </p>
                              {timecardTemplate.header_images.map((img, idx) => (
                                <Card key={idx} className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 border rounded overflow-hidden bg-muted flex items-center justify-center">
                                        <img src={img.url} alt={`Header ${idx + 1}`} className="w-full h-full object-contain" />
                                      </div>
                                      <div>
                                        <div className="font-medium text-sm">Image {idx + 1}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {Math.round(img.width)}×{Math.round(img.height)}pt at ({Math.round(img.x)}, {Math.round(img.y)})
                                        </div>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => removeHeaderImage(idx)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Styling Options */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Colors & Fonts</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Font Family</Label>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={timecardTemplate.font_family}
                              onChange={(e) => setTimecardTemplate({ ...timecardTemplate, font_family: e.target.value })}
                            >
                              <option value="helvetica">Helvetica</option>
                              <option value="times">Times New Roman</option>
                              <option value="courier">Courier</option>
                            </select>
                          </div>

                          <Separator />

                          <div className="space-y-3">
                            <h4 className="font-medium text-sm">Document Colors</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-xs">Primary Color</Label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={timecardTemplate.primary_color || '#1e40af'}
                                    onChange={(e) => setTimecardTemplate({ ...timecardTemplate, primary_color: e.target.value })}
                                    className="h-10 w-16 rounded border cursor-pointer"
                                  />
                                  <Input
                                    type="text"
                                    value={timecardTemplate.primary_color || '#1e40af'}
                                    onChange={(e) => setTimecardTemplate({ ...timecardTemplate, primary_color: e.target.value })}
                                    className="flex-1 h-10"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Secondary Color</Label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={timecardTemplate.secondary_color || '#3b82f6'}
                                    onChange={(e) => setTimecardTemplate({ ...timecardTemplate, secondary_color: e.target.value })}
                                    className="h-10 w-16 rounded border cursor-pointer"
                                  />
                                  <Input
                                    type="text"
                                    value={timecardTemplate.secondary_color || '#3b82f6'}
                                    onChange={(e) => setTimecardTemplate({ ...timecardTemplate, secondary_color: e.target.value })}
                                    className="flex-1 h-10"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <Separator />

                          <div className="space-y-3">
                            <h4 className="font-medium text-sm">Table Colors</h4>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Header</Label>
                                <input
                                  type="color"
                                  value={timecardTemplate.table_header_bg || '#f1f5f9'}
                                  onChange={(e) => setTimecardTemplate({ ...timecardTemplate, table_header_bg: e.target.value })}
                                  className="h-9 w-full rounded border cursor-pointer"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Border</Label>
                                <input
                                  type="color"
                                  value={timecardTemplate.table_border_color || '#e2e8f0'}
                                  onChange={(e) => setTimecardTemplate({ ...timecardTemplate, table_border_color: e.target.value })}
                                  className="h-9 w-full rounded border cursor-pointer"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Alt Rows</Label>
                                <input
                                  type="color"
                                  value={timecardTemplate.table_stripe_color || '#f8fafc'}
                                  onChange={(e) => setTimecardTemplate({ ...timecardTemplate, table_stripe_color: e.target.value })}
                                  className="h-9 w-full rounded border cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          <Separator />

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Auto-size Columns</Label>
                              <p className="text-xs text-muted-foreground">Automatically fit columns to content</p>
                            </div>
                            <Switch
                              checked={timecardTemplate.auto_size_columns || false}
                              onCheckedChange={(checked) => setTimecardTemplate({ ...timecardTemplate, auto_size_columns: checked })}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {editMode === 'code' && (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Header HTML</CardTitle>
                          <CardDescription>Advanced: Edit the HTML for your PDF header</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Textarea
                            value={timecardTemplate.header_html || ''}
                            onChange={(e) => setTimecardTemplate({ ...timecardTemplate, header_html: e.target.value })}
                            rows={10}
                            className="font-mono text-sm"
                            placeholder="<div>Your HTML here...</div>"
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Footer HTML</CardTitle>
                          <CardDescription>Advanced: Edit the HTML for your PDF footer</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Textarea
                            value={timecardTemplate.footer_html || ''}
                            onChange={(e) => setTimecardTemplate({ ...timecardTemplate, footer_html: e.target.value })}
                            rows={6}
                            className="font-mono text-sm"
                            placeholder="<div>Your footer HTML...</div>"
                          />
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>

                {/* Preview Section */}
                <div className="space-y-6">
                  <Card className="sticky top-4">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Live Preview
                      </CardTitle>
                      <CardDescription>See how your template will look in the PDF</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="border-2 rounded-lg p-6 bg-white space-y-6 max-h-[70vh] overflow-auto">
                        {/* Header Preview */}
                        {timecardTemplate.header_html && (
                          <div 
                            className="pb-4 border-b"
                            style={{ fontFamily: timecardTemplate.font_family }}
                            dangerouslySetInnerHTML={{ __html: renderPreview(timecardTemplate.header_html) }}
                          />
                        )}

                        {/* Sample Table */}
                        <div className="space-y-2">
                          <h3 className="font-semibold" style={{ color: timecardTemplate.primary_color }}>
                            Timecard Data
                          </h3>
                          <div className="border rounded overflow-hidden text-xs" style={{ fontFamily: timecardTemplate.font_family }}>
                            <table className="w-full">
                              <thead style={{ backgroundColor: timecardTemplate.table_header_bg }}>
                                <tr>
                                  <th className="px-2 py-1.5 text-left font-semibold" style={{ borderColor: timecardTemplate.table_border_color }}>Employee</th>
                                  <th className="px-2 py-1.5 text-left font-semibold" style={{ borderColor: timecardTemplate.table_border_color }}>Job</th>
                                  <th className="px-2 py-1.5 text-right font-semibold" style={{ borderColor: timecardTemplate.table_border_color }}>Hours</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr style={{ backgroundColor: timecardTemplate.table_stripe_color }}>
                                  <td className="px-2 py-1 border-t" style={{ borderColor: timecardTemplate.table_border_color }}>John Doe</td>
                                  <td className="px-2 py-1 border-t" style={{ borderColor: timecardTemplate.table_border_color }}>Sample Project</td>
                                  <td className="px-2 py-1 text-right border-t" style={{ borderColor: timecardTemplate.table_border_color }}>8.5</td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1 border-t" style={{ borderColor: timecardTemplate.table_border_color }}>Jane Smith</td>
                                  <td className="px-2 py-1 border-t" style={{ borderColor: timecardTemplate.table_border_color }}>Another Project</td>
                                  <td className="px-2 py-1 text-right border-t" style={{ borderColor: timecardTemplate.table_border_color }}>7.0</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Footer Preview */}
                        {timecardTemplate.footer_html && (
                          <div 
                            className="pt-4 border-t"
                            style={{ fontFamily: timecardTemplate.font_family }}
                            dangerouslySetInnerHTML={{ __html: renderPreview(timecardTemplate.footer_html) }}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => saveTemplate(timecardTemplate)} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Live Preview Section */}
      {timecardTemplate.header_images && timecardTemplate.header_images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Header Preview & Positioning
            </CardTitle>
            <CardDescription>
              Adjust image positions using the controls below (landscape view: 842×595pt)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full bg-white border-2 border-dashed border-muted rounded-lg overflow-hidden" style={{ height: '400px' }}>
              {/* Grid background */}
              <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)',
                backgroundSize: '50px 50px'
              }} />
              
              {/* Reference dimensions */}
              <div className="absolute top-2 left-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                842pt wide × 595pt tall (A4 Landscape)
              </div>

              {/* Render images with positioning */}
              {timecardTemplate.header_images.map((img, idx) => (
                <div
                  key={idx}
                  className="absolute border-2 border-primary bg-white/90 rounded group hover:shadow-lg transition-shadow"
                  style={{
                    left: `${(img.x / 842) * 100}%`,
                    top: `${(img.y / 595) * 100}%`,
                    width: `${(img.width / 842) * 100}%`,
                    height: `${(img.height / 595) * 100}%`,
                  }}
                >
                  <img 
                    src={img.url} 
                    alt={`Header ${idx + 1}`} 
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    Image {idx + 1}
                  </div>
                  
                  {/* Position adjustment controls */}
                  <div className="absolute -bottom-24 left-0 right-0 bg-background border border-border rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10">
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      <div>
                        <Label className="text-[10px]">X</Label>
                        <Input
                          type="number"
                          value={Math.round(img.x)}
                          onChange={(e) => updateImagePosition(idx, 'x', parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Y</Label>
                        <Input
                          type="number"
                          value={Math.round(img.y)}
                          onChange={(e) => updateImagePosition(idx, 'y', parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">W</Label>
                        <Input
                          type="number"
                          value={Math.round(img.width)}
                          onChange={(e) => updateImagePosition(idx, 'width', parseFloat(e.target.value) || 10)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">H</Label>
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
            <p className="text-xs text-muted-foreground mt-3">
              Hover over images to see positioning controls. Values are in PDF points (pt).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}