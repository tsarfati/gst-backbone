import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, FileText, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

export default function AddSubcontract() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  
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
  const [allowedVendorTypes, setAllowedVendorTypes] = useState<string[]>([]);
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState<{file: File, url: string}[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

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

        // Fetch payables settings for allowed vendor types
        const { data: settingsData, error: settingsError } = await supabase
          .from('payables_settings')
          .select('allowed_subcontract_vendor_types')
          .eq('company_id', companyId)
          .maybeSingle();

        const allowedTypes = settingsData?.allowed_subcontract_vendor_types || 
          ["Contractor", "Design Professional"];
        setAllowedVendorTypes(allowedTypes);

        // Fetch jobs for current company only
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, name, client')
          .eq('company_id', companyId)
          .order('name');

        if (jobsError) throw jobsError;
        setJobs(jobsData || []);

        // Fetch vendors filtered by allowed types and company
        const { data: vendorsData, error: vendorsError } = await supabase
          .from('vendors')
          .select('id, name, vendor_type')
          .eq('company_id', companyId)
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

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (files: File[]) => {
    const validFiles: File[] = [];
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp'];
    
    for (const file of files) {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name}: Please upload PDF, Word document, or image files only`,
          variant: "destructive"
        });
        continue;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name}: Please upload files smaller than 10MB`,
          variant: "destructive"
        });
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setContractFiles(prev => [...prev, ...validFiles]);
      
      // Create preview URLs for images and PDFs
      const newPreviews = validFiles
        .filter(file => file.type.startsWith('image/') || file.type === 'application/pdf')
        .map(file => ({
          file,
          url: URL.createObjectURL(file)
        }));
      
      setFilePreviewUrls(prev => [...prev, ...newPreviews]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(Array.from(files));
    }
  };

  const removeFile = (fileToRemove: File) => {
    setContractFiles(prev => prev.filter(f => f !== fileToRemove));
    setFilePreviewUrls(prev => {
      const preview = prev.find(p => p.file === fileToRemove);
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
      return prev.filter(p => p.file !== fileToRemove);
    });
  };

  const uploadFilesToStorage = async (): Promise<string[]> => {
    if (contractFiles.length === 0) return [];

    const companyId = currentCompany?.id || profile?.current_company_id;
    if (!companyId) return [];

    setUploadingFiles(true);
    const uploadedPaths: string[] = [];

    try {
      for (const file of contractFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${companyId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('subcontract-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Error uploading file:', file.name, uploadError);
          toast({
            title: "Upload Error",
            description: `Failed to upload ${file.name}`,
            variant: "destructive"
          });
          continue;
        }

        uploadedPaths.push(filePath);
      }

      return uploadedPaths;
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload contract files",
        variant: "destructive"
      });
      return uploadedPaths;
    } finally {
      setUploadingFiles(false);
    }
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
      // Upload files if present
      let fileUrls: string[] = [];
      if (contractFiles.length > 0) {
        const uploadedPaths = await uploadFilesToStorage();
        fileUrls = uploadedPaths;
      }

      // Store file URLs as JSON array or comma-separated string
      const fileUrlString = fileUrls.length > 0 ? JSON.stringify(fileUrls) : formData.contract_file_url || null;

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
          contract_file_url: fileUrlString,
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
                  <CurrencyInput
                    id="contract_amount"
                    value={formData.contract_amount}
                    onChange={(value) => handleInputChange("contract_amount", value)}
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

          {/* Contract File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Contract File
                <Badge variant="secondary" className="text-xs">Optional</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contractFiles.length === 0 ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto bg-muted rounded-full">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">Upload Contract Files</p>
                      <p className="text-sm text-muted-foreground">
                        Drag and drop your contract files here, or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Supported formats: PDF, Word, JPG, PNG • Max 10MB per file • Multiple files allowed
                      </p>
                    </div>
                    <div>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileInputChange}
                        className="hidden"
                        id="contract-file-upload"
                        multiple
                      />
                      <Button type="button" asChild variant="outline">
                        <label htmlFor="contract-file-upload" className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          Choose Files
                        </label>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{contractFiles.length} file{contractFiles.length > 1 ? 's' : ''} selected</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setContractFiles([]);
                        setFilePreviewUrls([]);
                      }}
                    >
                      Clear All
                    </Button>
                  </div>

                  {/* File List */}
                  <div className="space-y-2">
                    {contractFiles.map((file, index) => (
                      <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-10 h-10 bg-success/10 rounded flex-shrink-0">
                            <FileText className="h-5 w-5 text-success" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file)}
                          className="flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* File Previews */}
                  {filePreviewUrls.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-sm font-medium">Previews:</p>
                      {filePreviewUrls.map((preview, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-muted/50">
                          <p className="text-sm font-medium mb-2">{preview.file.name}</p>
                          {preview.file.type === 'application/pdf' ? (
                            <iframe
                              src={preview.url}
                              className="w-full h-96 border rounded"
                              title={`Preview ${preview.file.name}`}
                            />
                          ) : preview.file.type.startsWith('image/') ? (
                            <img
                              src={preview.url}
                              alt={`Preview ${preview.file.name}`}
                              className="max-w-full h-auto max-h-96 rounded mx-auto"
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add More Files Button */}
                  <div className="pt-2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileInputChange}
                      className="hidden"
                      id="contract-file-upload-more"
                      multiple
                    />
                    <Button type="button" asChild variant="outline" size="sm">
                      <label htmlFor="contract-file-upload-more" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Add More Files
                      </label>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Or Manual URL Entry */}
          <Card>
            <CardHeader>
              <CardTitle>Or Enter Contract File URL</CardTitle>
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
                disabled={isSubmitting || uploadingFiles}
                className="min-w-32"
              >
                {uploadingFiles ? "Uploading..." : isSubmitting ? "Creating..." : "Create Subcontract"}
              </Button>
          </div>
        </div>
      </form>
    </div>
  );
}