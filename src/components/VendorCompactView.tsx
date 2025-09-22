import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, Phone, Mail, Receipt } from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  totalSpent: string;
  bills: number;
  category: string;
  logo_url?: string;
}

interface VendorCompactViewProps {
  vendors: Vendor[];
  onVendorClick: (vendor: Vendor) => void;
}

const categoryColors = {
  "Materials": "default",
  "Retail": "secondary",
  "Subcontractor": "success",
  "Office": "warning"
} as const;

export default function VendorCompactView({ vendors, onVendorClick }: VendorCompactViewProps) {
  return (
    <div className="space-y-2">
      {vendors.map((vendor) => (
        <Card key={vendor.id} className="hover-lift cursor-pointer animate-fade-in" onClick={() => onVendorClick(vendor)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {vendor.logo_url ? (
                  <img src={vendor.logo_url} alt={vendor.name} className="h-8 w-8 rounded object-cover" />
                ) : (
                  <Building className="h-5 w-5 text-primary" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{vendor.name}</span>
                    <Badge variant={categoryColors[vendor.category as keyof typeof categoryColors]} className="text-xs">
                      {vendor.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <span>{vendor.phone}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span>{vendor.email}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Receipt className="h-3 w-3" />
                      <span>{vendor.bills} bills</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Total Spent</div>
                  <div className="font-semibold">{vendor.totalSpent}</div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVendorClick(vendor);
                  }}
                >
                  View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}