import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, Phone, Mail, MapPin, Plus, Receipt } from "lucide-react";

const mockVendors = [
  {
    id: "1",
    name: "ABC Materials",
    contact: "John Smith",
    phone: "(555) 123-4567",
    email: "john@abcmaterials.com",
    address: "123 Industrial Way, City, ST 12345",
    totalSpent: "$15,250",
    invoices: 12,
    category: "Materials"
  },
  {
    id: "2",
    name: "Home Depot",
    contact: "N/A",
    phone: "(555) 987-6543",
    email: "support@homedepot.com",
    address: "456 Retail Blvd, City, ST 12345",
    totalSpent: "$8,450",
    invoices: 8,
    category: "Retail"
  },
  {
    id: "3",
    name: "Elite Electrical",
    contact: "Sarah Johnson",
    phone: "(555) 456-7890",
    email: "sarah@eliteelectrical.com",
    address: "789 Service St, City, ST 12345",
    totalSpent: "$22,100",
    invoices: 15,
    category: "Subcontractor"
  },
  {
    id: "4",
    name: "Office Supply Co",
    contact: "Mike Davis",
    phone: "(555) 321-0987",
    email: "mike@officesupply.com",
    address: "321 Business Park, City, ST 12345",
    totalSpent: "$1,250",
    invoices: 5,
    category: "Office"
  }
];

const categoryColors = {
  "Materials": "default",
  "Retail": "secondary",
  "Subcontractor": "success",
  "Office": "warning"
} as const;

export default function Vendors() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
          <p className="text-muted-foreground">
            Manage vendor relationships and track spending
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockVendors.map((vendor) => (
          <Card key={vendor.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-lg">
                  <Building className="h-5 w-5 mr-2 text-primary" />
                  {vendor.name}
                </CardTitle>
                <Badge variant={categoryColors[vendor.category as keyof typeof categoryColors]}>
                  {vendor.category}
                </Badge>
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
                    <p className="text-sm text-muted-foreground">Invoices</p>
                    <p className="font-semibold text-lg flex items-center">
                      <Receipt className="h-4 w-4 mr-1" />
                      {vendor.invoices}
                    </p>
                  </div>
                </div>
              </div>

              <Button variant="outline" className="w-full">
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}