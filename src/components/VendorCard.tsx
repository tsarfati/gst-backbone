import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, Phone, Mail, MapPin, Receipt, AlertTriangle } from "lucide-react";
import { useVendorCompliance } from "@/hooks/useComplianceWarnings";
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
  linkedVendorAvatarUrl?: string | null;
  vendorPortalLinked?: boolean;
  linkedVendorUserId?: string | null;
}

interface VendorCardProps {
  vendor: Vendor;
  onClick: () => void;
  onPortalBadgeClick?: (vendor: Vendor) => void;
}

const categoryColors = {
  "Materials": "default",
  "Retail": "secondary", 
  "Subcontractor": "success",
  "Office": "warning"
} as const;

export default function VendorCard({ vendor, onClick, onPortalBadgeClick }: VendorCardProps) {
  const { missingCount } = useVendorCompliance(vendor.id);
  
  return (
    <Card className="cursor-pointer animate-fade-in transition-all duration-200 hover:shadow-lg hover:border-primary/50 hover:scale-[1.02]" onClick={onClick}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            <VendorAvatar 
              name={vendor.name}
              logoUrl={vendor.logo_url}
              fallbackAvatarUrl={vendor.linkedVendorAvatarUrl}
              size="lg"
              shape="square"
              className="mr-3"
            />
            {vendor.name}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant={categoryColors[vendor.category as keyof typeof categoryColors]}>
              {vendor.category}
            </Badge>
            {vendor.vendorPortalLinked && (
              <Badge
                variant="default"
                className={vendor.linkedVendorUserId && onPortalBadgeClick ? "cursor-pointer" : undefined}
                onClick={(e) => {
                  if (!vendor.linkedVendorUserId || !onPortalBadgeClick) return;
                  e.stopPropagation();
                  onPortalBadgeClick(vendor);
                }}
              >
                Vendor Portal Linked
              </Badge>
            )}
            {missingCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {missingCount} Missing
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {vendor.contact !== "N/A" && (
          <div>
            <p className="text-sm text-muted-foreground">Contact</p>
            <p className="font-medium">{vendor.contact}</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center text-sm">
            <Phone className="h-3 w-3 mr-2 text-muted-foreground" />
            {vendor.phone}
          </div>
          <div className="flex items-center text-sm">
            <Mail className="h-3 w-3 mr-2 text-muted-foreground" />
            {vendor.email}
          </div>
          <div className="flex items-start text-sm">
            <MapPin className="h-3 w-3 mr-2 text-muted-foreground mt-0.5" />
            <span className="leading-tight">{vendor.address}</span>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="font-semibold text-lg">{vendor.totalSpent}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bills</p>
              <p className="font-semibold text-lg flex items-center">
                <Receipt className="h-4 w-4 mr-1" />
                {vendor.bills}
              </p>
            </div>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}
