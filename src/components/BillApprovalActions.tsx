import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BillApprovalActionsProps {
  billId: string;
  currentStatus: string;
  onStatusUpdate: () => void;
}

export default function BillApprovalActions({ billId, currentStatus, onStatusUpdate }: BillApprovalActionsProps) {
  const { toast } = useToast();

  const updateBillStatus = async (newStatus: string, statusText: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', billId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Bill ${statusText.toLowerCase()} successfully`,
      });

      onStatusUpdate();
    } catch (error) {
      console.error('Error updating bill status:', error);
      toast({
        title: "Error",
        description: `Failed to ${statusText.toLowerCase()} bill`,
        variant: "destructive",
      });
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending_approval":
        return { text: "Pending Approval", variant: "warning" as const, icon: Clock };
      case "pending_payment":
        return { text: "Pending Payment", variant: "secondary" as const, icon: Clock };
      case "paid":
        return { text: "Paid", variant: "success" as const, icon: CheckCircle };
      case "rejected":
        return { text: "Rejected", variant: "destructive" as const, icon: XCircle };
      case "overdue":
        return { text: "Overdue", variant: "destructive" as const, icon: AlertTriangle };
      default:
        return { text: status, variant: "default" as const, icon: Clock };
    }
  };

  const statusDisplay = getStatusDisplay(currentStatus);
  const StatusIcon = statusDisplay.icon;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground mb-2">Current Status</p>
        <Badge variant={statusDisplay.variant} className="flex items-center gap-1 w-fit">
          <StatusIcon className="h-3 w-3" />
          {statusDisplay.text}
        </Badge>
      </div>

      {currentStatus === 'pending_approval' && (
        <div className="flex gap-2">
          <Button 
            onClick={() => updateBillStatus('pending_payment', 'Approved')}
            className="flex items-center gap-2"
            size="sm"
          >
            <CheckCircle className="h-4 w-4" />
            Approve Bill
          </Button>
          <Button 
            onClick={() => updateBillStatus('rejected', 'Rejected')}
            variant="destructive"
            className="flex items-center gap-2"
            size="sm"
          >
            <XCircle className="h-4 w-4" />
            Reject Bill
          </Button>
        </div>
      )}

      {currentStatus === 'pending_payment' && (
        <div className="flex gap-2">
          <Button 
            onClick={() => updateBillStatus('paid', 'Marked as Paid')}
            className="flex items-center gap-2"
            size="sm"
          >
            <CheckCircle className="h-4 w-4" />
            Mark as Paid
          </Button>
          <Button 
            onClick={() => updateBillStatus('pending_approval', 'Returned for Review')}
            variant="outline"
            className="flex items-center gap-2"
            size="sm"
          >
            <Clock className="h-4 w-4" />
            Return for Review
          </Button>
        </div>
      )}

      {currentStatus === 'rejected' && (
        <Button 
          onClick={() => updateBillStatus('pending_approval', 'Returned for Review')}
          variant="outline"
          className="flex items-center gap-2"
          size="sm"
        >
          <Clock className="h-4 w-4" />
          Return for Review
        </Button>
      )}
    </div>
  );
}