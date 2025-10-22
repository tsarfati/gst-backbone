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

      // Save template info to database with file path (not signed URL)
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
        template_file_url: filePath, // Store path, not signed URL
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
    // Create a sample Word-compatible HTML template
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${displayName} Template</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 1in; }
    h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
    h2 { color: #3b82f6; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f3f4f6; font-weight: bold; }
    .placeholder { background-color: #fef3c7; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    .header { text-align: center; margin-bottom: 30px; }
    .footer { text-align: center; margin-top: 30px; font-size: 9pt; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${displayName}</h1>
    <p><strong>Company:</strong> <span class="placeholder">{{company_name}}</span></p>
    <p><strong>Report Period:</strong> <span class="placeholder">{{period}}</span></p>
    <p><strong>Generated:</strong> <span class="placeholder">{{generated_date}}</span></p>
  </div>

  <h2>Summary Information</h2>
  <table>
    <tr>
      <td><strong>Bank Account:</strong></td>
      <td><span class="placeholder">{{bank_account}}</span></td>
    </tr>
    <tr>
      <td><strong>Beginning Balance:</strong></td>
      <td><span class="placeholder">{{beginning_balance}}</span></td>
    </tr>
    <tr>
      <td><strong>Ending Balance:</strong></td>
      <td><span class="placeholder">{{ending_balance}}</span></td>
    </tr>
    <tr>
      <td><strong>Cleared Balance:</strong></td>
      <td><span class="placeholder">{{cleared_balance}}</span></td>
    </tr>
    <tr>
      <td><strong>Difference:</strong></td>
      <td><span class="placeholder">{{difference}}</span></td>
    </tr>
  </table>

  <h2>Transaction Details</h2>
  <p><em>The report data will appear below with all cleared and uncleared transactions:</em></p>
  <div style="background: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; border-radius: 4px;">
    <span class="placeholder">{{report_data}}</span>
  </div>

  <h2>All Available Placeholders</h2>
  <p><strong>Replace these with the actual placeholder syntax in your template:</strong></p>
  <table>
    <tr>
      <th>Placeholder</th>
      <th>Description</th>
    </tr>
    ${availableVariables.map(v => `
    <tr>
      <td><code>{{${v}}}</code></td>
      <td>${v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
    </tr>
    `).join('')}
    <tr>
      <td><code>{{cleared_deposits_total}}</code></td>
      <td>Total amount of cleared deposits</td>
    </tr>
    <tr>
      <td><code>{{cleared_payments_total}}</code></td>
      <td>Total amount of cleared payments</td>
    </tr>
    <tr>
      <td><code>{{uncleared_deposits_total}}</code></td>
      <td>Total amount of uncleared deposits</td>
    </tr>
    <tr>
      <td><code>{{uncleared_payments_total}}</code></td>
      <td>Total amount of uncleared payments</td>
    </tr>
    <tr>
      <td><code>{{cleared_deposits_count}}</code></td>
      <td>Number of cleared deposits</td>
    </tr>
    <tr>
      <td><code>{{cleared_payments_count}}</code></td>
      <td>Number of cleared payments</td>
    </tr>
    <tr>
      <td><code>{{report_data}}</code></td>
      <td>Complete formatted report with all transaction tables</td>
    </tr>
  </table>

  <div class="footer">
    <p>Page <span class="placeholder">{{page}}</span> of <span class="placeholder">{{pages}}</span></p>
    <p><em>This is a sample template. Edit this file in Word and upload it back to the system.</em></p>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateType}_sample_template.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Sample template downloaded",
      description: "Open the HTML file in Word, edit it, then save as .docx and upload back.",
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
                <Badge variant="secondary" className="font-mono text-xs">
                  {`{{report_data}}`}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Use these variables in your template document. They will be replaced with actual data when generating reports.
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                Use <code className="bg-muted px-1 py-0.5 rounded">{`{{report_data}}`}</code> for the main report table. Colors from Template Settings will automatically apply to the report data.
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
            Download Sample Template with All Placeholders
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Download an HTML file with all placeholders. Open in Word, edit & format as needed, then save as .docx and upload
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
