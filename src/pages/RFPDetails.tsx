import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit, FileText, Users, BarChart3, Plus, Building2, Calendar, Send, Trash2, Mail, Search, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';
import { canAccessJobIds } from '@/utils/jobAccess';
import { getStoragePathForDb } from '@/utils/storageUtils';
interface RFP {
  id: string;
  rfp_number: string;
  title: string;
  description: string | null;
  scope_of_work: string | null;
  logistics_details: string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  job_id: string | null;
  created_at: string;
  job?: {
    name: string;
  };
}
interface RfpAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_at: string;
}

interface Bid {
  id: string;
  bid_amount: number;
  proposed_timeline: string | null;
  notes: string | null;
  status: string;
  submitted_at: string;
  version_number?: number | null;
  bid_contact_name?: string | null;
  bid_contact_email?: string | null;
  bid_contact_phone?: string | null;
  shipping_included?: boolean | null;
  shipping_amount?: number | null;
  taxes_included?: boolean | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  vendor: {
    id: string;
    name: string;
  };
  total_score?: number;
}

interface ScoringCriterion {
  id: string;
  criterion_name: string;
  description: string | null;
  weight: number;
  max_score: number;
  sort_order: number;
}

interface Vendor {
  id: string;
  name: string;
  email: string | null;
}

interface InvitedVendor {
  id: string;
  vendor_id: string;
  invited_at: string;
  response_status: string | null;
  vendor: Vendor;
}

export default function RFPDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [attachments, setAttachments] = useState<RfpAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDrawings, setUploadingDrawings] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invitedVendors, setInvitedVendors] = useState<InvitedVendor[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const drawingsInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawingsDragOver, setIsDrawingsDragOver] = useState(false);

  const getFinalBidTotal = (bid: Bid) => {
    const base = Number(bid.bid_amount || 0);
    const discount = Number(bid.discount_amount || 0);
    const taxableBase = Math.max(0, base - discount);
    const shipping = bid.shipping_included ? 0 : Number(bid.shipping_amount || 0);
    const taxRatePercent = bid.taxes_included ? 0 : Number(bid.tax_amount || 0);
    const tax = taxableBase * (Math.max(0, taxRatePercent) / 100);
    return Math.max(0, taxableBase + shipping + tax);
  };

  useEffect(() => {
    if (id && currentCompany?.id && !websiteJobAccessLoading) {
      loadRFP();
    }
  }, [id, currentCompany?.id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(',')]);

  const loadRFP = async () => {
    try {
      const { data, error } = await supabase
        .from('rfps')
        .select(`
          *,
          job:jobs(name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (!canAccessJobIds([data.job_id], isPrivileged, allowedJobIds)) {
        toast({
          title: 'Access denied',
          description: 'You do not have access to this job.',
          variant: 'destructive'
        });
        navigate('/construction/rfps');
        return;
      }
      setRfp(data as any);
      await Promise.all([loadBids(), loadCriteria(), loadVendors(), loadInvitedVendors(), loadAttachments()]);
    } catch (error) {
      console.error('Error loading RFP:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RFP details',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBids = async () => {
    try {
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          vendor:vendors(id, name)
        `)
        .eq('rfp_id', id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setBids(data || []);
    } catch (error) {
      console.error('Error loading bids:', error);
    }
  };

  const loadCriteria = async () => {
    try {
      const { data, error } = await supabase
        .from('bid_scoring_criteria')
        .select('*')
        .eq('rfp_id', id)
        .order('sort_order');

      if (error) throw error;
      setCriteria(data || []);
    } catch (error) {
      console.error('Error loading criteria:', error);
    }
  };

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, email')
        .eq('company_id', currentCompany!.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadInvitedVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('rfp_invited_vendors')
        .select(`
          id,
          vendor_id,
          invited_at,
          response_status,
          vendor:vendors(id, name, email)
        `)
        .eq('rfp_id', id);

      if (error) throw error;
      setInvitedVendors(data || []);
    } catch (error) {
      console.error('Error loading invited vendors:', error);
    }
  };

  const loadAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('rfp_attachments')
        .select('id, file_name, file_url, file_size, file_type, uploaded_at')
        .eq('rfp_id', id)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      setAttachments((data || []) as any);
    } catch (error) {
      console.error('Error loading RFP attachments:', error);
    }
  };

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStoragePathFromUrl = (url: string): string | null => {
    if (!url) return null;
    if (!url.startsWith('http')) return url;
    const marker = '/storage/v1/object/public/company-files/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.substring(idx + marker.length));
  };

  const handleUploadDrawingFiles = async (files: File[] | FileList) => {
    const uploadFiles = Array.from(files || []);
    if (!uploadFiles.length || !currentCompany?.id || !user?.id || !id) return;

    try {
      setUploadingDrawings(true);
      const rows = [];
      for (const file of uploadFiles) {
        const storagePath = `rfp-drawings/${currentCompany.id}/${id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('company-files')
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        rows.push({
          rfp_id: id,
          company_id: currentCompany.id,
          file_name: file.name,
          file_url: getStoragePathForDb('company-files', storagePath),
          file_size: file.size,
          file_type: file.type || null,
          uploaded_by: user.id,
        });
      }

      const { error: insertError } = await supabase.from('rfp_attachments').insert(rows);
      if (insertError) throw insertError;

      toast({
        title: 'Drawings uploaded',
        description: `${uploadFiles.length} drawing file(s) uploaded`,
      });
      await loadAttachments();
    } catch (error: any) {
      console.error('Error uploading drawings:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload drawings',
        variant: 'destructive'
      });
    } finally {
      setUploadingDrawings(false);
    }
  };

  const handleUploadDrawings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !currentCompany?.id || !user?.id || !id) return;

    try {
      await handleUploadDrawingFiles(files);
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachment: RfpAttachment) => {
    try {
      setDeletingAttachmentId(attachment.id);
      const { error: deleteError } = await supabase
        .from('rfp_attachments')
        .delete()
        .eq('id', attachment.id)
        .eq('rfp_id', id);
      if (deleteError) throw deleteError;

      const storagePath = getStoragePathFromUrl(attachment.file_url);
      if (storagePath) {
        await supabase.storage.from('company-files').remove([storagePath]);
      }

      toast({
        title: 'Deleted',
        description: 'Drawing removed'
      });
      await loadAttachments();
    } catch (error: any) {
      console.error('Error deleting drawing:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove drawing',
        variant: 'destructive'
      });
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const handleInviteVendors = async () => {
    if (selectedVendors.length === 0) {
      toast({
        title: 'No vendors selected',
        description: 'Please select at least one vendor to invite',
        variant: 'destructive'
      });
      return;
    }

    try {
      setInviting(true);

      const invitations = selectedVendors.map(vendorId => ({
        rfp_id: id,
        vendor_id: vendorId,
        company_id: currentCompany!.id,
        response_status: 'pending'
      }));

      const { error } = await supabase
        .from('rfp_invited_vendors')
        .insert(invitations);

      if (error) throw error;

      // Send email invitations to each vendor
      const emailPromises = selectedVendors.map(async (vendorId) => {
        const vendor = vendors.find(v => v.id === vendorId);
        if (!vendor?.email) return null;

        try {
          const { error: emailError } = await supabase.functions.invoke('send-rfp-invite', {
            body: {
              rfpId: id,
              rfpTitle: rfp?.title || '',
              rfpNumber: rfp?.rfp_number || '',
              dueDate: rfp?.due_date,
              vendorId: vendor.id,
              vendorName: vendor.name,
              vendorEmail: vendor.email,
              companyId: currentCompany!.id,
              companyName: currentCompany!.name,
              scopeOfWork: rfp?.scope_of_work
            }
          });
          
          if (emailError) {
            console.error(`Failed to send email to ${vendor.email}:`, emailError);
          }
          return { vendorId, success: !emailError };
        } catch (err) {
          console.error(`Failed to send email to ${vendor.email}:`, err);
          return { vendorId, success: false };
        }
      });

      await Promise.all(emailPromises);

      toast({
        title: 'Success',
        description: `${selectedVendors.length} vendor(s) invited to bid`
      });

      setInviteDialogOpen(false);
      setSelectedVendors([]);
      loadInvitedVendors();
    } catch (error: any) {
      console.error('Error inviting vendors:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to invite vendors',
        variant: 'destructive'
      });
    } finally {
      setInviting(false);
    }
  };

  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendors(prev => 
      prev.includes(vendorId) 
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const getAvailableVendors = () => {
    const invitedIds = invitedVendors.map(iv => iv.vendor_id);
    return vendors.filter(v => !invitedIds.includes(v.id));
  };

  const getFilteredVendors = () => {
    let filtered = getAvailableVendors();
    
    // Apply search filter
    if (vendorSearch.trim()) {
      const searchLower = vendorSearch.toLowerCase();
      filtered = filtered.filter(v => 
        v.name.toLowerCase().includes(searchLower) ||
        (v.email && v.email.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply alphabet filter
    if (activeLetter) {
      filtered = filtered.filter(v => 
        v.name.toUpperCase().startsWith(activeLetter)
      );
    }
    
    return filtered;
  };

  const handleResendInvite = async (inv: InvitedVendor) => {
    if (!inv.vendor?.email || !rfp) return;

    try {
      setResendingInvite(inv.id);

      const { error: emailError } = await supabase.functions.invoke('send-rfp-invite', {
        body: {
          rfpId: id,
          rfpTitle: rfp.title,
          rfpNumber: rfp.rfp_number,
          dueDate: rfp.due_date,
          vendorId: inv.vendor.id,
          vendorName: inv.vendor.name,
          vendorEmail: inv.vendor.email,
          companyId: currentCompany!.id,
          companyName: currentCompany!.name,
          scopeOfWork: rfp.scope_of_work
        }
      });

      if (emailError) throw emailError;

      toast({
        title: 'Invitation Resent',
        description: `Bid invitation resent to ${inv.vendor.name}`
      });
    } catch (error: any) {
      console.error('Error resending invite:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend invitation',
        variant: 'destructive'
      });
    } finally {
      setResendingInvite(null);
    }
  };

  const getAvailableLetters = () => {
    const available = getAvailableVendors();
    const letters = new Set<string>();
    available.forEach(v => {
      const firstLetter = v.name.charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstLetter)) {
        letters.add(firstLetter);
      }
    });
    return Array.from(letters).sort();
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const updateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('rfps')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setRfp(prev => prev ? { ...prev, status: newStatus } : null);
      toast({
        title: 'Success',
        description: `RFP status updated to ${newStatus}`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      issued: { variant: 'default', label: 'Issued' },
      closed: { variant: 'outline', label: 'Closed' },
      awarded: { variant: 'default', label: 'Awarded' },
      cancelled: { variant: 'destructive', label: 'Cancelled' }
    };
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getBidStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      submitted: { variant: 'secondary', label: 'Submitted' },
      under_review: { variant: 'default', label: 'Under Review' },
      shortlisted: { variant: 'default', label: 'Shortlisted' },
      accepted: { variant: 'default', label: 'Accepted' },
      rejected: { variant: 'destructive', label: 'Rejected' }
    };
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="loading-dots">Loading</span></div>;
  }

  if (!rfp) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">RFP Not Found</h2>
        <Button className="mt-4" onClick={() => navigate('/construction/rfps')}>
          Back to RFPs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 md:px-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/construction/rfps')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{rfp.rfp_number}</h1>
              {getStatusBadge(rfp.status)}
            </div>
            <p className="text-lg text-muted-foreground">{rfp.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={rfp.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="awarded">Awarded</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigate(`/construction/rfps/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Invite Vendors
          </Button>
          <Button onClick={() => navigate(`/construction/rfps/${id}/compare`)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Compare Bids
          </Button>
        </div>
      </div>

      {/* Invite Vendors Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        setInviteDialogOpen(open);
        if (!open) {
          setVendorSearch('');
          setActiveLetter(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Vendors to Bid</DialogTitle>
            <DialogDescription>
              Select vendors to invite to submit bids for this RFP
            </DialogDescription>
          </DialogHeader>
          
          {getAvailableVendors().length === 0 ? (
            <div className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {vendors.length === 0 
                  ? "No vendors found. Add vendors first."
                  : "All vendors have already been invited."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setActiveLetter(null); // Clear letter filter when searching
                  }}
                  className="pl-9"
                />
              </div>

              {/* Alphabet Filter */}
              <div className="flex flex-wrap gap-1">
                <Button
                  variant={activeLetter === null ? "default" : "ghost"}
                  size="sm"
                  className="h-7 w-7 p-0 text-xs"
                  onClick={() => {
                    setActiveLetter(null);
                    setVendorSearch('');
                  }}
                >
                  All
                </Button>
                {alphabet.map(letter => {
                  const availableLetters = getAvailableLetters();
                  const hasVendors = availableLetters.includes(letter);
                  return (
                    <Button
                      key={letter}
                      variant={activeLetter === letter ? "default" : "ghost"}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      disabled={!hasVendors}
                      onClick={() => {
                        setActiveLetter(letter);
                        setVendorSearch('');
                      }}
                    >
                      {letter}
                    </Button>
                  );
                })}
              </div>

              {/* Vendor List */}
              <ScrollArea className="max-h-[250px] pr-4">
                <div className="space-y-2">
                  {getFilteredVendors().length === 0 ? (
                    <div className="py-4 text-center text-muted-foreground">
                      No vendors found matching your filters
                    </div>
                  ) : (
                    getFilteredVendors().map(vendor => (
                      <div 
                        key={vendor.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleVendorSelection(vendor.id)}
                      >
                        <Checkbox 
                          checked={selectedVendors.includes(vendor.id)}
                          onCheckedChange={() => toggleVendorSelection(vendor.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{vendor.name}</p>
                          {vendor.email && (
                            <p className="text-sm text-muted-foreground truncate">{vendor.email}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInviteVendors} 
              disabled={selectedVendors.length === 0 || inviting}
            >
              <Send className="h-4 w-4 mr-2" />
              {inviting ? 'Inviting...' : `Invite ${selectedVendors.length > 0 ? `(${selectedVendors.length})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {rfp.job && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                  <p className="text-sm text-muted-foreground">Job</p>
                  <p className="font-medium">{rfp.job.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Issue Date</p>
                <p className="font-medium">
                  {rfp.issue_date ? format(new Date(rfp.issue_date), 'MMM d, yyyy') : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">
                  {rfp.due_date ? format(new Date(rfp.due_date), 'MMM d, yyyy') : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Bids Received</p>
                <p className="font-medium">{bids.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invited">Invited ({invitedVendors.length})</TabsTrigger>
          <TabsTrigger value="bids">Bids ({bids.length})</TabsTrigger>
          <TabsTrigger value="scoring">Scoring Criteria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              {rfp.description ? (
                <p className="whitespace-pre-wrap">{rfp.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description provided yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scope of Work</CardTitle>
            </CardHeader>
            <CardContent>
              {rfp.scope_of_work ? (
                <p className="whitespace-pre-wrap">{rfp.scope_of_work}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No scope of work provided yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logistics Details</CardTitle>
            </CardHeader>
            <CardContent>
              {rfp.logistics_details ? (
                <p className="whitespace-pre-wrap">{rfp.logistics_details}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No logistics details provided yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Drawings</CardTitle>
                <CardDescription>Upload and manage plan sheets and drawing files for this RFP</CardDescription>
              </div>
              <div>
                <input
                  ref={drawingsInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp"
                  onChange={handleUploadDrawings}
                  disabled={uploadingDrawings}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => drawingsInputRef.current?.click()}
                  disabled={uploadingDrawings}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose files
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`mb-3 rounded-md border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
                  isDrawingsDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDrawingsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDrawingsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDrawingsDragOver(false);
                  if (uploadingDrawings) return;
                  const droppedFiles = Array.from(e.dataTransfer.files || []);
                  if (droppedFiles.length > 0) {
                    void handleUploadDrawingFiles(droppedFiles);
                  }
                }}
                onClick={() => !uploadingDrawings && drawingsInputRef.current?.click()}
              >
                {uploadingDrawings ? (
                  <span className="loading-dots">Loading</span>
                ) : (
                  <span>Drag and drop drawings/specs here, or click to choose files</span>
                )}
              </div>
              {uploadingDrawings && (
                <p className="text-sm text-muted-foreground mb-3"><span className="loading-dots">Loading</span></p>
              )}
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No drawings uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between rounded-md border p-2">
                      <a
                        href={attachment.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium hover:underline truncate pr-3"
                      >
                        {attachment.file_name}
                      </a>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{formatFileSize(attachment.file_size)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={deletingAttachmentId === attachment.id}
                          onClick={() => handleDeleteAttachment(attachment)}
                        >
                          {deletingAttachmentId === attachment.id ? (
                            <span className="loading-dots text-xs">Loading</span>
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invited" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Invited Vendors</h3>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Invite More
            </Button>
          </div>
          
          {invitedVendors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Vendors Invited</h3>
                <p className="text-muted-foreground mb-4">Invite vendors to submit bids for this RFP</p>
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Invite Vendors
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2">Vendor</TableHead>
                    <TableHead className="py-2">Email</TableHead>
                    <TableHead className="py-2">Invited</TableHead>
                    <TableHead className="py-2">Status</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitedVendors.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="py-2 font-medium">{inv.vendor?.name}</TableCell>
                      <TableCell className="py-2">{inv.vendor?.email || '-'}</TableCell>
                      <TableCell className="py-2">{format(new Date(inv.invited_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant={inv.response_status === 'bid_submitted' ? 'default' : 'secondary'}>
                          {inv.response_status === 'pending' || !inv.response_status ? 'Pending' : inv.response_status === 'bid_submitted' ? 'Bid Submitted' : inv.response_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        {inv.vendor?.email && inv.response_status !== 'bid_submitted' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendInvite(inv)}
                            disabled={resendingInvite === inv.id}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            {resendingInvite === inv.id ? 'Sending...' : 'Resend'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bids" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Received Bids</h3>
            <Button onClick={() => navigate(`/construction/rfps/${id}/bids/add`)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bid
            </Button>
          </div>
          
          {bids.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Bids Yet</h3>
                <p className="text-muted-foreground mb-4">No vendors have submitted bids for this RFP</p>
                <Button onClick={() => navigate(`/construction/rfps/${id}/bids/add`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bid
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2">Vendor</TableHead>
                    <TableHead className="py-2">Version</TableHead>
                    <TableHead className="py-2">Bid Amount</TableHead>
                    <TableHead className="py-2">Final Total</TableHead>
                    <TableHead className="py-2">Bid Contact</TableHead>
                    <TableHead className="py-2">Timeline</TableHead>
                    <TableHead className="py-2">Status</TableHead>
                    <TableHead className="py-2">Submitted</TableHead>
                    <TableHead className="py-2"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bids.map(bid => (
                    <TableRow
                      key={bid.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate(`/construction/bids/${bid.id}`)}
                    >
                      <TableCell className="py-2 font-medium">{bid.vendor.name}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline">v{Number(bid.version_number || 1)}</Badge>
                      </TableCell>
                      <TableCell className="py-2">${bid.bid_amount.toLocaleString()}</TableCell>
                      <TableCell className="py-2 font-medium">
                        ${getFinalBidTotal(bid).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="py-2">
                        {bid.bid_contact_name ? (
                          <div className="leading-tight">
                            <div>{bid.bid_contact_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {bid.bid_contact_email || bid.bid_contact_phone || "-"}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="py-2">{bid.proposed_timeline || '-'}</TableCell>
                      <TableCell className="py-2">{getBidStatusBadge(bid.status)}</TableCell>
                      <TableCell className="py-2">{format(new Date(bid.submitted_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="py-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/construction/bids/${bid.id}`);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scoring" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Scoring Criteria</h3>
              <p className="text-sm text-muted-foreground">Define weighted criteria for bid evaluation</p>
            </div>
            <Button onClick={() => navigate(`/construction/rfps/${id}/criteria/add`)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Criterion
            </Button>
          </div>

          {criteria.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Scoring Criteria</h3>
                <p className="text-muted-foreground mb-4">Add criteria to evaluate and compare bids</p>
                <Button onClick={() => navigate(`/construction/rfps/${id}/criteria/add`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Criterion
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2">Criterion</TableHead>
                    <TableHead className="py-2">Description</TableHead>
                    <TableHead className="py-2">Weight</TableHead>
                    <TableHead className="py-2">Max Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="py-2 font-medium">{c.criterion_name}</TableCell>
                      <TableCell className="py-2">{c.description || '-'}</TableCell>
                      <TableCell className="py-2">{c.weight}x</TableCell>
                      <TableCell className="py-2">{c.max_score}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
