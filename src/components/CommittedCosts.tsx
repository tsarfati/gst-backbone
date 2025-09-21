import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, FileText, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CommittedCostsProps {
  jobId: string;
}

export default function CommittedCosts({ jobId }: CommittedCostsProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [subcontracts, setSubcontracts] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommittedCosts();
  }, [jobId]);

  const fetchCommittedCosts = async () => {
    try {
      const [subcontractsRes, posRes, invoicesRes] = await Promise.all([
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
      if (invoicesRes.data) setInvoices(invoicesRes.data);
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
    const relatedInvoices = invoices.filter(inv => 
      isSubcontract ? inv.subcontract_id === contractId : false
    );
    
    const totalBilled = relatedInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Committed Costs
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => navigate(`/subcontracts/add?jobId=${jobId}`)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contract/PO
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Subcontracts Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Subcontracts</h3>
            {subcontracts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No subcontracts for this job</p>
            ) : (
              <div className="space-y-3">
                {subcontracts.map((subcontract) => {
                  const billing = calculateBillingStatus(
                    parseFloat(subcontract.contract_amount), 
                    subcontract.id, 
                    true
                  );
                  
                  return (
                    <Card key={subcontract.id} className="border border-muted">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium">{subcontract.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {subcontract.vendors?.name}
                            </p>
                          </div>
                          <Badge variant="outline">{subcontract.status}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Contract Amount</p>
                            <p className="font-medium">${parseFloat(subcontract.contract_amount).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Billed</p>
                            <p className="font-medium">${billing.totalBilled.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Remaining</p>
                            <p className="font-medium">${billing.remaining.toLocaleString()}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Billing Progress</span>
                            <span>{billing.percentageBilled.toFixed(1)}%</span>
                          </div>
                          <Progress value={billing.percentageBilled} className="h-2" />
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          {subcontract.contract_file_url ? (
                            <Button size="sm" variant="outline" asChild>
                              <a href={subcontract.contract_file_url} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-3 w-3 mr-1" />
                                View Contract
                              </a>
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              <FileText className="h-3 w-3 mr-1" />
                              No Contract File
                            </Button>
                          )}
                          <Button size="sm" variant="ghost">
                            Edit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Purchase Orders Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Purchase Orders</h3>
            {purchaseOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">No purchase orders for this job</p>
            ) : (
              <div className="space-y-3">
                {purchaseOrders.map((po) => (
                  <Card key={po.id} className="border border-muted">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">PO #{po.po_number}</h4>
                          <p className="text-sm text-muted-foreground">
                            {po.vendors?.name}
                          </p>
                          {po.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {po.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">{po.status}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">PO Amount</p>
                          <p className="font-medium">${parseFloat(po.amount).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Order Date</p>
                          <p className="font-medium">{po.order_date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Expected Delivery</p>
                          <p className="font-medium">{po.expected_delivery || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        {po.po_file_url ? (
                          <Button size="sm" variant="outline" asChild>
                            <a href={po.po_file_url} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3 w-3 mr-1" />
                              View PO
                            </a>
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            <FileText className="h-3 w-3 mr-1" />
                            No PO File
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}