import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  FileKey, Upload, Search, Filter, Eye, Download, Edit,
  Plus, Calendar, DollarSign, Building, ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import DragDropUpload from "@/components/DragDropUpload";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";

const getStatusVariant = (status: string) => {
  switch (status) {
    case "active": return "default" as const;
    case "completed": return "secondary" as const;
    case "pending": return "warning" as const;
    case "expired": return "destructive" as const;
    default: return "outline" as const;
  }
};

export default function CompanyContracts() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();

  const [newContract, setNewContract] = useState({
    name: "", job_id: "", status: "active", issue_date: "", expiration_date: "", contract_value: "", description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (currentCompany && !websiteJobAccessLoading) { fetchContracts(); fetchJobs(); }
  }, [currentCompany, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  const fetchContracts = async () => {
    if (!currentCompany) return;
    const { data } = await supabase
      .from('company_files' as any)
      .select('*, jobs:job_id(name)')
      .eq('company_id', currentCompany.id)
      .eq('category', 'contract')
      .order('created_at', { ascending: false });
    if (data) {
      const filtered = isPrivileged
        ? data
        : data.filter((c: any) => !c.job_id || allowedJobIds.includes(c.job_id));
      setContracts(filtered);
    }
  };

  const fetchJobs = async () => {
    if (!currentCompany) return;
    if (!isPrivileged && allowedJobIds.length === 0) {
      setJobs([]);
      return;
    }
    let query = supabase.from('jobs').select('id, name').eq('company_id', currentCompany.id).eq('is_active', true).order('name');
    if (!isPrivileged) {
      query = query.in('id', allowedJobIds);
    }
    const { data } = await query;
    if (data) setJobs(data);
  };

  const handleAdd = async () => {
    if (!currentCompany || !user || !selectedFile) {
      toast({ title: 'Error', description: 'Please fill required fields and select a file.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const filePath = `${currentCompany.id}/contracts/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage.from('job-filing-cabinet').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('job-filing-cabinet').getPublicUrl(filePath);

      let filingDocId: string | null = null;
      if (newContract.job_id) {
        let { data: folder } = await supabase.from('job_filing_folders').select('id').eq('job_id', newContract.job_id).eq('company_id', currentCompany.id).eq('name', 'Contracts').maybeSingle();
        if (!folder) {
          const { data: nf } = await supabase.from('job_filing_folders').insert({ job_id: newContract.job_id, company_id: currentCompany.id, name: 'Contracts', sort_order: 7, created_by: user.id }).select('id').single();
          folder = nf;
        }
        if (folder) {
          const { data: fd } = await supabase.from('job_filing_documents').insert({ folder_id: folder.id, job_id: newContract.job_id, company_id: currentCompany.id, file_name: selectedFile.name, file_url: urlData.publicUrl, file_size: selectedFile.size, file_type: selectedFile.type, description: newContract.description || newContract.name, uploaded_by: user.id }).select('id').single();
          if (fd) filingDocId = fd.id;
        }
      }

      await supabase.from('company_files' as any).insert({
        company_id: currentCompany.id, category: 'contract', name: newContract.name, description: newContract.description,
        file_name: selectedFile.name, file_url: urlData.publicUrl, file_size: selectedFile.size, file_type: selectedFile.type,
        job_id: newContract.job_id || null, filing_document_id: filingDocId, status: newContract.status,
        issue_date: newContract.issue_date || null, expiration_date: newContract.expiration_date || null,
        contract_value: newContract.contract_value ? parseFloat(newContract.contract_value) : null, uploaded_by: user.id,
      });

      toast({ title: 'Contract Added' });
      setShowAddDialog(false);
      setNewContract({ name: "", job_id: "", status: "active", issue_date: "", expiration_date: "", contract_value: "", description: "" });
      setSelectedFile(null);
      fetchContracts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const filtered = contracts.filter(c => {
    const matchesSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalValue = contracts.filter(c => c.contract_value).reduce((s, c) => s + (c.contract_value || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Company Contracts</h1>
        </div>
        <Button onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-2" />Upload Contract</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Contracts</CardTitle><FileKey className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{contracts.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Active</CardTitle><Building className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{contracts.filter(c => c.status === "active").length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Value</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">${totalValue.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Expiring Soon</CardTitle><Calendar className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{contracts.filter(c => c.status === "expiring").length}</div></CardContent></Card>
      </div>

      <Card className="mb-6"><CardContent className="pt-6"><div className="flex flex-col md:flex-row gap-4"><div className="flex-1"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search contracts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="expired">Expired</SelectItem></SelectContent></Select></div></CardContent></Card>

      <Card>
        <CardHeader><CardTitle>Contract Documents</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <FileKey className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No contracts found</h3>
              <p className="text-muted-foreground mb-4">{searchTerm || statusFilter !== "all" ? "Try adjusting filters" : "Upload your first contract"}</p>
              <Button onClick={() => setShowAddDialog(true)}><Upload className="h-4 w-4 mr-2" />Upload Contract</Button>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Job</TableHead><TableHead>Value</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.job_id ? <Button variant="link" className="p-0 h-auto text-xs" onClick={() => navigate(`/jobs/${c.job_id}`)}><ExternalLink className="h-3 w-3 mr-1" />{c.jobs?.name || 'View'}</Button> : <span className="text-sm text-muted-foreground">Company</span>}</TableCell>
                    <TableCell>{c.contract_value ? `$${Number(c.contract_value).toLocaleString()}` : '—'}</TableCell>
                    <TableCell>{c.issue_date ? format(new Date(c.issue_date), 'MM/dd/yyyy') : '—'}</TableCell>
                    <TableCell>{c.expiration_date ? format(new Date(c.expiration_date), 'MM/dd/yyyy') : '—'}</TableCell>
                    <TableCell><Badge variant={getStatusVariant(c.status)}>{c.status}</Badge></TableCell>
                    <TableCell><div className="flex space-x-2"><Button variant="ghost" size="sm" onClick={() => window.open(c.file_url, '_blank')}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="sm" asChild><a href={c.file_url} download={c.file_name}><Download className="h-4 w-4" /></a></Button></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Upload Contract</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2"><Label>Contract Name *</Label><Input value={newContract.name} onChange={(e) => setNewContract(p => ({ ...p, name: e.target.value }))} placeholder="Subcontract Agreement" /></div>
            <div className="space-y-2">
              <Label>Job (optional — links to job filing cabinet)</Label>
              <Select value={newContract.job_id} onValueChange={(v) => setNewContract(p => ({ ...p, job_id: v }))}>
                <SelectTrigger><SelectValue placeholder="No job (company-level)" /></SelectTrigger>
                <SelectContent><SelectItem value="">No job</SelectItem>{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent>
              </Select>
              {newContract.job_id && <p className="text-xs text-muted-foreground">📁 File stored in job's Filing Cabinet → Contracts folder.</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={newContract.issue_date} onChange={(e) => setNewContract(p => ({ ...p, issue_date: e.target.value }))} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" value={newContract.expiration_date} onChange={(e) => setNewContract(p => ({ ...p, expiration_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Contract Value</Label><Input type="number" value={newContract.contract_value} onChange={(e) => setNewContract(p => ({ ...p, contract_value: e.target.value }))} placeholder="0.00" /></div>
              <div className="space-y-2"><Label>Status</Label><Select value={newContract.status} onValueChange={(v) => setNewContract(p => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="expired">Expired</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Input value={newContract.description} onChange={(e) => setNewContract(p => ({ ...p, description: e.target.value }))} placeholder="Optional" /></div>
            <div className="space-y-2">
              <Label>Contract File *</Label>
              <DragDropUpload
                onFileSelect={(file) => setSelectedFile(file)}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                maxSize={20}
                disabled={uploading}
                size="compact"
                title="Drag contract file here"
                dropTitle="Drop contract file here"
                helperText="PDF, image, or document up to 20MB"
              />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button><Button onClick={handleAdd} disabled={uploading || !newContract.name || !selectedFile}>{uploading ? 'Uploading...' : 'Upload Contract'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
