import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FileText, Calendar, Building2, Users, ChevronRight, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface RFP {
  id: string;
  rfp_number: string;
  title: string;
  description: string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  job_id: string | null;
  created_at: string;
  job?: {
    name: string;
  };
  bid_count?: number;
}

export default function RFPs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [rfps, setRfps] = useState<RFP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const jobIdFilter = searchParams.get('jobId');

  useEffect(() => {
    if (currentCompany?.id) {
      loadRFPs();
    }
  }, [currentCompany?.id, jobIdFilter]);

  const loadRFPs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('rfps')
        .select(`
          *,
          job:jobs(name),
          bids(id)
        `)
        .eq('company_id', currentCompany!.id)
        .order('created_at', { ascending: false });
      
      if (jobIdFilter) {
        query = query.eq('job_id', jobIdFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const rfpsWithCount = (data || []).map(rfp => ({
        ...rfp,
        bid_count: rfp.bids?.length || 0,
        bids: undefined
      }));

      setRfps(rfpsWithCount);
    } catch (error: any) {
      console.error('Error loading RFPs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RFPs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      issued: { variant: 'default', label: 'Issued' },
      closed: { variant: 'outline', label: 'Closed' },
      awarded: { variant: 'default', label: 'Awarded' },
      cancelled: { variant: 'destructive', label: 'Cancelled' }
    };
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredRFPs = rfps.filter(rfp => {
    const matchesSearch = 
      rfp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfp.rfp_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rfp.job?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    
    const matchesStatus = statusFilter === 'all' || rfp.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">RFPs</h1>
        </div>
        <Button onClick={() => navigate('/construction/rfps/add')}>
          <Plus className="h-4 w-4 mr-2" />
          New RFP
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, number, or job..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="awarded">Awarded</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rfps.length}</p>
                <p className="text-sm text-muted-foreground">Total RFPs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Calendar className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rfps.filter(r => r.status === 'issued').length}</p>
                <p className="text-sm text-muted-foreground">Active RFPs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Users className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rfps.reduce((acc, r) => acc + (r.bid_count || 0), 0)}</p>
                <p className="text-sm text-muted-foreground">Total Bids</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <Building2 className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rfps.filter(r => r.status === 'awarded').length}</p>
                <p className="text-sm text-muted-foreground">Awarded</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RFPs Table */}
      <Card>
        <CardHeader>
          <CardTitle>All RFPs</CardTitle>
          <CardDescription>
            {filteredRFPs.length} RFP{filteredRFPs.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredRFPs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No RFPs Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Create your first RFP to get started'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => navigate('/construction/rfps/add')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create RFP
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFP #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Bids</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRFPs.map((rfp) => (
                  <TableRow 
                    key={rfp.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/construction/rfps/${rfp.id}`)}
                  >
                    <TableCell className="font-medium">{rfp.rfp_number}</TableCell>
                    <TableCell>{rfp.title}</TableCell>
                    <TableCell>
                      {rfp.job ? (
                        <span className="text-sm">
                          {rfp.job.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(rfp.status)}</TableCell>
                    <TableCell>
                      {rfp.due_date ? format(new Date(rfp.due_date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rfp.bid_count || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
