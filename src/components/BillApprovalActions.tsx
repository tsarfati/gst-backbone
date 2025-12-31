import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BillApprovalActionsProps {
  billId: string;
  currentStatus: string;
  jobRequiresPmApproval?: boolean;
  currentUserRole?: string;
  currentUserId?: string;
  jobPmUserId?: string;
  onStatusUpdate: () => void;
  onApproved?: () => void;
}

export default function BillApprovalActions({ 
  billId, 
  currentStatus, 
  jobRequiresPmApproval = false,
  currentUserRole,
  currentUserId,
  jobPmUserId,
  onStatusUpdate,
  onApproved
}: BillApprovalActionsProps) {
  const { toast } = useToast();

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'controller';
  const isPm = currentUserId === jobPmUserId;
  const canApprove = isAdmin || (isPm && jobRequiresPmApproval);

  // Pending coding helpers
  const [billMeta, setBillMeta] = useState<{ cost_code_id?: string | null; subcontract_id?: string | null; purchase_order_id?: string | null } | null>(null);
  const [suggestedCostCodeId, setSuggestedCostCodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const loadBillMeta = async () => {
      if (currentStatus !== 'pending_coding') return;
      try {
        setLoading(true);
        const { data: inv, error: invErr } = await supabase
          .from('invoices')
          .select('cost_code_id, subcontract_id, purchase_order_id')
          .eq('id', billId)
          .single();
        if (invErr) throw invErr;
        setBillMeta(inv);

        // If subcontract with single distribution, suggest its cost code
        if (inv?.subcontract_id) {
          const { data: sub, error: subErr } = await supabase
            .from('subcontracts')
            .select('cost_distribution')
            .eq('id', inv.subcontract_id)
            .single();
          if (subErr) throw subErr;
          let dist: any[] = [];
          const raw = (sub as any)?.cost_distribution;
          if (Array.isArray(raw)) dist = raw;
          else if (typeof raw === 'string') {
            try { dist = JSON.parse(raw); } catch { dist = []; }
          }
          if (dist.length === 1 && dist[0]?.cost_code_id) {
            setSuggestedCostCodeId(dist[0].cost_code_id);
          }
        }
      } catch (e) {
        console.error('Failed to load bill meta', e);
      } finally {
        setLoading(false);
      }
    };
    loadBillMeta();
  }, [billId, currentStatus]);

  const applyCostCodeAndSend = async () => {
    if (!suggestedCostCodeId) return;
    try {
      setApplying(true);
      const { error } = await supabase
        .from('invoices')
        .update({ cost_code_id: suggestedCostCodeId, status: 'pending_approval' })
        .eq('id', billId);
      if (error) throw error;
      toast({ title: 'Cost code applied', description: 'Bill moved to Pending Approval.' });
      onStatusUpdate();
    } catch (e) {
      console.error('Apply cost code failed', e);
      toast({ title: 'Error', description: 'Failed to apply cost code', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const sendToApproval = async () => {
    await updateBillStatus('pending_approval', 'Sent to approval');
  };

  const updateBillStatus = async (newStatus: string, statusText: string) => {
    try {
      const user = await supabase.auth.getUser();
      const updateData: any = { status: newStatus };
      
      // Add approved_by and approved_at if approving
      if (newStatus === 'pending_payment') {
        updateData.approved_by = user.data.user?.id;
        updateData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', billId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Bill ${statusText.toLowerCase()} successfully`,
      });

      // If bill was approved, call onApproved callback to navigate to details page
      if (newStatus === 'pending_payment' && onApproved) {
        onApproved();
      } else {
        onStatusUpdate();
      }
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
      case "pending_coding":
        return { text: "Pending Coding", variant: "secondary" as const, icon: Clock };
      case "pending_approval":
        return { text: "Pending Approval", variant: "warning" as const, icon: Clock };
      case "pending_payment":
        return { text: "Pending Payment", variant: "info" as const, icon: Clock };
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
        <>
          {jobRequiresPmApproval && !canApprove && (
            <div className="bg-muted p-3 rounded-md text-sm text-muted-foreground">
              This bill requires project manager approval. Only the PM or admin can approve.
            </div>
          )}
          <div className="flex gap-2">
            <Button 
              onClick={() => updateBillStatus('pending_payment', 'Approved')}
              className="flex items-center gap-2"
              size="sm"
              disabled={jobRequiresPmApproval && !canApprove}
            >
              <CheckCircle className="h-4 w-4" />
              Approve Bill
            </Button>
            <Button 
              onClick={() => updateBillStatus('rejected', 'Rejected')}
              variant="destructive"
              className="flex items-center gap-2"
              size="sm"
              disabled={jobRequiresPmApproval && !canApprove}
            >
              <XCircle className="h-4 w-4" />
              Reject Bill
            </Button>
          </div>
        </>
      )}

      {currentStatus === 'pending_coding' && (
        <>
          {loading ? (
            <div className="text-sm text-muted-foreground">Checking subcontract distribution...</div>
          ) : (
            <div className="space-y-3">
              {suggestedCostCodeId ? (
                <div className="bg-muted p-3 rounded-md text-sm">
                  Subcontract distribution has a single cost code. You can apply it to this bill and send for approval.
                </div>
              ) : (
                <div className="bg-muted p-3 rounded-md text-sm">
                  This bill is pending coding. You can send it for approval now or edit the bill to assign a cost code.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {suggestedCostCodeId && (
                  <Button onClick={applyCostCodeAndSend} size="sm" disabled={applying}>
                    {applying ? 'Applying…' : 'Apply cost code & send to approval'}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={sendToApproval}>
                  Send to approval
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
