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
  FileCheck, Upload, Search, Filter, Eye, Download,
  Calendar, AlertTriangle, Plus, MapPin, Hash, ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import DragDropUpload from "@/components/DragDropUpload";

const TRADES = [
  "General", "Electrical", "Plumbing", "HVAC", "Mechanical",
  "Structural", "Roofing", "Fire Protection", "Demolition",
  "Excavation", "Concrete", "Masonry", "Steel", "Framing",
  "Drywall", "Painting", "Flooring", "Landscaping", "Paving",
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

export default function CompanyPermits() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [permits, setPermits] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Add permit form state
  const [newPermit, setNewPermit] = useState({
    name: "",
    permit_number: "",
    trade: "",
    job_id: "",
    status: "active",
    issue_date: "",
    expiration_date: "",
    cost: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (currentCompany) {
      fetchPermits();
      fetchJobs();
    }
  }, [currentCompany]);

  const fetchPermits = async () => {
    if (!currentCompany) return;
    const { data, error } = await supabase
      .from('company_files' as any)
      .select('*, jobs:job_id(name)')
      .eq('company_id', currentCompany.id)
      .eq('category', 'permit')
      .order('created_at', { ascending: false });
    if (!error && data) setPermits(data);
  };

  const fetchJobs = async () => {
    if (!currentCompany) return;
    const { data } = await supabase
      .from('jobs')
      .select('id, name')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true)
      .order('name');
    if (data) setJobs(data);
  };

  const handleAddPermit = async () => {
    if (!currentCompany || !user || !selectedFile) {
      toast({ title: 'Error', description: 'Please fill in all required fields and select a file.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${currentCompany.id}/permits/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('job-filing-cabinet')
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('job-filing-cabinet')
        .getPublicUrl(filePath);
      const fileUrl = urlData.publicUrl;

      let filingDocId: string | null = null;

      // If job is selected, also create a filing document in the job's Permits folder
      if (newPermit.job_id) {
        // Find or create Permits folder for this job
        let { data: folder } = await supabase
          .from('job_filing_folders')
          .select('id')
          .eq('job_id', newPermit.job_id)
          .eq('company_id', currentCompany.id)
          .eq('name', 'Permits')
          .maybeSingle();

        if (!folder) {
          const { data: newFolder } = await supabase
            .from('job_filing_folders')
            .insert({
              job_id: newPermit.job_id,
              company_id: currentCompany.id,
              name: 'Permits',
              sort_order: 2,
              created_by: user.id,
            })
            .select('id')
            .single();
          folder = newFolder;
        }

        if (folder) {
          const { data: filingDoc } = await supabase
            .from('job_filing_documents')
            .insert({
              folder_id: folder.id,
              job_id: newPermit.job_id,
              company_id: currentCompany.id,
              file_name: selectedFile.name,
              file_url: fileUrl,
              file_size: selectedFile.size,
              file_type: selectedFile.type,
              description: newPermit.description || `${newPermit.trade} Permit - ${newPermit.permit_number}`,
              uploaded_by: user.id,
            })
            .select('id')
            .single();
          if (filingDoc) filingDocId = filingDoc.id;
        }
      }

      // Create the company file record (linked to filing doc)
      const { error: insertError } = await supabase
        .from('company_files' as any)
        .insert({
          company_id: currentCompany.id,
          category: 'permit',
          name: newPermit.name || selectedFile.name,
          description: newPermit.description,
          file_name: selectedFile.name,
          file_url: fileUrl,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          job_id: newPermit.job_id || null,
          filing_document_id: filingDocId,
          trade: newPermit.trade || null,
          permit_number: newPermit.permit_number || null,
          status: newPermit.status,
          issue_date: newPermit.issue_date || null,
          expiration_date: newPermit.expiration_date || null,
          contract_value: newPermit.cost ? parseFloat(newPermit.cost) : null,
          uploaded_by: user.id,
        });
      if (insertError) throw insertError;

      toast({ title: 'Permit Added', description: 'The permit has been added successfully.' });
      setShowAddDialog(false);
      setNewPermit({ name: "", permit_number: "", trade: "", job_id: "", status: "active", issue_date: "", expiration_date: "", cost: "", description: "" });
      setSelectedFile(null);
      fetchPermits();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const filteredPermits = permits.filter(permit => {
    const matchesSearch = (permit.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (permit.permit_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (permit.trade || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || permit.trade === typeFilter;
    const matchesStatus = statusFilter === "all" || permit.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const activePermits = permits.filter(p => p.status === "active").length;
  const expiringPermits = permits.filter(p => p.status === "expiring").length;
  const expiredPermits = permits.filter(p => p.status === "expired").length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Company Permits</h1>
          <p className="text-muted-foreground">Track building permits, licenses, and regulatory approvals</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Permit
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Permits</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePermits}</div>
            <p className="text-xs text-muted-foreground">Currently valid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringPermits}</div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredPermits}</div>
            <p className="text-xs text-muted-foreground">Need renewal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Permits</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permits.length}</div>
            <p className="text-xs text-muted-foreground">All permits</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search permits..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Trade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trades</SelectItem>
                  {TRADES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring">Expiring</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permits Table */}
      <Card>
        <CardHeader>
          <CardTitle>Permit Registry</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPermits.length === 0 ? (
            <div className="text-center py-8">
              <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No permits found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || typeFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Start by adding your first permit"}
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Add Permit
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permit #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPermits.map((permit) => (
                  <TableRow key={permit.id}>
                    <TableCell className="font-medium">{permit.permit_number || '—'}</TableCell>
                    <TableCell>{permit.name}</TableCell>
                    <TableCell>{permit.trade || '—'}</TableCell>
                    <TableCell>
                      {permit.job_id ? (
                        <Button
                          variant="link"
                          className="p-0 h-auto text-xs"
                          onClick={() => navigate(`/jobs/${permit.job_id}`)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {permit.jobs?.name || 'View Job'}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">Company-level</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {permit.issue_date ? (
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                          {format(new Date(permit.issue_date), 'MM/dd/yyyy')}
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {permit.expiration_date ? (
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                          {format(new Date(permit.expiration_date), 'MM/dd/yyyy')}
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(permit.status)}>
                        {permit.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => window.open(permit.file_url, '_blank')}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={permit.file_url} download={permit.file_name}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Permit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Permit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Permit Name *</Label>
              <Input value={newPermit.name} onChange={(e) => setNewPermit(p => ({ ...p, name: e.target.value }))} placeholder="Building Permit #123" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Permit Number</Label>
                <Input value={newPermit.permit_number} onChange={(e) => setNewPermit(p => ({ ...p, permit_number: e.target.value }))} placeholder="BP-2025-001" />
              </div>
              <div className="space-y-2">
                <Label>Trade *</Label>
                <Select value={newPermit.trade} onValueChange={(v) => setNewPermit(p => ({ ...p, trade: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger>
                  <SelectContent>
                    {TRADES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Job (optional — links to job filing cabinet)</Label>
              <Select value={newPermit.job_id} onValueChange={(v) => setNewPermit(p => ({ ...p, job_id: v }))}>
                <SelectTrigger><SelectValue placeholder="No job (company-level)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No job (company-level)</SelectItem>
                  {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {newPermit.job_id && (
                <p className="text-xs text-muted-foreground">
                  📁 File will be stored in the job's Filing Cabinet → Permits folder and linked here.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input type="date" value={newPermit.issue_date} onChange={(e) => setNewPermit(p => ({ ...p, issue_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Expiration Date</Label>
                <Input type="date" value={newPermit.expiration_date} onChange={(e) => setNewPermit(p => ({ ...p, expiration_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newPermit.status} onValueChange={(v) => setNewPermit(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expiring">Expiring</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cost</Label>
                <Input type="number" value={newPermit.cost} onChange={(e) => setNewPermit(p => ({ ...p, cost: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={newPermit.description} onChange={(e) => setNewPermit(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
            </div>
            <div className="space-y-2">
              <Label>Permit File *</Label>
              <DragDropUpload
                onFileSelect={(file) => setSelectedFile(file)}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                maxSize={20}
                disabled={uploading}
                size="compact"
                title="Drag permit file here"
                dropTitle="Drop permit file here"
                helperText="PDF, image, or document up to 20MB"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddPermit} disabled={uploading || !newPermit.name || !selectedFile}>
              {uploading ? 'Uploading...' : 'Add Permit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
