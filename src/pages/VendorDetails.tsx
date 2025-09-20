import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Building, FileText, Mail, Phone, CreditCard, FileIcon, Upload, ExternalLink, Briefcase, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function VendorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [complianceDocuments, setComplianceDocuments] = useState<any[]>([]);

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
          if (data) {
            // Fetch related data
            fetchVendorJobs(data.company_id);
            fetchPaymentMethods(data.id);
            fetchComplianceDocuments(data.id);
          }
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

    const fetchPaymentMethods = async (vendorId: string) => {
      try {
        const { data, error } = await supabase
          .from('vendor_payment_methods')
          .select('*')
          .eq('vendor_id', vendorId)
          .order('created_at');

        if (error) throw error;
        setPaymentMethods(data || []);
      } catch (error) {
        console.error('Error loading payment methods:', error);
      }
    };

    const fetchComplianceDocuments = async (vendorId: string) => {
      try {
        const { data, error } = await supabase
          .from('vendor_compliance_documents')
          .select('*')
          .eq('vendor_id', vendorId)
          .order('type');

        if (error) throw error;
        setComplianceDocuments(data || []);
      } catch (error) {
        console.error('Error loading compliance documents:', error);
      }
    };

    const fetchVendorJobs = async (companyId: string) => {
      // Only show jobs where vendor is actually associated (empty for now)
      // Jobs should only be shown if vendor is linked via invoices or job settings
      setJobs([]);
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
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            {vendor.logo_url ? (
              <img 
                src={vendor.logo_url} 
                alt={`${vendor.name} logo`}
                className="h-12 w-12 object-contain rounded-lg border"
              />
            ) : (
              <Building className="h-12 w-12 p-2 bg-muted rounded-lg text-muted-foreground" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{vendor.name}</h1>
              <p className="text-muted-foreground">Vendor Details</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/vendors/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Vendor
          </Button>
        </div>
      </div>

      {/* Single Scrollable Content */}
      <div className="space-y-8">
        {/* Overview Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {vendor.logo_url ? (
                    <img 
                      src={vendor.logo_url} 
                      alt={`${vendor.name} logo`}
                      className="h-8 w-8 object-contain rounded"
                    />
                  ) : (
                    <Building className="h-5 w-5" />
                  )}
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                {/* Contact Information */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Information</h4>
                  <div className="space-y-3">
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
                  </div>
                </div>

                {/* Business Information */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Business Information</h4>
                  <div className="space-y-3">
                    {vendor.tax_id && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Tax ID</label>
                        <p className="text-foreground">{vendor.tax_id}</p>
                      </div>
                    )}
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Payment Terms</label>
                      <p className="text-foreground">
                        {vendor.payment_terms === 'asap' ? 'ASAP' : 
                         vendor.payment_terms === '15' ? 'Net 15' :
                         vendor.payment_terms === '30' ? 'Net 30' : 
                         `${vendor.payment_terms} days`}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div>
                        <Badge variant={vendor.is_active ? "default" : "secondary"}>
                          {vendor.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {vendor.notes && (
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-muted-foreground">Notes</label>
                    <p className="text-foreground">{vendor.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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

        {/* Payment Methods Section - Only show if there are payment methods */}
        {paymentMethods.length > 0 && (
          <div id="payment-methods">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Methods
                </CardTitle>
                <Badge variant="outline" className="text-xs">View Only</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <Card key={method.id} className="border-dashed">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{method.bank_name || 'Payment Method'}</h4>
                            <p className="text-sm text-muted-foreground">
                              {method.type.toUpperCase()} - ****{method.account_number?.slice(-4) || '****'}
                            </p>
                            {method.check_delivery && (
                              <p className="text-sm text-muted-foreground">
                                Delivery: {method.check_delivery === 'office_pickup' ? 'Office Pickup' : 'Mail'}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline">{method.type.toUpperCase()}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Compliance Documents Section - Only show if there are required documents */}
        {complianceDocuments.filter(d => d.is_required).length > 0 && (
          <div id="compliance-documents">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileIcon className="h-5 w-5" />
                  Compliance Documents
                </CardTitle>
                <Badge variant="outline" className="text-xs">View Only</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['Insurance', 'W-9 Form', 'License'].map((docType) => {
                    const docTypeKey = docType.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const doc = complianceDocuments.find(d => d.type === docTypeKey);
                    const isUploaded = doc?.is_uploaded || false;
                    const isRequired = doc?.is_required || false;
                    
                    // Only show if required
                    if (!isRequired) return null;
                    
                    return (
                      <Card key={docType} className="border-dashed">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="h-8 w-8 p-1.5 bg-muted rounded text-muted-foreground" />
                              <div>
                                <h4 className="font-medium">{docType}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Required • {isUploaded ? 'Uploaded' : 'Missing'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!isUploaded && (
                                <Badge variant="destructive" className="text-xs">Missing</Badge>
                              )}
                              <Badge variant={isUploaded ? "default" : "secondary"} className="text-xs">
                                {isUploaded ? "Uploaded" : "Not Uploaded"}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }).filter(Boolean)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Jobs Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Associated Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Jobs Found</h3>
                <p className="text-muted-foreground mb-4">No jobs are currently associated with this vendor</p>
                <p className="text-xs text-muted-foreground">
                  Jobs will appear here when this vendor is linked via invoices or job settings
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <Card 
                    key={job.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow border-dashed"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{job.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {job.client && `Client: ${job.client}`}
                            {job.status && ` • Status: ${job.status}`}
                          </p>
                          {job.budget && (
                            <p className="text-sm text-muted-foreground">
                              Budget: ${job.budget.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{job.status}</Badge>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}