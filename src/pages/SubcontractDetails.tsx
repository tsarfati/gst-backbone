import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, FileText, Plus, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";
import FullPagePdfViewer from "@/components/FullPagePdfViewer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CommitmentInfo from "@/components/CommitmentInfo";
import { generateCommitmentStatusReport } from "@/utils/commitmentReportPdf";

export default function SubcontractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [subcontract, setSubcontract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
const [changeOrders, setChangeOrders] = useState<any[]>([]);
const [viewingFile, setViewingFile] = useState<{file: File, name: string} | null>(null);
const [costCodeLookup, setCostCodeLookup] = useState<Record<string, { code: string; description: string; type?: string }>>({});

  useEffect(() => {
    if (id) {
      fetchSubcontract();
    }
  }, [id]);

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

  const handleViewFile = async (filePath: string, fileName: string) => {
    try {
      // Extract the path from the full URL if it's a URL
      let path = filePath;
      if (filePath.includes('/storage/v1/object/')) {
        // Extract path after the bucket name
        const match = filePath.match(/\/subcontract-files\/(.+)$/);
        if (match) {
          path = match[1];
        }
      }

      const { data, error } = await supabase.storage
        .from('subcontract-files')
        .download(path);

      if (error) throw error;

      // Create a proper File object from the Blob
      const fileObj = new File([data], fileName, { type: data.type });
      setViewingFile({ file: fileObj, name: fileName });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to load file",
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
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
      <FullPagePdfViewer 
        file={viewingFile.file} 
        onBack={() => setViewingFile(null)} 
      />
    );
  }

  const getFileNameFromPath = (path: string) => {
    return path.split('/').pop() || 'Contract Document';
  };

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
                onClick={() => handleViewFile(fileData.path, fileData.name)}
              >
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{fileData.name}</p>
                  <p className="text-sm text-muted-foreground">Click to view</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
