import { useCallback, useRef } from 'react';
import { ImagePlus } from 'lucide-react';

interface MultiFileUploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  label?: string;
  disabled?: boolean;
}

export default function MultiFileUploadDropzone({
  onFilesSelected,
  accept = 'image/*',
  multiple = true,
  maxFiles,
  label = 'Drop files here or click to browse',
  disabled = false,
}: MultiFileUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      let arr = Array.from(files);
      if (maxFiles) arr = arr.slice(0, maxFiles);
      onFilesSelected(arr);
    },
    [onFilesSelected, maxFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles, disabled],
  );

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        disabled
          ? 'border-muted bg-muted/30 cursor-not-allowed opacity-50'
          : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
      <ImagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
