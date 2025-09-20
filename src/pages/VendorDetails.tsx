import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Building, Plus, FileText, Mail, Phone, MapPin, CreditCard, FileIcon, Upload, Download, ExternalLink, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import PaymentMethodEdit from "@/components/PaymentMethodEdit";
import ComplianceDocumentManager from "@/components/ComplianceDocumentManager";

export default function VendorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [complianceDocuments, setComplianceDocuments] = useState<any[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

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
            // Fetch related jobs
            fetchVendorJobs(data.company_id);
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

    const fetchVendorJobs = async (companyId: string) => {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('created_by', companyId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setJobs(data);
        }
      } catch (error) {
        console.error('Error fetching vendor jobs:', error);
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
    <div className="p-6 max-w-7xl mx-auto">
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

      <TabsPrimitive.Root defaultValue="overview" className="space-y-6">
        <TabsPrimitive.List className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <TabsPrimitive.Trigger value="overview" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">Overview</TabsPrimitive.Trigger>
          <TabsPrimitive.Trigger value="payments" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">Payment Methods</TabsPrimitive.Trigger>
          <TabsPrimitive.Trigger value="compliance" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">Compliance Documents</TabsPrimitive.Trigger>
          <TabsPrimitive.Trigger value="jobs" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">Jobs</TabsPrimitive.Trigger>
        </TabsPrimitive.List>

        <TabsPrimitive.Content value="overview" className="mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 space-y-6">
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
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="payments" className="mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Payment Methods</CardTitle>
              <Button onClick={() => {
                setSelectedPaymentMethod(null);
                setIsPaymentDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </CardHeader>
            <CardContent>
              {paymentMethods.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Payment Methods</h3>
                  <p className="text-muted-foreground mb-4">Add payment methods to streamline vendor payments</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <Card key={method.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                      setSelectedPaymentMethod(method);
                      setIsPaymentDialogOpen(true);
                    }}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{method.bankName || 'Payment Method'}</h4>
                            <p className="text-sm text-muted-foreground">
                              {method.type} - ****{method.accountNumber?.slice(-4) || '****'}
                            </p>
                            {method.checkDelivery && (
                              <p className="text-sm text-muted-foreground">
                                Delivery: {method.checkDelivery === 'office_pickup' ? 'Office Pickup' : 'Mail'}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline">{method.type}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <PaymentMethodEdit
            paymentMethod={selectedPaymentMethod}
            isOpen={isPaymentDialogOpen}
            onClose={() => {
              setIsPaymentDialogOpen(false);
              setSelectedPaymentMethod(null);
            }}
            onSave={(method) => {
              if (selectedPaymentMethod) {
                setPaymentMethods(prev => prev.map(pm => pm.id === selectedPaymentMethod.id ? { ...method, id: selectedPaymentMethod.id } : pm));
              } else {
                setPaymentMethods(prev => [...prev, { ...method, id: Date.now().toString() }]);
              }
            }}
            onDelete={(methodId) => {
              setPaymentMethods(prev => prev.filter(pm => pm.id !== methodId));
            }}
          />
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="compliance" className="mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 space-y-6">
          <ComplianceDocumentManager
            vendorId={id}
            documents={complianceDocuments}
            onDocumentsChange={setComplianceDocuments}
          />
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="jobs" className="mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Associated Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Jobs Found</h3>
                  <p className="text-muted-foreground mb-4">No jobs are currently associated with this vendor</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <Card key={job.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/job-details/${job.id}`)}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{job.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Status: <span className="capitalize">{job.status}</span>
                              {job.budget && ` • Budget: $${Number(job.budget).toLocaleString()}`}
                            </p>
                            {job.description && (
                              <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
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
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>
    </div>
  );
}