import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MultiFileUploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
  dragLabel?: string;
  buttonLabel?: string;
  subtitle?: string;
  helperText?: string;
  compact?: boolean;
}

export default function MultiFileUploadDropzone({
  onFilesSelected,
  accept = ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx",
  disabled = false,
  className,
  dragLabel = "Drag Files Here",
  buttonLabel = "Choose Files to Add",
  subtitle,
  helperText,
  compact = false,
}: MultiFileUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pushFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList || []);
    if (files.length === 0 || disabled) return;
    onFilesSelected(files);
  }, [disabled, onFilesSelected]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    pushFiles(event.dataTransfer.files);
  }, [pushFiles]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    pushFiles(event.target.files || []);
    event.target.value = "";
  }, [pushFiles]);

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-dashed border-muted-foreground/35 bg-muted/10 transition-colors",
        compact ? "px-4 py-3" : "p-6",
        isDragging && !disabled && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      <div className={cn(
        "flex items-center justify-center text-center",
        compact ? "gap-3" : "flex-col gap-4 md:flex-row"
      )}>
        <div className={cn(
          "flex items-center font-medium tracking-tight",
          compact ? "gap-2 text-sm" : "gap-3 text-2xl"
        )}>
          <Upload className={cn("text-muted-foreground", compact ? "h-4 w-4" : "h-6 w-6")} />
          <span>{isDragging ? "Drop Files Here" : dragLabel}</span>
        </div>
        <span className={cn("text-muted-foreground", compact ? "text-sm" : "text-xl")}>or</span>
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "lg"}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {buttonLabel}
        </Button>
      </div>

      {(subtitle || helperText) && (
        <div className="mt-4 space-y-1 text-center text-sm text-muted-foreground">
          {subtitle ? <p>{subtitle}</p> : null}
          {helperText ? <p>{helperText}</p> : null}
        </div>
      )}
    </div>
  );
}
