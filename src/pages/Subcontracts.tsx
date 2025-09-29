import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";
import PayablesViewSelector from "@/components/PayablesViewSelector";
import { usePayablesViewPreference } from "@/hooks/usePayablesViewPreference";

export default function Subcontracts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  
  const [subcontracts, setSubcontracts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobFilter, setJobFilter] = useState("all");
  
  const { currentView, setCurrentView, setAsDefault, isDefault } = usePayablesViewPreference('subcontracts');

  useEffect(() => {
    fetchData();
  }, [currentCompany, profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const companyId = currentCompany?.id || profile?.current_company_id;
      if (!companyId) return;

      // Fetch subcontracts with related data
      const { data: subcontractsData, error: subcontractsError } = await supabase
        .from('subcontracts')
        .select(`
          *,
          jobs!inner(id, name, company_id),
          vendors(id, name)
        `)
        .eq('jobs.company_id', companyId)
        .order('created_at', { ascending: false });

      if (subcontractsError) throw subcontractsError;
      setSubcontracts(subcontractsData || []);

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
        description: "Failed to load subcontracts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSubcontracts = subcontracts.filter(subcontract => {
    const matchesSearch = 
      subcontract.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subcontract.vendors?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subcontract.jobs?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || subcontract.status === statusFilter;
    const matchesJob = jobFilter === "all" || subcontract.job_id === jobFilter;
    
    return matchesSearch && matchesStatus && matchesJob;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
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
          <h1 className="text-3xl font-bold text-foreground">Subcontracts</h1>
          <p className="text-muted-foreground">Manage your subcontract agreements</p>
        </div>
        <div className="flex gap-2">
          <PayablesViewSelector
            currentView={currentView}
            onViewChange={setCurrentView}
            onSetDefault={setAsDefault}
            isDefault={isDefault}
          />
          <Button onClick={() => navigate('/subcontracts/add')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Subcontract
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subcontracts..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
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

      {/* Subcontracts List */}
      <div className="grid gap-4">
        {filteredSubcontracts.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                No subcontracts found
              </div>
            </CardContent>
          </Card>
        ) : currentView === 'list' ? (
          // List View
          filteredSubcontracts.map((subcontract) => (
            <Card 
              key={subcontract.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/subcontracts/${subcontract.id}`)}
            >
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="md:col-span-2">
                    <h3 className="font-semibold text-lg text-foreground">{subcontract.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Vendor: {subcontract.vendors?.name || 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Job: {subcontract.jobs?.name || 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Amount</p>
                    <p className="font-semibold text-foreground">${formatNumber(subcontract.contract_amount)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Dates</p>
                    <p className="text-sm text-foreground">
                      {subcontract.start_date ? format(new Date(subcontract.start_date), 'MMM d, yyyy') : 'No start date'}
                      {subcontract.end_date && ` - ${format(new Date(subcontract.end_date), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge className={`${getStatusColor(subcontract.status)} text-white`}>
                      {subcontract.status}
                    </Badge>
                  </div>
                </div>
                
                {subcontract.description && (
                  <p className="text-sm text-muted-foreground mt-4">{subcontract.description}</p>
                )}
              </CardContent>
            </Card>
          ))
        ) : currentView === 'compact' ? (
          // Compact View
          filteredSubcontracts.map((subcontract) => (
            <Card 
              key={subcontract.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/subcontracts/${subcontract.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{subcontract.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {subcontract.vendors?.name} • {subcontract.jobs?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">${formatNumber(subcontract.contract_amount)}</p>
                    <Badge className={`${getStatusColor(subcontract.status)} text-white mt-1 text-xs`}>
                      {subcontract.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          // Super Compact View
          filteredSubcontracts.map((subcontract) => (
            <Card 
              key={subcontract.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/subcontracts/${subcontract.id}`)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge className={`${getStatusColor(subcontract.status)} text-white flex-shrink-0 text-xs`}>
                      {subcontract.status}
                    </Badge>
                    <span className="font-medium text-foreground truncate">{subcontract.name}</span>
                    <span className="text-sm text-muted-foreground truncate">{subcontract.vendors?.name}</span>
                  </div>
                  <span className="font-semibold text-foreground whitespace-nowrap">
                    ${formatNumber(subcontract.contract_amount)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
