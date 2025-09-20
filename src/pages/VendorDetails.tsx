import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Building, Phone, Mail, MapPin, Receipt, CreditCard, FileText, Plus, Briefcase, Eye, EyeOff } from "lucide-react";
import PaymentMethodEdit from "@/components/PaymentMethodEdit";

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
    category: "Materials",
    logo: null,
    description: "Trusted supplier of high-quality construction materials with over 20 years of experience.",
    paymentMethods: [
      { id: "1", type: "Check", accountNumber: "1234567890124567", isDefault: true, checkDelivery: "mail" },
      { id: "2", type: "ACH", accountNumber: "9876543210128901", isDefault: false, routingNumber: "123456789", bankName: "First National Bank" }
    ],
    complianceDocuments: [
      { name: "Insurance Certificate", uploadDate: "2024-01-15", status: "Current" },
      { name: "W-9 Form", uploadDate: "2024-01-10", status: "Current" }
    ],
    jobs: [
      { id: "1", name: "Office Renovation", status: "active", spent: "$8,500" },
      { id: "2", name: "Warehouse Project", status: "active", spent: "$6,750" }
    ]
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
    category: "Retail",
    logo: null,
    description: "Major home improvement retailer providing materials and tools.",
    paymentMethods: [
      { id: "3", type: "Credit Card", accountNumber: "4111111111111234", isDefault: true }
    ],
    complianceDocuments: [],
    jobs: [
      { id: "3", name: "Retail Buildout", status: "completed", spent: "$8,450" }
    ]
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
    category: "Subcontractor",
    logo: null,
    description: "Licensed electrical contractor specializing in commercial and industrial projects.",
    paymentMethods: [
      { id: "4", type: "ACH", accountNumber: "5555555555552468", isDefault: true, routingNumber: "987654321", bankName: "Business Bank" },
      { id: "5", type: "Check", accountNumber: "1111111111111357", isDefault: false, checkDelivery: "office_pickup", pickupLocation: "main" }
    ],
    complianceDocuments: [
      { name: "Electrical License", uploadDate: "2024-01-01", status: "Current" },
      { name: "Insurance Certificate", uploadDate: "2024-01-05", status: "Current" },
      { name: "Bond Certificate", uploadDate: "2024-01-03", status: "Current" }
    ],
    jobs: [
      { id: "1", name: "Office Renovation", status: "active", spent: "$12,100" },
      { id: "2", name: "Warehouse Project", status: "active", spent: "$10,000" }
    ]
  }
];

const categoryColors = {
  "Materials": "default",
  "Retail": "secondary",
  "Subcontractor": "success",
  "Office": "warning"
} as const;

export default function VendorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [editingPaymentMethod, setEditingPaymentMethod] = useState(null);
  const [isPaymentMethodDialogOpen, setIsPaymentMethodDialogOpen] = useState(false);
  const [userRole] = useState<'admin' | 'controller' | 'user'>('admin'); // Mock user role

  const vendor = mockVendors.find(v => v.id === id);

  const maskAccountNumber = (accountNumber: string) => {
    if (accountNumber.length <= 4) return accountNumber;
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
  };

  const handleEditPaymentMethod = (method: any) => {
    setEditingPaymentMethod(method);
    setIsPaymentMethodDialogOpen(true);
  };

  const handleAddPaymentMethod = () => {
    setEditingPaymentMethod(null);
    setIsPaymentMethodDialogOpen(true);
  };

  const handleSavePaymentMethod = (method: any) => {
    // In a real app, this would update the backend
    console.log('Saving payment method:', method);
  };

  const handleDeletePaymentMethod = (methodId: string) => {
    // In a real app, this would delete from the backend
    console.log('Deleting payment method:', methodId);
  };

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {vendor.logo ? (
                  <img src={vendor.logo} alt={vendor.name} className="h-8 w-8 rounded object-cover" />
                ) : (
                  <Building className="h-6 w-6 text-primary" />
                )}
                <h1 className="text-2xl font-bold text-foreground">{vendor.name}</h1>
              </div>
              <Badge variant={categoryColors[vendor.category as keyof typeof categoryColors]}>
                {vendor.category}
              </Badge>
            </div>
            <p className="text-muted-foreground">{vendor.description}</p>
          </div>
        </div>
        <Button onClick={() => navigate(`/vendors/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Vendor
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Spent</span>
            </div>
            <div className="text-2xl font-bold">{vendor.totalSpent}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Invoices</span>
            </div>
            <div className="text-2xl font-bold">{vendor.invoices}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Active Jobs</span>
            </div>
            <div className="text-2xl font-bold">{vendor.jobs.filter(j => j.status === "active").length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payment">Payment Methods</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vendor.contact !== "N/A" && (
                <div>
                  <span className="text-sm text-muted-foreground">Primary Contact:</span>
                  <div className="font-medium">{vendor.contact}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{vendor.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{vendor.email}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <span>{vendor.address}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Payment Methods</h3>
            <Button size="sm" onClick={handleAddPaymentMethod}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
          <div className="space-y-4">
            {vendor.paymentMethods.map((method, index) => (
              <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleEditPaymentMethod(method)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{method.type}</div>
                        <div className="text-sm text-muted-foreground">
                          {maskAccountNumber(method.accountNumber)}
                        </div>
                        {method.type === 'ACH' && method.bankName && (
                          <div className="text-xs text-muted-foreground">{method.bankName}</div>
                        )}
                        {method.type === 'Check' && method.checkDelivery && (
                          <div className="text-xs text-muted-foreground">
                            Delivery: {method.checkDelivery === 'mail' ? 'Mail' : 'Office Pickup'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPaymentMethod(method);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <PaymentMethodEdit
            paymentMethod={editingPaymentMethod}
            isOpen={isPaymentMethodDialogOpen}
            onClose={() => setIsPaymentMethodDialogOpen(false)}
            onSave={handleSavePaymentMethod}
            onDelete={handleDeletePaymentMethod}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Compliance Documents</h3>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
          {vendor.complianceDocuments.length > 0 ? (
            <div className="space-y-4">
              {vendor.complianceDocuments.map((doc, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{doc.name}</div>
                          <div className="text-sm text-muted-foreground">Uploaded: {doc.uploadDate}</div>
                        </div>
                      </div>
                      <Badge variant={doc.status === "Current" ? "success" : "warning"}>
                        {doc.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No compliance documents uploaded yet</p>
                <Button variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload First Document
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <h3 className="text-lg font-semibold">Associated Jobs</h3>
          {vendor.jobs.length > 0 ? (
            <div className="space-y-4">
              {vendor.jobs.map((job) => (
                <Card key={job.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/jobs/${job.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium">{job.name}</div>
                          <div className="text-sm text-muted-foreground">Spent: {job.spent}</div>
                        </div>
                      </div>
                      <Badge variant={job.status === "active" ? "default" : "success"}>
                        {job.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No jobs associated with this vendor yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Vendor Documents</h3>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No documents uploaded yet</p>
              <Button variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}