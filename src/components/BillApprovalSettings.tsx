import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function BillApprovalSettings() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [requireBillApproval, setRequireBillApproval] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      fetchSettings();
    }
  }, [currentCompany]);

  const fetchSettings = async () => {
    if (!currentCompany) return;

    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('require_bill_approval')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRequireBillApproval(data.require_bill_approval || false);
      }
    } catch (error) {
      console.error('Error fetching bill approval settings:', error);
    }
  };

  const handleToggleApproval = async (checked: boolean) => {
    if (!currentCompany) return;

    setLoading(true);
    setRequireBillApproval(checked);

    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          company_id: currentCompany.id,
          require_bill_approval: checked,
        }, {
          onConflict: 'company_id'
        });

      if (error) throw error;

      toast({
        title: "Settings updated",
        description: `Bill approval ${checked ? 'required' : 'not required'}`,
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      setRequireBillApproval(!checked);
      toast({
        title: "Failed to update settings",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-4 border-t">
      <div className="space-y-0.5">
        <Label htmlFor="require-bill-approval">Require Bill Approval</Label>
        <p className="text-sm text-muted-foreground">
          All bills must be approved before they can be paid
        </p>
      </div>
      <div className="flex items-center gap-2">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        <Switch
          id="require-bill-approval"
          checked={requireBillApproval}
          onCheckedChange={handleToggleApproval}
          disabled={loading}
        />
      </div>
    </div>
  );
}
