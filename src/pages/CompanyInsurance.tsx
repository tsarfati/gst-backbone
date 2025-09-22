import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Shield, 
  Upload, 
  Search, 
  Filter,
  Eye,
  Download,
  Edit,
  Calendar,
  AlertTriangle,
  Plus,
  DollarSign,
  Building,
  Phone
} from "lucide-react";

const mockInsurance = [
  {
    id: "1",
    policyNumber: "GL-2024-001234",
    type: "General Liability",
    provider: "ABC Insurance Company",
    coverage: 2000000,
    premium: 8500,
    effectiveDate: "2024-01-01",
    expirationDate: "2024-12-31",
    status: "active",
    agent: "John Smith",
    agentPhone: "(555) 123-4567",
    fileSize: "2.1 MB"
  },
  {
    id: "2",
    policyNumber: "WC-2024-567890",
    type: "Workers' Compensation",
    provider: "XYZ Insurance Group",
    coverage: 1000000,
    premium: 12000,
    effectiveDate: "2024-01-01",
    expirationDate: "2024-12-31",
    status: "active",
    agent: "Sarah Johnson",
    agentPhone: "(555) 987-6543",
    fileSize: "1.8 MB"
  },
  {
    id: "3",
    policyNumber: "AU-2023-112233",
    type: "Commercial Auto",
    provider: "DEF Insurance Co",
    coverage: 500000,
    premium: 3200,
    effectiveDate: "2023-06-01",
    expirationDate: "2024-06-01",
    status: "expiring",
    agent: "Mike Davis",
    agentPhone: "(555) 456-7890",
    fileSize: "1.2 MB"
  }
];

const getStatusVariant = (status: string) => {
  switch (status) {
    case "active":
      return "default";
    case "expiring":
      return "warning";
    case "expired":
      return "destructive";
    case "pending":
      return "secondary";
    default:
      return "outline";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "expiring":
    case "expired":
      return <AlertTriangle className="h-3 w-3" />;
    default:
      return null;
  }
};

export default function CompanyInsurance() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredInsurance = mockInsurance.filter(policy => {
    const matchesSearch = policy.policyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         policy.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         policy.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || policy.type === typeFilter;
    const matchesStatus = statusFilter === "all" || policy.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const activePolicies = mockInsurance.filter(p => p.status === "active").length;
  const expiringPolicies = mockInsurance.filter(p => p.status === "expiring").length;
  const totalCoverage = mockInsurance.reduce((sum, policy) => sum + policy.coverage, 0);
  const totalPremiums = mockInsurance.reduce((sum, policy) => sum + policy.premium, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Company Insurance</h1>
          <p className="text-muted-foreground">
            Manage insurance policies, coverage, and renewals
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePolicies}</div>
            <p className="text-xs text-muted-foreground">Currently in force</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringPolicies}</div>
            <p className="text-xs text-muted-foreground">Next 60 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coverage</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalCoverage / 1000000).toFixed(1)}M</div>
            <p className="text-xs text-muted-foreground">Combined limits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annual Premiums</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPremiums.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Per year</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search policies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-56">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Insurance Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="General Liability">General Liability</SelectItem>
                  <SelectItem value="Workers' Compensation">Workers' Compensation</SelectItem>
                  <SelectItem value="Commercial Auto">Commercial Auto</SelectItem>
                  <SelectItem value="Professional Liability">Professional Liability</SelectItem>
                  <SelectItem value="Property">Property Insurance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring">Expiring</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insurance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Insurance Policies</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInsurance.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No insurance policies found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || typeFilter !== "all" || statusFilter !== "all" 
                  ? "Try adjusting your search or filters"
                  : "Start by adding your first insurance policy"
                }
              </p>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Add Policy
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInsurance.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.policyNumber}</TableCell>
                    <TableCell>{policy.type}</TableCell>
                    <TableCell>{policy.provider}</TableCell>
                    <TableCell>${(policy.coverage / 1000000).toFixed(1)}M</TableCell>
                    <TableCell>${policy.premium.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                        {policy.effectiveDate}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                        {policy.expirationDate}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(policy.status)} className="flex items-center gap-1">
                        {getStatusIcon(policy.status)}
                        {policy.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{policy.agent}</div>
                        <div className="flex items-center text-muted-foreground">
                          <Phone className="h-3 w-3 mr-1" />
                          {policy.agentPhone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}