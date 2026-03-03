import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit, Building, FileText, Mail, Phone, CreditCard, FileIcon, Upload, ExternalLink, Briefcase, AlertTriangle, Eye, EyeOff, Plus, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useActionPermissions } from "@/hooks/useActionPermissions";
import ComplianceDocumentManager from "@/components/ComplianceDocumentManager";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import UrlPdfInlinePreview from "@/components/UrlPdfInlinePreview";

export default function VendorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const { currentCompany } = useCompany();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [vendorJobAccess, setVendorJobAccess] = useState<any[]>([]);
  const [selectedAssignJobId, setSelectedAssignJobId] = useState<string>("");
  const [assigningJob, setAssigningJob] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [complianceDocuments, setComplianceDocuments] = useState<any[]>([]);
  const [subcontracts, setSubcontracts] = useState<any[]>([]);
  const [unmaskedMethods, setUnmaskedMethods] = useState<Set<string>>(new Set());
  const [viewingVoidedCheck, setViewingVoidedCheck] = useState<any>(null);
  const { hasElevatedAccess } = useActionPermissions();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<any>(null);
  const [scopeEditorOpen, setScopeEditorOpen] = useState(false);
  const [scopeEditorLoading, setScopeEditorLoading] = useState(false);
  const [scopeEditorAssignment, setScopeEditorAssignment] = useState<any>(null);
  const [scopeJobFolders, setScopeJobFolders] = useState<any[]>([]);
  const [scopeJobFiles, setScopeJobFiles] = useState<any[]>([]);
  const [scopeSelectedFolderIds, setScopeSelectedFolderIds] = useState<Set<string>>(new Set());
  const [scopeSelectedFileIds, setScopeSelectedFileIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchVendor = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching vendor:', error);
          toast({
            title: "Error",
            description: "Failed to load vendor details",
            variant: "destructive",
          });
        } else {
          setVendor(data);
          if (data) {
            // Fetch related data
            fetchVendorJobs(data.company_id);
            fetchAllCompanyJobs(data.company_id);
            fetchVendorJobAccess(data.id);
            fetchPaymentMethods(data.id);
            fetchComplianceDocuments(data.id);
            fetchSubcontracts(data.id);
            fetchPendingInvite(data.id);
          }
        }
      } catch (err) {
        console.error('Error:', err);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    const fetchPaymentMethods = async (vendorId: string) => {
      try {
        const { data, error } = await supabase
          .from('vendor_payment_methods')
          .select('*')
          .eq('vendor_id', vendorId)
          .order('created_at');

        if (error) throw error;
        setPaymentMethods(data || []);
      } catch (error) {
        console.error('Error loading payment methods:', error);
      }
    };

    const fetchComplianceDocuments = async (vendorId: string) => {
      try {
        const { data, error } = await supabase
          .from('vendor_compliance_documents')
          .select('*')
          .eq('vendor_id', vendorId)
          .order('type');

        if (error) throw error;
        
        // Transform database format to component format
        const transformedDocs = (data || []).map(doc => ({
          id: doc.id,
          type: doc.type,
          required: doc.is_required,
          uploaded: doc.is_uploaded,
          fileName: doc.file_name || undefined,
          uploadDate: doc.uploaded_at || undefined,
          expirationDate: doc.expiration_date || undefined,
          url: doc.file_url || undefined,
          status: doc.is_uploaded ? 'uploaded' : 'missing'
        }));
        
        setComplianceDocuments(transformedDocs);
      } catch (error) {
        console.error('Error loading compliance documents:', error);
      }
    };

    const fetchSubcontracts = async (vendorId: string) => {
      try {
        const { data, error } = await supabase
          .from('subcontracts')
          .select(`
            *,
            jobs:job_id (
              id,
              name,
              client
            )
          `)
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSubcontracts(data || []);
      } catch (error) {
        console.error('Error loading subcontracts:', error);
      }
    };

    const fetchVendorJobs = async (companyId: string) => {
      try {
        // Get unique jobs from invoices, subcontracts, and purchase orders
        const { data: invoiceJobs } = await supabase
          .from('invoices')
          .select(`
            job_id,
            jobs:job_id (
              id,
              name,
              client,
              status
            )
          `)
          .eq('vendor_id', id)
          .not('job_id', 'is', null);

        const { data: subcontractJobs } = await supabase
          .from('subcontracts')
          .select(`
            job_id,
            jobs:job_id (
              id,
              name,
              client,
              status
            )
          `)
          .eq('vendor_id', id)
          .not('job_id', 'is', null);

        const { data: poJobs } = await supabase
          .from('purchase_orders')
          .select(`
            job_id,
            jobs:job_id (
              id,
              name,
              client,
              status
            )
          `)
          .eq('vendor_id', id)
          .not('job_id', 'is', null);

        // Combine and deduplicate jobs
        const allJobs = [
          ...(invoiceJobs || []),
          ...(subcontractJobs || []),
          ...(poJobs || [])
        ];

        const uniqueJobsMap = new Map();
        allJobs.forEach(item => {
          if (item.jobs && !uniqueJobsMap.has(item.jobs.id)) {
            uniqueJobsMap.set(item.jobs.id, item.jobs);
          }
        });

        setJobs(Array.from(uniqueJobsMap.values()));
      } catch (error) {
        console.error('Error loading vendor jobs:', error);
      }
    };

    const fetchAllCompanyJobs = async (companyId: string) => {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, name, status, client')
          .eq('company_id', companyId)
          .order('name', { ascending: true });

        if (error) throw error;
        setAllJobs(data || []);
      } catch (error) {
        console.error('Error loading company jobs:', error);
      }
    };

    const fetchVendorJobAccess = async (vendorId: string) => {
      try {
        const { data, error } = await supabase
          .from('vendor_job_access' as any)
          .select(`
            id,
            vendor_id,
            job_id,
            can_submit_bills,
            can_view_plans,
            can_submit_rfis,
            can_view_team_directory,
            can_upload_compliance_docs,
            can_negotiate_contracts,
            can_submit_sov_proposals,
            can_upload_signed_contracts,
            can_access_filing_cabinet,
            filing_cabinet_access_level,
            can_download_filing_cabinet_files,
            allowed_filing_cabinet_folder_ids,
            allowed_filing_cabinet_file_ids,
            jobs:job_id(id, name, status)
          `)
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setVendorJobAccess((data as any[]) || []);
      } catch (error) {
        console.error('Error loading vendor job access:', error);
      }
    };

    const fetchPendingInvite = async (vendorId: string) => {
      try {
        const { data, error } = await supabase
          .from('vendor_invitations')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('invited_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setPendingInvite(data);
        }
      } catch (error) {
        console.error('Error loading pending invite:', error);
      }
    };

    fetchVendor();
  }, [id, toast]);

  const handleAssignJob = async () => {
    if (!vendor?.id || !selectedAssignJobId || !user?.id) return;
    try {
      setAssigningJob(true);
      const { error } = await supabase
        .from('vendor_job_access' as any)
        .upsert({
          vendor_id: vendor.id,
          job_id: selectedAssignJobId,
          can_submit_bills: true,
          can_view_plans: false,
          can_submit_rfis: false,
          can_view_team_directory: true,
          can_upload_compliance_docs: true,
          can_negotiate_contracts: true,
          can_submit_sov_proposals: true,
          can_upload_signed_contracts: true,
          can_access_filing_cabinet: false,
          filing_cabinet_access_level: 'view_only',
          can_download_filing_cabinet_files: true,
          created_by: user.id,
        }, {
          onConflict: 'vendor_id,job_id',
        });

      if (error) throw error;
      setSelectedAssignJobId('');
      const { data } = await supabase
        .from('vendor_job_access' as any)
        .select(`
          id,
          vendor_id,
          job_id,
          can_submit_bills,
          can_view_plans,
          can_submit_rfis,
          can_view_team_directory,
          can_upload_compliance_docs,
          can_negotiate_contracts,
          can_submit_sov_proposals,
          can_upload_signed_contracts,
          can_access_filing_cabinet,
          filing_cabinet_access_level,
          can_download_filing_cabinet_files,
          allowed_filing_cabinet_folder_ids,
          allowed_filing_cabinet_file_ids,
          jobs:job_id(id, name, status)
        `)
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: true });
      setVendorJobAccess((data as any[]) || []);
      toast({
        title: "Job assigned",
        description: "Vendor assignment and default access saved.",
      });
    } catch (error) {
      console.error('Error assigning vendor job:', error);
      toast({
        title: "Error",
        description: "Failed to assign vendor to job.",
        variant: "destructive",
      });
    } finally {
      setAssigningJob(false);
    }
  };

  const handleUpdateVendorJobAccess = async (assignmentId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('vendor_job_access' as any)
        .update({ [field]: value })
        .eq('id', assignmentId);
      if (error) throw error;
      setVendorJobAccess(prev => prev.map((entry) => (
        entry.id === assignmentId ? { ...entry, [field]: value } : entry
      )));
    } catch (error) {
      console.error('Error updating vendor job access:', error);
      toast({
        title: "Error",
        description: "Failed to update vendor job access.",
        variant: "destructive",
      });
    }
  };

  const openScopeEditor = async (assignment: any) => {
    if (!assignment?.job_id || !vendor?.company_id) return;
    setScopeEditorAssignment(assignment);
    setScopeEditorOpen(true);
    setScopeEditorLoading(true);
    try {
      const [{ data: folders }, { data: files }] = await Promise.all([
        supabase
          .from('job_folders')
          .select('id,name')
          .eq('job_id', assignment.job_id)
          .eq('company_id', vendor.company_id)
          .order('name', { ascending: true }),
        supabase
          .from('job_files')
          .select('id,file_name,folder_id')
          .eq('job_id', assignment.job_id)
          .eq('company_id', vendor.company_id)
          .order('file_name', { ascending: true }),
      ]);

      setScopeJobFolders(folders || []);
      setScopeJobFiles(files || []);
      setScopeSelectedFolderIds(new Set(assignment.allowed_filing_cabinet_folder_ids || []));
      setScopeSelectedFileIds(new Set(assignment.allowed_filing_cabinet_file_ids || []));
    } catch (error) {
      console.error('Error loading filing cabinet scope options:', error);
      toast({
        title: "Error",
        description: "Failed to load folder/file scope options.",
        variant: "destructive",
      });
    } finally {
      setScopeEditorLoading(false);
    }
  };

  const saveScopeEditor = async () => {
    if (!scopeEditorAssignment?.id) return;
    try {
      const selectedFolderIds = Array.from(scopeSelectedFolderIds);
      const selectedFileIds = Array.from(scopeSelectedFileIds);
      const { error } = await supabase
        .from('vendor_job_access' as any)
        .update({
          allowed_filing_cabinet_folder_ids: selectedFolderIds.length > 0 ? selectedFolderIds : null,
          allowed_filing_cabinet_file_ids: selectedFileIds.length > 0 ? selectedFileIds : null,
        })
        .eq('id', scopeEditorAssignment.id);

      if (error) throw error;
      setVendorJobAccess((prev) =>
        prev.map((entry) =>
          entry.id === scopeEditorAssignment.id
            ? {
                ...entry,
                allowed_filing_cabinet_folder_ids: selectedFolderIds.length > 0 ? selectedFolderIds : null,
                allowed_filing_cabinet_file_ids: selectedFileIds.length > 0 ? selectedFileIds : null,
              }
            : entry
        )
      );
      toast({
        title: "Scope updated",
        description: "Vendor filing-cabinet scope was saved.",
      });
      setScopeEditorOpen(false);
    } catch (error) {
      console.error('Error saving filing cabinet scope:', error);
      toast({
        title: "Error",
        description: "Failed to save filing-cabinet scope.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveVendorJobAccess = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('vendor_job_access' as any)
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
      setVendorJobAccess(prev => prev.filter((entry) => entry.id !== assignmentId));
      toast({
        title: "Assignment removed",
        description: "Vendor was removed from the job.",
      });
    } catch (error) {
      console.error('Error removing vendor job access:', error);
      toast({
        title: "Error",
        description: "Failed to remove job assignment.",
        variant: "destructive",
      });
    }
  };

  const canViewSensitiveData = hasElevatedAccess();

  const toggleUnmask = (methodId: string) => {
    if (!canViewSensitiveData) return;
    
    setUnmaskedMethods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(methodId)) {
        newSet.delete(methodId);
      } else {
        newSet.add(methodId);
      }
      return newSet;
    });
  };

  const handleSendInvite = async () => {
    if (!vendor?.email) {
      toast({
        title: "No email",
        description: "This vendor does not have an email address configured",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingInvite(true);
      
      const { data, error } = await supabase.functions.invoke('send-vendor-invite', {
        body: {
          vendorId: vendor.id,
          vendorName: vendor.name,
          vendorEmail: vendor.email,
          companyId: currentCompany?.id,
          companyName: currentCompany?.name,
          invitedBy: user?.id,
          baseUrl: window.location.origin
        }
      });

      if (error) throw error;
      
      if (data?.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Invitation Sent",
        description: `An invitation has been sent to ${vendor.email}`,
      });
      
      setInviteDialogOpen(false);
      
      // Refresh pending invite status
      const { data: inviteData } = await supabase
        .from('vendor_invitations')
        .select('*')
        .eq('vendor_id', vendor.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('invited_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (inviteData) {
        setPendingInvite(inviteData);
      }
    } catch (err: any) {
      console.error('Error sending invite:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const maskAccountNumber = (accountNumber: string, methodId: string) => {
    if (!accountNumber) return '****';
    if (unmaskedMethods.has(methodId)) return accountNumber;
    return `****${accountNumber.slice(-4)}`;
  };

  const maskRoutingNumber = (routingNumber: string, methodId: string) => {
    if (!routingNumber) return '****';
    if (unmaskedMethods.has(methodId)) return routingNumber;
    return `****${routingNumber.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground"><span className="loading-dots">Loading vendor details</span></div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vendor Not Found</h1>
          </div>
        </div>
        
        <Card>
          <CardContent className="p-8 text-center">
            <Building className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">No Vendor Available</h2>
            <p className="text-muted-foreground mb-4">
              This vendor doesn&apos;t exist or you don&apos;t have permission to view it.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate("/vendors")}>
                Return to Vendors
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            {vendor.logo_url ? (
              <img 
                src={vendor.logo_url} 
                alt={`${vendor.name} logo`}
                className="h-12 w-12 object-contain rounded-lg border"
              />
            ) : (
              <Building className="h-12 w-12 p-2 bg-muted rounded-lg text-muted-foreground" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{vendor.name}</h1>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {vendor.email && (
            <Button 
              variant="outline" 
              onClick={() => setInviteDialogOpen(true)}
              disabled={!!pendingInvite}
            >
              <Send className="h-4 w-4 mr-2" />
              {pendingInvite ? 'Invitation Pending' : 'Invite to Portal'}
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(`/vendors/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Vendor
          </Button>
        </div>
      </div>

      {/* Invite Vendor Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Vendor to Portal</DialogTitle>
            <DialogDescription>
              Send an invitation to {vendor.name} to create their own vendor portal account. 
              They will be able to view projects, submit bids, and manage their documents.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">Invitation will be sent to:</p>
            <p className="font-medium">{vendor.email}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendInvite} disabled={sendingInvite}>
              {sendingInvite ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Scrollable Content */}
      <div className="space-y-8">
        {/* Overview Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {vendor.contact_person && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
                    <p className="text-foreground">{vendor.contact_person}</p>
                  </div>
                )}

                {(vendor.address || vendor.city || vendor.state || vendor.zip_code) && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <div className="space-y-1">
                      {vendor.address && <p className="text-foreground">{vendor.address}</p>}
                      {(vendor.city || vendor.state || vendor.zip_code) && (
                        <p className="text-foreground">
                          {[vendor.city, vendor.state, vendor.zip_code].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Contact Information */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Information</h4>
                  <div className="space-y-3">
                    {vendor.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${vendor.email}`} className="text-primary hover:underline">
                          {vendor.email}
                        </a>
                      </div>
                    )}
                    
                    {vendor.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${vendor.phone}`} className="text-primary hover:underline">
                          {vendor.phone}
                        </a>
                      </div>
                    )}

                    {!vendor.email && !vendor.phone && (
                      <p className="text-muted-foreground text-sm">No contact information available</p>
                    )}
                  </div>
                </div>

                {/* Business Information */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Business Information</h4>
                  <div className="space-y-3">
                    {vendor.tax_id && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Tax ID</label>
                        <p className="text-foreground">{vendor.tax_id}</p>
                      </div>
                    )}

                    {vendor.customer_number && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Customer Number</label>
                        <p className="text-foreground">{vendor.customer_number}</p>
                      </div>
                    )}
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Payment Terms</label>
                      <p className="text-foreground">
                        {vendor.payment_terms === 'asap' ? 'ASAP' : 
                         vendor.payment_terms === '15' ? 'Net 15' :
                         vendor.payment_terms === '30' ? 'Net 30' : 
                         `${vendor.payment_terms} days`}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div>
                        <Badge variant={vendor.is_active ? "default" : "secondary"}>
                          {vendor.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {vendor.notes && (
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-muted-foreground">Notes</label>
                    <p className="text-foreground">{vendor.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/invoices', { state: { vendorFilter: vendor.name } })}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Invoices
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/payables/payment-history', { state: { vendorFilter: vendor.name } })}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment History
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate(`/vendors/${id}/edit`, { state: { scrollToDocuments: true } })}
                >
                  <FileIcon className="h-4 w-4 mr-2" />
                  View Documents
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Payment Methods Section - Only show if there are payment methods */}
        {paymentMethods.length > 0 && (
          <div id="payment-methods">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Methods
                </CardTitle>
                <Badge variant="outline" className="text-xs">View Only</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {paymentMethods.map((method, index) => {
                    const isUnmasked = unmaskedMethods.has(method.id);
                    const isSensitiveType = method.type === 'ach' || method.type === 'wire';
                    
                    return (
                      <div key={method.id}>
                        {index > 0 && <hr className="border-muted" />}
                        <Card className={`border-dashed ${isSensitiveType ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20' : ''}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{method.bank_name || 'Payment Method'}</h4>
                                {isSensitiveType && (
                                  <Badge variant="outline" className="text-xs bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900 dark:border-amber-700 dark:text-amber-200">
                                    Encrypted
                                  </Badge>
                                )}
                              </div>
                              
                               {/* Account Information */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-muted-foreground">Type:</span>
                                  <Badge variant="outline">{method.type.toUpperCase()}</Badge>
                                </div>
                                
                                {method.account_number && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Account:</span>
                                    <span className="text-sm font-mono">
                                      {maskAccountNumber(method.account_number, method.id)}
                                    </span>
                                    {canViewSensitiveData && isSensitiveType && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleUnmask(method.id)}
                                        className="h-6 w-6 p-0"
                                      >
                                        {isUnmasked ? (
                                          <EyeOff className="h-3 w-3" />
                                        ) : (
                                          <Eye className="h-3 w-3" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                )}
                                
                                {method.routing_number && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Routing:</span>
                                    <span className="text-sm font-mono">
                                      {maskRoutingNumber(method.routing_number, method.id)}
                                    </span>
                                    {canViewSensitiveData && isSensitiveType && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleUnmask(method.id)}
                                        className="h-6 w-6 p-0"
                                      >
                                        {isUnmasked ? (
                                          <EyeOff className="h-3 w-3" />
                                        ) : (
                                          <Eye className="h-3 w-3" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                )}
                                
                                {method.account_type && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Account Type:</span>
                                    <span className="text-sm">{method.account_type}</span>
                                  </div>
                                )}
                                
                                {method.check_delivery && method.type === 'check' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Delivery:</span>
                                    <span className="text-sm">
                                      {method.check_delivery === 'office_pickup' ? 'Office Pickup' : 'Mail'}
                                    </span>
                                  </div>
                                )}
                                
                                {method.pickup_location && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Pickup Location:</span>
                                    <span className="text-sm">{method.pickup_location}</span>
                                  </div>
                                )}
                                
                                {method.is_primary && (
                                  <Badge variant="default" className="text-xs">Primary</Badge>
                                )}
                                
                                {/* View Voided Check Button */}
                                {canViewSensitiveData && isSensitiveType && method.voided_check_url && (
                                  <div className="mt-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setViewingVoidedCheck(method)}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      View Voided Check
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                         </CardContent>
                       </Card>
                       </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Compliance Documents Section */}
        <div id="compliance-documents">
          <ComplianceDocumentManager
            vendorId={vendor.id}
            documents={complianceDocuments}
            onDocumentsChange={setComplianceDocuments}
            isEditMode={false}
          />
        </div>

        {/* Jobs Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Vendor Job Assignments & Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedAssignJobId}
                onChange={(e) => setSelectedAssignJobId(e.target.value)}
              >
                <option value="">Select a job to assign...</option>
                {allJobs
                  .filter((job) => !vendorJobAccess.some((entry) => entry.job_id === job.id))
                  .map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
              </select>
              <Button onClick={handleAssignJob} disabled={!selectedAssignJobId || assigningJob}>
                {assigningJob ? 'Assigning...' : 'Assign Job'}
              </Button>
            </div>

            {vendorJobAccess.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-1">No Assigned Jobs</h3>
                <p className="text-sm text-muted-foreground">
                  Assign at least one job to allow vendor portal access by project.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {vendorJobAccess.map((assignment) => (
                  <Card key={assignment.id} className="border-dashed">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{assignment.jobs?.name || 'Unknown Job'}</p>
                          <p className="text-xs text-muted-foreground">Job-level vendor portal access</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {assignment.jobs?.status && (
                            <Badge variant="outline">{assignment.jobs.status}</Badge>
                          )}
                          <Button variant="outline" size="sm" onClick={() => navigate(`/jobs/${assignment.job_id}`)}>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open Job
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleRemoveVendorJobAccess(assignment.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 border-t pt-3">
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>Submit Bills</Label>
                          <Switch
                            checked={!!assignment.can_submit_bills}
                            onCheckedChange={(checked) => handleUpdateVendorJobAccess(assignment.id, 'can_submit_bills', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>View Plans</Label>
                          <Switch
                            checked={!!assignment.can_view_plans}
                            onCheckedChange={(checked) => handleUpdateVendorJobAccess(assignment.id, 'can_view_plans', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>Submit RFIs</Label>
                          <Switch
                            checked={!!assignment.can_submit_rfis}
                            onCheckedChange={(checked) => handleUpdateVendorJobAccess(assignment.id, 'can_submit_rfis', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>Team Directory</Label>
                          <Switch
                            checked={!!assignment.can_view_team_directory}
                            onCheckedChange={(checked) => handleUpdateVendorJobAccess(assignment.id, 'can_view_team_directory', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>Upload Compliance Docs</Label>
                          <Switch
                            checked={!!assignment.can_upload_compliance_docs}
                            onCheckedChange={(checked) => handleUpdateVendorJobAccess(assignment.id, 'can_upload_compliance_docs', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>Contract Negotiation</Label>
                          <Switch
                            checked={!!assignment.can_negotiate_contracts}
                            onCheckedChange={(checked) => handleUpdateVendorJobAccess(assignment.id, 'can_negotiate_contracts', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>SOV Proposals</Label>
                          <Switch
                            checked={!!assignment.can_submit_sov_proposals}
                            onCheckedChange={(checked) => handleUpdateVendorJobAccess(assignment.id, 'can_submit_sov_proposals', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>Upload Signed Contracts</Label>
                          <Switch
                            checked={!!assignment.can_upload_signed_contracts}
                            onCheckedChange={(checked) => handleUpdateVendorJobAccess(assignment.id, 'can_upload_signed_contracts', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>Filing Cabinet Access</Label>
                          <Switch
                            checked={!!assignment.can_access_filing_cabinet}
                            onCheckedChange={(checked) => handleUpdateVendorJobAccess(assignment.id, 'can_access_filing_cabinet', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>Filing Access Level</Label>
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={assignment.filing_cabinet_access_level || 'view_only'}
                            disabled={!assignment.can_access_filing_cabinet}
                            onChange={(e) => handleUpdateVendorJobAccess(assignment.id, 'filing_cabinet_access_level', e.target.value)}
                          >
                            <option value="view_only">View Only</option>
                            <option value="read_write">Read + Write</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between rounded border p-2">
                          <Label>Allow File Downloads</Label>
                          <Switch
                            checked={!!assignment.can_download_filing_cabinet_files}
                            disabled={!assignment.can_access_filing_cabinet}
                            onCheckedChange={(checked) => handleUpdateVendorJobAccess(assignment.id, 'can_download_filing_cabinet_files', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded border p-2 md:col-span-2">
                          <div className="space-y-1">
                            <Label>Scope Restrictions</Label>
                            <p className="text-xs text-muted-foreground">
                              {assignment.allowed_filing_cabinet_folder_ids?.length || assignment.allowed_filing_cabinet_file_ids?.length
                                ? `Restricted (${assignment.allowed_filing_cabinet_folder_ids?.length || 0} folders, ${assignment.allowed_filing_cabinet_file_ids?.length || 0} files)`
                                : 'All folders and files in this job'}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!assignment.can_access_filing_cabinet}
                            onClick={() => openScopeEditor(assignment)}
                          >
                            Configure Scope
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {jobs.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Historical associated jobs (from invoices/subcontracts/POs): {jobs.length}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Subcontracts Section - Only show for contractors and design professionals */}
        {(vendor.vendor_type === 'contractor' || vendor.vendor_type === 'design_professional') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Subcontracts
              </CardTitle>
              <Button 
                onClick={() => navigate(`/subcontracts/add?vendorId=${vendor.id}`)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Subcontract
              </Button>
            </CardHeader>
            <CardContent>
            {subcontracts.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Subcontracts Found</h3>
                <p className="text-muted-foreground mb-4">No subcontracts are currently associated with this vendor</p>
                <Button 
                  onClick={() => navigate(`/subcontracts/add?vendorId=${vendor.id}`)}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Subcontract
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {subcontracts.map((subcontract) => (
                  <Card 
                    key={subcontract.id} 
                    className="border-dashed hover-lift cursor-pointer"
                    onClick={() => navigate(`/jobs/${subcontract.job_id}`)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{subcontract.name}</h4>
                            <Badge variant={
                              subcontract.status === 'active' ? 'default' :
                              subcontract.status === 'completed' ? 'success' : 'secondary'
                            }>
                              {subcontract.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Job: {subcontract.jobs?.name}
                            {subcontract.jobs?.client && ` • Client: ${subcontract.jobs.client}`}
                          </p>
                          {subcontract.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {subcontract.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <div>
                              <span className="text-xs text-muted-foreground">Contract Amount:</span>
                              <span className="text-sm font-medium ml-1">
                                ${parseFloat(subcontract.contract_amount).toLocaleString()}
                              </span>
                            </div>
                            {subcontract.start_date && (
                              <div>
                                <span className="text-xs text-muted-foreground">Start Date:</span>
                                <span className="text-sm ml-1">{subcontract.start_date}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {subcontract.contract_file_url && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(subcontract.contract_file_url, '_blank');
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View Contract
                            </Button>
                          )}
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Purchase Orders Section - Only show for suppliers */}
        {vendor.vendor_type === 'supplier' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Purchase Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Purchase Orders</h3>
                <p className="text-sm mb-4">This vendor has no purchase orders on record.</p>
                <Button variant="outline" disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Purchase Order
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Voided Check Modal */}
      <Dialog open={!!viewingVoidedCheck} onOpenChange={() => setViewingVoidedCheck(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Voided Check - {viewingVoidedCheck?.bank_name}</DialogTitle>
            <DialogDescription>
              View the voided check document for this payment method
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            {viewingVoidedCheck?.voided_check_url && (
              <>
                {viewingVoidedCheck.voided_check_url.toLowerCase().endsWith('.pdf') ? (
                  <UrlPdfInlinePreview 
                    url={viewingVoidedCheck.voided_check_url}
                    className="w-full"
                  />
                ) : (
                  <img 
                    src={viewingVoidedCheck.voided_check_url} 
                    alt="Voided Check" 
                    className="w-full h-auto"
                  />
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={scopeEditorOpen} onOpenChange={setScopeEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Configure Filing Cabinet Scope</DialogTitle>
            <DialogDescription>
              Limit this vendor's access to specific folders/files for {scopeEditorAssignment?.jobs?.name || 'this job'}.
              Leave all unchecked to allow all.
            </DialogDescription>
          </DialogHeader>
          {scopeEditorLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground"><span className="loading-dots">Loading scope options</span></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded border">
                <div className="px-3 py-2 border-b text-sm font-medium">Allowed Folders</div>
                <ScrollArea className="h-64">
                  <div className="p-3 space-y-2">
                    {scopeJobFolders.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No folders found for this job.</p>
                    ) : (
                      scopeJobFolders.map((folder) => (
                        <label key={folder.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={scopeSelectedFolderIds.has(folder.id)}
                            onChange={(e) => {
                              setScopeSelectedFolderIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(folder.id);
                                else next.delete(folder.id);
                                return next;
                              });
                            }}
                          />
                          <span>{folder.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
              <div className="rounded border">
                <div className="px-3 py-2 border-b text-sm font-medium">Allowed Files</div>
                <ScrollArea className="h-64">
                  <div className="p-3 space-y-2">
                    {scopeJobFiles.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No files found for this job.</p>
                    ) : (
                      scopeJobFiles.map((file) => (
                        <label key={file.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={scopeSelectedFileIds.has(file.id)}
                            onChange={(e) => {
                              setScopeSelectedFileIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(file.id);
                                else next.delete(file.id);
                                return next;
                              });
                            }}
                          />
                          <span className="truncate">{file.file_name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScopeEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveScopeEditor} disabled={scopeEditorLoading}>
              Save Scope
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
