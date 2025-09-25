import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, AlertTriangle } from "lucide-react";
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

interface VendorListViewProps {
  vendors: Vendor[];
  onVendorClick: (vendor: Vendor) => void;
}

const categoryColors = {
  "Materials": "default",
  "Retail": "secondary",
  "Subcontractor": "success", 
  "Office": "warning"
} as const;

export default function VendorListView({ vendors, onVendorClick }: VendorListViewProps) {
  const { warnings } = useComplianceWarnings(vendors.map(v => v.id));
  
  return (
    <div className="border border-border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Total Spent</TableHead>
            <TableHead>Bills</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id} className="cursor-pointer hover-row" onClick={() => onVendorClick(vendor)}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <VendorAvatar 
                    name={vendor.name}
                    logoUrl={vendor.logo_url}
                    size="sm"
                  />
                  <span className="font-medium">{vendor.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Badge variant={categoryColors[vendor.category as keyof typeof categoryColors]}>
                    {vendor.category}
                  </Badge>
                  {warnings[vendor.id] && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {warnings[vendor.id]} Missing
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{vendor.contact !== "N/A" ? vendor.contact : "-"}</TableCell>
              <TableCell>{vendor.phone}</TableCell>
              <TableCell>{vendor.email}</TableCell>
              <TableCell className="font-medium">{vendor.totalSpent}</TableCell>
              <TableCell>{vendor.bills}</TableCell>
              <TableCell>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVendorClick(vendor);
                  }}
                >
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}