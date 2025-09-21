import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building } from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  totalSpent: string;
  invoices: number;
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
            <TableHead>Invoices</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id} className="cursor-pointer hover-row" onClick={() => onVendorClick(vendor)}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {vendor.logo_url ? (
                    <img src={vendor.logo_url} alt={vendor.name} className="h-6 w-6 rounded object-cover" />
                  ) : (
                    <Building className="h-4 w-4 text-primary" />
                  )}
                  <span className="font-medium">{vendor.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={categoryColors[vendor.category as keyof typeof categoryColors]}>
                  {vendor.category}
                </Badge>
              </TableCell>
              <TableCell>{vendor.contact !== "N/A" ? vendor.contact : "-"}</TableCell>
              <TableCell>{vendor.phone}</TableCell>
              <TableCell>{vendor.email}</TableCell>
              <TableCell className="font-medium">{vendor.totalSpent}</TableCell>
              <TableCell>{vendor.invoices}</TableCell>
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