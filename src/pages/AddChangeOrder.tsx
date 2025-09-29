import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { z } from "zod";

const changeOrderSchema = z.object({
  subcontract_id: z.string().uuid({ message: "Invalid subcontract" }),
  change_order_number: z.string().trim().min(1, { message: "Change order number is required" }).max(50),
  description: z.string().trim().min(1, { message: "Description is required" }).max(1000),
  amount: z.number().min(0, { message: "Amount must be positive" }),
  status: z.enum(["pending", "approved", "rejected"]),
  reason: z.string().max(500).optional(),
});

export default function AddChangeOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  
  const subcontractId = searchParams.get('subcontractId');
  
  const [formData, setFormData] = useState({
    change_order_number: "",
    description: "",
    amount: "",
    status: "pending",
    reason: "",
    effective_date: "",
  });

  const [subcontract, setSubcontract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const fetchSubcontract = async () => {
      if (!subcontractId) {
        toast({
          title: "Error",
          description: "No subcontract specified",
          variant: "destructive",
        });
        navigate('/subcontracts');
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('subcontracts')
          .select('*, jobs(id, name), vendors(id, name)')
          .eq('id', subcontractId)
          .single();

        if (error) throw error;
        setSubcontract(data);
      } catch (error) {
        console.error('Error fetching subcontract:', error);
        toast({
          title: "Error",
          description: "Failed to load subcontract details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchSubcontract();
    }
  }, [user, subcontractId, toast, navigate]);

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
      setAttachments(prev => [...prev, ...validFiles]);
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
    setAttachments(prev => prev.filter(f => f !== fileToRemove));
  };

  const uploadAttachments = async (changeOrderId: string): Promise<string[]> => {
    if (attachments.length === 0) return [];

    const companyId = currentCompany?.id;
    if (!companyId) return [];

    const uploadedPaths: string[] = [];

    try {
      for (const file of attachments) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${companyId}/change-orders/${changeOrderId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('subcontract-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Error uploading file:', file.name, uploadError);
          continue;
        }

        uploadedPaths.push(filePath);
      }

      return uploadedPaths;
    } catch (error) {
      console.error('Error uploading attachments:', error);
      return uploadedPaths;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subcontractId) return;

    // Validate form data
    try {
      changeOrderSchema.parse({
        subcontract_id: subcontractId,
        change_order_number: formData.change_order_number,
        description: formData.description,
        amount: parseFloat(formData.amount),
        status: formData.status,
        reason: formData.reason || undefined,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { data: changeOrder, error: insertError } = await supabase
        .from('change_orders' as any)
        .insert({
          subcontract_id: subcontractId,
          change_order_number: formData.change_order_number.trim(),
          description: formData.description.trim(),
          amount: parseFloat(formData.amount),
          status: formData.status,
          reason: formData.reason.trim() || null,
          effective_date: formData.effective_date || null,
          created_by: user.id
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload attachments if any
      if (attachments.length > 0 && changeOrder && (changeOrder as any).id) {
        const uploadedPaths = await uploadAttachments((changeOrder as any).id);
        if (uploadedPaths.length > 0) {
          await supabase
            .from('change_orders' as any)
            .update({ attachment_urls: JSON.stringify(uploadedPaths) } as any)
            .eq('id', (changeOrder as any).id);
        }
      }

      toast({
        title: "Success",
        description: "Change order created successfully",
      });

      navigate(`/subcontracts/${subcontractId}`);
    } catch (error) {
      console.error('Error creating change order:', error);
      toast({
        title: "Error",
        description: "Failed to create change order",
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

  if (!subcontract) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Subcontract not found</p>
          <Button onClick={() => navigate('/subcontracts')} className="mt-4">
            Back to Subcontracts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(`/subcontracts/${subcontractId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Change Order</h1>
          <p className="text-muted-foreground">
            For: {subcontract.name} - {subcontract.vendors?.name}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="change_order_number">Change Order Number *</Label>
                  <Input
                    id="change_order_number"
                    value={formData.change_order_number}
                    onChange={(e) => handleInputChange("change_order_number", e.target.value)}
                    placeholder="CO-001"
                    required
                    maxLength={50}
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
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Describe the change order"
                  rows={3}
                  required
                  maxLength={1000}
                />
              </div>

              <div>
                <Label htmlFor="reason">Reason for Change</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => handleInputChange("reason", e.target.value)}
                  placeholder="Optional: Explain why this change order is necessary"
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="effective_date">Effective Date</Label>
                  <Input
                    id="effective_date"
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => handleInputChange("effective_date", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
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
                      <p className="text-lg font-medium">Upload Supporting Documents</p>
                      <p className="text-sm text-muted-foreground">
                        Drag and drop files here, or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Supported: PDF, Word, JPG, PNG • Max 10MB per file
                      </p>
                    </div>
                    <div>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileInputChange}
                        className="hidden"
                        id="attachment-upload"
                        multiple
                      />
                      <Button type="button" asChild variant="outline">
                        <label htmlFor="attachment-upload" className="cursor-pointer">
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
                    <p className="text-sm font-medium">{attachments.length} file{attachments.length > 1 ? 's' : ''} selected</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttachments([])}
                    >
                      Clear All
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {attachments.map((file, index) => (
                      <div 
                        key={index} 
                        className="flex items-start justify-between p-3 border rounded-lg"
                      >
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

                  <div className="pt-2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileInputChange}
                      className="hidden"
                      id="attachment-upload-more"
                      multiple
                    />
                    <Button type="button" asChild variant="outline" size="sm">
                      <label htmlFor="attachment-upload-more" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Add More Files
                      </label>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate(`/subcontracts/${subcontractId}`)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="min-w-32"
            >
              {isSubmitting ? "Creating..." : "Create Change Order"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
