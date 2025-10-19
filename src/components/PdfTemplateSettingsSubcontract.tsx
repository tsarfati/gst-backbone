import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { SUBCONTRACT_PLACEHOLDERS } from "@/utils/subcontractPdfGenerator";

interface SubcontractTemplateProps {
  onSave?: () => void;
}

export default function SubcontractTemplateSettings({ onSave }: SubcontractTemplateProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState({
    template_name: '',
    header_html: '',
    body_html: '',
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
    if (selectedTemplateId && selectedTemplateId !== 'new') {
      const selected = templates.find(t => t.id === selectedTemplateId);
      if (selected) {
        setCurrentTemplate({
          template_name: selected.template_name,
          header_html: selected.header_html || '',
          body_html: selected.body_html || '',
          footer_html: selected.footer_html || '',
          font_family: selected.font_family || 'helvetica',
          primary_color: selected.primary_color || '#1e40af',
        });
      }
    } else if (selectedTemplateId === 'new') {
      // Reset for new template
      setCurrentTemplate({
        template_name: newTemplateName,
        header_html: '',
        body_html: '',
        footer_html: '',
        font_family: 'helvetica',
        primary_color: '#1e40af',
      });
    }
  }, [selectedTemplateId, templates, newTemplateName]);

  const loadTemplates = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdf_templates')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('template_type', 'subcontract')
        .order('template_name');

      if (error) throw error;
      
      setTemplates(data || []);
      
      // Auto-select first template if exists
      if (data && data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    if (!newTemplateName.trim()) {
      toast({
        title: "Template name required",
        description: "Please enter a name for the new template",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedTemplateId('new');
    setCurrentTemplate({
      template_name: newTemplateName.trim(),
      header_html: '',
      body_html: '',
      footer_html: '',
      font_family: 'helvetica',
      primary_color: '#1e40af',
    });
    setIsCreatingNew(false);
    setNewTemplateName('');
  };

  const saveTemplate = async () => {
    if (!currentCompany?.id) return;
    
    if (!currentTemplate.template_name.trim()) {
      toast({
        title: "Template name required",
        description: "Please enter a template name",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const templateData = {
        ...currentTemplate,
        company_id: currentCompany.id,
        template_type: 'subcontract',
        created_by: user.id
      };

      if (selectedTemplateId && selectedTemplateId !== 'new') {
        // Update existing
        const { error } = await supabase
          .from('pdf_templates')
          .update(templateData)
          .eq('id', selectedTemplateId);
        
        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('pdf_templates')
          .insert([templateData])
          .select()
          .single();
        
        if (error) throw error;
        
        if (data) {
          setSelectedTemplateId(data.id);
        }
      }

      toast({
        title: "Template saved",
        description: `Subcontract template "${currentTemplate.template_name}" has been saved successfully.`,
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
    if (!selectedTemplateId || selectedTemplateId === 'new') return;

    if (!confirm('Are you sure you want to delete this template?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pdf_templates')
        .delete()
        .eq('id', selectedTemplateId);

      if (error) throw error;

      toast({
        title: "Template deleted",
        description: "The template has been deleted successfully.",
      });
      
      setSelectedTemplateId('');
      await loadTemplates();
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs mt-2">
              {Object.entries(SUBCONTRACT_PLACEHOLDERS).map(([placeholder, description]) => (
                <div key={placeholder} className="flex items-start gap-1">
                  <code className="bg-muted px-1 rounded font-mono whitespace-nowrap text-[10px]">{placeholder}</code>
                  <span className="text-muted-foreground text-[10px]">- {description}</span>
                </div>
              ))}
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Template Selector & Creator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select or Create Template</CardTitle>
          <CardDescription>
            Manage your subcontract document templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isCreatingNew ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.template_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setIsCreatingNew(true)}
                className="mt-6"
              >
                <Plus className="h-4 w-4" />
              </Button>
              {selectedTemplateId && selectedTemplateId !== 'new' && (
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
          ) : (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>New Template Name</Label>
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Enter template name (e.g., Short Form, AIA, Standard)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNew();
                  }}
                />
              </div>
              <Button 
                onClick={handleCreateNew}
                disabled={!newTemplateName.trim()}
                className="mt-6"
              >
                Create
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewTemplateName('');
                }}
                className="mt-6"
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTemplateId && (
        <>
          {/* Template Name */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Template Name</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={currentTemplate.template_name}
                onChange={(e) => setCurrentTemplate({ ...currentTemplate, template_name: e.target.value })}
                placeholder="Template name"
              />
            </CardContent>
          </Card>

          {/* Header HTML */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Header HTML</CardTitle>
              <CardDescription>Design the header for your subcontract documents (appears at top of each page)</CardDescription>
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

          {/* Body HTML */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Body HTML</CardTitle>
              <CardDescription>Design the main content area of your subcontract document</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={currentTemplate.body_html}
                onChange={(e) => setCurrentTemplate({ ...currentTemplate, body_html: e.target.value })}
                rows={15}
                className="font-mono text-sm"
                placeholder="<div>Your contract body HTML here...\n\nUse placeholders like {company_name}, {contractor_name}, {scope_of_work}, etc.</div>"
              />
            </CardContent>
          </Card>

          {/* Footer HTML */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Footer HTML</CardTitle>
              <CardDescription>Design the footer for your subcontract documents (appears at bottom of each page)</CardDescription>
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
        </>
      )}
    </div>
  );
}
