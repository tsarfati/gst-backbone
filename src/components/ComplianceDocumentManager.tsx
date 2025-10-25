import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, FileText, AlertTriangle, Calendar, Eye, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DragDropUpload from "./DragDropUpload";
import DocumentPreviewModal from "./DocumentPreviewModal";

interface ComplianceDocument {
  id?: string;
  type: 'insurance' | 'w9' | 'license';
  required: boolean;
  uploaded: boolean;
  fileName?: string;
  uploadDate?: string;
  expirationDate?: string;
  url?: string;
  status?: 'missing' | 'uploaded' | 'expired';
}

interface ComplianceDocumentManagerProps {
  vendorId: string;
  documents: ComplianceDocument[];
  onDocumentsChange: (documents: ComplianceDocument[]) => void;
  isEditMode?: boolean;
}

export default function ComplianceDocumentManager({
  vendorId,
  documents,
  onDocumentsChange,
  isEditMode = false
}: ComplianceDocumentManagerProps) {
  const { profile, user } = useAuth();
  const [editingDoc, setEditingDoc] = useState<ComplianceDocument | null>(null);
  const [expirationDate, setExpirationDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{fileName: string; url: string; type: string} | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const { toast } = useToast();

  const canViewSensitiveData = profile?.role === 'admin' || profile?.role === 'controller';

  const documentTypes = [
    { type: 'insurance' as const, label: 'Insurance', icon: FileText },
    { type: 'w9' as const, label: 'W-9 Form', icon: FileText },
    { type: 'license' as const, label: 'License', icon: FileText }
  ];

  const getDocumentByType = (type: string) => {
    return documents.find(doc => doc.type === type) || {
      type: type as any,
      required: false,
      uploaded: false
    };
  };

  const updateDocument = async (type: string, updates: Partial<ComplianceDocument>) => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Check if document exists
      const existingDoc = documents.find(doc => doc.type === type);
      
      if (existingDoc?.id) {
        // Update existing document - only update fields that are provided
        const updateData: any = {};
        if (updates.required !== undefined) updateData.is_required = updates.required;
        if (updates.fileName !== undefined) updateData.file_name = updates.fileName;
        if (updates.url !== undefined) updateData.file_url = updates.url;
        if (updates.uploadDate !== undefined) updateData.uploaded_at = updates.uploadDate;
        if (updates.expirationDate !== undefined) updateData.expiration_date = updates.expirationDate;
        if (updates.uploaded !== undefined) updateData.is_uploaded = updates.uploaded;
        
        const { error } = await supabase
          .from('vendor_compliance_documents')
          .update(updateData)
          .eq('id', existingDoc.id);
          
        if (error) throw error;
      } else {
        // Create new document
        const { error } = await supabase
          .from('vendor_compliance_documents')
          .insert({
            vendor_id: vendorId,
            type: type,
            is_required: updates.required || false,
            file_name: updates.fileName,
            file_url: updates.url,
            uploaded_at: updates.uploadDate,
            expiration_date: updates.expirationDate,
            is_uploaded: updates.uploaded || false
          });
          
        if (error) throw error;
      }
      
      // Refresh documents
      await fetchComplianceDocuments();
      
      toast({
        title: "Success",
        description: "Compliance document updated successfully",
      });
    } catch (error) {
      console.error('Error updating compliance document:', error);
      toast({
        title: "Error",
        description: "Failed to update compliance document",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComplianceDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_compliance_documents')
        .select('*')
        .eq('vendor_id', vendorId);
        
      if (error) throw error;
      
      const transformedDocs: ComplianceDocument[] = (data || []).map(doc => ({
        id: doc.id,
        type: doc.type as any,
        required: doc.is_required,
        uploaded: doc.is_uploaded,
        fileName: doc.file_name || undefined,
        uploadDate: doc.uploaded_at || undefined,
        expirationDate: doc.expiration_date || undefined,
        url: doc.file_url || undefined,
        status: doc.is_uploaded ? 'uploaded' : 'missing'
      }));
      
      onDocumentsChange(transformedDocs);
    } catch (error) {
      console.error('Error fetching compliance documents:', error);
    }
  };

  useEffect(() => {
    if (vendorId) {
      fetchComplianceDocuments();
    }
  }, [vendorId]);

  const handleFileUpload = async (type: string, file: File) => {
    if (!file || !user) return;
    
    setUploading(type);
    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendorId}/${type}/${Date.now()}.${fileExt}`;
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('vendor-compliance-docs')
        .upload(fileName, file);

      if (error) throw error;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('vendor-compliance-docs')
        .getPublicUrl(fileName);

      // Update document record
      await updateDocument(type, {
        uploaded: true,
        fileName: file.name,
        uploadDate: new Date().toISOString(),
        url: publicUrl
      });

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleLegacyFileUpload = (type: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(type, file);
    }
  };

  const handleRequiredToggle = async (type: string, required: boolean) => {
    await updateDocument(type, { required });
  };

  const handleExpirationDateSave = async (type: string) => {
    await updateDocument(type, { expirationDate });
    setEditingDoc(null);
    setExpirationDate('');
  };

  const isExpired = (doc: ComplianceDocument) => {
    if (!doc.expirationDate) return false;
    return new Date(doc.expirationDate) < new Date();
  };

  const getMissingRequiredCount = () => {
    return documents.filter(doc => doc.required && !doc.uploaded).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Compliance Documents</h3>
          {getMissingRequiredCount() > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {getMissingRequiredCount()} Missing
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {documentTypes
          .filter(({ type }) => {
            // In edit mode, show all document types
            if (isEditMode) return true;
            
            // In view mode, only show documents that are required or uploaded
            const doc = getDocumentByType(type);
            return doc.required || doc.uploaded;
          })
          .map(({ type, label, icon: Icon }) => {
          const doc = getDocumentByType(type);
          const expired = isExpired(doc);
          
          return (
            <Card key={type} className={expired ? "border-destructive" : ""}>
              <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{label}</span>
                    {expired && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Expired
                      </Badge>
                    )}
                  </div>
                  {isEditMode && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`required-${type}`} className="text-sm">Required</Label>
                        <Switch
                          id={`required-${type}`}
                          checked={doc.required}
                          onCheckedChange={(checked) => handleRequiredToggle(type, checked)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {(doc.required || doc.uploaded) && (
                  <div className="space-y-3">
                    {!doc.uploaded && (isEditMode || doc.required) ? (
                      <div className="space-y-3">
                        <DragDropUpload
                          onFileSelect={(file) => handleFileUpload(type, file)}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          maxSize={10}
                          disabled={uploading === type}
                        />
                        <div className="text-center text-xs text-muted-foreground">
                          or
                        </div>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => handleLegacyFileUpload(type, e)}
                          disabled={uploading === type}
                          className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                        />
                        {uploading === type && (
                          <div className="text-center text-sm text-muted-foreground">
                            Uploading document...
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => {
                              if (doc.url && canViewSensitiveData) {
                                setPreviewDocument({
                                  fileName: doc.fileName || 'Document',
                                  url: doc.url,
                                  type: doc.type
                                });
                              }
                            }}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="hover:underline">{doc.fileName}</span>
                            {doc.uploadDate && (
                              <span className="text-xs">
                                • Uploaded {new Date(doc.uploadDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {canViewSensitiveData && doc.url && (
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2"
                                onClick={() => setPreviewDocument({
                                  fileName: doc.fileName || 'Document',
                                  url: doc.url,
                                  type: doc.type
                                })}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2"
                                onClick={async () => {
                                  if (doc.url) {
                                    try {
                                      const response = await fetch(doc.url);
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = doc.fileName || 'document';
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      window.URL.revokeObjectURL(url);
                                    } catch (error) {
                                      console.error('Download failed:', error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to download document",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {(type === 'insurance' || type === 'license') && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`expiration-${type}`} className="text-sm font-medium">
                                Expiration Date {type === 'insurance' && <span className="text-destructive">*</span>}
                              </Label>
                              {doc.expirationDate ? (
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium ${expired ? 'text-destructive' : 'text-foreground'}`}>
                                    {new Date(doc.expirationDate).toLocaleDateString()}
                                  </span>
                                  {(profile?.role === 'admin' || profile?.role === 'controller') && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingDoc(doc);
                                        setExpirationDate(doc.expirationDate || '');
                                      }}
                                      className="h-6 px-2"
                                    >
                                      Edit
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingDoc(doc);
                                    setExpirationDate('');
                                  }}
                                  className="h-6 px-2"
                                >
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Add Date
                                </Button>
                              )}
                            </div>
                            {expired && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                                <AlertTriangle className="h-3 w-3" />
                                This document expired on {new Date(doc.expirationDate!).toLocaleDateString()}
                              </div>
                            )}
                            {!expired && doc.expirationDate && (() => {
                              const daysUntil = Math.floor((new Date(doc.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                              return daysUntil <= 30 ? (
                                <div className="mt-2 flex items-center gap-1 text-xs text-warning">
                                  <AlertTriangle className="h-3 w-3" />
                                  Expires in {daysUntil} days
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!editingDoc} onOpenChange={() => setEditingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set Expiration Date</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the expiration date for this document. {editingDoc?.expirationDate && !(['admin', 'controller'].includes(profile?.role || '')) && (
                <span className="text-warning block mt-2">
                  Note: Once set, only admins and controllers can modify expiration dates.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="expiration-input">Expiration Date</Label>
            <Input
              id="expiration-input"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="mt-2"
              min={new Date().toISOString().split('T')[0]}
            />
            {editingDoc?.expirationDate && (
              <p className="text-xs text-muted-foreground mt-2">
                Current expiration: {new Date(editingDoc.expirationDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => editingDoc && handleExpirationDateSave(editingDoc.type)}>
              Save Date
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DocumentPreviewModal
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument}
      />
    </div>
  );
}