import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import SubcontractCostDistribution from "@/components/SubcontractCostDistribution";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SubcontractEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    job_id: "",
    vendor_id: "",
    contract_amount: "",
    start_date: "",
    end_date: "",
    status: "active",
    apply_retainage: false,
    retainage_percentage: ""
  });

  const [costDistribution, setCostDistribution] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [hasPaidBills, setHasPaidBills] = useState(false);
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const companyId = currentCompany?.id || profile?.current_company_id;
        
        if (!companyId) {
          toast({
            title: "Error",
            description: "No company selected",
            variant: "destructive",
          });
          return;
        }

        // Check if user is admin or controller
        const isAdminOrController = profile?.role === 'admin' || profile?.role === 'controller';
        
        // Check for paid bills against this subcontract
        const { data: paidBills, error: billsError } = await supabase
          .from('invoices')
          .select('id')
          .eq('subcontract_id', id)
          .eq('status', 'paid');
        
        if (billsError) throw billsError;
        const hasPaid = (paidBills || []).length > 0;
        setHasPaidBills(hasPaid);
        setCanDelete(isAdminOrController && !hasPaid);

        // Fetch subcontract data
        const { data: subcontractData, error: subcontractError } = await supabase
          .from('subcontracts')
          .select('*')
          .eq('id', id)
          .single();

        if (subcontractError) throw subcontractError;

        setFormData({
          name: subcontractData.name,
          description: subcontractData.description || "",
          job_id: subcontractData.job_id,
          vendor_id: subcontractData.vendor_id,
          contract_amount: subcontractData.contract_amount.toString(),
          start_date: subcontractData.start_date || "",
          end_date: subcontractData.end_date || "",
          status: subcontractData.status,
          apply_retainage: subcontractData.apply_retainage || false,
          retainage_percentage: subcontractData.retainage_percentage?.toString() || ""
        });

        // Set existing file URL if available
        setExistingFileUrl(subcontractData.contract_file_url);

        // Set cost distribution data
        if (subcontractData.cost_distribution) {
          try {
            const parsedDistribution = typeof subcontractData.cost_distribution === 'string' 
              ? JSON.parse(subcontractData.cost_distribution) 
              : subcontractData.cost_distribution;
            setCostDistribution(parsedDistribution || []);
          } catch {
            setCostDistribution([]);
          }
        }

        // Fetch jobs
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, name, client')
          .eq('company_id', companyId)
          .order('name');

        if (jobsError) throw jobsError;
        setJobs(jobsData || []);

        // Fetch vendors
        const { data: vendorsData, error: vendorsError } = await supabase
          .from('vendors')
          .select('id, name, vendor_type')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('name');

        if (vendorsError) throw vendorsError;
        setVendors(vendorsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load subcontract data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user && (currentCompany?.id || profile?.current_company_id)) {
      fetchData();
    }
  }, [id, user, currentCompany, profile, toast]);

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
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name}: Please upload PDF, Word document, or image files only`,
          variant: "destructive"
        });
        continue;
      }

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
      setContractFiles(validFiles);
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

  const removeNewFile = () => {
    setContractFiles([]);
  };

  const removeExistingFile = async () => {
    if (!existingFileUrl) return;

    try {
      // Extract file path from URL
      const urlParts = existingFileUrl.split('/subcontract-files/');
      if (urlParts.length === 2) {
        const filePath = urlParts[1];
        
        await supabase.storage
          .from('subcontract-files')
          .remove([filePath]);
      }

      setExistingFileUrl(null);
      
      // Update database to remove file URL
      await supabase
        .from('subcontracts')
        .update({ contract_file_url: null })
        .eq('id', id);

      toast({
        title: "Success",
        description: "Contract file removed",
      });
    } catch (error) {
      console.error('Error removing file:', error);
      toast({
        title: "Error",
        description: "Failed to remove contract file",
        variant: "destructive",
      });
    }
  };

  const uploadFilesToStorage = async (): Promise<string | null> => {
    if (contractFiles.length === 0) return null;

    const companyId = currentCompany?.id || profile?.current_company_id;
    if (!companyId) return null;

    setUploadingFiles(true);

    try {
      const file = contractFiles[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${companyId}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('subcontract-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('subcontract-files')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload contract file",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const totalDistributedAmount = costDistribution.reduce((sum, dist) => sum + (dist.amount || 0), 0);
      const contractAmount = parseFloat(formData.contract_amount);
      
      // Validate status change requirements
      if (['active', 'completed', 'cancelled'].includes(formData.status)) {
        if (Math.abs(totalDistributedAmount - contractAmount) > 0.01) {
          toast({
            title: "Validation Error",
            description: "Job distribution must equal contract amount for active, completed, or cancelled status",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Upload new file if one was selected
      let fileUrl = existingFileUrl;
      if (contractFiles.length > 0) {
        const uploadedUrl = await uploadFilesToStorage();
        if (uploadedUrl) {
          fileUrl = uploadedUrl;
          // Delete old file if it exists
          if (existingFileUrl) {
            const urlParts = existingFileUrl.split('/subcontract-files/');
            if (urlParts.length === 2) {
              await supabase.storage
                .from('subcontract-files')
                .remove([urlParts[1]]);
            }
          }
        }
      }

      const { error } = await supabase
        .from('subcontracts')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          job_id: formData.job_id,
          vendor_id: formData.vendor_id,
          contract_amount: parseFloat(formData.contract_amount),
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          status: formData.status,
          apply_retainage: formData.apply_retainage,
          retainage_percentage: formData.apply_retainage ? parseFloat(formData.retainage_percentage) : null,
          cost_distribution: costDistribution.length > 0 ? JSON.stringify(costDistribution) : null,
          total_distributed_amount: totalDistributedAmount,
          contract_file_url: fileUrl
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subcontract updated successfully",
      });

      navigate(`/subcontracts/${id}`);
    } catch (error) {
      console.error('Error updating subcontract:', error);
      toast({
        title: "Error",
        description: "Failed to update subcontract",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const { error } = await supabase
        .from('subcontracts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subcontract deleted successfully",
      });

      navigate('/subcontracts');
    } catch (error) {
      console.error('Error deleting subcontract:', error);
      toast({
        title: "Error",
        description: "Failed to delete subcontract",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
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
        <Button variant="ghost" onClick={() => navigate(`/subcontracts/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Subcontract</h1>
          <p className="text-muted-foreground">Update subcontract details</p>
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
                       <SelectItem value="planning">Planning</SelectItem>
                       <SelectItem value="active">Active</SelectItem>
                       <SelectItem value="completed">Completed</SelectItem>
                       <SelectItem value="cancelled">Cancelled</SelectItem>
                     </SelectContent>
                  </Select>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="job">Job *</Label>
                  <Select value={formData.job_id} onValueChange={(value) => handleInputChange("job_id", value)}>
                    <SelectTrigger>
                      <SelectValue />
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
                      <SelectValue />
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
                  disabled={formData.status !== "planning"}
                />
                {formData.status !== "planning" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Financial details cannot be changed once subcontract is out of planning status
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="apply_retainage"
                    checked={formData.apply_retainage}
                    onChange={(e) => handleInputChange("apply_retainage", e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                    disabled={formData.status !== "planning"}
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
                          disabled={formData.status !== "planning"}
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
                  <SubcontractCostDistribution
                    contractAmount={parseFloat(formData.contract_amount)}
                    jobId={formData.job_id}
                    initialDistribution={costDistribution}
                    onChange={setCostDistribution}
                    disabled={isSubmitting || formData.status !== "planning"}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contract File Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Contract File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing file display */}
              {existingFileUrl && (
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Current contract file</span>
                      <a 
                        href={existingFileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm"
                      >
                        View file
                      </a>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeExistingFile}
                      disabled={isSubmitting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* File upload area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="contract-file-upload"
                  className="hidden"
                  onChange={handleFileInputChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  disabled={isSubmitting}
                />
                <label
                  htmlFor="contract-file-upload"
                  className="cursor-pointer"
                >
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Drag and drop contract file here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supported formats: PDF, Word, JPG, PNG (Max 10MB)
                    </p>
                  </div>
                </label>
              </div>

              {/* New file preview */}
              {contractFiles.length > 0 && (
                <div className="space-y-2">
                  {contractFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                      <span className="text-sm font-medium truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeNewFile}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate(`/subcontracts/${id}`)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          {canDelete && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Delete Subcontract</p>
                     <p className="text-sm text-muted-foreground">
                       {hasPaidBills 
                         ? "Cannot delete subcontract with paid bills against it."
                         : "This action cannot be undone. All data will be permanently deleted."
                       }
                     </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                       <Button variant="destructive" size="sm" disabled={deleting || hasPaidBills}>
                         <Trash2 className="h-4 w-4 mr-2" />
                         {deleting ? "Deleting..." : "Delete"}
                       </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                         <AlertDialogDescription>
                           {hasPaidBills 
                             ? "Cannot delete this subcontract because it has paid bills associated with it."
                             : "This action cannot be undone. This will permanently delete the subcontract and all associated data."
                           }
                         </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Subcontract
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </form>
    </div>
  );
}