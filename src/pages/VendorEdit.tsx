import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Trash2, Upload, Building, Archive, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PaymentMethodEdit from "@/components/PaymentMethodEdit";
import ComplianceDocumentManager from "@/components/ComplianceDocumentManager";
import PaymentTermsSelect from "@/components/PaymentTermsSelect";
import { useCompany } from "@/contexts/CompanyContext";

export default function VendorEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();

  const isAddMode = !id || id === "add";
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(!isAddMode);

  const [formData, setFormData] = useState({
    name: "",
    vendor_type: "Other",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    tax_id: "",
    customer_number: "",
    payment_terms: "30",
    notes: "",
    is_active: true
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [complianceDocuments, setComplianceDocuments] = useState<any[]>([]);
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<any>(null);

  useEffect(() => {
    if (!isAddMode && user && (currentCompany?.id || profile?.current_company_id)) {
      loadVendor();
    }
  }, [id, isAddMode, user, currentCompany, profile?.current_company_id]);

  const loadPaymentMethods = async () => {
    if (!user || !id) return;
    
    try {
      const { data, error } = await supabase
        .from('vendor_payment_methods')
        .select('*')
        .eq('vendor_id', id)
        .order('created_at');

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const loadComplianceDocuments = async () => {
    if (!user || !id) return;
    
    try {
      const { data, error } = await supabase
        .from('vendor_compliance_documents')
        .select('*')
        .eq('vendor_id', id)
        .order('type');

      if (error) throw error;
      setComplianceDocuments(data || []);
    } catch (error) {
      console.error('Error loading compliance documents:', error);
    }
  };

  useEffect(() => {
    if (!isAddMode && id && user) {
      loadPaymentMethods();
      loadComplianceDocuments();
    }
  }, [id, isAddMode, user]);

  const loadVendor = async () => {
    if (!user || !id) return;
    
    try {
      // Let RLS handle company access check, don't filter by company_id
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setVendor(data);
        setFormData({
          name: data.name || "",
          vendor_type: data.vendor_type || "Other",
          contact_person: data.contact_person || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zip_code: data.zip_code || "",
          tax_id: data.tax_id || "",
          customer_number: data.customer_number || "",
          payment_terms: data.payment_terms || "30",
          notes: data.notes || "",
          is_active: data.is_active ?? true
        });
        
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      }
    } catch (error) {
      console.error('Error loading vendor:', error);
      toast({
        title: "Error",
        description: "Failed to load vendor details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Only show "not found" if we're in edit mode and vendor doesn't exist after loading
  if (!isAddMode && !loading && !vendor) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vendor Not Found</h1>
            <p className="text-muted-foreground">The requested vendor could not be found</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            This vendor doesn&apos;t exist or you don&apos;t have permission to edit it.
          </p>
          <Button onClick={() => navigate("/vendors")}>
            Return to Vendors
          </Button>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to save vendors",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Vendor name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    try {
      let logoUrl = vendor?.logo_url;
      
      // Handle logo upload
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `vendor-logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      }

      const vendorData = {
        ...formData,
        logo_url: logoUrl
      };

        if (isAddMode) {
          const companyId = currentCompany?.id || profile?.current_company_id;
          if (!companyId) {
            toast({ title: "Missing Company", description: "Select a company before creating a vendor.", variant: "destructive" });
            setSaving(false);
            return;
          }
          const { data, error } = await supabase
            .from('vendors')
            .insert([{ company_id: companyId, ...vendorData }])
            .select()
            .single();

        if (error) throw error;

        toast({
          title: "Vendor Created",
          description: "New vendor has been successfully created.",
        });
        navigate("/vendors");
      } else {
        // Let RLS handle access control, don't filter by company
        const { error } = await supabase
          .from('vendors')
          .update(vendorData)
          .eq('id', id);

        if (error) throw error;

        toast({
          title: "Vendor Updated", 
          description: "Vendor details have been successfully updated.",
        });
        navigate(`/vendors/${id}`);
      }
    } catch (error) {
      console.error('Error saving vendor:', error);
      toast({
        title: "Error",
        description: `Failed to ${isAddMode ? 'create' : 'update'} vendor: ${(error as any)?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !id) return;
    
    try {
      // Let RLS handle access control
      const { error } = await supabase
        .from('vendors')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Vendor Deleted",
        description: "Vendor has been successfully deleted.",
        variant: "destructive",
      });
      navigate("/vendors");
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast({
        title: "Error",
        description: "Failed to delete vendor",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async () => {
    if (!user || !id) return;
    
    const newStatus = !formData.is_active;
    
    try {
      // Let RLS handle access control
      const { error } = await supabase
        .from('vendors')
        .update({ is_active: newStatus })
        .eq('id', id);

      if (error) throw error;

      setFormData(prev => ({ ...prev, is_active: newStatus }));

      toast({
        title: `Vendor ${newStatus ? 'Activated' : 'Archived'}`,
        description: `Vendor has been successfully ${newStatus ? 'activated' : 'archived'}.`,
      });
    } catch (error) {
      console.error('Error updating vendor status:', error);
      toast({
        title: "Error",
        description: "Failed to update vendor status",
        variant: "destructive",
      });
    }
  };

  const handlePaymentMethodSave = async (paymentMethodData: any) => {
    // Only send columns that exist in vendor_payment_methods
    const mapToDb = (data: any) => ({
      type: data.type,
      bank_name: data.bank_name || null,
      routing_number: data.routing_number || null,
      account_number: data.account_number || null,
      is_primary: data.is_primary ?? false,
      check_delivery: data.check_delivery || null,
      pickup_location: data.pickup_location || null,
      voided_check_url: data.voided_check_url || null,
      account_type: data.account_type || null,
    });

    try {
      if (editingPaymentMethod) {
        const { error } = await supabase
          .from('vendor_payment_methods')
          .update(mapToDb(paymentMethodData))
          .eq('id', editingPaymentMethod.id);
        
        if (error) throw error;
        
        toast({
          title: "Payment Method Updated",
          description: "Payment method has been successfully updated. Editing account or routing number later will require confirmation.",
        });
      } else {
        const { error } = await supabase
          .from('vendor_payment_methods')
          .insert({
            ...mapToDb(paymentMethodData),
            vendor_id: id
          });
        
        if (error) throw error;
        
        toast({
          title: "Payment Method Added",
          description: "Payment method has been successfully added. Editing account or routing number later will require confirmation.",
        });
      }
      
      setShowPaymentMethodDialog(false);
      setEditingPaymentMethod(null);
      if (id) loadPaymentMethods();
    } catch (error) {
      console.error('Error saving payment method:', error);
      toast({
        title: "Error",
        description: "Failed to save payment method",
        variant: "destructive",
      });
    }
  };

  const handlePaymentMethodDelete = async (paymentMethodId: string) => {
    try {
      const { error } = await supabase
        .from('vendor_payment_methods')
        .delete()
        .eq('id', paymentMethodId);
      
      if (error) throw error;
      
      toast({
        title: "Payment Method Deleted",
        description: "Payment method has been successfully deleted.",
        variant: "destructive",
      });
      
      setShowPaymentMethodDialog(false);
      setEditingPaymentMethod(null);
      if (id) loadPaymentMethods();
    } catch (error) {
      console.error('Error deleting payment method:', error);
      toast({
        title: "Error",
        description: "Failed to delete payment method",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading vendor details...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(isAddMode ? "/vendors" : `/vendors/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isAddMode ? "Add New Vendor" : "Edit Vendor"}
            </h1>
            <p className="text-muted-foreground">
              {isAddMode ? "Create a new vendor profile" : "Update vendor details and settings"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isAddMode && (profile?.role === 'admin' || profile?.role === 'controller') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Vendor
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Vendor Confirmation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you absolutely sure you want to delete this vendor? This action cannot be undone. 
                    This will permanently delete the vendor and all associated data including payment methods, 
                    compliance documents, and transaction history.
                    <br /><br />
                    <strong>Vendor Name:</strong> {formData.name}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, Delete Vendor
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!isAddMode && (
            <Button 
              variant={formData.is_active ? "outline" : "default"} 
              onClick={handleToggleStatus}
            >
              {formData.is_active ? (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Vendor
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Activate Vendor
                </>
              )}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : (isAddMode ? "Create Vendor" : "Save Changes")}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Basic Information & Contact Details
              {!isAddMode && (
                <span className={`text-xs px-2 py-1 rounded-full ${formData.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {formData.is_active ? 'Active' : 'Archived'}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Vendor Logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 border border-border rounded-lg flex items-center justify-center bg-muted">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover rounded-lg" />
                  ) : (
                    <Building className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </span>
                    </Button>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: Square image, max 2MB
                  </p>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vendor Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter vendor name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID/EIN Number</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) => handleInputChange("tax_id", e.target.value)}
                  placeholder="Enter Tax ID or EIN number"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_person">Primary Contact</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => handleInputChange("contact_person", e.target.value)}
                  placeholder="Enter primary contact name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Enter street address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  placeholder="Enter city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleInputChange("state", e.target.value)}
                  placeholder="Enter state"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">ZIP Code</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => handleInputChange("zip_code", e.target.value)}
                  placeholder="Enter ZIP code"
                />
              </div>
            </div>

            {/* Business Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_type">Vendor Type</Label>
                <Select 
                  value={formData.vendor_type} 
                  onValueChange={(value) => handleInputChange("vendor_type", value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select vendor type" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-md z-50">
                    <SelectItem value="Contractor">Contractor</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                    <SelectItem value="Consultant">Consultant</SelectItem>
                    <SelectItem value="Design Professional">Design Professional</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_number">Customer Number</Label>
                <Input
                  id="customer_number"
                  value={formData.customer_number}
                  onChange={(e) => handleInputChange("customer_number", e.target.value)}
                  placeholder="Enter customer number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <PaymentTermsSelect 
                  value={formData.payment_terms} 
                  onValueChange={(value) => handleInputChange("payment_terms", value)} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Enter vendor notes"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {!isAddMode && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Payment Methods</CardTitle>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setEditingPaymentMethod(null);
                    setShowPaymentMethodDialog(true);
                  }}
                >
                  Add Payment Method
                </Button>
              </CardHeader>
              <CardContent>
                {paymentMethods.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No payment methods configured
                  </div>
                ) : (
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
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setEditingPaymentMethod(method);
                                setShowPaymentMethodDialog(true);
                              }}
                            >
                              Edit
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <ComplianceDocumentManager
                  vendorId={id!}
                  documents={complianceDocuments}
                  onDocumentsChange={setComplianceDocuments}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Payment Method Dialog */}
      <PaymentMethodEdit
        paymentMethod={editingPaymentMethod}
        isOpen={showPaymentMethodDialog}
        onClose={() => setShowPaymentMethodDialog(false)}
        onSave={handlePaymentMethodSave}
        onDelete={editingPaymentMethod ? handlePaymentMethodDelete : undefined}
      />
    </div>
  );
}