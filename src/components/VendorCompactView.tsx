import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Receipt, AlertTriangle } from "lucide-react";
import { useComplianceWarnings } from "@/hooks/useComplianceWarnings";
import VendorAvatar from "@/components/VendorAvatar";

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
  const { warnings } = useComplianceWarnings(vendors.map(v => v.id));
  
  return (
    <div className="space-y-1">
      {vendors.map((vendor) => (
        <Card key={vendor.id} className="hover-lift cursor-pointer animate-fade-in" onClick={() => onVendorClick(vendor)}>
          <CardContent className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <VendorAvatar
                  name={vendor.name}
                  logoUrl={vendor.logo_url}
                  size="md"
                  shape="square"
                />
                <span className="font-medium truncate max-w-[220px]">{vendor.name}</span>
                <Badge variant={categoryColors[vendor.category as keyof typeof categoryColors]} className="text-xs">
                  {vendor.category}
                </Badge>
                {warnings[vendor.id] && (
                  <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    {warnings[vendor.id]} Missing
                  </Badge>
                )}
                <div className="flex min-w-0 items-center gap-3 overflow-hidden text-xs text-muted-foreground">
                  <div className="flex min-w-0 items-center gap-1">
                    <Phone className="h-3 w-3" />
                    <span className="truncate">{vendor.phone}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate max-w-[220px]">{vendor.email}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    <span>{vendor.bills} bills</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right leading-none">
                  <div className="text-[11px] text-muted-foreground">Total</div>
                  <div className="font-semibold text-sm">{vendor.totalSpent}</div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-7 px-2"
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
