import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Building2, Mail, Phone, MapPin, FileText, DollarSign, Briefcase } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";

interface Customer {
  id: string;
  name: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  current_balance: number | null;
  credit_limit: number | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  total_amount: number;
  balance_due: number;
  status: string;
}

interface Job {
  id: string;
  name: string;
  status: string | null;
  address: string | null;
}

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id && id) {
      loadCustomer();
    }
  }, [currentCompany?.id, id]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      
      // Load customer details
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .eq("company_id", currentCompany!.id)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Load invoices for this customer
      const { data: invoiceData } = await supabase
        .from("ar_invoices")
        .select("id, invoice_number, issue_date, due_date, total_amount, balance_due, status")
        .eq("customer_id", id)
        .eq("company_id", currentCompany!.id)
        .order("issue_date", { ascending: false });

      setInvoices(invoiceData || []);

      // Load jobs for this customer
      const { data: jobData } = await supabase
        .from("jobs")
        .select("id, name, status, address")
        .eq("customer_id", id)
        .eq("company_id", currentCompany!.id)
        .order("name");

      setJobs(jobData || []);
    } catch (error: any) {
      console.error("Error loading customer:", error);
      toast({
        title: "Error",
        description: "Failed to load customer details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-100 text-green-800";
      case "sent": return "bg-blue-100 text-blue-800";
      case "overdue": return "bg-red-100 text-red-800";
      case "partial": return "bg-amber-100 text-amber-800";
      case "active": return "bg-green-100 text-green-800";
      case "completed": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">Loading customer details...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/receivables/customers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Customer Not Found</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">The requested customer could not be found.</p>
            <Button onClick={() => navigate("/receivables/customers")} className="mt-4">
              Return to Customers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/receivables/customers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{customer.display_name || customer.name}</h1>
              {customer.display_name && (
                <p className="text-muted-foreground">{customer.name}</p>
              )}
            </div>
          </div>
        </div>
        <Badge variant={customer.is_active ? "default" : "secondary"} className="text-sm">
          {customer.is_active ? "Active" : "Inactive"}
        </Badge>
        <Button variant="outline" onClick={() => navigate(`/receivables/customers/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${formatNumber(totalInvoiced)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">${formatNumber(totalOutstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">
            <Building2 className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-2" />
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="projects">
            <Briefcase className="h-4 w-4 mr-2" />
            Projects ({jobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {customer.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.email}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {(customer.address || customer.city) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      {customer.address && <div>{customer.address}</div>}
                      {(customer.city || customer.state || customer.zip_code) && (
                        <div>
                          {customer.city && `${customer.city}, `}
                          {customer.state} {customer.zip_code}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {customer.contact_name && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Primary Contact</h4>
                    <div className="space-y-2">
                      <div className="font-medium">{customer.contact_name}</div>
                      {customer.contact_email && (
                        <div className="text-sm text-muted-foreground">{customer.contact_email}</div>
                      )}
                      {customer.contact_phone && (
                        <div className="text-sm text-muted-foreground">{customer.contact_phone}</div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Payment Terms</div>
                    <div className="font-medium">{customer.payment_terms || "Net 30"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Credit Limit</div>
                    <div className="font-medium">
                      {customer.credit_limit ? `$${formatNumber(customer.credit_limit)}` : "No limit"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Current Balance</div>
                    <div className="font-medium">${formatNumber(customer.current_balance || 0)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Customer Since</div>
                    <div className="font-medium">
                      {format(new Date(customer.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>

                {customer.notes && (
                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground mb-2">Notes</div>
                    <p className="text-sm">{customer.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Invoices</CardTitle>
                <Button onClick={() => navigate(`/receivables/invoices/add?customerId=${id}`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No invoices found for this customer
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/receivables/invoices/${invoice.id}`)}
                      >
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{format(new Date(invoice.issue_date), "MM/dd/yyyy")}</TableCell>
                        <TableCell>
                          {invoice.due_date ? format(new Date(invoice.due_date), "MM/dd/yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">${formatNumber(invoice.total_amount)}</TableCell>
                        <TableCell className={`text-right font-medium ${invoice.balance_due > 0 ? "text-amber-600" : "text-green-600"}`}>
                          ${formatNumber(invoice.balance_due)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No projects found for this customer
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow
                        key={job.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <TableCell className="font-medium">{job.name}</TableCell>
                        <TableCell>{job.address || "-"}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(job.status || "")}>
                            {job.status || "Unknown"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
