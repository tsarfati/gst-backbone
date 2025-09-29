import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, FileText, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";
import FullPagePdfViewer from "@/components/FullPagePdfViewer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function SubcontractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [subcontract, setSubcontract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [changeOrders, setChangeOrders] = useState<any[]>([]);
  const [viewingFile, setViewingFile] = useState<{file: File, name: string} | null>(null);

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
          jobs(id, name),
          vendors(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setSubcontract(data);

      // Fetch invoices for this subcontract
      if (data) {
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('*')
          .eq('subcontract_id', id)
          .order('created_at', { ascending: false });
        
        setInvoices(invoiceData || []);
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

  const handleViewFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('subcontract-files')
        .download(filePath);

      if (error) throw error;

      setViewingFile({ file: data as File, name: fileName });
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
      const parsed = JSON.parse(subcontract.contract_file_url);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        contractFiles = parsed;
      } else if (Array.isArray(parsed)) {
        contractFiles = parsed.map(p => ({ path: p, name: getFileNameFromPath(p) }));
      } else {
        contractFiles = [{ path: subcontract.contract_file_url, name: getFileNameFromPath(subcontract.contract_file_url) }];
      }
    } catch {
      contractFiles = [{ path: subcontract.contract_file_url, name: getFileNameFromPath(subcontract.contract_file_url) }];
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{subcontract.name}</h1>
            <p className="text-muted-foreground">Subcontract Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/subcontracts/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Main Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Subcontract Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Vendor</p>
              <p className="font-semibold text-foreground">{subcontract.vendors?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Job</p>
              <p className="font-semibold text-foreground">{subcontract.jobs?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contract Amount</p>
              <p className="font-semibold text-foreground text-xl">${formatNumber(subcontract.contract_amount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={`${getStatusColor(subcontract.status)} text-white`}>
                {subcontract.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-semibold text-foreground">
                {format(new Date(subcontract.created_at), 'MMMM d, yyyy')}
              </p>
            </div>
          </CardContent>
        </Card>
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
                className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
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
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => navigate(`/bills/${invoice.id}`)}
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
