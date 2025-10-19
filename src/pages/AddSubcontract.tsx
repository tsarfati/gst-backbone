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
import { ArrowLeft, Upload, FileText, X, AlertCircle, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import PdfInlinePreview from "@/components/PdfInlinePreview";
import FullPagePdfViewer from "@/components/FullPagePdfViewer";
import JobCostingDistribution from "@/components/JobCostingDistribution";
import QuickAddVendor from "@/components/QuickAddVendor";

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
    scope_of_work: "",
    job_id: jobId || "",
    vendor_id: vendorId || "",
    contract_amount: "",
    start_date: "",
    end_date: "",
    status: "planning",
    contract_file_url: "",
    apply_retainage: false,
    retainage_percentage: ""
  });

  const [costDistribution, setCostDistribution] = useState<any[]>([]);

  const [jobs, setJobs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [costCodes, setCostCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowedVendorTypes, setAllowedVendorTypes] = useState<string[]>([]);
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const [filePreviewUrls, setFilePreviewUrls] = useState<{file: File, url: string}[]>([]);
  const [fileNames, setFileNames] = useState<{[key: string]: string}>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<File | null>(null);
  const [requiredFields, setRequiredFields] = useState<string[]>(["name", "job_id", "vendor_id", "contract_amount"]);
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('default');

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
          .select('subcontract_required_fields')
          .eq('company_id', companyId)
          .maybeSingle();

        if (jobSettingsData?.subcontract_required_fields && Array.isArray(jobSettingsData.subcontract_required_fields)) {
          setRequiredFields(jobSettingsData.subcontract_required_fields as string[]);
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

        // Fetch vendors filtered by company and allowed types
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
          .in('type', ['sub', 'other'] as any[])
          .eq('is_active', true)
          .eq('is_dynamic_group', false)
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

  // Check if all required fields are filled
  const areRequiredFieldsFilled = () => {
    return requiredFields.every(field => {
      const value = formData[field as keyof typeof formData];
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'number') return value > 0;
      return !!value;
    });
  };

  // Determine available statuses based on required fields
  const getAvailableStatuses = () => {
    if (!areRequiredFieldsFilled()) {
      return ['planning'];
    }
    return ['planning', 'active', 'completed', 'cancelled'];
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
        .map(file => {
          const url = URL.createObjectURL(file);
          console.log(`Created preview URL for ${file.name}:`, url, `Type: ${file.type}`);
          return {
            file,
            url
          };
        });
      
      setFilePreviewUrls(prev => [...prev, ...newPreviews]);
      
      if (newPreviews.length > 0) {
        console.log(`Total previews available: ${newPreviews.length + filePreviewUrls.length}`);
      }
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
    console.log(`Removing file: ${fileToRemove.name}`);
    setContractFiles(prev => prev.filter(f => f !== fileToRemove));
    setFilePreviewUrls(prev => {
      const preview = prev.find(p => p.file === fileToRemove);
      if (preview) {
        console.log(`Revoking preview URL for ${fileToRemove.name}`);
        URL.revokeObjectURL(preview.url);
      }
      return prev.filter(p => p.file !== fileToRemove);
    });
    setFileNames(prev => {
      const newNames = { ...prev };
      delete newNames[fileToRemove.name];
      return newNames;
    });
  };

  const uploadFilesToStorage = async (): Promise<{path: string, name: string}[]> => {
    if (contractFiles.length === 0) return [];

    const companyId = currentCompany?.id || profile?.current_company_id;
    if (!companyId) return [];

    // Fetch file naming settings
    const { data: namingSettings } = await supabase
      .from('file_upload_settings')
      .select('subcontract_naming_pattern')
      .eq('company_id', companyId)
      .single();

    setUploadingFiles(true);
    const uploadedFiles: {path: string, name: string}[] = [];

    try {
      for (const file of contractFiles) {
        const fileExt = file.name.split('.').pop();
        
        // Apply naming pattern if available
        let displayName = fileNames[file.name] || file.name;
        if (namingSettings?.subcontract_naming_pattern) {
          const vendor = vendors.find(v => v.id === formData.vendor_id);
          const job = jobs.find(j => j.id === formData.job_id);
          const dateStr = formData.start_date || new Date().toISOString().split('T')[0];
          
          displayName = namingSettings.subcontract_naming_pattern
            .replace('{vendor}', vendor?.name || 'Unknown')
            .replace('{contract_number}', formData.name || 'NoContractNum')
            .replace('{date}', dateStr)
            .replace('{amount}', parseFloat(formData.contract_amount || '0').toFixed(2))
            .replace('{job}', job?.name || 'NoJob')
            .replace('{original_filename}', file.name.replace(/\.[^/.]+$/, ''))
            + '.' + fileExt;
        }
        
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

        uploadedFiles.push({
          path: filePath,
          name: displayName
        });
      }

      return uploadedFiles;
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload contract files",
        variant: "destructive"
      });
      return uploadedFiles;
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
      let fileData: {path: string, name: string}[] = [];
      if (contractFiles.length > 0) {
        const uploadedFiles = await uploadFilesToStorage();
        fileData = uploadedFiles;
      }

      // Store file data as JSON array
      const fileDataString = fileData.length > 0 ? JSON.stringify(fileData) : formData.contract_file_url || null;

      const totalDistributedAmount = costDistribution.reduce((sum, dist) => sum + (dist.amount || 0), 0);

      const { error } = await supabase
        .from('subcontracts')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          scope_of_work: formData.scope_of_work.trim() || null,
          job_id: formData.job_id,
          vendor_id: formData.vendor_id,
          contract_amount: parseFloat(formData.contract_amount),
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          status: formData.status,
          contract_file_url: fileDataString,
          apply_retainage: formData.apply_retainage,
          retainage_percentage: formData.apply_retainage ? parseFloat(formData.retainage_percentage) : null,
          cost_distribution: costDistribution.length > 0 ? JSON.stringify(costDistribution) : null,
          total_distributed_amount: totalDistributedAmount,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subcontract created successfully",
      });

      // Navigate back to job details or subcontracts page
      if (jobId) {
        navigate(`/jobs/${jobId}`);
      } else {
        navigate(`/subcontracts`);
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

  // Show full-page PDF viewer if a PDF is being viewed
  if (viewingPdf) {
    return (
      <FullPagePdfViewer 
        file={viewingPdf} 
        onBack={() => setViewingPdf(null)} 
      />
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
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableStatuses().map(status => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!areRequiredFieldsFilled() && formData.status !== 'planning' && (
                    <p className="text-xs text-amber-600 mt-1">
                      Status will be set to Planning until all required fields are filled
                    </p>
                  )}
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

              <div>
                <Label htmlFor="scope_of_work">Scope of Work</Label>
                <Textarea
                  id="scope_of_work"
                  value={formData.scope_of_work}
                  onChange={(e) => handleInputChange("scope_of_work", e.target.value)}
                  placeholder="Enter detailed scope of work for this subcontract"
                  rows={5}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will be used in the generated contract document
                </p>
              </div>

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
                            .eq('company_id', currentCompany?.id)
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
            </CardContent>
          </Card>

          {/* Financial Section */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Section</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="apply_retainage"
                    checked={formData.apply_retainage}
                    onChange={(e) => handleInputChange("apply_retainage", e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="apply_retainage" className="cursor-pointer">
                    Apply retainage to payments
                  </Label>
                </div>
                
                {formData.apply_retainage && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="retainage_percentage">Retainage Percentage *</Label>
                      <div className="relative">
                        <Input
                          id="retainage_percentage"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.retainage_percentage}
                          onChange={(e) => handleInputChange("retainage_percentage", e.target.value)}
                          placeholder="0.00"
                          required={formData.apply_retainage}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Typical retainage is 5-10%
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Job Costing Distribution - Integrated */}
              {formData.contract_amount && parseFloat(formData.contract_amount) > 0 && formData.job_id && (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-base font-semibold">Job Costing Distribution</h4>
                  <JobCostingDistribution
                    contractAmount={parseFloat(formData.contract_amount)}
                    jobId={formData.job_id}
                    costCodeType="sub"
                    initialDistribution={costDistribution}
                    onChange={setCostDistribution}
                    disabled={isSubmitting}
                  />
                </div>
              )}
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
                        setFileNames({});
                      }}
                    >
                      Clear All
                    </Button>
                  </div>

                  {/* File List */}
                  <div className="space-y-3">
                    {contractFiles.map((file, index) => (
                      <div key={index} className="space-y-2">
                        <div 
                          className={cn(
                            "flex items-start justify-between p-3 border rounded-lg transition-colors",
                            file.type === 'application/pdf' 
                              ? "cursor-pointer hover:bg-primary/10 hover:border-primary" 
                              : ""
                          )}
                          onClick={() => {
                            if (file.type === 'application/pdf') {
                              setViewingPdf(file);
                            }
                          }}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="flex items-center justify-center w-10 h-10 bg-success/10 rounded flex-shrink-0">
                              <FileText className="h-5 w-5 text-success" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate text-sm">{file.name}</p>
                                {file.type === 'application/pdf' && (
                                  <Badge variant="secondary" className="text-xs">Click to view</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(file);
                            }}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* File name input */}
                        <div className="ml-14 space-y-1">
                          <Label htmlFor={`file-name-${index}`} className="text-xs">
                            Display Name (optional)
                          </Label>
                          <Input
                            id={`file-name-${index}`}
                            type="text"
                            placeholder={file.name}
                            value={fileNames[file.name] || ''}
                            onChange={(e) => {
                              setFileNames(prev => ({
                                ...prev,
                                [file.name]: e.target.value
                              }));
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Image Previews Only */}
                  {filePreviewUrls.filter(p => p.file.type.startsWith('image/')).length > 0 && (
                    <div className="space-y-4">
                      <p className="text-sm font-medium">Image Previews:</p>
                      {filePreviewUrls
                        .filter(preview => preview.file.type.startsWith('image/'))
                        .map((preview, index) => (
                          <div key={index} className="border rounded-lg p-4 bg-muted/50">
                            <p className="text-sm font-medium mb-2">{preview.file.name}</p>
                            <div className="flex justify-center">
                              <img
                                src={preview.url}
                                alt={`Preview ${preview.file.name}`}
                                className="max-w-full h-auto max-h-96 rounded object-contain"
                                onError={(e) => {
                                  console.error('Image preview error:', preview.file.name, e);
                                }}
                              />
                            </div>
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