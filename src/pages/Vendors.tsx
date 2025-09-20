import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import VendorViewSelector, { VendorViewType } from "@/components/VendorViewSelector";
import VendorCard from "@/components/VendorCard";
import VendorListView from "@/components/VendorListView";
import VendorCompactView from "@/components/VendorCompactView";

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

export default function Vendors() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<VendorViewType>("tiles");

  const handleVendorClick = (vendor: any) => {
    navigate(`/vendors/${vendor.id}`);
  };

  const renderVendors = () => {
    switch (currentView) {
      case "tiles":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockVendors.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} onClick={() => handleVendorClick(vendor)} />
            ))}
          </div>
        );
      case "list":
        return <VendorListView vendors={mockVendors} onVendorClick={handleVendorClick} />;
      case "compact":
        return <VendorCompactView vendors={mockVendors} onVendorClick={handleVendorClick} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
          <p className="text-muted-foreground">
            Manage vendor relationships and track spending
          </p>
        </div>
        <div className="flex items-center gap-4">
          <VendorViewSelector currentView={currentView} onViewChange={setCurrentView} />
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>
      </div>

      {renderVendors()}
    </div>
  );
}