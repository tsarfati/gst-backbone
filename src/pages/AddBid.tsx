import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Vendor {
  id: string;
  name: string;
}

interface RFP {
  id: string;
  rfp_number: string;
  title: string;
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
      // Load RFP
      const { data: rfpData, error: rfpError } = await supabase
        .from('rfps')
        .select('id, rfp_number, title')
        .eq('id', rfpId)
        .single();

      if (rfpError) throw rfpError;
      setRfp(rfpData);

      // Load vendors
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('company_id', currentCompany!.id)
        .eq('is_active', true)
        .order('name');

      if (vendorError) throw vendorError;
      setVendors(vendorData || []);

      // Load existing bids to exclude those vendors
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vendor_id) {
      toast({
        title: 'Validation Error',
        description: 'Please select a vendor',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.bid_amount || parseFloat(formData.bid_amount) <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid bid amount',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('bids')
        .insert({
          rfp_id: rfpId,
          company_id: currentCompany!.id,
          vendor_id: formData.vendor_id,
          bid_amount: parseFloat(formData.bid_amount),
          proposed_timeline: formData.proposed_timeline || null,
          notes: formData.notes || null,
          status: 'submitted'
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Bid added successfully'
      });

      navigate(`/construction/rfps/${rfpId}`);
    } catch (error: any) {
      console.error('Error adding bid:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add bid',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add Bid</h1>
          <p className="text-muted-foreground">
            {rfp ? `${rfp.rfp_number} - ${rfp.title}` : 'Loading...'}
          </p>
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
              <Label htmlFor="vendor_id">Vendor *</Label>
              <Select 
                value={formData.vendor_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, vendor_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {availableVendors.length === 0 ? (
                    <SelectItem value="" disabled>No available vendors</SelectItem>
                  ) : (
                    availableVendors.map(vendor => (
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
