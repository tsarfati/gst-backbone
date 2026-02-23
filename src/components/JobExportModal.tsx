import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Package, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { exportJobAsZip, ExportProgress } from "@/utils/jobExport";
import { useToast } from "@/hooks/use-toast";

interface JobExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobName: string;
}

export default function JobExportModal({
  open,
  onOpenChange,
  jobId,
  jobName,
}: JobExportModalProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({ stage: "", percent: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setDone(false);
    setError(null);
    setProgress({ stage: "Starting export…", percent: 0 });

    try {
      const blob = await exportJobAsZip(jobId, setProgress);

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${jobName.replace(/[^a-zA-Z0-9 _-]/g, "_")}-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDone(true);
      toast({
        title: "Export complete",
        description: "Job archive has been downloaded as a ZIP file.",
      });
    } catch (err: any) {
      console.error("Export failed:", err);
      setError(err.message || "Export failed");
      toast({
        title: "Export failed",
        description: err.message || "An error occurred during export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    if (!exporting) {
      setDone(false);
      setError(null);
      setProgress({ stage: "", percent: 0 });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Archive Job
          </DialogTitle>
          <DialogDescription>
            Download a complete archive of this job including all documents, photos, plans,
            financials, and a BuilderLynk re-import manifest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Folder structure preview */}
          {!exporting && !done && !error && (
            <div className="text-sm text-muted-foreground space-y-1 bg-muted/50 rounded-lg p-4 font-mono">
              <div>📁 {jobName}/</div>
              <div className="ml-4">📁 Documents/ <span className="text-xs">(filing cabinet)</span></div>
              <div className="ml-4">📁 Photos/ <span className="text-xs">(albums)</span></div>
              <div className="ml-4">📁 Plans/</div>
              <div className="ml-4">📁 RFIs/</div>
              <div className="ml-4">📁 Delivery Tickets/</div>
              <div className="ml-4">📁 Permits/</div>
              <div className="ml-4">📁 Subcontracts/</div>
              <div className="ml-4">📁 Financials/</div>
              <div className="ml-8">📁 Bills/</div>
              <div className="ml-8">📁 Receipts/</div>
              <div className="ml-8">📁 Payments/</div>
              <div className="ml-8">📁 Reports/</div>
              <div className="ml-4">📄 builderlynk-job.json</div>
            </div>
          )}

          {/* Progress */}
          {exporting && (
            <div className="space-y-3">
              <Progress value={progress.percent} />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress.stage}
              </div>
            </div>
          )}

          {/* Done */}
          {done && (
            <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg text-primary">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="text-sm">Archive downloaded successfully! The ZIP file includes a <code className="bg-primary/10 px-1 rounded">builderlynk-job.json</code> manifest for future re-import.</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={exporting}>
            {done ? "Close" : "Cancel"}
          </Button>
          {!done && (
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export as ZIP
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
