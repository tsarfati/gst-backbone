import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Building, Plus, FileText } from "lucide-react";

export default function VendorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  // In a real app, you would fetch vendor data from backend
  const vendor = null; // No mock data

  if (!vendor) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vendor Not Found</h1>
            <p className="text-muted-foreground">The requested vendor could not be found</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="p-8 text-center">
            <Building className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">No Vendor Available</h2>
            <p className="text-muted-foreground mb-4">
              This vendor doesn&apos;t exist or you don&apos;t have permission to view it.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate("/vendors")}>
                Return to Vendors
              </Button>
              <Button variant="outline" onClick={() => navigate("/vendors/add")}>
                <Plus className="h-4 w-4 mr-2" />
                Add New Vendor
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* This would contain the actual vendor details when data exists */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vendor Details</h1>
            <p className="text-muted-foreground">View and manage vendor information</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/vendors/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Vendor
          </Button>
        </div>
      </div>
    </div>
  );
}