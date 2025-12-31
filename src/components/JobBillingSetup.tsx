import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Plus, Trash2, Save, GripVertical, FileText } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";

interface SOVItem {
  id?: string;
  item_number: string;
  description: string;
  scheduled_value: number;
  cost_code_id?: string | null;
  sort_order: number;
  is_new?: boolean;
}

interface JobBillingSetupProps {
  jobId: string;
}

export default function JobBillingSetup({ jobId }: JobBillingSetupProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [items, setItems] = useState<SOVItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (currentCompany?.id && jobId) {
      loadSOV();
    }
  }, [currentCompany?.id, jobId]);

  const loadSOV = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("schedule_of_values")
        .select("*")
        .eq("company_id", currentCompany!.id)
        .eq("job_id", jobId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      
      setItems(data?.map(item => ({
        id: item.id,
        item_number: item.item_number,
        description: item.description,
        scheduled_value: Number(item.scheduled_value),
        cost_code_id: item.cost_code_id,
        sort_order: item.sort_order
      })) || []);
    } catch (error: any) {
      console.error("Error loading SOV:", error);
      toast({
        title: "Error",
        description: "Failed to load schedule of values",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    const nextNumber = (items.length + 1).toString();
    setItems([...items, {
      item_number: nextNumber,
      description: "",
      scheduled_value: 0,
      sort_order: items.length,
      is_new: true
    }]);
    setHasChanges(true);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    // Renumber items
    newItems.forEach((item, i) => {
      item.sort_order = i;
      if (item.is_new) {
        item.item_number = (i + 1).toString();
      }
    });
    setItems(newItems);
    setHasChanges(true);
  };

  const updateItem = (index: number, field: keyof SOVItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    setHasChanges(true);
  };

  const saveSOV = async () => {
    if (!currentCompany?.id || !user?.id) return;

    try {
      setSaving(true);

      // Get existing IDs
      const existingIds = items.filter(i => i.id).map(i => i.id);
      
      // Delete removed items (soft delete)
      if (existingIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("schedule_of_values")
          .update({ is_active: false })
          .eq("company_id", currentCompany.id)
          .eq("job_id", jobId)
          .not("id", "in", `(${existingIds.join(",")})`);
        
        if (deleteError) throw deleteError;
      }

      // Upsert all items
      for (const item of items) {
        if (item.id) {
          // Update existing
          const { error } = await supabase
            .from("schedule_of_values")
            .update({
              item_number: item.item_number,
              description: item.description,
              scheduled_value: item.scheduled_value,
              cost_code_id: item.cost_code_id,
              sort_order: item.sort_order,
              updated_at: new Date().toISOString()
            })
            .eq("id", item.id);
          
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from("schedule_of_values")
            .insert({
              company_id: currentCompany.id,
              job_id: jobId,
              item_number: item.item_number,
              description: item.description,
              scheduled_value: item.scheduled_value,
              cost_code_id: item.cost_code_id,
              sort_order: item.sort_order,
              created_by: user.id
            });
          
          if (error) throw error;
        }
      }

      toast({
        title: "Success",
        description: "Schedule of Values saved successfully",
      });
      
      setHasChanges(false);
      loadSOV(); // Reload to get IDs
    } catch (error: any) {
      console.error("Error saving SOV:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save schedule of values",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const totalScheduledValue = items.reduce((sum, item) => sum + (item.scheduled_value || 0), 0);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading billing setup...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Schedule of Values
            </CardTitle>
            <CardDescription>
              Set up the billing breakdown for AIA G702/G703 invoicing. This must be configured before creating the first invoice.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
            {hasChanges && (
              <Button onClick={saveSOV} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/50">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Schedule of Values</h3>
            <p className="text-muted-foreground mb-4">
              Add line items to define the billing breakdown for this project
            </p>
            <Button onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Line Item
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-24">Item #</TableHead>
                  <TableHead>Description of Work</TableHead>
                  <TableHead className="w-48 text-right">Scheduled Value</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.id || `new-${index}`}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.item_number}
                        onChange={(e) => updateItem(index, "item_number", e.target.value)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        placeholder="Enter description of work"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">$</span>
                        <CurrencyInput
                          value={item.scheduled_value}
                          onChange={(val) => updateItem(index, "scheduled_value", parseFloat(val) || 0)}
                          className="text-right"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Total Row */}
            <div className="flex justify-end items-center gap-4 mt-4 pt-4 border-t">
              <span className="font-medium">Total Contract Sum:</span>
              <span className="text-xl font-bold">${formatNumber(totalScheduledValue)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
