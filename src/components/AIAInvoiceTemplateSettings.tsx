import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { FileSpreadsheet, Upload, Trash2, Download, Info, Eye, FileText, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import DragDropUpload from '@/components/DragDropUpload';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface AIATemplate {
  id: string;
  company_id: string;
  template_name: string;
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
  created_by: string;
  is_default: boolean;
}

const PLACEHOLDER_CATEGORIES = [
  {
    category: 'Company Information',
    placeholders: [
      { placeholder: '{company_name}', description: 'Your company legal name' },
      { placeholder: '{company_address}', description: 'Full company address' },
      { placeholder: '{company_city}', description: 'Company city' },
      { placeholder: '{company_state}', description: 'Company state abbreviation' },
      { placeholder: '{company_zip}', description: 'Company ZIP code' },
      { placeholder: '{company_phone}', description: 'Company phone number' },
      { placeholder: '{company_email}', description: 'Company email address' },
      { placeholder: '{license_number}', description: 'Contractor license number' },
    ],
  },
  {
    category: 'Customer/Owner Information',
    placeholders: [
      { placeholder: '{owner_name}', description: 'Owner/Customer name' },
      { placeholder: '{owner_address}', description: 'Owner full address' },
      { placeholder: '{owner_city}', description: 'Owner city' },
      { placeholder: '{owner_state}', description: 'Owner state' },
      { placeholder: '{owner_zip}', description: 'Owner ZIP code' },
      { placeholder: '{owner_phone}', description: 'Owner phone number' },
      { placeholder: '{owner_email}', description: 'Owner email address' },
    ],
  },
  {
    category: 'Project/Job Information',
    placeholders: [
      { placeholder: '{project_name}', description: 'Project/Job name' },
      { placeholder: '{project_number}', description: 'Project/Job number' },
      { placeholder: '{project_address}', description: 'Project site address' },
      { placeholder: '{project_city}', description: 'Project city' },
      { placeholder: '{project_state}', description: 'Project state' },
      { placeholder: '{project_zip}', description: 'Project ZIP code' },
      { placeholder: '{architect_name}', description: 'Architect name' },
      { placeholder: '{architect_project_no}', description: 'Architect project number' },
    ],
  },
  {
    category: 'Contract Information',
    placeholders: [
      { placeholder: '{contract_date}', description: 'Original contract date' },
      { placeholder: '{contract_amount}', description: 'Original contract sum' },
      { placeholder: '{change_orders_amount}', description: 'Net change by change orders' },
      { placeholder: '{current_contract_sum}', description: 'Contract sum to date (line 3)' },
      { placeholder: '{retainage_percent}', description: 'Retainage percentage' },
    ],
  },
  {
    category: 'Application/Invoice Details',
    placeholders: [
      { placeholder: '{application_number}', description: 'Application/Invoice number' },
      { placeholder: '{application_date}', description: 'Application date' },
      { placeholder: '{period_from}', description: 'Period covered start date' },
      { placeholder: '{period_to}', description: 'Period covered end date' },
      { placeholder: '{total_completed}', description: 'Total completed and stored to date' },
      { placeholder: '{total_retainage}', description: 'Total retainage amount' },
      { placeholder: '{total_earned_less_retainage}', description: 'Total earned less retainage (line 5a)' },
      { placeholder: '{less_previous_certificates}', description: 'Less previous certificates for payment' },
      { placeholder: '{current_payment_due}', description: 'Current payment due' },
      { placeholder: '{balance_to_finish}', description: 'Balance to finish including retainage' },
    ],
  },
  {
    category: 'G703 Schedule of Values',
    placeholders: [
      { placeholder: '{sov_item_no}', description: 'Line item number' },
      { placeholder: '{sov_description}', description: 'Description of work' },
      { placeholder: '{sov_scheduled_value}', description: 'Scheduled value' },
      { placeholder: '{sov_previous_applications}', description: 'Work completed from previous applications' },
      { placeholder: '{sov_this_period}', description: 'Work completed this period' },
      { placeholder: '{sov_materials_stored}', description: 'Materials presently stored' },
      { placeholder: '{sov_total_completed}', description: 'Total completed and stored' },
      { placeholder: '{sov_percent_complete}', description: 'Percentage complete (G/C)' },
      { placeholder: '{sov_balance_to_finish}', description: 'Balance to finish (C-G)' },
      { placeholder: '{sov_retainage}', description: 'Retainage amount for line item' },
    ],
  },
];

export default function AIAInvoiceTemplateSettings() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templates, setTemplates] = useState<AIATemplate[]>([]);

  useEffect(() => {
    if (currentCompany?.id) {
      loadTemplates();
    }
  }, [currentCompany?.id]);

  const loadTemplates = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('aia_invoice_templates' as any)
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      setTemplates((data as AIATemplate[]) || []);
    } catch (error: any) {
      console.error('Error loading AIA templates:', error);
      // Table might not exist yet - that's okay
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const processUploadFile = async (file: File) => {
    if (!file || !currentCompany?.id) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an Excel file (.xlsx, .xls) or CSV file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}/aia-templates/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('company-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-files')
        .getPublicUrl(fileName);

      // Save template record
      const { error: insertError } = await (supabase
        .from('aia_invoice_templates' as any)
        .insert({
          company_id: currentCompany.id,
          template_name: file.name.replace(/\.[^/.]+$/, ''),
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          created_by: user.id,
          is_default: templates.length === 0, // First template is default
        }) as any);

      if (insertError) throw insertError;

      toast({
        title: 'Template uploaded',
        description: 'Your AIA invoice template has been uploaded successfully.',
      });

      await loadTemplates();
    } catch (error: any) {
      console.error('Error uploading template:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload template.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadFile(file);
    e.target.value = '';
  };

  const handleDelete = async (template: AIATemplate) => {
    try {
      const { error } = await (supabase
        .from('aia_invoice_templates' as any)
        .delete()
        .eq('id', template.id) as any);

      if (error) throw error;

      toast({
        title: 'Template deleted',
        description: 'The template has been removed.',
      });

      await loadTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template.',
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (template: AIATemplate) => {
    try {
      // First, unset all defaults
      await (supabase
        .from('aia_invoice_templates' as any)
        .update({ is_default: false })
        .eq('company_id', currentCompany?.id) as any);

      // Set this one as default
      const { error } = await (supabase
        .from('aia_invoice_templates' as any)
        .update({ is_default: true })
        .eq('id', template.id) as any);

      if (error) throw error;

      toast({
        title: 'Default template set',
        description: `"${template.template_name}" is now the default template.`,
      });

      await loadTemplates();
    } catch (error: any) {
      console.error('Error setting default:', error);
      toast({
        title: 'Error',
        description: 'Failed to set default template.',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            AIA Invoice Templates
          </CardTitle>
          <CardDescription>
            Upload Excel spreadsheet templates for AIA G702/G703 payment applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {uploading ? (
            <div className="border rounded-lg p-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <span className="text-sm font-medium">Uploading template...</span>
                <span className="text-xs text-muted-foreground">Please wait</span>
              </div>
            </div>
          ) : (
            <DragDropUpload
              onFileSelect={processUploadFile}
              accept=".xlsx,.xls,.csv"
              maxSize={10}
              disabled={uploading}
              title="Drag AIA template here"
              dropTitle="Drop template here"
              helperText="Excel/CSV templates (.xlsx, .xls, .csv) up to 10MB"
            />
          )}

          <div className="sr-only">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              id="aia-template-upload"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Label htmlFor="aia-template-upload">Upload AIA template</Label>
          </div>

          {/* Existing Templates */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Uploaded Templates</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>File Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          {template.template_name}
                        </div>
                      </TableCell>
                      <TableCell>{formatFileSize(template.file_size)}</TableCell>
                      <TableCell>
                        {new Date(template.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {template.is_default ? (
                          <Badge variant="default">Default</Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(template)}
                          >
                            Set as default
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(template.file_url, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(template)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No templates uploaded yet. Upload an Excel spreadsheet with placeholders to get started.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Placeholder Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Available Placeholders
          </CardTitle>
          <CardDescription>
            Use these placeholders in your Excel template. They will be replaced with actual data when generating invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Place these placeholders in your Excel cells exactly as shown. When you generate an AIA invoice, 
              the system will replace them with the corresponding data from your project and customer records.
            </AlertDescription>
          </Alert>

          <Accordion type="multiple" className="w-full">
            {PLACEHOLDER_CATEGORIES.map((category, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-sm font-medium">
                  {category.category}
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Placeholder</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {category.placeholders.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {item.placeholder}
                            </code>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.description}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
