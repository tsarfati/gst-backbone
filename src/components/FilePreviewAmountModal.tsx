import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import UrlPdfInlinePreview from "./UrlPdfInlinePreview";

interface FilePreviewAmountModalProps {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (amount: string) => void;
  initialAmount?: string;
}

export default function FilePreviewAmountModal({ 
  file, 
  open, 
  onOpenChange,
  onSave,
  initialAmount = ''
}: FilePreviewAmountModalProps) {
  const [amount, setAmount] = useState(initialAmount);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setAmount(initialAmount);
  }, [initialAmount]);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  if (!file) return null;

  const isPdf = file.type === 'application/pdf';

  const handleSave = () => {
    onSave(amount);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[90vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{file.name}</DialogTitle>
        </DialogHeader>

        {/* Amount Input at Top */}
        <div className="space-y-2 pb-4 border-b">
          <Label htmlFor="receipt-amount">
            Receipt Amount <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="receipt-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSave} disabled={!amount || parseFloat(amount) <= 0}>
              Save Amount
            </Button>
          </div>
        </div>

        {/* File Preview */}
        <div className="flex-1 border rounded-lg overflow-hidden bg-muted/30 min-h-0">
          <div className="w-full h-full overflow-auto">
            {isPdf && previewUrl ? (
              <UrlPdfInlinePreview url={previewUrl} className="h-full" />
            ) : previewUrl ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                <img
                  src={previewUrl}
                  alt="File preview"
                  className="max-w-full h-auto"
                />
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
