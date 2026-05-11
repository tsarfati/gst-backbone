import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit, FileText, Plus, Download, Send, CheckCircle2, FileDown, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";
import FullPagePdfViewer from "@/components/FullPagePdfViewer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CommitmentInfo from "@/components/CommitmentInfo";
import { generateCommitmentStatusReport } from "@/utils/commitmentReportPdf";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { canAccessAssignedJobOnly } from "@/utils/jobAccess";
import FileShareModal from "@/components/FileShareModal";
import { downloadGeneratedSubcontractDocument, generateSubcontractPDF } from "@/utils/subcontractPdfGenerator";

export default function SubcontractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  
  const [subcontract, setSubcontract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [changeOrders, setChangeOrders] = useState<any[]>([]);
  const [viewingFile, setViewingFile] = useState<{file: File, name: string, path: string} | null>(null);
  const [costCodeLookup, setCostCodeLookup] = useState<Record<string, { code: string; description: string; type?: string }>>({});
  const [shareFiles, setShareFiles] = useState<Array<{ id: string; file_name: string; file_url: string; file_size: number | null }>>([]);
  const [contractEvents, setContractEvents] = useState<any[]>([]);
  const [companySignatureProvider, setCompanySignatureProvider] = useState<'manual' | 'docusign'>('manual');
  const [signatureActionLoading, setSignatureActionLoading] = useState(false);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateActionLoading, setTemplateActionLoading] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<Array<{ id: string; template_name: string; template_format?: string | null; template_file_type?: string | null }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [workflowForm, setWorkflowForm] = useState({
    contract_negotiation_status: 'draft',
    signature_status: 'not_started',
    signature_provider: 'manual',
    executed_signed_by_name: '',
  });

  useEffect(() => {
    if (id && !websiteJobAccessLoading) {
      fetchSubcontract();
    }
  }, [id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  const isDocxTemplate = (template?: { template_format?: string | null; template_file_type?: string | null; template_file_name?: string | null; template_file_url?: string | null }) => {
    const fileType = String(template?.template_file_type || '').toLowerCase();
    const fileName = String(template?.template_file_name || '').toLowerCase();
    const fileUrl = String(template?.template_file_url || '').toLowerCase();
    return (
      fileType === 'docx' ||
      fileName.endsWith('.docx') ||
      fileUrl.endsWith('.docx')
    );
  };

  const dedupeTemplates = (templates: Array<{ id: string; template_name: string; template_format?: string | null; template_file_type?: string | null; template_file_name?: string | null; template_file_url?: string | null }>) => {
    const byName = new Map<string, typeof templates[number]>();
    for (const template of templates) {
      const existing = byName.get(template.template_name);
      if (!existing) {
        byName.set(template.template_name, template);
        continue;
      }

      const existingIsDocx = isDocxTemplate(existing);
      const candidateIsDocx = isDocxTemplate(template);

      if (!existingIsDocx && candidateIsDocx) {
        byName.set(template.template_name, template);
      }
    }

    return Array.from(byName.values());
  };

  const fetchSubcontract = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subcontracts')
        .select(`
          *,
          jobs(id, name, client, company_id),
          vendors(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (!canAccessAssignedJobOnly([data?.jobs?.id], isPrivileged, allowedJobIds)) {
        toast({
          title: "Access denied",
          description: "You do not have access to this subcontract",
          variant: "destructive",
        });
        setSubcontract(null);
        return;
      }

      setSubcontract(data);

      // Resolve cost codes used in cost_distribution for display
      try {
        const distribution: any[] = (() => {
          try {
            const raw = (data as any)?.cost_distribution as any;
            if (!raw) return [];
            if (typeof raw === 'string') return JSON.parse(raw);
            if (Array.isArray(raw)) return raw as any[];
            return [];
          } catch { return []; }
        })();
        const ids: string[] = distribution.map((d: any) => d?.cost_code_id).filter(Boolean);
        if (ids.length > 0) {
          const { data: codes } = await supabase
            .from('cost_codes')
            .select('id, code, description, type')
            .in('id', ids);
          const map: Record<string, {code: string; description: string; type?: string}> = {};
          (codes || []).forEach(cc => { map[cc.id] = { code: cc.code, description: cc.description, type: cc.type }; });
          setCostCodeLookup(map);
        } else {
          setCostCodeLookup({});
        }
      } catch {
        setCostCodeLookup({});
      }
      if (data) {
        const [{ data: eventsData }, { data: payablesConfig }] = await Promise.all([
          supabase
            .from('contract_signature_events' as any)
            .select('*')
            .eq('subcontract_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('payables_settings')
            .select('vendor_portal_signature_provider')
            .eq('company_id', data.jobs?.company_id)
            .maybeSingle(),
        ]);

        const { data: templateRows } = await supabase
          .from('pdf_templates')
          .select('id, template_name, template_format, template_file_type, template_file_name, template_file_url')
          .eq('company_id', data.jobs?.company_id)
          .eq('template_type', 'subcontract')
          .order('template_name');

        setContractEvents((eventsData as any[]) || []);
        setCompanySignatureProvider(((payablesConfig as any)?.vendor_portal_signature_provider || 'manual') as 'manual' | 'docusign');
        const templateOptions = dedupeTemplates((templateRows || []).filter((row) => !!row.id && !!row.template_name));
        setAvailableTemplates(templateOptions);
        setSelectedTemplate((prev) => (prev && templateOptions.some((row) => row.id === prev) ? prev : templateOptions[0]?.id || ''));

        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('*')
          .eq('subcontract_id', id)
          .order('created_at', { ascending: false });
        setInvoices(invoiceData || []);

        // Fetch payments related to these invoices
        if (invoiceData && invoiceData.length > 0) {
          const invoiceIds = invoiceData.map((inv: any) => inv.id);
          const { data: paymentLines } = await supabase
            .from('payment_invoice_lines')
            .select('payment_id, amount_paid, payments(*)')
            .in('invoice_id', invoiceIds);

          // Extract unique payments
          const paymentsMap = new Map();
          (paymentLines || []).forEach((line: any) => {
            if (line.payments && !paymentsMap.has(line.payments.id)) {
              paymentsMap.set(line.payments.id, line.payments);
            }
          });
          setPayments(Array.from(paymentsMap.values()));
        } else {
          setPayments([]);
        }
      }
    } catch (error) {
      console.error('Error fetching subcontract:', error);
      toast({
        title: "Error",
        description: "Failed to load subcontract details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!subcontract) return;
    
    try {
      // Fetch company info
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('name, logo_url')
        .eq('id', subcontract.jobs?.company_id)
        .maybeSingle();

      if (companyError) {
        console.error('Error fetching company:', companyError);
      }

      await generateCommitmentStatusReport(
        {
          name: subcontract.name,
          vendor_name: subcontract.vendors?.name || 'Unknown',
          contract_amount: parseFloat(subcontract.contract_amount),
          status: subcontract.status,
          start_date: subcontract.start_date,
          end_date: subcontract.end_date,
          apply_retainage: subcontract.apply_retainage,
          retainage_percentage: subcontract.retainage_percentage,
        },
        invoices.map(inv => ({
          invoice_number: inv.invoice_number || 'N/A',
          issue_date: inv.issue_date,
          amount: parseFloat(inv.amount),
          status: inv.status,
          due_date: inv.due_date,
        })),
        payments.map(pmt => ({
          payment_number: pmt.payment_number || 'N/A',
          payment_date: pmt.payment_date,
          amount: parseFloat(pmt.amount),
          payment_method: pmt.payment_method || 'N/A',
          check_number: pmt.check_number,
          memo: pmt.memo,
        })),
        companyData || { name: 'Company' },
        {
          name: subcontract.jobs?.name || 'Job',
          client: subcontract.jobs?.client,
        }
      );

      toast({
        title: "Success",
        description: "Commitment status report generated successfully",
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    }
  };

  const normalizeSubcontractPath = (filePath: string) => {
    let path = filePath;
    if (filePath.includes('/storage/v1/object/')) {
      const match = filePath.match(/\/subcontract-files\/(.+)$/);
      if (match) {
        path = match[1];
      }
    }
    return path;
  };

  const handleViewFile = async (filePath: string, fileName: string) => {
    try {
      const path = normalizeSubcontractPath(filePath);

      const { data, error } = await supabase.storage
        .from('subcontract-files')
        .download(path);

      if (error) throw error;

      // Create a proper File object from the Blob
      const fileObj = new File([data], fileName, { type: data.type });
      setViewingFile({ file: fileObj, name: fileName, path });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to load file",
        variant: "destructive",
      });
    }
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      const path = normalizeSubcontractPath(filePath);
      const { data, error } = await supabase.storage
        .from('subcontract-files')
        .download(path);

      if (error) throw error;

      const objectUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName || 'Contract Document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Error downloading subcontract file:', error);
      toast({
        title: "Download failed",
        description: "Could not download this contract document.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const isPrivilegedCompanyUser = ['admin', 'controller', 'company_admin', 'owner', 'super_admin'].includes(String(profile?.role || '').toLowerCase());

  const createContractEvent = async (eventType: string, eventNote: string, metadata: Record<string, any> = {}) => {
    if (!subcontract?.id) return;
    try {
      await supabase.from('contract_signature_events' as any).insert({
        subcontract_id: subcontract.id,
        company_id: subcontract.jobs?.company_id || null,
        vendor_id: subcontract.vendor_id || null,
        actor_user_id: user?.id || null,
        actor_role: profile?.role || 'unknown',
        event_type: eventType,
        event_note: eventNote,
        metadata,
      });
    } catch (error) {
      console.error('Failed to create contract event:', error);
    }
  };

  const updateSignatureState = async (updates: Record<string, any>, successMessage: string, eventType: string, eventNote: string) => {
    if (!subcontract?.id) return;
    try {
      setSignatureActionLoading(true);
      const { error } = await supabase
        .from('subcontracts')
        .update(updates as any)
        .eq('id', subcontract.id);
      if (error) throw error;

      await createContractEvent(eventType, eventNote, updates);
      toast({ title: "Success", description: successMessage });
      await fetchSubcontract();
    } catch (error) {
      console.error('Failed contract signature action:', error);
      toast({
        title: "Error",
        description: "Failed to update contract signature workflow",
        variant: "destructive",
      });
    } finally {
      setSignatureActionLoading(false);
    }
  };

  const openWorkflowEditor = () => {
    setWorkflowForm({
      contract_negotiation_status: String(subcontract?.contract_negotiation_status || 'draft'),
      signature_status: String(subcontract?.signature_status || 'not_started'),
      signature_provider: String(subcontract?.signature_provider || companySignatureProvider || 'manual'),
      executed_signed_by_name: String(subcontract?.executed_signed_by_name || ''),
    });
    setWorkflowDialogOpen(true);
  };

  const handleSaveWorkflow = async () => {
    await updateSignatureState(
      {
        contract_negotiation_status: workflowForm.contract_negotiation_status,
        signature_status: workflowForm.signature_status,
        signature_provider: workflowForm.signature_provider,
        executed_signed_by_name: workflowForm.executed_signed_by_name || null,
      },
      'Contract workflow updated.',
      'company_updated_contract_workflow',
      'Company updated workflow statuses manually'
    );
    setWorkflowDialogOpen(false);
  };

  const openTemplateDialog = () => {
    if (availableTemplates.length === 0) {
      toast({
        title: "No subcontract templates yet",
        description: "Set up a subcontract template first so we can generate the contract document from it.",
        variant: "destructive",
      });
      return;
    }

    setTemplateDialogOpen(true);
  };

  const saveGeneratedContractDocument = async (
    generatedDocument: { blob: Blob; fileName: string; mimeType: string },
    templateName: string | null
  ) => {
    if (!subcontract?.id || !subcontract?.jobs?.company_id) {
      throw new Error('Missing subcontract context for saving the generated contract.');
    }

    const fileExtension = generatedDocument.fileName.split('.').pop() || (generatedDocument.mimeType === 'application/pdf' ? 'pdf' : 'docx');
    const storagePath = `${subcontract.jobs.company_id}/generated-contracts/${subcontract.id}/${Date.now()}-${generatedDocument.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploadFile = new File([generatedDocument.blob], generatedDocument.fileName, { type: generatedDocument.mimeType });

    const { error: uploadError } = await supabase.storage
      .from('subcontract-files')
      .upload(storagePath, uploadFile, {
        contentType: generatedDocument.mimeType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const displayName = templateName
      ? `${templateName}.${fileExtension}`
      : generatedDocument.fileName;

    const { error: updateError } = await supabase
      .from('subcontracts')
      .update({
        contract_file_url: JSON.stringify([{ path: storagePath, name: displayName }]),
      })
      .eq('id', subcontract.id);

    if (updateError) throw updateError;

    return { path: storagePath, name: displayName };
  };

  const handleCreateFromTemplate = async () => {
    if (!subcontract?.id || !selectedTemplate) {
      toast({
        title: "Select a template",
        description: "Choose a subcontract template before continuing.",
        variant: "destructive",
      });
      return;
    }

    try {
      setTemplateActionLoading(true);
      const selectedTemplateRow = availableTemplates.find((template) => template.id === selectedTemplate);
      const generatedDocument = await generateSubcontractPDF(subcontract.id, selectedTemplate);
      const savedDocument = await saveGeneratedContractDocument(
        generatedDocument,
        selectedTemplateRow?.template_name || null
      );
      downloadGeneratedSubcontractDocument(generatedDocument);
      await createContractEvent(
        'company_generated_contract_from_template',
        `Company generated contract document from template "${selectedTemplateRow?.template_name || 'Selected Template'}".`,
        {
          template_id: selectedTemplate,
          template_name: selectedTemplateRow?.template_name || null,
          saved_contract_path: savedDocument.path,
          saved_contract_name: savedDocument.name,
          generated_kind: generatedDocument.kind,
        }
      );

      await fetchSubcontract();

      toast({
        title: "Contract generated",
        description: `We generated and saved the contract document from the "${selectedTemplateRow?.template_name || 'selected'}" template.`,
      });

      setTemplateDialogOpen(false);
    } catch (error: any) {
      console.error('Failed to generate contract from template:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate the subcontract contract document.",
        variant: "destructive",
      });
    } finally {
      setTemplateActionLoading(false);
    }
  };

  if (loading || websiteJobAccessLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground"><span className="loading-dots">Loading</span></div>
      </div>
    );
  }

  if (!subcontract) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Subcontract not found</p>
          <Button onClick={() => navigate('/subcontracts')} className="mt-4">
            Back to Subcontracts
          </Button>
        </div>
      </div>
    );
  }

  if (viewingFile) {
    return (
      <>
        <div className="fixed inset-0 z-40 flex flex-col bg-background">
          <div className="flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{viewingFile.name}</p>
              <p className="text-xs text-muted-foreground">Subcontract document</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShareFiles([{
                  id: `subcontract-doc-${viewingFile.path}`,
                  file_name: viewingFile.name,
                  file_url: viewingFile.path,
                  file_size: viewingFile.file.size || null,
                }])}
              >
                <Send className="h-4 w-4 mr-2" />
                Email / Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleDownloadFile(viewingFile.path, viewingFile.name)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="default" size="sm" onClick={() => setViewingFile(null)}>
                Close
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <FullPagePdfViewer
              file={viewingFile.file}
              onBack={() => setViewingFile(null)}
              hideBackButton
            />
          </div>
        </div>
        <FileShareModal
          open={shareFiles.length > 0}
          onOpenChange={(open) => {
            if (!open) setShareFiles([]);
          }}
          files={shareFiles}
          jobId={subcontract?.jobs?.id || ''}
          storageBucket="subcontract-files"
        />
      </>
    );
  }

  const getFileNameFromPath = (path: string) => {
    return path.split('/').pop() || 'Contract Document';
  };

  const isPdfFile = (fileNameOrPath: string) => fileNameOrPath.toLowerCase().endsWith('.pdf');

  let contractFiles: {path: string, name: string}[] = [];
  if (subcontract.contract_file_url) {
    try {
      // Only parse if it looks like JSON (starts with '[' or '{')
      const fileUrl = subcontract.contract_file_url.trim();
      if (fileUrl.startsWith('[') || fileUrl.startsWith('{')) {
        const parsed = JSON.parse(fileUrl);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
          contractFiles = parsed;
        } else if (Array.isArray(parsed)) {
          contractFiles = parsed.map(p => ({ path: p, name: getFileNameFromPath(p) }));
        } else {
          contractFiles = [{ path: subcontract.contract_file_url, name: getFileNameFromPath(subcontract.contract_file_url) }];
        }
      } else {
        // Treat as a simple URL string
        contractFiles = [{ path: subcontract.contract_file_url, name: getFileNameFromPath(subcontract.contract_file_url) }];
      }
    } catch (error) {
      console.error('Error parsing contract file URL:', error);
      // Fallback to treating it as a simple URL
      contractFiles = [{ path: subcontract.contract_file_url, name: getFileNameFromPath(subcontract.contract_file_url) }];
    }
  }

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{subcontract.name}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleGenerateReport}
          >
            <Download className="h-4 w-4 mr-2" />
            Commit Status Report
          </Button>
          <Button onClick={() => navigate(`/subcontracts/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Subcontract Name</p>
              <p className="font-semibold text-foreground">{subcontract.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Job</p>
              <p className="font-semibold text-foreground">{subcontract.jobs?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vendor</p>
              <p className="font-semibold text-foreground">{subcontract.vendors?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={`${getStatusColor(subcontract.status)} text-white`}>
                {subcontract.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-semibold text-foreground">
                {subcontract.start_date ? format(new Date(subcontract.start_date), 'MMMM d, yyyy') : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Date</p>
              <p className="font-semibold text-foreground">
                {subcontract.end_date ? format(new Date(subcontract.end_date), 'MMMM d, yyyy') : 'Not set'}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Section</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Contract Amount</p>
                <p className="font-semibold text-foreground text-xl">${formatNumber(subcontract.contract_amount)}</p>
              </div>
              {subcontract.apply_retainage && (
                <div>
                  <p className="text-sm text-muted-foreground">Retainage</p>
                  <p className="font-semibold text-foreground">{subcontract.retainage_percentage}% applied</p>
                </div>
              )}
            {(() => {
              try {
                const distributionData = subcontract.cost_distribution 
                  ? JSON.parse(subcontract.cost_distribution) 
                  : [];
                
                return Array.isArray(distributionData) && distributionData.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Cost Distribution</p>
                    <div className="space-y-3">
                      {distributionData.map((item: any, index: number) => (
                        <div key={index} className="bg-muted/50 p-4 rounded-md border">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-sm">{costCodeLookup[item.cost_code_id]?.code || 'N/A'}</span>
                                <span className="text-sm text-muted-foreground">•</span>
                                <span className="text-sm font-medium">{costCodeLookup[item.cost_code_id]?.description || 'Cost Code'}</span>
                                <Badge variant="secondary" className="text-xs">{costCodeLookup[item.cost_code_id]?.type || 'sub'}</Badge>
                              </div>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-2 p-2 bg-background/50 rounded border-l-2 border-muted">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-semibold text-lg">${formatNumber(item.amount || 0)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="mt-4 pt-3 border-t border-muted">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-medium">Total Distributed:</p>
                          <p className="font-semibold text-foreground text-lg">
                            ${formatNumber(subcontract.total_distributed_amount || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } catch (error) {
                console.error('Error parsing cost distribution:', error);
                return null;
              }
            })()}
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-semibold text-foreground">
                  {format(new Date(subcontract.created_at), 'MMMM d, yyyy')}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <CommitmentInfo 
            totalCommit={parseFloat(subcontract.contract_amount) + invoices.filter(inv => inv.status === 'approved').reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0)}
            prevGross={invoices.filter(inv => inv.status !== 'draft').reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0)}
            prevRetention={invoices.filter(inv => inv.status !== 'draft').reduce((sum, inv) => sum + (parseFloat(inv.amount || 0) * (subcontract.retainage_percentage || 0) / 100), 0)}
            prevPayments={invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0)}
            contractBalance={parseFloat(subcontract.contract_amount) - invoices.filter(inv => inv.status !== 'draft').reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0)}
          />
        </div>
      </div>

      {/* Description */}
      {subcontract.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{subcontract.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Contract Files */}
      {contractFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contract Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {contractFiles.map((fileData, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                onClick={() => isPdfFile(fileData.name || fileData.path)
                  ? handleViewFile(fileData.path, fileData.name)
                  : handleDownloadFile(fileData.path, fileData.name)}
              >
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{fileData.name}</p>
                  <p className="text-sm text-muted-foreground">{isPdfFile(fileData.name || fileData.path) ? 'Click to view' : 'Click to download'}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Contract Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Negotiation Status</p>
              <p className="font-medium">{subcontract.contract_negotiation_status || 'draft'}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Signature Status</p>
              <p className="font-medium">{subcontract.signature_status || 'not_started'}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Provider</p>
              <p className="font-medium">{(subcontract.signature_provider || companySignatureProvider || 'manual').toUpperCase()}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Executed Signed By</p>
              <p className="font-medium">{subcontract.executed_signed_by_name || 'Not provided'}</p>
            </div>
          </div>

          {subcontract.executed_contract_file_url && (
            <div
              className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
              onClick={() => handleViewFile(subcontract.executed_contract_file_url, 'Executed Contract')}
            >
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Executed Contract</p>
                <p className="text-sm text-muted-foreground">Click to view uploaded signed copy</p>
              </div>
            </div>
          )}

          {isPrivilegedCompanyUser && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={signatureActionLoading}
                onClick={openWorkflowEditor}
              >
                Edit Workflow
              </Button>
              <Button
                variant="outline"
                disabled={signatureActionLoading}
                onClick={() => updateSignatureState(
                  {
                    contract_negotiation_status: 'pending_vendor_review',
                    signature_status: 'pending_vendor_review',
                  },
                  'Marked for vendor review.',
                  'company_sent_for_vendor_review',
                  'Company sent contract to vendor for review'
                )}
              >
                <Send className="h-4 w-4 mr-2" />
                Send for Vendor Review
              </Button>
              <Button
                variant="outline"
                disabled={signatureActionLoading || templateActionLoading}
                onClick={openTemplateDialog}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Create from Template
              </Button>
              <Button
                variant="outline"
                disabled
                onClick={() => {
                  toast({
                    title: "Coming soon",
                    description: "DocuSign integration is planned but not enabled yet.",
                  });
                }}
              >
                Send for Signature (DocuSign - Coming Soon)
              </Button>
              {String(subcontract.signature_status || '').toLowerCase() === 'signed_uploaded' && (
                <Button
                  variant="secondary"
                  disabled={signatureActionLoading}
                  onClick={() => updateSignatureState(
                    {
                      signature_status: 'executed',
                    },
                    'Contract marked fully executed.',
                    'company_marked_contract_executed',
                    'Company marked contract as fully executed'
                  )}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Executed
                </Button>
              )}
              {availableTemplates.length === 0 && (
                <Button
                  variant="ghost"
                  onClick={() => navigate('/settings/company?tab=pdf-templates&section=subcontracts')}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Set Up Subcontract Template
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Workflow Timeline</p>
            {contractEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contract workflow events yet.</p>
            ) : (
              <div className="space-y-2">
                {contractEvents.slice(0, 8).map((event) => (
                  <div key={event.id} className="rounded border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{event.event_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    {event.event_note && (
                      <p className="text-xs text-muted-foreground mt-1">{event.event_note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={workflowDialogOpen} onOpenChange={setWorkflowDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contract Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Negotiation Status</Label>
              <Select
                value={workflowForm.contract_negotiation_status}
                onValueChange={(value) => setWorkflowForm((prev) => ({ ...prev, contract_negotiation_status: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_vendor_review">Pending Vendor Review</SelectItem>
                  <SelectItem value="under_revision">Under Revision</SelectItem>
                  <SelectItem value="approved_for_signature">Approved for Signature</SelectItem>
                  <SelectItem value="executed">Executed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Signature Status</Label>
              <Select
                value={workflowForm.signature_status}
                onValueChange={(value) => setWorkflowForm((prev) => ({ ...prev, signature_status: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="pending_vendor_review">Pending Vendor Review</SelectItem>
                  <SelectItem value="awaiting_external_signature">Awaiting Signature</SelectItem>
                  <SelectItem value="signed_uploaded">Signed Uploaded</SelectItem>
                  <SelectItem value="executed">Executed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={workflowForm.signature_provider}
                onValueChange={(value) => setWorkflowForm((prev) => ({ ...prev, signature_provider: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="docusign">DocuSign</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Executed Signed By</Label>
              <Input
                value={workflowForm.executed_signed_by_name}
                onChange={(e) => setWorkflowForm((prev) => ({ ...prev, executed_signed_by_name: e.target.value }))}
                placeholder="Signer full name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkflowDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWorkflow} disabled={signatureActionLoading}>Save Workflow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Create Contract from Template
            </DialogTitle>
            <DialogDescription>
              Choose the subcontract template to generate and save the contract document for this subcontract.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subcontract Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subcontract template" />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.template_name} {isDocxTemplate(template) ? '(Word Template)' : '(HTML/PDF Template)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {availableTemplates.length === 0 && (
              <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
                No subcontract templates are set up yet. Go to Company Settings and add one first.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)} disabled={templateActionLoading}>
              Cancel
            </Button>
            {availableTemplates.length === 0 ? (
              <Button onClick={() => navigate('/settings/company?tab=pdf-templates&section=subcontracts')}>
                <Settings className="h-4 w-4 mr-2" />
                Open Template Settings
              </Button>
            ) : (
              <Button onClick={handleCreateFromTemplate} disabled={templateActionLoading || !selectedTemplate}>
                <FileDown className="h-4 w-4 mr-2" />
                {templateActionLoading ? 'Generating...' : 'Generate Contract'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Orders Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Change Orders</CardTitle>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Change Order
          </Button>
        </CardHeader>
        <CardContent>
          {changeOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No change orders yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeOrders.map((co) => (
                  <TableRow key={co.id}>
                    <TableCell>{co.number}</TableCell>
                    <TableCell>{co.description}</TableCell>
                    <TableCell>${formatNumber(co.amount)}</TableCell>
                    <TableCell>{co.status}</TableCell>
                    <TableCell>{format(new Date(co.date), 'MMM d, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoices Section */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No invoices submitted yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow 
                    key={invoice.id}
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                  >
                    <TableCell className="font-medium">{invoice.invoice_number || invoice.id.substring(0, 8)}</TableCell>
                    <TableCell>{format(new Date(invoice.issue_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>${formatNumber(invoice.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FileShareModal
        open={shareFiles.length > 0}
        onOpenChange={(open) => {
          if (!open) setShareFiles([]);
        }}
        files={shareFiles}
        jobId={subcontract?.jobs?.id || ''}
        storageBucket="subcontract-files"
      />
    </div>
  );
}
