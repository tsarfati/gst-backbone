import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Trash2, Upload, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const mockVendors = [
  {
    id: "1",
    name: "ABC Materials",
    contact: "John Smith",
    phone: "(555) 123-4567",
    email: "john@abcmaterials.com",
    address: "123 Industrial Way, City, ST 12345",
    category: "Materials",
    description: "Trusted supplier of high-quality construction materials with over 20 years of experience.",
    logo: null
  },
  {
    id: "2", 
    name: "Home Depot",
    contact: "N/A",
    phone: "(555) 987-6543",
    email: "support@homedepot.com",
    address: "456 Retail Blvd, City, ST 12345",
    category: "Retail",
    description: "Major home improvement retailer providing materials and tools.",
    logo: null
  },
  {
    id: "3",
    name: "Elite Electrical", 
    contact: "Sarah Johnson",
    phone: "(555) 456-7890",
    email: "sarah@eliteelectrical.com",
    address: "789 Service St, City, ST 12345",
    category: "Subcontractor",
    description: "Licensed electrical contractor specializing in commercial and industrial projects.",
    logo: null
  }
];

export default function VendorEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const vendor = mockVendors.find(v => v.id === id);

  const [formData, setFormData] = useState({
    name: vendor?.name || "",
    contact: vendor?.contact || "",
    phone: vendor?.phone || "",
    email: vendor?.email || "",
    address: vendor?.address || "",
    category: vendor?.category || "Materials",
    description: vendor?.description || "",
    logo: vendor?.logo || null
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(formData.logo);

  if (!vendor) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Vendor Not Found</h1>
          <Button onClick={() => navigate("/vendors")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vendors
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

  const handleSave = () => {
    // In a real app, this would save to backend
    toast({
      title: "Vendor Updated",
      description: "Vendor details have been successfully updated.",
    });
    navigate(`/vendors/${id}`);
  };

  const handleDelete = () => {
    // In a real app, this would delete from backend
    toast({
      title: "Vendor Deleted",
      description: "Vendor has been successfully deleted.",
      variant: "destructive",
    });
    navigate("/vendors");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/vendors/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Edit Vendor</h1>
            <p className="text-muted-foreground">Update vendor details and settings</p>
          </div>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Vendor
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete this vendor?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the vendor
                  and all associated data including payment methods, compliance documents, and transaction history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Vendor
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vendor Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter vendor name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleInputChange("category", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Materials">Materials</option>
                  <option value="Retail">Retail</option>
                  <option value="Subcontractor">Subcontractor</option>
                  <option value="Office">Office</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Services">Services</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Enter vendor description"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact">Primary Contact</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => handleInputChange("contact", e.target.value)}
                placeholder="Enter primary contact name"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Enter full address"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}