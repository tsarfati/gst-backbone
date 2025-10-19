import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { SUBCONTRACT_PLACEHOLDERS } from "@/utils/subcontractPdfGenerator";

interface SubcontractTemplateProps {
  onSave?: () => void;
}

const TEMPLATE_VARIANTS = ['default', 'short', 'long', 'standard', 'aia'];

export default function SubcontractTemplateSettings({ onSave }: SubcontractTemplateProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string>('default');
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [currentTemplate, setCurrentTemplate] = useState({
    header_html: '',
    footer_html: '',
    font_family: 'helvetica',
    primary_color: '#1e40af',
  });

  useEffect(() => {
    if (currentCompany?.id) {
      loadTemplates();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (templates[selectedVariant]) {
      setCurrentTemplate(templates[selectedVariant]);
    } else {
      // Set default template for new variants
      setCurrentTemplate({
        header_html: '<div style="text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px;">\n  <div style="font-size: 24px; font-weight: bold; color: #1e40af;">{company_name}</div>\n  <div style="font-size: 14px; color: #64748b; margin-top: 5px;">SUBCONTRACT AGREEMENT</div>\n</div>',
        footer_html: '<div style="text-align: center; font-size: 10px; color: #64748b; padding-top: 15px; border-top: 1px solid #e2e8f0;">\n  <div>Page {page} of {pages}</div>\n  <div style="margin-top: 5px;">Generated on {date}</div>\n</div>',
        font_family: 'helvetica',
        primary_color: '#1e40af',
      });
    }
  }, [selectedVariant, templates]);

  const loadTemplates = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdf_templates')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('template_type', 'subcontract');

      if (error) throw error;
      
      const templatesMap: Record<string, any> = {};
      data?.forEach(template => {
        templatesMap[template.template_name] = template;
      });
      setTemplates(templatesMap);
    } catch (error: any) {
      console.error('Error loading templates:', error);
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
        ...currentTemplate,
        company_id: currentCompany.id,
        template_type: 'subcontract',
        template_name: selectedVariant,
        created_by: user.id
      };

      const existingTemplate = templates[selectedVariant];
      
      if (existingTemplate?.id) {
        const { error } = await supabase
          .from('pdf_templates')
          .update(templateData)
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
        description: `Subcontract template "${selectedVariant}" has been saved successfully.`,
      });
      
      await loadTemplates();
      onSave?.();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save template.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async () => {
    if (!currentCompany?.id || !templates[selectedVariant]?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pdf_templates')
        .delete()
        .eq('id', templates[selectedVariant].id);

      if (error) throw error;

      toast({
        title: "Template deleted",
        description: `Template "${selectedVariant}" has been deleted.`,
      });
      
      await loadTemplates();
      setSelectedVariant('default');
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete template.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Placeholders Reference */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Available Placeholders for Subcontracts:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mt-2">
              {Object.entries(SUBCONTRACT_PLACEHOLDERS).map(([placeholder, description]) => (
                <div key={placeholder} className="flex items-start gap-1">
                  <code className="bg-muted px-1 rounded font-mono whitespace-nowrap">{placeholder}</code>
                  <span className="text-muted-foreground">- {description}</span>
                </div>
              ))}
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Template Variant Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template Variant</CardTitle>
          <CardDescription>
            Create different contract templates for various scenarios (short form, long form, AIA format, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Select Template</Label>
              <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_VARIANTS.map(variant => (
                    <SelectItem key={variant} value={variant}>
                      {variant.charAt(0).toUpperCase() + variant.slice(1)}
                      {templates[variant] && <Badge variant="outline" className="ml-2">Saved</Badge>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedVariant !== 'default' && templates[selectedVariant]?.id && (
              <Button 
                variant="destructive" 
                size="icon"
                onClick={deleteTemplate}
                disabled={loading}
                className="mt-6"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Header HTML */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Header HTML</CardTitle>
          <CardDescription>Design the header for your subcontract documents</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={currentTemplate.header_html}
            onChange={(e) => setCurrentTemplate({ ...currentTemplate, header_html: e.target.value })}
            rows={8}
            className="font-mono text-sm"
            placeholder="<div>Your header HTML here...</div>"
          />
        </CardContent>
      </Card>

      {/* Footer HTML */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Footer HTML</CardTitle>
          <CardDescription>Design the footer for your subcontract documents</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={currentTemplate.footer_html}
            onChange={(e) => setCurrentTemplate({ ...currentTemplate, footer_html: e.target.value })}
            rows={6}
            className="font-mono text-sm"
            placeholder="<div>Your footer HTML here...</div>"
          />
        </CardContent>
      </Card>

      {/* Styling Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Styling Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Font Family</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={currentTemplate.font_family}
              onChange={(e) => setCurrentTemplate({ ...currentTemplate, font_family: e.target.value })}
            >
              <option value="helvetica">Helvetica</option>
              <option value="times">Times New Roman</option>
              <option value="courier">Courier</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Primary Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={currentTemplate.primary_color}
                onChange={(e) => setCurrentTemplate({ ...currentTemplate, primary_color: e.target.value })}
                className="h-10 w-16 rounded border cursor-pointer"
              />
              <Input
                type="text"
                value={currentTemplate.primary_color}
                onChange={(e) => setCurrentTemplate({ ...currentTemplate, primary_color: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button onClick={saveTemplate} disabled={loading}>
          {loading ? 'Saving...' : 'Save Template'}
        </Button>
      </div>
    </div>
  );
}
