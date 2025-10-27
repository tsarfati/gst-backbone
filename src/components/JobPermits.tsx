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
import { FileText, Upload, Plus, Pencil } from "lucide-react";
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
  const [editingPermit, setEditingPermit] = useState<JobPermit | null>(null);
  const [previewFile, setPreviewFile] = useState<{ permit: JobPermit; editMode: boolean } | null>(null);
  
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
    if (!user || !currentCompany) {
      toast({
        title: "Error",
        description: "User or company information is missing",
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

    // For new uploads, file is required
    if (!editingPermit && !selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      let fileUrl = editingPermit?.file_url;
      let fileName = editingPermit?.file_name;

      // If a new file is selected, upload it
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const storagePath = `${jobId}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("job-permits")
          .upload(storagePath, selectedFile);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("job-permits")
          .getPublicUrl(storagePath);

        fileUrl = publicUrl;
        fileName = selectedFile.name;

        // If editing, delete the old file
        if (editingPermit) {
          const urlParts = editingPermit.file_url.split("/job-permits/");
          if (urlParts.length > 1) {
            await supabase.storage
              .from("job-permits")
              .remove([urlParts[1]]);
          }
        }
      }

      if (editingPermit) {
        // Update existing permit
        const { error: updateError } = await supabase
          .from("job_permits")
          .update({
            permit_name: formData.permit_name,
            permit_number: formData.permit_number || null,
            description: formData.description || null,
            file_name: fileName,
            file_url: fileUrl,
          })
          .eq("id", editingPermit.id);

        if (updateError) throw updateError;

        toast({
          title: "Success",
          description: "Permit updated successfully",
        });
      } else {
        // Insert new permit
        const { error: insertError } = await supabase
          .from("job_permits")
          .insert({
            job_id: jobId,
            company_id: currentCompany.id,
            permit_name: formData.permit_name,
            permit_number: formData.permit_number || null,
            description: formData.description || null,
            file_name: fileName!,
            file_url: fileUrl!,
            uploaded_by: user.id,
          });

        if (insertError) throw insertError;

        toast({
          title: "Success",
          description: "Permit uploaded successfully",
        });
      }

      // Reset form
      setFormData({
        permit_name: "",
        permit_number: "",
        description: "",
      });
      setSelectedFile(null);
      setShowUploadDialog(false);
      setEditingPermit(null);
      
      // Reload permits
      loadPermits();
    } catch (error: any) {
      console.error("Error saving permit:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save permit",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (permit: JobPermit) => {
    setEditingPermit(permit);
    setFormData({
      permit_name: permit.permit_name,
      permit_number: permit.permit_number || "",
      description: permit.description || "",
    });
    setSelectedFile(null);
    setPreviewFile({ permit, editMode: true });
  };

  const handlePreview = (permit: JobPermit) => {
    setPreviewFile({ permit, editMode: false });
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
            <Card 
              key={permit.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePreview(permit)}
            >
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(permit);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
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

      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        setShowUploadDialog(open);
        if (!open) {
          setEditingPermit(null);
          setFormData({
            permit_name: "",
            permit_number: "",
            description: "",
          });
          setSelectedFile(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPermit ? "Edit Permit" : "Upload Permit"}</DialogTitle>
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
              <Label htmlFor="file">{editingPermit ? "Replace File (optional)" : "Select File *"}</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              {selectedFile ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {selectedFile.name}
                </p>
              ) : editingPermit ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Current file: {editingPermit.file_name}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadDialog(false);
                  setEditingPermit(null);
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
              <Button 
                onClick={handleUpload} 
                disabled={uploading || (!editingPermit && !selectedFile)}
              >
                {uploading ? "Saving..." : editingPermit ? "Update" : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {previewFile && (
        <DocumentPreviewModal
          isOpen={!!previewFile}
          onClose={() => {
            setPreviewFile(null);
            setEditingPermit(null);
            setFormData({
              permit_name: "",
              permit_number: "",
              description: "",
            });
            setSelectedFile(null);
          }}
          document={{
            fileName: previewFile.permit.file_name,
            url: previewFile.permit.file_url,
            type: previewFile.permit.file_name.split(".").pop()?.toLowerCase() || "",
          }}
          editMode={previewFile.editMode}
          editData={previewFile.editMode ? formData : undefined}
          onEditDataChange={previewFile.editMode ? setFormData : undefined}
          onFileSelect={previewFile.editMode ? setSelectedFile : undefined}
          selectedFile={previewFile.editMode ? selectedFile : undefined}
          onSave={previewFile.editMode ? handleUpload : undefined}
          saving={uploading}
        />
      )}
    </div>
  );
}
