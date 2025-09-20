import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, DollarSign, Calendar, Receipt, Image, FileText, FolderOpen, Users, Plus } from "lucide-react";

const mockJobs = [
  {
    id: "1",
    name: "Office Renovation",
    budget: "$25,000",
    spent: "$18,450",
    receipts: 8,
    startDate: "2024-01-01",
    status: "active",
    description: "Complete renovation of the main office space including flooring, painting, and furniture.",
    location: "123 Main St, Downtown",
    contractor: "ABC Construction",
    costCodes: [
      { code: "001", description: "Labor", budget: 10000, spent: 7500 },
      { code: "002", description: "Materials", budget: 8000, spent: 6200 },
      { code: "003", description: "Equipment", budget: 7000, spent: 4750 }
    ],
    photos: [],
    drawings: [],
    documents: [],
    directory: [
      { name: "John Smith", role: "Project Manager", phone: "(555) 123-4567", email: "john@company.com" },
      { name: "Sarah Wilson", role: "Site Supervisor", phone: "(555) 987-6543", email: "sarah@contractor.com" }
    ]
  },
  {
    id: "2",
    name: "Warehouse Project",
    budget: "$50,000",
    spent: "$32,100",
    receipts: 15,
    startDate: "2023-12-15",
    status: "active",
    description: "Warehouse expansion and modernization project.",
    location: "456 Industrial Blvd",
    contractor: "XYZ Builders",
    costCodes: [
      { code: "001", description: "Foundation", budget: 15000, spent: 12000 },
      { code: "002", description: "Steel Structure", budget: 20000, spent: 15100 },
      { code: "003", description: "Electrical", budget: 15000, spent: 5000 }
    ],
    photos: [],
    drawings: [],
    documents: [],
    directory: []
  },
  {
    id: "3",
    name: "Retail Buildout",
    budget: "$15,000",
    spent: "$14,800",
    receipts: 4,
    startDate: "2024-01-10",
    status: "completed",
    description: "Retail space buildout for new store location.",
    location: "789 Shopping Center",
    contractor: "Retail Builders Inc",
    costCodes: [
      { code: "001", description: "Interior Finishes", budget: 8000, spent: 7800 },
      { code: "002", description: "Lighting", budget: 4000, spent: 4000 },
      { code: "003", description: "Security", budget: 3000, spent: 3000 }
    ],
    photos: [],
    drawings: [],
    documents: [],
    directory: []
  }
];

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const job = mockJobs.find(j => j.id === id);

  if (!job) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Job Not Found</h1>
          <Button onClick={() => navigate("/jobs")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  const budgetUsage = Math.round((parseInt(job.spent.replace(/[$,]/g, '')) / parseInt(job.budget.replace(/[$,]/g, ''))) * 100);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/jobs")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{job.name}</h1>
              <Badge variant={job.status === "active" ? "default" : "success"}>
                {job.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{job.description}</p>
          </div>
        </div>
        <Button onClick={() => navigate(`/jobs/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Job
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Budget</span>
            </div>
            <div className="text-2xl font-bold">{job.budget}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Spent</span>
            </div>
            <div className="text-2xl font-bold">{job.spent}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Receipts</span>
            </div>
            <div className="text-2xl font-bold">{job.receipts}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Started</span>
            </div>
            <div className="text-2xl font-bold">{job.startDate}</div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Budget Usage</span>
            <span>{budgetUsage}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div 
              className="bg-primary h-3 rounded-full transition-all"
              style={{ width: `${Math.min(100, budgetUsage)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="costcodes">Cost Codes</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="drawings">Drawings</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Location:</span>
                  <div className="font-medium">{job.location}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Contractor:</span>
                  <div className="font-medium">{job.contractor}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Start Date:</span>
                  <div className="font-medium">{job.startDate}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costcodes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Cost Codes</h3>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Cost Code
            </Button>
          </div>
          <div className="space-y-4">
            {job.costCodes.map((costCode, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{costCode.code}</Badge>
                      <span className="font-medium">{costCode.description}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${costCode.spent.toLocaleString()} / ${costCode.budget.toLocaleString()}
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (costCode.spent / costCode.budget) * 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="photos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Photos</h3>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Upload Photos
            </Button>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No photos uploaded yet</p>
              <Button variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Upload First Photo
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drawings" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Drawings & Plans</h3>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Upload Drawing
            </Button>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No drawings uploaded yet</p>
              <Button variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Upload First Drawing
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Job Documents</h3>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No documents uploaded yet</p>
              <Button variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directory" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Job Directory</h3>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
          {job.directory.length > 0 ? (
            <div className="space-y-4">
              {job.directory.map((contact, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{contact.name}</div>
                        <div className="text-sm text-muted-foreground">{contact.role}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div>{contact.phone}</div>
                        <div className="text-muted-foreground">{contact.email}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No contacts added yet</p>
                <Button variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Contact
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}