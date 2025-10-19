import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/contexts/SettingsContext';
import { useCompany } from '@/contexts/CompanyContext';

export default function PdfTemplateSettings() {
  const { settings, updateSettings } = useSettings();
  const { currentCompany } = useCompany();

  const tpl = settings.pdfTemplateTimecard || {};

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
