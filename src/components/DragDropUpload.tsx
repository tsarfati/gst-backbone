import { useCallback, useState, type ReactNode } from 'react';
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
  title?: string;
  dropTitle?: string;
  subtitle?: string;
  helperText?: string;
  buttonLabel?: string;
  size?: 'default' | 'compact';
  icon?: ReactNode;
  buttonLabel?: string;
}

export default function DragDropUpload({
  onFileSelect,
  accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx",
  maxSize = 10,
  disabled = false,
  className,
  title = "Drag Files Here",
  dropTitle = "Drop File Here",
  subtitle = "or",
  helperText,
  size = 'default',
  icon,
  buttonLabel = "Choose File",
}: DragDropUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const compact = size === 'compact';

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
    e.target.value = '';
  }, [handleFile]);

  return (
    <div className={cn("w-full", className)}>
      <Card
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-colors cursor-pointer",
          isDragOver && !disabled ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-primary/50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className={cn(compact ? "px-4 py-3" : "px-4 py-4")}>
          <div className="flex items-center justify-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {icon ?? <Upload className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />}
              </span>
              <p className="text-sm font-medium">
                {isDragOver && !disabled ? dropTitle : title}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
            <Button type="button" variant="outline" size="sm" disabled={disabled}>
              {buttonLabel}
            </Button>
          </div>

          {helperText ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">{helperText}</p>
          ) : null}

          <input
            type="file"
            accept={accept}
            onChange={handleFileInput}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </CardContent>
      </Card>

      {error && (
        <div className="mt-2 flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/10 p-2">
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
