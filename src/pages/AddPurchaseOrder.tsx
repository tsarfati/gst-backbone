import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import QuickAddVendor from "@/components/QuickAddVendor";

export default function AddPurchaseOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  
  const jobId = searchParams.get('jobId');
  const vendorId = searchParams.get('vendorId');
  
  const [formData, setFormData] = useState({
    po_number: "",
    description: "",
    job_id: jobId || "",
    vendor_id: vendorId || "",
    amount: "",
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: "",
    status: "active",
    po_file_url: ""
  });

  const [jobs, setJobs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [costCodes, setCostCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowedVendorTypes, setAllowedVendorTypes] = useState<string[]>([]);
  const [requiredFields, setRequiredFields] = useState<string[]>(["po_number", "job_id", "vendor_id", "amount"]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const companyId = currentCompany?.id || profile?.current_company_id;
        
        if (!companyId) {
          toast({
            title: "Error",
            description: "No company selected",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Fetch job settings for required fields
        const { data: jobSettingsData } = await supabase
          .from('job_settings')
          .select('po_required_fields')
          .eq('company_id', companyId)
          .maybeSingle();

        if (jobSettingsData?.po_required_fields && Array.isArray(jobSettingsData.po_required_fields)) {
          setRequiredFields(jobSettingsData.po_required_fields as string[]);
        }

        // Fetch payables settings for allowed vendor types
        const { data: settingsData, error: settingsError } = await supabase
          .from('payables_settings')
          .select('allowed_po_vendor_types')
          .eq('company_id', companyId)
          .maybeSingle();

        const allowedTypes = settingsData?.allowed_po_vendor_types || ["Supplier"];
        setAllowedVendorTypes(allowedTypes);

        // Fetch jobs for current company only
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, name, client')
          .eq('company_id', companyId)
          .order('name');

        if (jobsError) throw jobsError;
        setJobs(jobsData || []);

        // Fetch vendors filtered by allowed types (RLS will handle company access)
        const { data: vendorsData, error: vendorsError } = await supabase
          .from('vendors')
          .select('id, name, vendor_type')
          .eq('is_active', true)
          .in('vendor_type', allowedTypes)
          .order('name');

        if (vendorsError) throw vendorsError;
        setVendors(vendorsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load form data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user && (currentCompany?.id || profile?.current_company_id)) {
      fetchData();
    }
  }, [user, currentCompany, profile, toast]);

  // Fetch cost codes when job is selected
  useEffect(() => {
    const fetchCostCodes = async () => {
      if (!formData.job_id) {
        setCostCodes([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('cost_codes')
          .select('*')
          .eq('job_id', formData.job_id)
          .eq('type', 'material')
          .eq('is_active', true)
          .order('code');

        if (error) throw error;
        setCostCodes(data || []);
      } catch (error) {
        console.error('Error fetching cost codes:', error);
      }
    };

    fetchCostCodes();
  }, [formData.job_id]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!formData.po_number.trim()) {
      toast({
        title: "Validation Error",
        description: "PO number is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.job_id) {
      toast({
        title: "Validation Error", 
        description: "Please select a job",
        variant: "destructive",
      });
      return;
    }

    if (!formData.vendor_id) {
      toast({
        title: "Validation Error",
        description: "Please select a vendor",
        variant: "destructive",
      });
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: formData.po_number.trim(),
          description: formData.description.trim() || null,
          job_id: formData.job_id,
          vendor_id: formData.vendor_id,
          amount: parseFloat(formData.amount),
          order_date: formData.order_date,
          expected_delivery: formData.expected_delivery || null,
          status: formData.status,
          po_file_url: formData.po_file_url || null,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Purchase order created successfully",
      });

      // Navigate back to job details or purchase orders page
      if (jobId) {
        navigate(`/jobs/${jobId}`);
      } else {
        navigate(`/purchase-orders`);
      }
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Purchase Order</h1>
          <p className="text-muted-foreground">Create a new purchase order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="po_number">PO Number *</Label>
                  <Input
                    id="po_number"
                    value={formData.po_number}
                    onChange={(e) => handleInputChange("po_number", e.target.value)}
                    placeholder="Enter PO number"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount *</Label>
                  <CurrencyInput
                    id="amount"
                    value={formData.amount}
                    onChange={(value) => handleInputChange("amount", value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Enter purchase order description"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Job and Vendor Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Job and Vendor Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="job">Job *</Label>
                  <Select value={formData.job_id} onValueChange={(value) => handleInputChange("job_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name} {job.client && `(${job.client})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="vendor">Vendor *</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select value={formData.vendor_id} onValueChange={(value) => handleInputChange("vendor_id", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vendor" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name} {vendor.vendor_type && `(${vendor.vendor_type})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <QuickAddVendor 
                      allowedTypes={allowedVendorTypes}
                      onVendorAdded={(vendorId) => {
                        handleInputChange("vendor_id", vendorId);
                        // Refresh vendors list
                        const fetchVendors = async () => {
                          const { data } = await supabase
                            .from('vendors')
                            .select('id, name, vendor_type')
                            .eq('is_active', true)
                            .in('vendor_type', allowedVendorTypes)
                            .order('name');
                          if (data) setVendors(data);
                        };
                        fetchVendors();
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline and Status */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline and Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="order_date">Order Date *</Label>
                  <Input
                    id="order_date"
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => handleInputChange("order_date", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="expected_delivery">Expected Delivery</Label>
                  <Input
                    id="expected_delivery"
                    type="date"
                    value={formData.expected_delivery}
                    onChange={(e) => handleInputChange("expected_delivery", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PO File */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Order File</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="po_file_url">PO File URL</Label>
                <Input
                  id="po_file_url"
                  value={formData.po_file_url}
                  onChange={(e) => handleInputChange("po_file_url", e.target.value)}
                  placeholder="https://example.com/po.pdf"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the URL to the purchase order file (optional)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="min-w-32"
            >
              {isSubmitting ? "Creating..." : "Create Purchase Order"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}