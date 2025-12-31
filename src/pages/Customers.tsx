import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, Mail, Phone, Briefcase } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";

interface Customer {
  id: string;
  name: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  current_balance: number;
  is_active: boolean;
  job_count: number;
}

export default function Customers() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (currentCompany?.id) {
      loadCustomers();
    }
  }, [currentCompany?.id]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      
      // Load customers
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("id, name, display_name, email, phone, city, state, current_balance, is_active")
        .eq("company_id", currentCompany!.id)
        .order("name");

      if (customerError) throw customerError;

      // Load job counts per customer
      const { data: jobCounts, error: jobError } = await supabase
        .from("jobs")
        .select("customer_id")
        .eq("company_id", currentCompany!.id)
        .not("customer_id", "is", null);

      if (jobError) throw jobError;

      // Count jobs per customer
      const countMap = new Map<string, number>();
      jobCounts?.forEach(job => {
        if (job.customer_id) {
          countMap.set(job.customer_id, (countMap.get(job.customer_id) || 0) + 1);
        }
      });

      // Merge counts into customer data
      const customersWithCounts = (customerData || []).map(c => ({
        ...c,
        job_count: countMap.get(c.id) || 0
      }));

      setCustomers(customersWithCounts);
    } catch (error: any) {
      console.error("Error loading customers:", error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalBalance = filteredCustomers.reduce((sum, c) => sum + (c.current_balance || 0), 0);

  const handleJobsClick = (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    navigate(`/jobs?customerId=${customerId}`);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer accounts</p>
        </div>
        <Button onClick={() => navigate("/receivables/customers/add")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.filter(c => c.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(totalBalance)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Customer List</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "No customers match your search" : "No customers found. Add your first customer to get started."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Jobs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/receivables/customers/${customer.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{customer.display_name || customer.name}</div>
                          {customer.display_name && (
                            <div className="text-sm text-muted-foreground">{customer.name}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {customer.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {customer.email}
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {customer.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.city && customer.state
                        ? `${customer.city}, ${customer.state}`
                        : customer.city || customer.state || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {customer.job_count > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleJobsClick(e, customer.id)}
                          className="h-8 gap-1"
                        >
                          <Briefcase className="h-3 w-3" />
                          {customer.job_count}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.is_active ? "default" : "secondary"}>
                        {customer.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${formatNumber(customer.current_balance || 0)}
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
