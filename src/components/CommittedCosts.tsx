import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface CommittedCostsProps {
  jobId: string;
}

export default function CommittedCosts({ jobId }: CommittedCostsProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [subcontracts, setSubcontracts] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommittedCosts();
  }, [jobId]);

  const fetchCommittedCosts = async () => {
    try {
      const [subcontractsRes, posRes, billsRes] = await Promise.all([
        supabase
          .from('subcontracts')
          .select('*, vendors(name)')
          .eq('job_id', jobId),
        supabase
          .from('purchase_orders')
          .select('*, vendors(name)')
          .eq('job_id', jobId),
        supabase
          .from('invoices')
          .select('*')
          .eq('job_id', jobId)
      ]);

      if (subcontractsRes.data) setSubcontracts(subcontractsRes.data);
      if (posRes.data) setPurchaseOrders(posRes.data);
      if (billsRes.data) setBills(billsRes.data);
    } catch (error) {
      console.error('Error fetching committed costs:', error);
      toast({
        title: "Error",
        description: "Failed to load committed costs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateBillingStatus = (contractAmount: number, contractId: string, isSubcontract: boolean) => {
    const relatedBills = bills.filter(bill => 
      isSubcontract ? bill.subcontract_id === contractId : false
    );
    
    const totalBilled = relatedBills.reduce((sum, bill) => sum + parseFloat(bill.amount), 0);
    const remaining = contractAmount - totalBilled;
    const percentageBilled = (totalBilled / contractAmount) * 100;

    return {
      totalBilled,
      remaining,
      percentageBilled: Math.min(percentageBilled, 100)
    };
  };

  if (loading) {
    return <div className="text-center py-4">Loading committed costs...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Subcontracts Section */}
      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Subcontracts ({subcontracts.length})
        </h3>
        {subcontracts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No subcontracts for this job</p>
        ) : (
          <div className="space-y-2">
            {subcontracts.map((subcontract) => {
              const billing = calculateBillingStatus(
                parseFloat(subcontract.contract_amount), 
                subcontract.id, 
                true
              );
              
              return (
                <div 
                  key={subcontract.id} 
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all duration-200 cursor-pointer group"
                  onClick={() => navigate(`/subcontracts/${subcontract.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate group-hover:text-primary transition-colors">{subcontract.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {subcontract.vendors?.name}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{subcontract.status}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="font-medium">${parseFloat(subcontract.contract_amount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        ${billing.totalBilled.toLocaleString()} billed ({billing.percentageBilled.toFixed(0)}%)
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {subcontract.contract_file_url && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a href={subcontract.contract_file_url} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Purchase Orders Section */}
      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Purchase Orders ({purchaseOrders.length})
        </h3>
        {purchaseOrders.length === 0 ? (
          <p className="text-muted-foreground text-sm">No purchase orders for this job</p>
        ) : (
          <div className="space-y-2">
            {purchaseOrders.map((po) => (
              <div key={po.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-primary/10 hover:border-primary hover:shadow-md hover:scale-[1.01] transition-all duration-200 cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">PO #{po.po_number}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {po.vendors?.name}
                      </p>
                      {po.description && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {po.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0">{po.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-right">
                    <p className="font-medium">${parseFloat(po.amount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {po.expected_delivery ? `Due: ${po.expected_delivery}` : 'No delivery date'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {po.po_file_url && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={po.po_file_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {(subcontracts.length > 0 || purchaseOrders.length > 0) && (
        <div className="pt-3 border-t">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Total Committed:</span>
            <span className="font-semibold">
              ${(
                subcontracts.reduce((sum, s) => sum + parseFloat(s.contract_amount), 0) +
                purchaseOrders.reduce((sum, po) => sum + parseFloat(po.amount), 0)
              ).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}