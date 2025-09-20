import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useReceipts } from "@/contexts/ReceiptContext";
import { Upload, FileText, X } from "lucide-react";

export default function UploadReceipts() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { addReceipts } = useReceipts();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    // Filter for valid file types
    const validFiles = newFiles.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      if (!isValidType) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type.`,
          variant: "destructive",
        });
      }
      return isValidType;
    });

    setFiles(prev => [...prev, ...validFiles]);
    
    if (validFiles.length > 0) {
      toast({
        title: "Files added",
        description: `${validFiles.length} file(s) added successfully.`,
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to upload.",
        variant: "destructive",
      });
      return;
    }

    // Convert File[] to FileList
    const fileList = new DataTransfer();
    files.forEach(file => fileList.items.add(file));
    
    // Add receipts to global state
    addReceipts(fileList.files);
    
    toast({
      title: "Upload successful",
      description: `${files.length} receipt(s) uploaded and ready for coding.`,
    });
    setFiles([]);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Upload Receipts</h1>
        <p className="text-muted-foreground">
          Batch upload receipts for project coding
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="receipt-upload">Select Receipt Files</Label>
              <Input
                ref={fileInputRef}
                id="receipt-upload"
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Supports images and PDF files
              </p>
            </div>

            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? "border-primary bg-primary/5 border-solid" 
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleDropZoneClick}
            >
              <Upload className={`h-10 w-10 mx-auto mb-4 ${
                isDragActive ? "text-primary" : "text-muted-foreground"
              }`} />
              <p className="text-lg font-medium mb-2">
                {isDragActive ? "Drop files here" : "Drop files here"}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse files
              </p>
            </div>

            <Button onClick={handleUpload} className="w-full" disabled={files.length === 0}>
              Upload {files.length} Receipt{files.length !== 1 ? 's' : ''}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selected Files ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No files selected
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-accent rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}