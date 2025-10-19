import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function PdfTemplateSettings() {
  const { settings, updateSettings } = useSettings();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [loading, setLoading] = useState(false);

  const tpl = settings.pdfTemplateTimecard || {};

  useEffect(() => {
    if (currentCompany?.id) {
      loadTemplates();
    }
  }, [currentCompany?.id]);

  const loadTemplates = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdf_templates')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('template_type', 'timecard')
        .order('template_name');

      if (error) throw error;
      
      setTemplates(data || []);
      
      if (data && data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
        loadTemplateSettings(data[0]);
      }
    } catch (error: any) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateSettings = (template: any) => {
    updateSettings({
      pdfTemplateTimecard: {
        font_family: template.font_family || 'helvetica',
        header_html: template.header_html || '',
        footer_html: template.footer_html || '',
        table_header_bg: template.primary_color || '#f1f5f9',
        table_border_color: template.table_border_color || '#e2e8f0',
        table_stripe_color: template.table_stripe_color || '#f8fafc',
        auto_size_columns: template.auto_size_columns ?? true,
      }
    });
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId !== 'new') {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        loadTemplateSettings(template);
      }
    }
  };

  const handleCreateNew = async () => {
    if (!newTemplateName.trim() || !currentCompany?.id || !user?.id) {
      toast({
        title: "Template name required",
        description: "Please enter a name for the new template",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('pdf_templates')
        .insert([{
          company_id: currentCompany.id,
          template_type: 'timecard',
          template_name: newTemplateName,
          font_family: 'helvetica',
          primary_color: '#f1f5f9',
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Template created", description: "New timecard template created successfully" });
      setNewTemplateName('');
      setSelectedTemplateId(data.id);
      await loadTemplates();
    } catch (error: any) {
      toast({
        title: "Error creating template",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplateId || selectedTemplateId === 'new' || !currentCompany?.id) return;

    try {
      const { error } = await supabase
        .from('pdf_templates')
        .update({
          font_family: tpl.font_family,
          header_html: tpl.header_html,
          footer_html: tpl.footer_html,
          primary_color: tpl.table_header_bg,
          table_border_color: tpl.table_border_color,
          table_stripe_color: tpl.table_stripe_color,
          auto_size_columns: tpl.auto_size_columns,
        })
        .eq('id', selectedTemplateId);

      if (error) throw error;

      toast({ title: "Template saved", description: "Timecard template updated successfully" });
      await loadTemplates();
    } catch (error: any) {
      toast({
        title: "Error saving template",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const applyPreset = (preset: 'clean' | 'contrast' | 'striped') => {
    const presets = {
      clean: {
        table_header_bg: '#f1f5f9',
        table_border_color: '#e2e8f0',
        table_stripe_color: '#f8fafc',
        auto_size_columns: true,
        font_family: 'helvetica',
      },
      contrast: {
        table_header_bg: '#0f172a',
        table_border_color: '#334155',
        table_stripe_color: '#111827',
        auto_size_columns: false,
        font_family: 'helvetica',
      },
      striped: {
        table_header_bg: '#e2e8f0',
        table_border_color: '#94a3b8',
        table_stripe_color: '#f1f5f9',
        auto_size_columns: true,
        font_family: 'times',
      },
    } as const;

    updateSettings({
      pdfTemplateTimecard: {
        ...(settings.pdfTemplateTimecard || {}),
        ...presets[preset],
      },
    });
  };

  const headerPreview = useMemo(() => {
    const html = tpl.header_html || 'Company: {company_name} | Period: {period} | Generated: {generated_date}';
    return html
      .replace(/{company_name}/g, currentCompany?.name || '')
      .replace(/{period}/g, 'MM/DD/YYYY - MM/DD/YYYY')
      .replace(/{generated_date}/g, new Date().toLocaleString());
  }, [tpl.header_html, currentCompany?.name]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Timecard PDF Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Select Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange} disabled={loading}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={loading ? "Loading templates..." : "Select a template"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.template_name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Create New Template</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedTemplateId === 'new' && (
              <div className="flex-1">
                <Label>New Template Name</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="e.g., Weekly Report Template"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                  />
                  <Button onClick={handleCreateNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Font Family</Label>
              <select
                className="mt-2 w-full border rounded-md h-9 px-3 bg-background"
                value={tpl.font_family || 'helvetica'}
                onChange={(e) => updateSettings({ pdfTemplateTimecard: { ...(settings.pdfTemplateTimecard || {}), font_family: e.target.value } })}
              >
                <option value="helvetica">Helvetica</option>
                <option value="times">Times</option>
                <option value="courier">Courier</option>
              </select>
            </div>
            <div>
              <Label>Table Header Background</Label>
              <Input
                className="mt-2"
                type="color"
                value={tpl.table_header_bg || '#f1f5f9'}
                onChange={(e) => updateSettings({ pdfTemplateTimecard: { ...(settings.pdfTemplateTimecard || {}), table_header_bg: e.target.value } })}
              />
            </div>
            <div>
              <Label>Table Border Color</Label>
              <Input
                className="mt-2"
                type="color"
                value={tpl.table_border_color || '#e2e8f0'}
                onChange={(e) => updateSettings({ pdfTemplateTimecard: { ...(settings.pdfTemplateTimecard || {}), table_border_color: e.target.value } })}
              />
            </div>
            <div>
              <Label>Stripe Row Color</Label>
              <Input
                className="mt-2"
                type="color"
                value={tpl.table_stripe_color || '#f8fafc'}
                onChange={(e) => updateSettings({ pdfTemplateTimecard: { ...(settings.pdfTemplateTimecard || {}), table_stripe_color: e.target.value } })}
              />
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Switch
                id="autosize"
                checked={!!tpl.auto_size_columns}
                onCheckedChange={(val) => updateSettings({ pdfTemplateTimecard: { ...(settings.pdfTemplateTimecard || {}), auto_size_columns: val } })}
              />
              <Label htmlFor="autosize">Auto-size columns</Label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>Header HTML</Label>
              <Textarea
                className="mt-2 min-h-[100px]"
                placeholder="e.g. Company: {company_name} | Period: {period} | Page {page}/{pages}"
                value={tpl.header_html || ''}
                onChange={(e) => updateSettings({ pdfTemplateTimecard: { ...(settings.pdfTemplateTimecard || {}), header_html: e.target.value } })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available placeholders: {`{company_name}`} {`{period}`} {`{date}`} {`{employee_name}`} {`{generated_date}`}
              </p>
            </div>
            <div>
              <Label>Footer HTML</Label>
              <Textarea
                className="mt-2 min-h-[100px]"
                placeholder="e.g. Confidential • Generated {generated_date}"
                value={tpl.footer_html || ''}
                onChange={(e) => updateSettings({ pdfTemplateTimecard: { ...(settings.pdfTemplateTimecard || {}), footer_html: e.target.value } })}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => applyPreset('clean')}>Clean</Button>
            <Button type="button" variant="outline" onClick={() => applyPreset('contrast')}>Contrast</Button>
            <Button type="button" variant="outline" onClick={() => applyPreset('striped')}>Striped</Button>
            {selectedTemplateId && selectedTemplateId !== 'new' && (
              <Button type="button" onClick={handleSaveTemplate}>
                Save Template
              </Button>
            )}
          </div>

          <div className="border rounded-md p-4 bg-muted">
            <div className="text-sm text-muted-foreground">Header preview (text only)</div>
            <div className="mt-2 text-sm">{headerPreview}</div>
            <div className="mt-4 text-xs text-muted-foreground">
              Header logo used in exports: {settings.headerLogo ? 'Header Logo (Company Settings)' : 'Company Logo'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
