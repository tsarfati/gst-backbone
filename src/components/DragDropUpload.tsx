import { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DragDropUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in MB
  disabled?: boolean;
  className?: string;
}

export default function DragDropUpload({
  onFileSelect,
  accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx",
  maxSize = 10,
  disabled = false,
  className
}: DragDropUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize * 1024 * 1024) {
      return `File size must be less than ${maxSize}MB`;
    }

    const acceptedTypes = accept.split(',').map(type => type.trim());
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!acceptedTypes.includes(fileExtension)) {
      return `File type not supported. Accepted types: ${accept}`;
    }

    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelect(file);
  }, [onFileSelect, accept, maxSize]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile, disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input value so same file can be selected again
    e.target.value = '';
  }, [handleFile]);

  return (
    <div className={cn("w-full", className)}>
      <Card 
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragOver && !disabled ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className={cn(
              "p-3 rounded-full",
              isDragOver && !disabled ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <Upload className="h-6 w-6" />
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isDragOver && !disabled 
                  ? "Drop file here" 
                  : "Drag and drop a file here"
                }
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse files
              </p>
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Supported formats: {accept.replace(/\./g, '').toUpperCase()}</p>
              <p>Maximum size: {maxSize}MB</p>
            </div>

            <input
              type="file"
              accept={accept}
              onChange={handleFileInput}
              disabled={disabled}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="h-auto p-1 text-destructive hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}