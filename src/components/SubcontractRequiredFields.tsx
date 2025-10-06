import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { FileText, Briefcase } from 'lucide-react';

const availableSubcontractFields = [
  { value: 'name', label: 'Subcontract Name', alwaysRequired: true },
  { value: 'job_id', label: 'Job', alwaysRequired: true },
  { value: 'vendor_id', label: 'Vendor', alwaysRequired: true },
  { value: 'contract_amount', label: 'Contract Amount', alwaysRequired: true },
  { value: 'description', label: 'Description', alwaysRequired: false },
  { value: 'start_date', label: 'Start Date', alwaysRequired: false },
  { value: 'end_date', label: 'End Date', alwaysRequired: false },
  { value: 'contract_file_url', label: 'Contract File', alwaysRequired: false },
  { value: 'cost_distribution', label: 'Cost Distribution', alwaysRequired: false },
];

const availablePOFields = [
  { value: 'po_number', label: 'PO Number', alwaysRequired: true },
  { value: 'job_id', label: 'Job', alwaysRequired: true },
  { value: 'vendor_id', label: 'Vendor', alwaysRequired: true },
  { value: 'amount', label: 'Amount', alwaysRequired: true },
  { value: 'description', label: 'Description', alwaysRequired: false },
  { value: 'order_date', label: 'Order Date', alwaysRequired: false },
  { value: 'expected_delivery', label: 'Expected Delivery', alwaysRequired: false },
  { value: 'po_file_url', label: 'PO File', alwaysRequired: false },
];

export default function SubcontractRequiredFields() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [subcontractFields, setSubcontractFields] = useState<string[]>([
    'name', 'job_id', 'vendor_id', 'contract_amount'
  ]);
  const [poFields, setPOFields] = useState<string[]>([
    'po_number', 'job_id', 'vendor_id', 'amount'
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      loadSettings();
    }
  }, [currentCompany?.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('job_settings')
        .select('subcontract_required_fields, po_required_fields')
        .eq('company_id', currentCompany?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        if (data.subcontract_required_fields && Array.isArray(data.subcontract_required_fields)) {
          setSubcontractFields(data.subcontract_required_fields as string[]);
        }
        if (data.po_required_fields && Array.isArray(data.po_required_fields)) {
          setPOFields(data.po_required_fields as string[]);
        }
      }
    } catch (error) {
      console.error('Error loading required fields settings:', error);
      toast({
        title: "Error",
        description: "Failed to load required fields settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (type: 'subcontract' | 'po', fields: string[]) => {
    try {
      const updateData = type === 'subcontract' 
        ? { subcontract_required_fields: fields }
        : { po_required_fields: fields };

      const { error } = await supabase
        .from('job_settings')
        .upsert({
          company_id: currentCompany?.id,
          ...updateData,
        } as any);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: `${type === 'subcontract' ? 'Subcontract' : 'Purchase Order'} required fields have been updated.`,
      });
    } catch (error) {
      console.error('Error saving required fields settings:', error);
      toast({
        title: "Error",
        description: "Failed to save required fields settings",
        variant: "destructive",
      });
    }
  };

  const toggleSubcontractField = (field: string) => {
    const newFields = subcontractFields.includes(field)
      ? subcontractFields.filter(f => f !== field)
      : [...subcontractFields, field];
    setSubcontractFields(newFields);
    saveSettings('subcontract', newFields);
  };

  const togglePOField = (field: string) => {
    const newFields = poFields.includes(field)
      ? poFields.filter(f => f !== field)
      : [...poFields, field];
    setPOFields(newFields);
    saveSettings('po', newFields);
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-600" />
            Subcontract Required Fields
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Select which fields must be filled before a subcontract can be set to "Active" status
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableSubcontractFields.map(field => (
              <div key={field.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`subcontract-${field.value}`}
                  checked={subcontractFields.includes(field.value)}
                  onCheckedChange={() => !field.alwaysRequired && toggleSubcontractField(field.value)}
                  disabled={field.alwaysRequired}
                />
                <Label 
                  htmlFor={`subcontract-${field.value}`}
                  className={field.alwaysRequired ? 'text-muted-foreground' : ''}
                >
                  {field.label}
                  {field.alwaysRequired && <span className="text-xs ml-1">(Always Required)</span>}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-600" />
            Purchase Order Required Fields
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Select which fields must be filled for purchase orders
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availablePOFields.map(field => (
              <div key={field.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`po-${field.value}`}
                  checked={poFields.includes(field.value)}
                  onCheckedChange={() => !field.alwaysRequired && togglePOField(field.value)}
                  disabled={field.alwaysRequired}
                />
                <Label 
                  htmlFor={`po-${field.value}`}
                  className={field.alwaysRequired ? 'text-muted-foreground' : ''}
                >
                  {field.label}
                  {field.alwaysRequired && <span className="text-xs ml-1">(Always Required)</span>}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
