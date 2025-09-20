import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Building, Plus, FileText, Mail, Phone, MapPin, CreditCard, FileIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function VendorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVendor = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching vendor:', error);
          toast({
            title: "Error",
            description: "Failed to load vendor details",
            variant: "destructive",
          });
        } else {
          setVendor(data);
        }
      } catch (err) {
        console.error('Error:', err);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [id, toast]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">Loading vendor details...</div>
      </div>
    );
  }

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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{vendor.name}</h1>
            <p className="text-muted-foreground">Vendor Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/vendors/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Vendor
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                <p className="text-lg font-semibold">{vendor.name}</p>
              </div>
              
              {vendor.contact_person && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
                  <p className="text-foreground">{vendor.contact_person}</p>
                </div>
              )}

              {(vendor.address || vendor.city || vendor.state || vendor.zip_code) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <div className="space-y-1">
                    {vendor.address && <p className="text-foreground">{vendor.address}</p>}
                    {(vendor.city || vendor.state || vendor.zip_code) && (
                      <p className="text-foreground">
                        {[vendor.city, vendor.state, vendor.zip_code].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {vendor.notes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <p className="text-foreground">{vendor.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vendor.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${vendor.email}`} className="text-primary hover:underline">
                    {vendor.email}
                  </a>
                </div>
              )}
              
              {vendor.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${vendor.phone}`} className="text-primary hover:underline">
                    {vendor.phone}
                  </a>
                </div>
              )}

              {!vendor.email && !vendor.phone && (
                <p className="text-muted-foreground text-sm">No contact information available</p>
              )}
            </CardContent>
          </Card>

          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vendor.tax_id && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tax ID</label>
                  <p className="text-foreground">{vendor.tax_id}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Payment Terms</label>
                <p className="text-foreground">{vendor.payment_terms} days</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div>
                  <Badge variant={vendor.is_active ? "default" : "secondary"}>
                    {vendor.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" disabled>
                <FileText className="h-4 w-4 mr-2" />
                View Invoices
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <CreditCard className="h-4 w-4 mr-2" />
                Payment History
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <FileIcon className="h-4 w-4 mr-2" />
                View Documents
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}