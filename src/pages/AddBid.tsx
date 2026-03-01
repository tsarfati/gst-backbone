import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Upload, X, FileText, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ZoomableDocumentPreview from '@/components/ZoomableDocumentPreview';
import QuickAddVendor from '@/components/QuickAddVendor';
import { cn } from '@/lib/utils';

interface Vendor {
  id: string;
  name: string;
}

interface RFP {
  id: string;
  rfp_number: string;
  title: string;
}

interface PendingFile {
  file: File;
  previewUrl: string | null;
}

export default function AddBid() {
  const { rfpId } = useParams<{ rfpId: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [existingVendorIds, setExistingVendorIds] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  
  const [formData, setFormData] = useState({
    vendor_id: '',
    bid_amount: '',
    proposed_timeline: '',
    notes: ''
  });

  useEffect(() => {
    if (currentCompany?.id && rfpId) {
      loadData();
    }
  }, [currentCompany?.id, rfpId]);

  const loadData = async () => {
    try {
      const { data: rfpData, error: rfpError } = await supabase
        .from('rfps')
        .select('id, rfp_number, title')
        .eq('id', rfpId)
        .single();

      if (rfpError) throw rfpError;
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
        .select('vendor_id')
        .eq('rfp_id', rfpId);

      if (bidsError) throw bidsError;
      setExistingVendorIds((bidsData || []).map(b => b.vendor_id));
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
          status: 'submitted'
        })
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add Bid</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bid Details</CardTitle>
            <CardDescription>Enter the vendor's bid information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </CardContent>
        </Card>

        {/* Attachments Section */}
        <Card>
          <CardHeader>
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
          <CardContent>
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

        <div className="flex justify-end gap-4">
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
