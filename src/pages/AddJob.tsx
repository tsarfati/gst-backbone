import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building, ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import CostCodeManager from "@/components/CostCodeManager";
import JobBudgetManager from "@/components/JobBudgetManager";
import { geocodeAddress } from "@/utils/geocoding";
import DragDropUpload from "@/components/DragDropUpload";

export default function AddJob() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [customers, setCustomers] = useState<{ id: string; name: string; display_name: string | null }[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  const [formData, setFormData] = useState({
    jobName: "",
    projectNumber: "",
    client: "",
    customerId: "",
    address: "",
    jobType: "residential",
    startDate: "",
    endDate: "",
    budget: "",
    description: "",
    status: "planning"
  });
  
  const [costCodes, setCostCodes] = useState<Array<{ id: string; code: string; description: string }>>([]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBannerSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please choose an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please choose an image file.",
        variant: "destructive",
      });
      return;
    }

    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  useEffect(() => {
    return () => {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  const uploadBannerForJob = async (jobId: string): Promise<string | null> => {
    if (!bannerFile || !currentCompany?.id) return null;

    setBannerUploading(true);
    try {
      const fileExt = bannerFile.name.split(".").pop() || "png";
      const fileName = `banner-${Date.now()}.${fileExt}`;
      const filePath = `${currentCompany.id}/jobs/${jobId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("job-banners")
        .upload(filePath, bannerFile, {
          upsert: true,
          contentType: bannerFile.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("job-banners").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from("jobs")
        .update({ banner_url: publicUrl })
        .eq("id", jobId);

      if (updateError) throw updateError;

      return publicUrl;
    } finally {
      setBannerUploading(false);
    }
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!currentCompany?.id) return;
      
      setLoadingCustomers(true);
      
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, display_name')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');
        
      if (!error && data) setCustomers(data);
      setLoadingCustomers(false);
    };

    fetchCustomers();
  }, [currentCompany?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Not signed in", description: "Please sign in to create a job.", variant: "destructive" });
      return;
    }
    
    if (!currentCompany) {
      toast({ title: "No company selected", description: "Please select a company to create a job.", variant: "destructive" });
      return;
    }

    const budgetNumber = formData.budget ? Number(String(formData.budget).replace(/[^0-9.]/g, '')) : null;

    // Geocode the address to get coordinates
    let latitude: number | null = null;
    let longitude: number | null = null;
    
    if (formData.address) {
      const geocodeResult = await geocodeAddress(formData.address);
      if (geocodeResult) {
        latitude = geocodeResult.latitude;
        longitude = geocodeResult.longitude;
      }
    }

    // Create the job first
    const { data: jobData, error: jobError } = await supabase.from('jobs').insert({
      name: formData.jobName,
      project_number: formData.projectNumber || null,
      client: formData.client,
      customer_id: formData.customerId || null,
      address: formData.address,
      latitude,
      longitude,
      job_type: formData.jobType as any,
      status: formData.status as any,
      start_date: formData.startDate || null,
      end_date: formData.endDate || null,
      budget: budgetNumber,
      description: formData.description,
      created_by: user.id,
      company_id: currentCompany.id,
    } as any).select('id').single();

    if (jobError) {
      toast({ title: "Error creating job", description: jobError.message, variant: "destructive" });
      return;
    }

    if (jobData?.id && bannerFile) {
      try {
        await uploadBannerForJob(jobData.id);
      } catch (bannerError: any) {
        console.error("Error uploading job banner:", bannerError);
        toast({
          title: "Job created",
          description: "Job was created, but banner upload failed. You can upload it later.",
        });
      }
    }

    // Auto-create a chart of account for this job
    if (jobData?.id) {
      try {
        // Generate a unique account number for the job (using job ID for uniqueness)
        const jobAccountNumber = `8000-${jobData.id.slice(-8)}`;
        
        const { error: accountError } = await supabase
          .from('chart_of_accounts')
          .insert({
            account_number: jobAccountNumber,
            account_name: `Job Costs - ${formData.jobName}`,
            account_type: 'expense',
            account_category: 'job_costs',
            normal_balance: 'debit',
            current_balance: 0,
            is_system_account: false,
            is_active: true,
            company_id: currentCompany?.id || '',
            created_by: user.id
          });

        if (accountError) {
          console.error('Error creating job chart account:', accountError);
          // Don't fail the job creation if chart account creation fails
          toast({ 
            title: "Job created", 
            description: "Job created successfully, but chart of account creation failed. You can create it manually later.",
            variant: "default"
          });
        } else {
          toast({ title: "Job created", description: "New job and associated chart of account have been successfully created" });
        }
      } catch (error) {
        console.error('Error in chart account creation:', error);
        toast({ title: "Job created", description: "Job created successfully, but chart of account creation failed." });
      }
    }

    navigate("/jobs");
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/jobs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Job</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Job Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobName">Job Name *</Label>
                <Input
                  id="jobName"
                  value={formData.jobName}
                  onChange={(e) => handleInputChange("jobName", e.target.value)}
                  placeholder="Enter job name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectNumber">Job / Project Number</Label>
                <Input
                  id="projectNumber"
                  value={formData.projectNumber}
                  onChange={(e) => handleInputChange("projectNumber", e.target.value)}
                  placeholder="e.g. 24-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select value={formData.customerId} onValueChange={(value) => handleInputChange("customerId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCustomers ? "Loading..." : "Select a customer"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.display_name || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="client">Client Contact (Optional)</Label>
                <Input
                  id="client"
                  value={formData.client}
                  onChange={(e) => handleInputChange("client", e.target.value)}
                  placeholder="Enter client contact name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Job Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Enter job site address"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobType">Job Type</Label>
                <Select value={formData.jobType} onValueChange={(value) => handleInputChange("jobType", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="renovation">Renovation</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange("endDate", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                value={formData.budget}
                onChange={(e) => handleInputChange("budget", e.target.value)}
                placeholder="$0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Enter job description and details"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Job Banner */}
        <Card>
          <CardHeader>
            <CardTitle>Job Banner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banner">Banner Image</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-32 border border-border rounded-lg flex items-center justify-center bg-muted overflow-hidden">
                  {bannerPreview ? (
                    <img
                      src={bannerPreview}
                      alt="Job banner preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="mt-2 w-full min-w-[240px]">
                    <DragDropUpload
                      onFileSelect={handleBannerSelect}
                      accept=".jpg,.jpeg,.png,.webp"
                      maxSize={5}
                      size="compact"
                      title="Drop banner image"
                      subtitle="or click to choose image"
                      helperText="Job banner image (max 5MB)"
                      disabled={bannerUploading}
                    />
                  </div>
                  {bannerFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        if (bannerPreview) URL.revokeObjectURL(bannerPreview);
                        setBannerFile(null);
                        setBannerPreview(null);
                      }}
                    >
                      Remove Selected Banner
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: 1200x400px, max 5MB
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Codes */}
        <CostCodeManager 
          costCodes={costCodes} 
          onCostCodesChange={setCostCodes} 
        />

        {/* Job Budget Section */}
        <div className="p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center">
          <p className="text-muted-foreground">Budget setup will be available after creating the job</p>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={bannerUploading}>
            <Save className="h-4 w-4 mr-2" />
            Create Job
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/jobs")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
