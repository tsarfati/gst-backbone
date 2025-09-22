import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, DollarSign, Calendar, Building, Filter } from "lucide-react";

const mockBills: any[] = [];

const getStatusVariant = (status: string) => {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "overdue":
      return "destructive";
    default:
      return "default";
  }
};

export default function Bills() {
  const navigate = useNavigate();
  const [jobFilter, setJobFilter] = useState("all");

  const filteredBills = jobFilter === "all" 
    ? mockBills 
    : mockBills.filter(bill => bill.job === jobFilter);

  const uniqueJobs: string[] = [];

  const totalPending = 0;
  const totalOverdue = 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bills</h1>
          <p className="text-muted-foreground">
            Track bill payments and manage vendor billing
          </p>
        </div>
        <Button onClick={() => navigate("/invoices/add")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Bill
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Bills
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <Badge variant="warning" className="mt-2">
              0 bills
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overdue Bills
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <Badge variant="destructive" className="mt-2">
              0 bills
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Paid This Month
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <Badge variant="success" className="mt-2">
              0 bills
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Bills</CardTitle>
              {uniqueJobs.length > 0 && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={jobFilter} onValueChange={setJobFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by job" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jobs</SelectItem>
                      {uniqueJobs.map(job => (
                        <SelectItem key={job} value={job}>{job}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill ID</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No bills found</p>
                      <p className="text-sm">Upload your first bill to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBills.map((bill) => (
                  <TableRow 
                    key={bill.id} 
                    className={`cursor-pointer hover:bg-muted/50 ${
                      bill.status === 'overdue' ? 'animate-pulse-red' : ''
                    }`}
                    onClick={() => navigate(`/invoices/${bill.id}`)}
                  >
                    <TableCell className="font-medium">{bill.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                        {bill.vendor}
                      </div>
                    </TableCell>
                    <TableCell>{bill.job}</TableCell>
                    <TableCell className="font-semibold">{bill.amount}</TableCell>
                    <TableCell>{bill.issueDate}</TableCell>
                    <TableCell>{bill.dueDate}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(bill.status)}>
                        {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                    <Button 
                      size="sm"
                      onClick={() => navigate(`/bills/${bill.id}`)}
                    >
                      View Details
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate('/banking/make-payment')}
                    >
                      Create Payment
                    </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}