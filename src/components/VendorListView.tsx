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
      <Table className="border-separate border-spacing-0">
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
            <TableRow key={vendor.id} className="cursor-pointer group hover:bg-primary/5 transition-all duration-200 hover:rounded-lg hover:shadow-[0_0_0_2px_hsl(var(--primary))]" onClick={() => onVendorClick(vendor)}>
              <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                <div className="flex items-center gap-3">
                  <VendorAvatar 
                    name={vendor.name}
                    logoUrl={vendor.logo_url}
                    size="sm"
                  />
                  <span className="font-medium group-hover:text-primary transition-colors">{vendor.name}</span>
                </div>
              </TableCell>
              <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
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
              <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{vendor.contact !== "N/A" ? vendor.contact : "-"}</TableCell>
              <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{vendor.phone}</TableCell>
              <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{vendor.email}</TableCell>
              <TableCell className="font-medium border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{vendor.totalSpent}</TableCell>
              <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{vendor.bills}</TableCell>
              <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
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