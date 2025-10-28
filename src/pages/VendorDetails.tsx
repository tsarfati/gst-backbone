import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Building, FileText, Mail, Phone, CreditCard, FileIcon, Upload, ExternalLink, Briefcase, AlertTriangle, Eye, EyeOff, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useActionPermissions } from "@/hooks/useActionPermissions";
import ComplianceDocumentManager from "@/components/ComplianceDocumentManager";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function VendorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [complianceDocuments, setComplianceDocuments] = useState<any[]>([]);
  const [subcontracts, setSubcontracts] = useState<any[]>([]);
  const [unmaskedMethods, setUnmaskedMethods] = useState<Set<string>>(new Set());
  const [viewingVoidedCheck, setViewingVoidedCheck] = useState<any>(null);
  const { hasElevatedAccess } = useActionPermissions();

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
            fetchSubcontracts(data.id);
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
        
        // Transform database format to component format
        const transformedDocs = (data || []).map(doc => ({
          id: doc.id,
          type: doc.type,
          required: doc.is_required,
          uploaded: doc.is_uploaded,
          fileName: doc.file_name || undefined,
          uploadDate: doc.uploaded_at || undefined,
          expirationDate: doc.expiration_date || undefined,
          url: doc.file_url || undefined,
          status: doc.is_uploaded ? 'uploaded' : 'missing'
        }));
        
        setComplianceDocuments(transformedDocs);
      } catch (error) {
        console.error('Error loading compliance documents:', error);
      }
    };

    const fetchSubcontracts = async (vendorId: string) => {
      try {
        const { data, error } = await supabase
          .from('subcontracts')
          .select(`
            *,
            jobs:job_id (
              id,
              name,
              client
            )
          `)
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSubcontracts(data || []);
      } catch (error) {
        console.error('Error loading subcontracts:', error);
      }
    };

    const fetchVendorJobs = async (companyId: string) => {
      try {
        // Get unique jobs from invoices, subcontracts, and purchase orders
        const { data: invoiceJobs } = await supabase
          .from('invoices')
          .select(`
            job_id,
            jobs:job_id (
              id,
              name,
              client,
              status
            )
          `)
          .eq('vendor_id', id)
          .not('job_id', 'is', null);

        const { data: subcontractJobs } = await supabase
          .from('subcontracts')
          .select(`
            job_id,
            jobs:job_id (
              id,
              name,
              client,
              status
            )
          `)
          .eq('vendor_id', id)
          .not('job_id', 'is', null);

        const { data: poJobs } = await supabase
          .from('purchase_orders')
          .select(`
            job_id,
            jobs:job_id (
              id,
              name,
              client,
              status
            )
          `)
          .eq('vendor_id', id)
          .not('job_id', 'is', null);

        // Combine and deduplicate jobs
        const allJobs = [
          ...(invoiceJobs || []),
          ...(subcontractJobs || []),
          ...(poJobs || [])
        ];

        const uniqueJobsMap = new Map();
        allJobs.forEach(item => {
          if (item.jobs && !uniqueJobsMap.has(item.jobs.id)) {
            uniqueJobsMap.set(item.jobs.id, item.jobs);
          }
        });

        setJobs(Array.from(uniqueJobsMap.values()));
      } catch (error) {
        console.error('Error loading vendor jobs:', error);
      }
    };

    fetchVendor();
  }, [id, toast]);

  const canViewSensitiveData = hasElevatedAccess();

  const toggleUnmask = (methodId: string) => {
    if (!canViewSensitiveData) return;
    
    setUnmaskedMethods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(methodId)) {
        newSet.delete(methodId);
      } else {
        newSet.add(methodId);
      }
      return newSet;
    });
  };

  const maskAccountNumber = (accountNumber: string, methodId: string) => {
    if (!accountNumber) return '****';
    if (unmaskedMethods.has(methodId)) return accountNumber;
    return `****${accountNumber.slice(-4)}`;
  };

  const maskRoutingNumber = (routingNumber: string, methodId: string) => {
    if (!routingNumber) return '****';
    if (unmaskedMethods.has(methodId)) return routingNumber;
    return `****${routingNumber.slice(-4)}`;
  };

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
                  <Building className="h-5 w-5" />
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

                    {vendor.customer_number && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Customer Number</label>
                        <p className="text-foreground">{vendor.customer_number}</p>
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
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/invoices', { state: { vendorFilter: vendor.name } })}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Invoices
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/payables/payment-history', { state: { vendorFilter: vendor.name } })}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment History
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate(`/vendors/${id}/edit`, { state: { scrollToDocuments: true } })}
                >
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
                <div className="space-y-6">
                  {paymentMethods.map((method, index) => {
                    const isUnmasked = unmaskedMethods.has(method.id);
                    const isSensitiveType = method.type === 'ach' || method.type === 'wire';
                    
                    return (
                      <div key={method.id}>
                        {index > 0 && <hr className="border-muted" />}
                        <Card className={`border-dashed ${isSensitiveType ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20' : ''}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{method.bank_name || 'Payment Method'}</h4>
                                {isSensitiveType && (
                                  <Badge variant="outline" className="text-xs bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900 dark:border-amber-700 dark:text-amber-200">
                                    Encrypted
                                  </Badge>
                                )}
                              </div>
                              
                               {/* Account Information */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-muted-foreground">Type:</span>
                                  <Badge variant="outline">{method.type.toUpperCase()}</Badge>
                                </div>
                                
                                {method.account_number && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Account:</span>
                                    <span className="text-sm font-mono">
                                      {maskAccountNumber(method.account_number, method.id)}
                                    </span>
                                    {canViewSensitiveData && isSensitiveType && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleUnmask(method.id)}
                                        className="h-6 w-6 p-0"
                                      >
                                        {isUnmasked ? (
                                          <EyeOff className="h-3 w-3" />
                                        ) : (
                                          <Eye className="h-3 w-3" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                )}
                                
                                {method.routing_number && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Routing:</span>
                                    <span className="text-sm font-mono">
                                      {maskRoutingNumber(method.routing_number, method.id)}
                                    </span>
                                    {canViewSensitiveData && isSensitiveType && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleUnmask(method.id)}
                                        className="h-6 w-6 p-0"
                                      >
                                        {isUnmasked ? (
                                          <EyeOff className="h-3 w-3" />
                                        ) : (
                                          <Eye className="h-3 w-3" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                )}
                                
                                {method.account_type && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Account Type:</span>
                                    <span className="text-sm">{method.account_type}</span>
                                  </div>
                                )}
                                
                                {method.check_delivery && method.type === 'check' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Delivery:</span>
                                    <span className="text-sm">
                                      {method.check_delivery === 'office_pickup' ? 'Office Pickup' : 'Mail'}
                                    </span>
                                  </div>
                                )}
                                
                                {method.pickup_location && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Pickup Location:</span>
                                    <span className="text-sm">{method.pickup_location}</span>
                                  </div>
                                )}
                                
                                {method.is_primary && (
                                  <Badge variant="default" className="text-xs">Primary</Badge>
                                )}
                                
                                {/* View Voided Check Button */}
                                {canViewSensitiveData && isSensitiveType && method.voided_check_url && (
                                  <div className="mt-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setViewingVoidedCheck(method)}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      View Voided Check
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                         </CardContent>
                       </Card>
                       </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Compliance Documents Section */}
        <div id="compliance-documents">
          <ComplianceDocumentManager
            vendorId={vendor.id}
            documents={complianceDocuments}
            onDocumentsChange={setComplianceDocuments}
            isEditMode={false}
          />
        </div>

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

        {/* Subcontracts Section - Only show for contractors and design professionals */}
        {(vendor.vendor_type === 'contractor' || vendor.vendor_type === 'design_professional') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Subcontracts
              </CardTitle>
              <Button 
                onClick={() => navigate(`/subcontracts/add?vendorId=${vendor.id}`)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Subcontract
              </Button>
            </CardHeader>
            <CardContent>
            {subcontracts.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Subcontracts Found</h3>
                <p className="text-muted-foreground mb-4">No subcontracts are currently associated with this vendor</p>
                <Button 
                  onClick={() => navigate(`/subcontracts/add?vendorId=${vendor.id}`)}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Subcontract
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {subcontracts.map((subcontract) => (
                  <Card 
                    key={subcontract.id} 
                    className="border-dashed hover-lift cursor-pointer"
                    onClick={() => navigate(`/jobs/${subcontract.job_id}`)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{subcontract.name}</h4>
                            <Badge variant={
                              subcontract.status === 'active' ? 'default' :
                              subcontract.status === 'completed' ? 'success' : 'secondary'
                            }>
                              {subcontract.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Job: {subcontract.jobs?.name}
                            {subcontract.jobs?.client && ` • Client: ${subcontract.jobs.client}`}
                          </p>
                          {subcontract.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {subcontract.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <div>
                              <span className="text-xs text-muted-foreground">Contract Amount:</span>
                              <span className="text-sm font-medium ml-1">
                                ${parseFloat(subcontract.contract_amount).toLocaleString()}
                              </span>
                            </div>
                            {subcontract.start_date && (
                              <div>
                                <span className="text-xs text-muted-foreground">Start Date:</span>
                                <span className="text-sm ml-1">{subcontract.start_date}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {subcontract.contract_file_url && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(subcontract.contract_file_url, '_blank');
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View Contract
                            </Button>
                          )}
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
        )}

        {/* Purchase Orders Section - Only show for suppliers */}
        {vendor.vendor_type === 'supplier' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Purchase Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Purchase Orders</h3>
                <p className="text-sm mb-4">This vendor has no purchase orders on record.</p>
                <Button variant="outline" disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Purchase Order
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Voided Check Modal */}
      <Dialog open={!!viewingVoidedCheck} onOpenChange={() => setViewingVoidedCheck(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Voided Check - {viewingVoidedCheck?.bank_name}</DialogTitle>
            <DialogDescription>
              View the voided check document for this payment method
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            {viewingVoidedCheck?.voided_check_url && (
              <>
                {viewingVoidedCheck.voided_check_url.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={viewingVoidedCheck.voided_check_url}
                    className="w-full h-[70vh] border-0"
                    title="Voided Check PDF"
                  />
                ) : (
                  <img 
                    src={viewingVoidedCheck.voided_check_url} 
                    alt="Voided Check" 
                    className="w-full h-auto"
                  />
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}