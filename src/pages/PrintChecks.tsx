import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, 
  Plus, 
  Search, 
  Calendar,
  Building,
  Edit,
  Trash2,
  Eye,
  Download,
  FileText
} from "lucide-react";

export default function PrintChecks() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChecks, setSelectedChecks] = useState<string[]>([]);

  const checks: any[] = [];

  const filteredChecks = checks.filter(check => {
    return check?.payee?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           check?.memo?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleSelectCheck = (checkId: string) => {
    setSelectedChecks(prev => 
      prev.includes(checkId) 
        ? prev.filter(id => id !== checkId)
        : [...prev, checkId]
    );
  };

  const handleSelectAll = () => {
    if (selectedChecks.length === filteredChecks.length) {
      setSelectedChecks([]);
    } else {
      setSelectedChecks(filteredChecks.map(check => check.id));
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Print Checks</h1>
          <p className="text-muted-foreground">
            Create, manage, and print checks for payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Print Selected
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Check
          </Button>
        </div>
      </div>

      {/* Check Creation Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create New Check</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="checkDate">Date</Label>
              <Input id="checkDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account">Bank Account</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Main Checking</SelectItem>
                  <SelectItem value="payroll">Payroll Account</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkNumber">Check Number</Label>
              <Input id="checkNumber" placeholder="Auto-generated" disabled />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="payee">Pay to the Order of</Label>
              <Input id="payee" placeholder="Payee name..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" placeholder="0.00" />
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            <Label htmlFor="memo">Memo</Label>
            <Textarea id="memo" placeholder="Check memo/description..." />
          </div>

          <div className="space-y-2 mb-4">
            <Label htmlFor="address">Payee Address (Optional)</Label>
            <Textarea id="address" placeholder="Payee mailing address..." />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline">Save as Draft</Button>
            <Button>Create & Queue for Print</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Print</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Checks ready to print</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Printed Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Checks printed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Checks</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Saved drafts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voided</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Bulk Actions */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search checks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {selectedChecks.length > 0 && (
                <Button variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Selected ({selectedChecks.length})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Check Register</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredChecks.length === 0 ? (
            <div className="text-center py-8">
              <Printer className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No checks found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "Try adjusting your search"
                  : "Start by creating your first check"
                }
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Check
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedChecks.length === filteredChecks.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Check #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChecks.map((check) => (
                  <TableRow key={check.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedChecks.includes(check.id)}
                        onCheckedChange={() => handleSelectCheck(check.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{check.checkNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                        {check.date}
                      </div>
                    </TableCell>
                    <TableCell>{check.payee}</TableCell>
                    <TableCell className="font-semibold">${check.amount}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Building className="h-3 w-3 mr-1 text-muted-foreground" />
                        {check.account}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        check.status === "printed" ? "default" :
                        check.status === "draft" ? "secondary" :
                        check.status === "voided" ? "destructive" : "outline"
                      }>
                        {check.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
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