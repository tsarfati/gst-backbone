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
  Shield, Upload, Search, Filter, Eye, Download, Edit,
  Calendar, AlertTriangle, Plus, DollarSign, Building, Phone, ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import DragDropUpload from "@/components/DragDropUpload";

const INSURANCE_TYPES = [
  "General Liability", "Workers' Compensation", "Commercial Auto",
  "Professional Liability", "Property Insurance", "Umbrella/Excess",
  "Builder's Risk", "Inland Marine", "Surety Bond",
];

const getStatusVariant = (status: string) => {
  switch (status) {
    case "active": return "default" as const;
    case "expiring": return "warning" as const;
    case "expired": return "destructive" as const;
    case "pending": return "secondary" as const;
    default: return "outline" as const;
  }
};

export default function CompanyInsurance() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newPolicy, setNewPolicy] = useState({
    name: "", policy_number: "", trade: "", job_id: "", status: "active",
    issue_date: "", expiration_date: "", description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (currentCompany) { fetchPolicies(); fetchJobs(); }
  }, [currentCompany]);

  const fetchPolicies = async () => {
    if (!currentCompany) return;
    const { data } = await supabase
      .from('company_files' as any)
      .select('*, jobs:job_id(name)')
      .eq('company_id', currentCompany.id)
      .eq('category', 'insurance')
      .order('created_at', { ascending: false });
    if (data) setPolicies(data);
  };

  const fetchJobs = async () => {
    if (!currentCompany) return;
    const { data } = await supabase.from('jobs').select('id, name').eq('company_id', currentCompany.id).eq('is_active', true).order('name');
    if (data) setJobs(data);
  };

  const handleAdd = async () => {
    if (!currentCompany || !user || !selectedFile) {
      toast({ title: 'Error', description: 'Please fill required fields and select a file.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const filePath = `${currentCompany.id}/insurance/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage.from('job-filing-cabinet').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('job-filing-cabinet').getPublicUrl(filePath);

      let filingDocId: string | null = null;
      if (newPolicy.job_id) {
        let { data: folder } = await supabase.from('job_filing_folders').select('id').eq('job_id', newPolicy.job_id).eq('company_id', currentCompany.id).eq('name', 'Insurance').maybeSingle();
        if (!folder) {
          const { data: nf } = await supabase.from('job_filing_folders').insert({ job_id: newPolicy.job_id, company_id: currentCompany.id, name: 'Insurance', sort_order: 4, created_by: user.id }).select('id').single();
          folder = nf;
        }
        if (folder) {
          const { data: fd } = await supabase.from('job_filing_documents').insert({ folder_id: folder.id, job_id: newPolicy.job_id, company_id: currentCompany.id, file_name: selectedFile.name, file_url: urlData.publicUrl, file_size: selectedFile.size, file_type: selectedFile.type, description: newPolicy.description || newPolicy.name, uploaded_by: user.id }).select('id').single();
          if (fd) filingDocId = fd.id;
        }
      }

      await supabase.from('company_files' as any).insert({
        company_id: currentCompany.id, category: 'insurance', name: newPolicy.name, description: newPolicy.description,
        file_name: selectedFile.name, file_url: urlData.publicUrl, file_size: selectedFile.size, file_type: selectedFile.type,
        job_id: newPolicy.job_id || null, filing_document_id: filingDocId, trade: newPolicy.trade || null,
        policy_number: newPolicy.policy_number || null, status: newPolicy.status,
        issue_date: newPolicy.issue_date || null, expiration_date: newPolicy.expiration_date || null, uploaded_by: user.id,
      });

      toast({ title: 'Insurance Policy Added' });
      setShowAddDialog(false);
      setNewPolicy({ name: "", policy_number: "", trade: "", job_id: "", status: "active", issue_date: "", expiration_date: "", description: "" });
      setSelectedFile(null);
      fetchPolicies();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const filtered = policies.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.policy_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.trade || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || p.trade === typeFilter;
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Company Insurance</h1>
          <p className="text-muted-foreground">Manage insurance policies, coverage, and renewals</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-2" />Add Policy</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Active Policies</CardTitle><Shield className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{policies.filter(p => p.status === "active").length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Expiring Soon</CardTitle><AlertTriangle className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">{policies.filter(p => p.status === "expiring").length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Expired</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{policies.filter(p => p.status === "expired").length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Policies</CardTitle><Building className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{policies.length}</div></CardContent></Card>
      </div>

      <Card className="mb-6"><CardContent className="pt-6"><div className="flex flex-col md:flex-row gap-4"><div className="flex-1"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search policies..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div></div><div className="flex gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-56"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{INSURANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="expiring">Expiring</SelectItem><SelectItem value="expired">Expired</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select>
      </div></div></CardContent></Card>

      <Card>
        <CardHeader><CardTitle>Insurance Policies</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No policies found</h3>
              <p className="text-muted-foreground mb-4">{searchTerm || typeFilter !== "all" || statusFilter !== "all" ? "Adjust filters" : "Add your first policy"}</p>
              <Button onClick={() => setShowAddDialog(true)}><Upload className="h-4 w-4 mr-2" />Add Policy</Button>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Policy #</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Job</TableHead><TableHead>Effective</TableHead><TableHead>Expires</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.policy_number || '—'}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.trade || '—'}</TableCell>
                    <TableCell>{p.job_id ? <Button variant="link" className="p-0 h-auto text-xs" onClick={() => navigate(`/jobs/${p.job_id}`)}><ExternalLink className="h-3 w-3 mr-1" />{p.jobs?.name || 'View'}</Button> : <span className="text-sm text-muted-foreground">Company</span>}</TableCell>
                    <TableCell>{p.issue_date ? format(new Date(p.issue_date), 'MM/dd/yyyy') : '—'}</TableCell>
                    <TableCell>{p.expiration_date ? format(new Date(p.expiration_date), 'MM/dd/yyyy') : '—'}</TableCell>
                    <TableCell><Badge variant={getStatusVariant(p.status)}>{p.status}</Badge></TableCell>
                    <TableCell><div className="flex space-x-2"><Button variant="ghost" size="sm" onClick={() => window.open(p.file_url, '_blank')}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="sm" asChild><a href={p.file_url} download={p.file_name}><Download className="h-4 w-4" /></a></Button></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Insurance Policy</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2"><Label>Policy Name *</Label><Input value={newPolicy.name} onChange={(e) => setNewPolicy(p => ({ ...p, name: e.target.value }))} placeholder="General Liability Policy" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Policy Number</Label><Input value={newPolicy.policy_number} onChange={(e) => setNewPolicy(p => ({ ...p, policy_number: e.target.value }))} placeholder="POL-2025-001" /></div>
              <div className="space-y-2"><Label>Type</Label><Select value={newPolicy.trade} onValueChange={(v) => setNewPolicy(p => ({ ...p, trade: v }))}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{INSURANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2">
              <Label>Job (optional)</Label>
              <Select value={newPolicy.job_id} onValueChange={(v) => setNewPolicy(p => ({ ...p, job_id: v }))}>
                <SelectTrigger><SelectValue placeholder="No job (company-level)" /></SelectTrigger>
                <SelectContent><SelectItem value="">No job</SelectItem>{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent>
              </Select>
              {newPolicy.job_id && <p className="text-xs text-muted-foreground">📁 File stored in job's Filing Cabinet → Insurance folder.</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Effective Date</Label><Input type="date" value={newPolicy.issue_date} onChange={(e) => setNewPolicy(p => ({ ...p, issue_date: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Expiration Date</Label><Input type="date" value={newPolicy.expiration_date} onChange={(e) => setNewPolicy(p => ({ ...p, expiration_date: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Status</Label><Select value={newPolicy.status} onValueChange={(v) => setNewPolicy(p => ({ ...p, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="expiring">Expiring</SelectItem><SelectItem value="expired">Expired</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Description</Label><Input value={newPolicy.description} onChange={(e) => setNewPolicy(p => ({ ...p, description: e.target.value }))} placeholder="Optional" /></div>
            <div className="space-y-2">
              <Label>Policy File *</Label>
              <DragDropUpload
                onFileSelect={(file) => setSelectedFile(file)}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                maxSize={20}
                disabled={uploading}
                size="compact"
                title="Drag policy file here"
                dropTitle="Drop policy file here"
                helperText="PDF, image, or document up to 20MB"
              />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button><Button onClick={handleAdd} disabled={uploading || !newPolicy.name || !selectedFile}>{uploading ? 'Uploading...' : 'Add Policy'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
