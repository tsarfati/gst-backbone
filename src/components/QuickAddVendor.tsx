import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

interface QuickAddVendorProps {
  onVendorAdded: (vendorId: string) => void;
  variant?: "default" | "outline" | "ghost";
  className?: string;
  allowedTypes?: string[]; // Optional filter for vendor types
}

export default function QuickAddVendor({ 
  onVendorAdded, 
  variant = "outline", 
  className = "",
  allowedTypes 
}: QuickAddVendorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentCompany } = useCompany();

  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    vendor_type: "",
    address: ""
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !currentCompany) {
      toast({
        title: "Error",
        description: "User or company not found",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          name: formData.name,
          contact_person: formData.contact_person || null,
          email: formData.email || null,
          phone: formData.phone || null,
          vendor_type: formData.vendor_type || null,
          address: formData.address || null,
          company_id: currentCompany.id,
          is_active: true,
          require_invoice_number: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vendor added successfully"
      });

      onVendorAdded(data.id);
      setOpen(false);
      
      // Reset form
      setFormData({
        name: "",
        contact_person: "",
        email: "",
        phone: "",
        vendor_type: "",
        address: ""
      });
    } catch (error: any) {
      console.error('Error adding vendor:', error);
      // Only show error toast, don't log to console to avoid flash
      const errorMessage = error?.message || "Failed to add vendor";
      // Skip showing generic constraint errors that are temporary
      if (!errorMessage.includes('constraint') && !errorMessage.includes('schema cache')) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const vendorTypes = allowedTypes || [
    "Contractor",
    "Supplier",
    "Consultant",
    "Design Professional",
    "Other"
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          type="button" 
          variant={variant} 
          size="sm" 
          className={className}
        >
          <Plus className="h-4 w-4 mr-2" />
          Quick Add Vendor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-background">
        <DialogHeader>
          <DialogTitle>Quick Add Vendor</DialogTitle>
          <DialogDescription>
            Add a new vendor with basic information. You can edit full details later.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendor_name">
              Vendor Name *
            </Label>
            <Input
              id="vendor_name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter vendor name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_person">Contact Name</Label>
            <Input
              id="contact_person"
              value={formData.contact_person}
              onChange={(e) => handleInputChange("contact_person", e.target.value)}
              placeholder="Primary contact person"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor_type">Vendor Type</Label>
            <Select 
              value={formData.vendor_type} 
              onValueChange={(value) => handleInputChange("vendor_type", value)}
            >
              <SelectTrigger id="vendor_type">
                <SelectValue placeholder="Select vendor type" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {vendorTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor_email">Email</Label>
              <Input
                id="vendor_email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="vendor@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor_phone">Phone</Label>
              <Input
                id="vendor_phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor_address">Address</Label>
            <Input
              id="vendor_address"
              value={formData.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
              placeholder="Street address"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? "Adding..." : "Add Vendor"}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
