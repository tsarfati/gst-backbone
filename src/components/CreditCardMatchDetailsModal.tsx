import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import UrlPdfInlinePreview from "@/components/UrlPdfInlinePreview";

interface CreditCardMatchDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: any;
  onSelectMatch: () => void;
}

export function CreditCardMatchDetailsModal({
  open,
  onOpenChange,
  match,
  onSelectMatch,
}: CreditCardMatchDetailsModalProps) {
  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <span>{match.display}</span>
            <Badge 
              variant={
                match.matchScore >= 95 ? "default" : 
                match.matchScore >= 75 ? "secondary" : 
                "outline"
              }
              className={
                match.matchScore >= 95 ? "bg-green-600 dark:bg-green-700" :
                match.matchScore >= 75 ? "bg-blue-600 dark:bg-blue-700" :
                "bg-gray-500 dark:bg-gray-600"
              }
            >
              {match.matchScore}% match
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Match Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Amount</p>
              <p className="text-lg font-semibold">${Number(match.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date</p>
              <p className="text-lg font-semibold">{new Date(match.date).toLocaleDateString()}</p>
            </div>
            {match.vendor && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vendor</p>
                <p className="text-lg">{match.vendor}</p>
              </div>
            )}
            {match.status && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant="outline">{match.status}</Badge>
              </div>
            )}
            {match.jobName && (
              <div className="col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Job</p>
                <p className="text-lg">{match.jobName}</p>
              </div>
            )}
            {match.costCode && (
              <div className="col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Cost Code</p>
                <p className="text-lg">{match.costCode}</p>
              </div>
            )}
          </div>

          {/* Document Preview */}
          {match.attachmentUrl && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Document Preview
              </p>
              <div className="border rounded-lg overflow-hidden">
                <UrlPdfInlinePreview 
                  url={match.attachmentUrl} 
                  className="max-h-[500px] overflow-auto"
                />
              </div>
            </div>
          )}

          {!match.attachmentUrl && (
            <div className="text-center py-8 text-muted-foreground">
              No document available for preview
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSelectMatch}>
            <Check className="h-4 w-4 mr-2" />
            Select This Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
