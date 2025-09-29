import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, [currentCompany, profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const companyId = currentCompany?.id || profile?.current_company_id;
      if (!companyId) return;

      // Fetch purchase orders with related data
      const { data: posData, error: posError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          jobs!inner(id, name, company_id),
          vendors(id, name)
        `)
        .eq('jobs.company_id', companyId)
        .order('created_at', { ascending: false });

      if (posError) throw posError;
      setPurchaseOrders(posData || []);

      // Fetch jobs for filter
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name');

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Fetch vendors
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name');

      if (vendorsError) throw vendorsError;
      setVendors(vendorsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load purchase orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchaseOrders = purchaseOrders.filter(po => {
    const matchesSearch = 
      po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.vendors?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.jobs?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    const matchesJob = jobFilter === "all" || po.job_id === jobFilter;
    
    return matchesSearch && matchesStatus && matchesJob;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'approved': return 'bg-green-500';
      case 'received': return 'bg-blue-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage your purchase orders</p>
        </div>
        <Button onClick={() => navigate('/purchase-orders/add')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Purchase Order
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search purchase orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Jobs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
              setJobFilter("all");
            }}>
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders List */}
      <div className="grid gap-4">
        {filteredPurchaseOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                No purchase orders found
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredPurchaseOrders.map((po) => (
            <Card key={po.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="md:col-span-2">
                    <h3 className="font-semibold text-lg text-foreground">PO #{po.po_number}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Vendor: {po.vendors?.name || 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Job: {po.jobs?.name || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-semibold text-foreground">${formatNumber(po.amount)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Order Date</p>
                    <p className="text-sm text-foreground">
                      {format(new Date(po.order_date), 'MMM d, yyyy')}
                    </p>
                    {po.expected_delivery && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Expected: {format(new Date(po.expected_delivery), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge className={`${getStatusColor(po.status)} text-white`}>
                      {po.status}
                    </Badge>
                  </div>
                </div>
                
                {po.description && (
                  <p className="text-sm text-muted-foreground mt-4">{po.description}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
