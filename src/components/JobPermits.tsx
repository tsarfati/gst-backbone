import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Eye, Trash2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DocumentPreviewModal from "./DocumentPreviewModal";

interface JobPermit {
  id: string;
  permit_name: string;
  permit_number: string;
  description: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface JobPermitsProps {
  jobId: string;
}

export default function JobPermits({ jobId }: JobPermitsProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [permits, setPermits] = useState<JobPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: string } | null>(null);
  
  const [formData, setFormData] = useState({
    permit_name: "",
    permit_number: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (jobId) {
      loadPermits();
    }
  }, [jobId]);

  const loadPermits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("job_permits")
        .select("*")
        .eq("job_id", jobId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setPermits(data || []);
    } catch (error: any) {
      console.error("Error loading permits:", error);
      toast({
        title: "Error",
        description: "Failed to load permits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !currentCompany) {
      toast({
        title: "Error",
        description: "Please select a file and fill in the required fields",
        variant: "destructive",
      });
      return;
    }

    if (!formData.permit_name) {
      toast({
        title: "Error",
        description: "Please enter a permit name",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      // Upload file to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${jobId}/${Date.now()}.${fileExt}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("job-permits")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("job-permits")
        .getPublicUrl(fileName);

      // Insert permit record
      const { error: insertError } = await supabase
        .from("job_permits")
        .insert({
          job_id: jobId,
          company_id: currentCompany.id,
          permit_name: formData.permit_name,
          permit_number: formData.permit_number || null,
          description: formData.description || null,
          file_name: selectedFile.name,
          file_url: publicUrl,
          uploaded_by: user.id,
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Permit uploaded successfully",
      });

      // Reset form
      setFormData({
        permit_name: "",
        permit_number: "",
        description: "",
      });
      setSelectedFile(null);
      setShowUploadDialog(false);
      
      // Reload permits
      loadPermits();
    } catch (error: any) {
      console.error("Error uploading permit:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload permit",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (permitId: string, fileUrl: string) => {
    if (!confirm("Are you sure you want to delete this permit?")) return;

    try {
      // Extract file path from URL
      const urlParts = fileUrl.split("/job-permits/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        
        // Delete from storage
        await supabase.storage
          .from("job-permits")
          .remove([filePath]);
      }

      // Delete record
      const { error } = await supabase
        .from("job_permits")
        .delete()
        .eq("id", permitId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Permit deleted successfully",
      });

      loadPermits();
    } catch (error: any) {
      console.error("Error deleting permit:", error);
      toast({
        title: "Error",
        description: "Failed to delete permit",
        variant: "destructive",
      });
    }
  };

  const handlePreview = (permit: JobPermit) => {
    const fileType = permit.file_name.split(".").pop()?.toLowerCase() || "";
    setPreviewFile({
      name: permit.file_name,
      url: permit.file_url,
      type: fileType,
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading permits...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Job Permits</h2>
          <p className="text-muted-foreground">Upload and manage permits for this job</p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Permit
        </Button>
      </div>

      {permits.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Permits Yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload permits to keep track of all required documentation for this job
              </p>
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload First Permit
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {permits.map((permit) => (
            <Card key={permit.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-primary mt-1" />
                    <div>
                      <CardTitle className="text-lg">{permit.permit_name}</CardTitle>
                      {permit.permit_number && (
                        <p className="text-sm text-muted-foreground">
                          Permit #: {permit.permit_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePreview(permit)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(permit.id, permit.file_url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {permit.description && (
                  <p className="text-sm text-muted-foreground mb-3">{permit.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>File: {permit.file_name}</span>
                  <span>•</span>
                  <span>Uploaded: {new Date(permit.uploaded_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Permit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="permit_name">Permit Name *</Label>
              <Input
                id="permit_name"
                value={formData.permit_name}
                onChange={(e) => setFormData({ ...formData, permit_name: e.target.value })}
                placeholder="e.g., Building Permit, Electrical Permit"
              />
            </div>

            <div>
              <Label htmlFor="permit_number">Permit Number</Label>
              <Input
                id="permit_number"
                value={formData.permit_number}
                onChange={(e) => setFormData({ ...formData, permit_number: e.target.value })}
                placeholder="Optional permit number"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description or notes"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="file">Select File *</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadDialog(false);
                  setFormData({
                    permit_name: "",
                    permit_number: "",
                    description: "",
                  });
                  setSelectedFile(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {previewFile && (
        <DocumentPreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          document={{
            fileName: previewFile.name,
            url: previewFile.url,
            type: previewFile.type,
          }}
        />
      )}
    </div>
  );
}
