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
import { FileText, Info, Eye, Upload, X, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

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

export default function PdfTemplateSettings() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [timecardTemplate, setTimecardTemplate] = useState<TemplateSettings>({
    company_id: currentCompany?.id || '',
    template_type: 'timecard',
    font_family: 'helvetica',
    header_html: '<div style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 10px;">{company_name}</div>\n<div style="text-align: center; font-size: 14px; color: #666;">Timecard Report - {period}</div>',
    footer_html: '<div style="text-align: center; font-size: 10px; color: #666; margin-top: 10px;">Confidential - For Internal Use Only</div>',
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editor Section */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Header HTML</CardTitle>
                      <CardDescription>Design the top section of your PDF report</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={timecardTemplate.header_html || ''}
                        onChange={(e) => setTimecardTemplate({ ...timecardTemplate, header_html: e.target.value })}
                        rows={8}
                        className="font-mono text-sm"
                        placeholder="<div>Your HTML here...</div>"
                      />
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Header Images</Label>
                          <Button size="sm" variant="outline" disabled={uploadingImage} onClick={() => document.getElementById('header-image-upload')?.click()}>
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadingImage ? 'Uploading...' : 'Add Image'}
                          </Button>
                          <input
                            id="header-image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </div>
                        
                        {timecardTemplate.header_images && timecardTemplate.header_images.length > 0 && (
                          <div className="space-y-2">
                            {timecardTemplate.header_images.map((img, idx) => (
                              <div key={idx} className="p-3 border rounded-lg space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">Image {idx + 1}</span>
                                  <Button size="sm" variant="ghost" onClick={() => removeHeaderImage(idx)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">X Position (pt)</Label>
                                    <Input
                                      type="number"
                                      value={img.x}
                                      onChange={(e) => updateImagePosition(idx, 'x', parseInt(e.target.value))}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Y Position (pt)</Label>
                                    <Input
                                      type="number"
                                      value={img.y}
                                      onChange={(e) => updateImagePosition(idx, 'y', parseInt(e.target.value))}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Width (pt)</Label>
                                    <Input
                                      type="number"
                                      value={img.width}
                                      onChange={(e) => updateImagePosition(idx, 'width', parseInt(e.target.value))}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Height (pt)</Label>
                                    <Input
                                      type="number"
                                      value={img.height}
                                      onChange={(e) => updateImagePosition(idx, 'height', parseInt(e.target.value))}
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Footer HTML</CardTitle>
                      <CardDescription>Design the bottom section of your PDF report</CardDescription>
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

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Styling Options</CardTitle>
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

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Primary Color</Label>
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
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Secondary Color</Label>
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
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Table Styling</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Header BG</Label>
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
                          <p className="text-xs text-muted-foreground">Automatically fit columns to content width</p>
                        </div>
                        <Switch
                          checked={timecardTemplate.auto_size_columns || false}
                          onCheckedChange={(checked) => setTimecardTemplate({ ...timecardTemplate, auto_size_columns: checked })}
                        />
                      </div>
                    </CardContent>
                  </Card>
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
    </div>
  );
}