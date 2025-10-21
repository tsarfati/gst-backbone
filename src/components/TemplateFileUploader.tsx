import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, FileText, Info, Trash2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TemplateFileUploaderProps {
  templateType: string;
  displayName: string;
  availableVariables: string[];
  currentTemplate?: {
    file_url?: string;
    file_name?: string;
    file_type?: string;
  };
  onTemplateUpdate: () => void;
}

export default function TemplateFileUploader({
  templateType,
  displayName,
  availableVariables,
  currentTemplate,
  onTemplateUpdate,
}: TemplateFileUploaderProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.docx', '.xlsx', '.pdf'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a Word (.docx), Excel (.xlsx), or PDF file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 20MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentCompany) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get file extension
      const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      const fileType = fileExtension.replace('.', '');

      // Upload to storage
      const filePath = `${currentCompany.id}/${templateType}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('report-templates')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get signed URL (valid for 10 years)
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('report-templates')
        .createSignedUrl(filePath, 315360000);

      if (urlError) throw urlError;

      // Save template info to database
      const { data: existingTemplate } = await supabase
        .from('pdf_templates')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('template_type', templateType)
        .single();

      const templateData = {
        company_id: currentCompany.id,
        template_type: templateType,
        template_format: 'file',
        template_file_url: signedUrlData.signedUrl,
        template_file_name: selectedFile.name,
        template_file_type: fileType,
        available_variables: availableVariables,
        font_family: 'helvetica',
        created_by: user.id,
      };

      if (existingTemplate) {
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
        title: "Template uploaded",
        description: `${displayName} template has been saved successfully.`,
      });

      setSelectedFile(null);
      onTemplateUpdate();
    } catch (error: any) {
      console.error('Error uploading template:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload template file.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadBlankTemplate = () => {
    // Create a simple text file with variable documentation
    const content = `${displayName} Template
    
Available Variables:
${availableVariables.map(v => `  {{${v}}}`).join('\n')}

Instructions:
1. Create your template in Word (.docx) or Excel (.xlsx)
2. Use the variables above in your document (e.g., {{company_name}}, {{period}})
3. Format the document as desired - add logos, colors, fonts, layouts
4. Upload the template file back to this system
5. When generating reports, the system will replace variables with actual data

Example:
  Company: {{company_name}}
  Report Period: {{period}}
  Generated: {{generated_date}}
  Page {{page}} of {{pages}}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateType}_template_guide.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Template guide downloaded",
      description: "Use this guide to create your custom template.",
    });
  };

  const handleDeleteTemplate = async () => {
    if (!currentTemplate?.file_url || !currentCompany) return;

    try {
      const { data: template } = await supabase
        .from('pdf_templates')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('template_type', templateType)
        .single();

      if (template) {
        const { error } = await supabase
          .from('pdf_templates')
          .update({
            template_format: 'html',
            template_file_url: null,
            template_file_name: null,
            template_file_type: null,
          })
          .eq('id', template.id);

        if (error) throw error;

        toast({
          title: "Template removed",
          description: "Custom template has been removed.",
        });

        onTemplateUpdate();
      }
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to remove template.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {displayName} Template
        </CardTitle>
        <CardDescription>
          Upload a customized Word or Excel template with your formatting, logos, and layout
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-medium">Available Variables:</div>
              <div className="flex flex-wrap gap-2">
                {availableVariables.map((variable) => (
                  <Badge key={variable} variant="secondary" className="font-mono text-xs">
                    {`{{${variable}}}`}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Use these variables in your template document. They will be replaced with actual data when generating reports.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {currentTemplate?.file_url ? (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Custom Template Active</p>
                    <p className="text-sm text-muted-foreground">{currentTemplate.file_name}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteTemplate}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor={`template-${templateType}`}>Select Template File</Label>
              <Input
                id={`template-${templateType}`}
                type="file"
                accept=".docx,.xlsx,.pdf"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: Word (.docx), Excel (.xlsx), PDF (.pdf) - Max 20MB
              </p>
            </div>

            {selectedFile && (
              <div className="p-3 border rounded bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">{selectedFile.name}</span>
                </div>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            )}
          </>
        )}

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleDownloadBlankTemplate}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template Guide
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Download a guide showing available variables and instructions for creating your template
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
