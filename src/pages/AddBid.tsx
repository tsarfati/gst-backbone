import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Upload, X, FileText, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ZoomableDocumentPreview from '@/components/ZoomableDocumentPreview';
import QuickAddVendor from '@/components/QuickAddVendor';
import { cn } from '@/lib/utils';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';
import { canAccessAssignedJobOnly } from '@/utils/jobAccess';

interface Vendor {
  id: string;
  name: string;
}

interface RFP {
  id: string;
  rfp_number: string;
  title: string;
  job_id?: string | null;
}

const calculateBidTotal = (formData: {
  bid_amount: string;
  shipping_included: boolean;
  shipping_amount: string;
  taxes_included: boolean;
  tax_amount: string;
  discount_amount: string;
}) => {
  const base = Number(formData.bid_amount || 0);
  const discount = Number(formData.discount_amount || 0);
  const taxableBase = Math.max(0, base - discount);
  const shipping = formData.shipping_included ? 0 : Number(formData.shipping_amount || 0);
  const taxRatePercent = formData.taxes_included ? 0 : Number(formData.tax_amount || 0);
  const tax = taxableBase * (Math.max(0, taxRatePercent) / 100);
  return Math.max(0, taxableBase + shipping + tax);
};

interface PendingFile {
  file: File;
  previewUrl: string | null;
}

const BID_STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'verbal_quote', label: 'Verbal Quote' },
  { value: 'questions_pending', label: 'Questions Pending' },
  { value: 'waiting_for_revisions', label: 'Waiting for Revisions' },
  { value: 'subcontract_review', label: 'Reviewing Subcontract' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'retracted', label: 'Retracted' },
] as const;

export default function AddBid() {
  const { rfpId } = useParams<{ rfpId: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [existingVendorIds, setExistingVendorIds] = useState<string[]>([]);
  const [vendorLatestVersion, setVendorLatestVersion] = useState<Record<string, number>>({});
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  
  const [formData, setFormData] = useState({
    vendor_id: '',
    status: 'submitted',
    bid_amount: '',
    proposed_timeline: '',
    notes: '',
    bid_contact_name: '',
    bid_contact_email: '',
    bid_contact_phone: '',
    shipping_included: false,
    shipping_amount: '0',
    taxes_included: true,
    tax_amount: '0',
    discount_amount: '0',
  });

  useEffect(() => {
    if (currentCompany?.id && rfpId && !websiteJobAccessLoading) {
      loadData();
    }
  }, [currentCompany?.id, rfpId, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  const loadData = async () => {
    try {
      const { data: rfpData, error: rfpError } = await supabase
        .from('rfps')
        .select('id, rfp_number, title, job_id')
        .eq('id', rfpId)
        .single();

      if (rfpError) throw rfpError;

      if (!canAccessAssignedJobOnly([rfpData?.job_id], isPrivileged, allowedJobIds)) {
        toast({
          title: 'Access denied',
          description: 'You do not have access to this RFP job',
          variant: 'destructive'
        });
        navigate('/construction/rfps');
        return;
      }
      setRfp(rfpData);

      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('company_id', currentCompany!.id)
        .eq('is_active', true)
        .order('name');

      if (vendorError) throw vendorError;
      setVendors(vendorData || []);

      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select('vendor_id, version_number')
        .eq('rfp_id', rfpId);

      if (bidsError) throw bidsError;
      const allVendorIds = (bidsData || []).map((b: any) => b.vendor_id);
      setExistingVendorIds(allVendorIds);
      const latestByVendor: Record<string, number> = {};
      (bidsData || []).forEach((bid: any) => {
        const vendorId = bid.vendor_id;
        const version = Number(bid.version_number || 1);
        latestByVendor[vendorId] = Math.max(latestByVendor[vendorId] || 0, version);
      });
      setVendorLatestVersion(latestByVendor);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const availableVendors = vendors.filter(v => !existingVendorIds.includes(v.id));
  const filteredAvailableVendors = availableVendors.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const addPendingFiles = (files: FileList | File[]) => {
    const newFiles: PendingFile[] = Array.from(files).map(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      let previewUrl: string | null = null;

      if (isImage || isPdf) {
        previewUrl = URL.createObjectURL(file);
      }

      return { file, previewUrl };
    });

    setPendingFiles(prev => {
      const updated = [...prev, ...newFiles];
      if (selectedFileIndex === null && updated.length > 0) {
        setSelectedFileIndex(0);
      }
      return updated;
    });

  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    addPendingFiles(files);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => {
      const removed = prev[index];
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      const updated = prev.filter((_, i) => i !== index);
      
      if (selectedFileIndex === index) {
        setSelectedFileIndex(updated.length > 0 ? 0 : null);
      } else if (selectedFileIndex !== null && selectedFileIndex > index) {
        setSelectedFileIndex(selectedFileIndex - 1);
      }
      
      return updated;
    });
  };

  const uploadAttachments = async (bidId: string) => {
    for (const pf of pendingFiles) {
      const filePath = `${currentCompany!.id}/${bidId}/${Date.now()}-${pf.file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('bid-attachments')
        .upload(filePath, pf.file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('bid-attachments')
        .getPublicUrl(filePath);

      await supabase.from('bid_attachments').insert({
        bid_id: bidId,
        company_id: currentCompany!.id,
        file_name: pf.file.name,
        file_size: pf.file.size,
        file_type: pf.file.type,
        file_url: urlData.publicUrl,
        uploaded_by: user!.id
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vendor_id) {
      toast({ title: 'Validation Error', description: 'Please select a vendor', variant: 'destructive' });
      return;
    }

    if (!formData.bid_amount || parseFloat(formData.bid_amount) <= 0) {
      toast({ title: 'Validation Error', description: 'Please enter a valid bid amount', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);

      const { data: bidData, error } = await supabase
        .from('bids')
        .insert({
          rfp_id: rfpId,
          company_id: currentCompany!.id,
          vendor_id: formData.vendor_id,
          bid_amount: parseFloat(formData.bid_amount),
          proposed_timeline: formData.proposed_timeline || null,
          notes: formData.notes || null,
          version_number: (vendorLatestVersion[formData.vendor_id] || 0) + 1,
          bid_contact_name: formData.bid_contact_name || null,
          bid_contact_email: formData.bid_contact_email || null,
          bid_contact_phone: formData.bid_contact_phone || null,
          shipping_included: formData.shipping_included,
          shipping_amount: Number(formData.shipping_amount || 0),
          taxes_included: formData.taxes_included,
          tax_amount: formData.taxes_included ? 0 : Number(formData.tax_amount || 0),
          discount_amount: Number(formData.discount_amount || 0),
          status: formData.status || 'submitted'
        } as any)
        .select('id')
        .single();

      if (error) throw error;

      if (pendingFiles.length > 0 && bidData) {
        await uploadAttachments(bidData.id);
      }

      // Cleanup preview URLs
      pendingFiles.forEach(pf => {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      });

      toast({ title: 'Success', description: 'Bid added successfully' });
      navigate(`/construction/rfps/${rfpId}`);
    } catch (error: any) {
      console.error('Error adding bid:', error);
      toast({ title: 'Error', description: error.message || 'Failed to add bid', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectedPreviewUrl = selectedFileIndex !== null && pendingFiles[selectedFileIndex]
    ? pendingFiles[selectedFileIndex].previewUrl
    : null;
  const totalBid = calculateBidTotal(formData);

  return (
    <div className="space-y-4 px-4 md:px-6 pb-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add Bid</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Bid Details</CardTitle>
            <CardDescription>Enter the vendor's bid information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="vendor_id">Vendor *</Label>
                <QuickAddVendor
                  onVendorAdded={(vendorId) => {
                    loadData();
                    setFormData(prev => ({ ...prev, vendor_id: vendorId }));
                  }}
                  variant="ghost"
                  className="h-7 text-xs"
                />
              </div>
              <Select 
                value={formData.vendor_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, vendor_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input
                      placeholder="Search vendors..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      className="h-8"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredAvailableVendors.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      {availableVendors.length === 0 ? 'No available vendors' : 'No matching vendors'}
                    </SelectItem>
                  ) : (
                    filteredAvailableVendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {availableVendors.length === 0 && vendors.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  All vendors have already submitted bids for this RFP
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {BID_STATUS_OPTIONS.map((statusOption) => (
                      <SelectItem key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bid_amount">Bid Amount *</Label>
                <Input
                  id="bid_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.bid_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, bid_amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposed_timeline">Proposed Timeline</Label>
                <Input
                  id="proposed_timeline"
                  value={formData.proposed_timeline}
                  onChange={(e) => setFormData(prev => ({ ...prev, proposed_timeline: e.target.value }))}
                  placeholder="e.g., 30 days, 6 weeks"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this bid..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bid_contact_name">Bid Contact Name</Label>
                <Input
                  id="bid_contact_name"
                  value={formData.bid_contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, bid_contact_name: e.target.value }))}
                  placeholder="Contact for this bid"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bid_contact_email">Bid Contact Email</Label>
                <Input
                  id="bid_contact_email"
                  type="email"
                  value={formData.bid_contact_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, bid_contact_email: e.target.value }))}
                  placeholder="contact@vendor.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bid_contact_phone">Bid Contact Phone</Label>
                <Input
                  id="bid_contact_phone"
                  value={formData.bid_contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, bid_contact_phone: e.target.value }))}
                  placeholder="(555) 555-5555"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="shipping_included">Shipping Included In Bid</Label>
                  <Checkbox
                    id="shipping_included"
                    checked={formData.shipping_included}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, shipping_included: !!checked }))}
                  />
                </div>
                {!formData.shipping_included && (
                  <div className="space-y-2">
                    <Label htmlFor="shipping_amount">Shipping Amount</Label>
                    <Input
                      id="shipping_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.shipping_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, shipping_amount: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="taxes_included">Taxes Included In Bid</Label>
                  <Checkbox
                    id="taxes_included"
                    checked={formData.taxes_included}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, taxes_included: !!checked }))}
                  />
                </div>
                {!formData.taxes_included && (
                  <div className="space-y-2">
                    <Label htmlFor="tax_amount">Tax Rate (%)</Label>
                    <Input
                      id="tax_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.tax_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, tax_amount: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Applied to (Base Bid - Discount)</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount_amount">Discount Amount</Label>
                <Input
                  id="discount_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Final Total Bid</Label>
                <div className="h-10 rounded-md border px-3 flex items-center font-semibold">
                  ${totalBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attachments Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Attachments
                </CardTitle>
                <CardDescription>Upload bid documents, proposals, or supporting files</CardDescription>
              </div>
              <label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button type="button" variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </span>
                </Button>
              </label>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingFiles.length === 0 ? (
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div
                  className={cn("border-2 border-dashed rounded-lg p-12 text-center hover:border-primary/50 transition-colors")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files?.length) addPendingFiles(e.dataTransfer.files);
                  }}
                >
                  <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag & drop or click to upload bid documents
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, images, Word, and Excel files supported
                  </p>
                </div>
              </label>
            ) : (
              <div className="space-y-4">
                {/* File list */}
                <div className="flex flex-wrap gap-2">
                  {pendingFiles.map((pf, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedFileIndex === index
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedFileIndex(index)}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate max-w-[200px]">{pf.file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(pf.file.size / 1024).toFixed(0)} KB)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Embedded Document Preview - full width */}
                {selectedPreviewUrl && (
                  <div className="border rounded-lg overflow-hidden" style={{ minHeight: '500px' }}>
                    <ZoomableDocumentPreview
                      url={selectedPreviewUrl}
                      fileName={pendingFiles[selectedFileIndex!]?.file.name}
                      className="h-[500px]"
                    />
                  </div>
                )}

                {selectedFileIndex !== null && !selectedPreviewUrl && (
                  <div className="border rounded-lg p-12 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Preview not available for this file type
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pendingFiles[selectedFileIndex]?.file.name}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || availableVendors.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Adding...' : 'Add Bid'}
          </Button>
        </div>
      </form>
    </div>
  );
}
