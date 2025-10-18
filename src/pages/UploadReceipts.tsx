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
  const [fileAmounts, setFileAmounts] = useState<Record<string, string>>({});
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
    const fileToRemove = files[index];
    const fileKey = `${fileToRemove.name}_${fileToRemove.size}`;
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFileAmounts(prev => {
      const newAmounts = { ...prev };
      delete newAmounts[fileKey];
      return newAmounts;
    });
  };

  const updateFileAmount = (file: File, amount: string) => {
    const fileKey = `${file.name}_${file.size}`;
    setFileAmounts(prev => ({ ...prev, [fileKey]: amount }));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to upload.",
        variant: "destructive",
      });
      return;
    }

    // Validate that all files have amounts
    const filesWithoutAmounts = files.filter(file => {
      const fileKey = `${file.name}_${file.size}`;
      const amount = fileAmounts[fileKey];
      return !amount || parseFloat(amount) <= 0;
    });

    if (filesWithoutAmounts.length > 0) {
      toast({
        title: "Missing amounts",
        description: "Please enter a dollar amount for all receipts before uploading.",
        variant: "destructive",
      });
      return;
    }

    // Convert File[] to FileList and create amounts array
    const fileList = new DataTransfer();
    const amounts: number[] = [];
    files.forEach(file => {
      fileList.items.add(file);
      const fileKey = `${file.name}_${file.size}`;
      amounts.push(parseFloat(fileAmounts[fileKey]));
    });
    
    // Add receipts to global state with amounts
    await addReceipts(fileList.files, amounts);
    
    toast({
      title: "Upload successful",
      description: `${files.length} receipt(s) uploaded and ready for coding.`,
    });
    setFiles([]);
    setFileAmounts({});
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
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {files.map((file, index) => {
                  const fileKey = `${file.name}_${file.size}`;
                  const amount = fileAmounts[fileKey] || '';
                  return (
                    <div
                      key={index}
                      className="p-3 bg-accent rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{file.name}</p>
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
                      <div className="space-y-1">
                        <Label htmlFor={`amount-${index}`} className="text-xs">
                          Amount <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`amount-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => updateFileAmount(file, e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}