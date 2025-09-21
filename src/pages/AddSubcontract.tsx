import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function AddSubcontract() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const jobId = searchParams.get('jobId');
  const vendorId = searchParams.get('vendorId');
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    job_id: jobId || "",
    vendor_id: vendorId || "",
    contract_amount: "",
    start_date: "",
    end_date: "",
    status: "active",
    contract_file_url: ""
  });

  const [jobs, setJobs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch jobs
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, name, client')
          .order('name');

        if (jobsError) throw jobsError;
        setJobs(jobsData || []);

        // Fetch vendors
        const { data: vendorsData, error: vendorsError } = await supabase
          .from('vendors')
          .select('id, name, vendor_type')
          .eq('company_id', user?.id)
          .eq('is_active', true)
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

    if (user) {
      fetchData();
    }
  }, [user, toast]);

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
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Subcontract name is required",
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

    if (!formData.contract_amount || parseFloat(formData.contract_amount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid contract amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('subcontracts')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          job_id: formData.job_id,
          vendor_id: formData.vendor_id,
          contract_amount: parseFloat(formData.contract_amount),
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          status: formData.status,
          contract_file_url: formData.contract_file_url || null,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subcontract created successfully",
      });

      // Navigate back to job details or commitments page
      if (jobId) {
        navigate(`/jobs/${jobId}`);
      } else {
        navigate(`/commitments/contracts`);
      }
    } catch (error) {
      console.error('Error creating subcontract:', error);
      toast({
        title: "Error",
        description: "Failed to create subcontract",
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
          <h1 className="text-2xl font-bold text-foreground">Add Subcontract</h1>
          <p className="text-muted-foreground">Create a new subcontract agreement</p>
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
                  <Label htmlFor="name">Subcontract Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter subcontract name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contract_amount">Contract Amount *</Label>
                  <Input
                    id="contract_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.contract_amount}
                    onChange={(e) => handleInputChange("contract_amount", e.target.value)}
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
                  placeholder="Enter subcontract description"
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
                  <Select value={formData.vendor_id} onValueChange={(value) => handleInputChange("vendor_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name} {vendor.vendor_type && `(${vendor.vendor_type})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleInputChange("start_date", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => handleInputChange("end_date", e.target.value)}
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

          {/* Contract File */}
          <Card>
            <CardHeader>
              <CardTitle>Contract File</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="contract_file_url">Contract File URL</Label>
                <Input
                  id="contract_file_url"
                  value={formData.contract_file_url}
                  onChange={(e) => handleInputChange("contract_file_url", e.target.value)}
                  placeholder="https://example.com/contract.pdf"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the URL to the contract file (optional)
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
              {isSubmitting ? "Creating..." : "Create Subcontract"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}