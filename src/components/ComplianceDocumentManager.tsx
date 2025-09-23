import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, FileText, AlertTriangle, Calendar, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
}

export default function ComplianceDocumentManager({
  vendorId,
  documents,
  onDocumentsChange
}: ComplianceDocumentManagerProps) {
  const { profile, user } = useAuth();
  const [editingDoc, setEditingDoc] = useState<ComplianceDocument | null>(null);
  const [expirationDate, setExpirationDate] = useState('');
  const [loading, setLoading] = useState(false);
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
        // Update existing document
        const { error } = await supabase
          .from('vendor_compliance_documents')
          .update({
            is_required: updates.required,
            file_name: updates.fileName,
            file_url: updates.url,
            uploaded_at: updates.uploadDate,
            expiration_date: updates.expirationDate,
            is_uploaded: updates.uploaded || false
          })
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

  const handleFileUpload = (type: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real app, you'd upload this to Supabase storage
      updateDocument(type, {
        uploaded: true,
        fileName: file.name,
        uploadDate: new Date().toISOString(),
        url: `uploads/compliance/${vendorId}/${file.name}`
      });
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
        {documentTypes.map(({ type, label, icon: Icon }) => {
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
                </div>

                {doc.required && (
                  <div className="space-y-3">
                    {!doc.uploaded ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => handleFileUpload(type, e)}
                          className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span>{doc.fileName}</span>
                            {doc.uploadDate && (
                              <span className="text-xs">
                                • Uploaded {new Date(doc.uploadDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {canViewSensitiveData && (
                            <Button variant="ghost" size="sm" className="h-6 px-2">
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {type === 'insurance' && (
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`expiration-${type}`} className="text-sm">Expiration Date:</Label>
                            {doc.expirationDate ? (
                              <div className="flex items-center gap-2">
                                <span className={`text-sm ${expired ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {new Date(doc.expirationDate).toLocaleDateString()}
                                </span>
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
            <AlertDialogTitle>Set Insurance Expiration Date</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the expiration date for the insurance document.
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
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => editingDoc && handleExpirationDateSave(editingDoc.type)}>
              Save Date
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}